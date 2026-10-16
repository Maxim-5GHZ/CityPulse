import { DistrictScenario, DistrictMetrics, PathResult } from './types';
import { buildAdjacency, findShortestPath } from './dijkstra';

export const INFRA_COSTS = {
  add_crossing: 320_000,
  relocate_bus_stop: 450_000,
  add_park: 650_000,
  block_street: 40_000,
  build_new_tower: 1_200_000,
};

export const BUDGET_LIMIT_RUB = 2_500_000;

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

  for (const b of scenario.buildings) {
    totalResidents += b.residents;
    let bestBusPath: PathResult | null = null;
    for (const bus of busAmenities) {
      const p = findShortestPath(b.gateNodeId, bus.nodeId, adj);
      if (p && (!bestBusPath || p.distanceM < bestBusPath.distanceM)) bestBusPath = p;
    }
    busPaths[b.id] = bestBusPath;
    if (bestBusPath) {
      weightedBusDistanceSum += bestBusPath.distanceM * b.residents;
      if (bestBusPath.isFullyAccessible) accessiblePathCount += 1;
    } else {
      weightedBusDistanceSum += 1600 * b.residents;
    }
    let bestParkPath: PathResult | null = null;
    for (const park of parkAmenities) {
      const p = findShortestPath(b.gateNodeId, park.nodeId, adj);
      if (p && (!bestParkPath || p.distanceM < bestParkPath.distanceM)) bestParkPath = p;
    }
    parkPaths[b.id] = bestParkPath;
    if (bestParkPath && bestParkPath.distanceM <= 350) parkCoveredResidents += b.residents;
  }

  const weightedAvgBusDistM = totalResidents > 0 ? Math.round(weightedBusDistanceSum / totalResidents) : 0;
  const weightedAvgBusTimeMin = Number((weightedAvgBusDistM / 75).toFixed(1));
  const parkAccessPercent = totalResidents > 0 ? Math.round((parkCoveredResidents / totalResidents) * 100) : 0;
  const mobilityIndex = scenario.buildings.length > 0 ? Math.round((accessiblePathCount / scenario.buildings.length) * 100) : 0;

  let budgetSpentRub = 0;
  const customCrossings = scenario.edges.filter((e) => e.isCustom && e.type === 'crossing').length;
  budgetSpentRub += customCrossings * INFRA_COSTS.add_crossing;
  const movedStops = scenario.amenities.filter(
    (a) => a.type === 'bus_stop' && !baseScenario.amenities.some((base) => base.nodeId === a.nodeId),
  ).length;
  budgetSpentRub += movedStops * INFRA_COSTS.relocate_bus_stop;
  const customParks = scenario.amenities.filter((a) => a.isCustom && a.type === 'park').length;
  budgetSpentRub += customParks * INFRA_COSTS.add_park;
  const customBuildings = scenario.buildings.filter((b) => b.isCustom).length;
  budgetSpentRub += customBuildings * INFRA_COSTS.build_new_tower;
  const blockedEdges = scenario.edges.filter((e) => !e.isActive).length;
  budgetSpentRub += blockedEdges * INFRA_COSTS.block_street;

  return {
    weightedAvgBusDistM, weightedAvgBusTimeMin, parkAccessPercent, parkCoveredResidents,
    totalResidents, mobilityIndex, budgetSpentRub, budgetLimitRub: BUDGET_LIMIT_RUB, busPaths, parkPaths,
  };
}
