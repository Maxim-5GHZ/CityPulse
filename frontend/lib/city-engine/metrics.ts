import { DistrictScenario, DistrictMetrics, PathResult, CriticalBottleneck } from './types';
import { buildAdjacency, findShortestPath } from './dijkstra';

export const INFRA_COSTS = {
  add_crossing: 320_000,
  add_underpass: 1_450_000,
  upgrade_4_lanes: 850_000,
  add_sidewalk: 210_000,
  create_roundabout: 1_100_000,
  relocate_bus_stop: 450_000,
  add_park: 650_000,
  block_street: 40_000,
  build_new_tower: 1_200_000,
};

export const BUDGET_LIMIT_RUB = 5_000_000;

export function calculateMetrics(scenario: DistrictScenario, baseScenario: DistrictScenario): DistrictMetrics {
  const adj = buildAdjacency(scenario.nodes, scenario.edges);
  const busAmenities = scenario.amenities.filter((a) => a.type === 'bus_stop');
  const parkAmenities = scenario.amenities.filter((a) => a.type === 'park');

  let totalResidents = 0;
  let weightedBusDistanceSum = 0;
  let parkCoveredResidents = 0;
  let accessiblePathCount = 0;

  const busPaths: Record<string, PathResult | null> = {};
  const parkPaths: Record<string, PathResult | null> = {};
  const edgeLoads: Record<string, number> = {};

  const edgeIdLookup = new Map<string, string>();
  for (const e of scenario.edges) {
    edgeIdLookup.set(`${e.from}->${e.to}`, e.id);
    edgeIdLookup.set(`${e.to}->${e.from}`, e.id);
  }

  for (const b of scenario.buildings) {
    totalResidents += b.residents;

    // Путь к автобусной остановке
    let bestBusPath: PathResult | null = null;
    for (const bus of busAmenities) {
      const p = findShortestPath(b.gateNodeId, bus.nodeId, adj);
      if (p && (!bestBusPath || p.distanceM < bestBusPath.distanceM)) bestBusPath = p;
    }
    busPaths[b.id] = bestBusPath;

    if (bestBusPath) {
      weightedBusDistanceSum += bestBusPath.distanceM * b.residents;
      if (bestBusPath.isFullyAccessible) accessiblePathCount += 1;

      // Трассировка нагрузки на пешеходный граф
      for (let i = 0; i < bestBusPath.pathNodeIds.length - 1; i++) {
        const u = bestBusPath.pathNodeIds[i];
        const v = bestBusPath.pathNodeIds[i + 1];
        const eId = edgeIdLookup.get(`${u}->${v}`);
        if (eId) {
          edgeLoads[eId] = (edgeLoads[eId] || 0) + b.residents;
        }
      }
    } else {
      weightedBusDistanceSum += 3000 * b.residents;
    }

    // Путь к парку
    let bestParkPath: PathResult | null = null;
    for (const park of parkAmenities) {
      const p = findShortestPath(b.gateNodeId, park.nodeId, adj);
      if (p && (!bestParkPath || p.distanceM < bestParkPath.distanceM)) bestParkPath = p;
    }
    parkPaths[b.id] = bestParkPath;
    if (bestParkPath && bestParkPath.distanceM <= 350) {
      parkCoveredResidents += b.residents;
    }
  }

  // Определение критических зон (бутылочных горлышек)
  const bottlenecks: CriticalBottleneck[] = [];
  for (const [eId, load] of Object.entries(edgeLoads)) {
    if (load > 400) {
      const edge = scenario.edges.find((e) => e.id === eId);
      const isCross = edge?.type === 'crossing' || edge?.type === 'underpass';
      bottlenecks.push({
        edgeId: eId,
        load,
        description: isCross
          ? `Перегруженный створ перехода: ${load} чел/час`
          : `Узкий коридор движения: ${load} чел/час`,
      });
    }
  }

  const weightedAvgBusDistM = totalResidents > 0 ? Math.round(weightedBusDistanceSum / totalResidents) : 0;
  const weightedAvgBusTimeMin = Number((weightedAvgBusDistM / 75).toFixed(1));
  const parkAccessPercent = totalResidents > 0 ? Math.round((parkCoveredResidents / totalResidents) * 100) : 0;
  const mobilityIndex = scenario.buildings.length > 0 ? Math.round((accessiblePathCount / scenario.buildings.length) * 100) : 0;

  // Расчёт бюджета
  void baseScenario;
  let budgetSpentRub = 0;
  for (const e of scenario.edges) {
    if (e.isCustom) {
      if (e.type === 'crossing') budgetSpentRub += INFRA_COSTS.add_crossing;
      if (e.type === 'underpass') budgetSpentRub += INFRA_COSTS.add_underpass;
      if (e.lanes === 4) budgetSpentRub += INFRA_COSTS.upgrade_4_lanes;
      if (e.hasSidewalkLeft) budgetSpentRub += INFRA_COSTS.add_sidewalk;
      if (e.hasSidewalkRight) budgetSpentRub += INFRA_COSTS.add_sidewalk;
    }
    if (!e.isActive) budgetSpentRub += INFRA_COSTS.block_street;
  }
  budgetSpentRub += scenario.nodes.filter((n) => n.isCustom && n.type === 'roundabout').length * INFRA_COSTS.create_roundabout;
  budgetSpentRub += scenario.amenities.filter((a) => a.isCustom && a.type === 'park').length * INFRA_COSTS.add_park;
  budgetSpentRub += scenario.buildings.filter((b) => b.isCustom).length * INFRA_COSTS.build_new_tower;

  return {
    weightedAvgBusDistM,
    weightedAvgBusTimeMin,
    parkAccessPercent,
    parkCoveredResidents,
    totalResidents,
    mobilityIndex,
    budgetSpentRub,
    budgetLimitRub: BUDGET_LIMIT_RUB,
    busPaths,
    parkPaths,
    edgeLoads,
    bottlenecks,
  };
}
