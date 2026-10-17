import { DistrictScenario, DistrictMetrics, PathResult, CriticalBottleneck } from './types';
import { buildAdjacency, findShortestPath } from './dijkstra';
import { computePolygonAreaM2, resolveGateNodeId } from './geometry';

export const INFRA_COSTS = {
  add_crossing: 320_000,
  add_underpass: 1_450_000,
  upgrade_4_lanes: 850_000,
  add_sidewalk: 210_000,
  create_roundabout: 1_100_000,
  relocate_bus_stop: 450_000,
  add_park: 650_000,
  add_school: 900_000,
  // Перепрофилирование корпуса под соцобъект (тег через ПКМ-меню дома):
  // дешевле новостроя, но не бесплатно.
  tag_school: 600_000,
  tag_police: 400_000,
  tag_hospital: 700_000,
  tag_shop: 250_000,
  block_street: 40_000,
  build_new_tower: 1_200_000,
};

export const BUDGET_LIMIT_RUB = 5_000_000;

// Переиспользуемый конфиг города: все пороги в одном месте,
// чтобы другой район подключать без правки кода движка.
export const CITY_DEFAULTS = {
  walkMMin: 75, // 4.5 км/ч
  parkDefaultRadiusM: 350,
  schoolDefaultRadiusM: 500,
  serviceDefaultRadiusM: 500, // Теги корпусов: школа/полиция/больница/магазин
  busDefaultRadiusM: 500,
  isolationPenaltyM: 3000,
  bottleneckThreshold: 400,
  iso5M: 375, // 5 мин
  iso10M: 750, // 10 мин
  pointParkAreaM2: 4200, // заглушка сквера без полигона
};

function medianOf(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? Math.round((sorted[mid - 1] + sorted[mid]) / 2) : sorted[mid];
}

function percentile90(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.9) - 1);
  return sorted[idx];
}

// --- Персональный аудит «До / После»: кому стало лучше, кому хуже ---
// Порог ±5 м гасит шум округления координат. Дома, которых не было в базе
// (новострой), и снесённые — отдельными строками, а не «плюсом/минусом»:
// у них нет корректного «было».
export interface BuildingImpact {
  id: string;
  name: string;
  residents: number;
  beforeM: number | null;
  afterM: number;
  deltaM: number | null;
}

export interface ResidentImpactSummary {
  improvedResidents: number;
  worsenedResidents: number;
  unchangedResidents: number;
  addedResidents: number;
  removedResidents: number;
  maxSavedMeters: number;
  maxLossMeters: number;
  buildings: BuildingImpact[];
}

const IMPACT_NOISE_M = 5;

export function computeResidentImpact(
  currentScenario: DistrictScenario,
  baseScenario: DistrictScenario,
  current: DistrictMetrics,
  base: DistrictMetrics,
): ResidentImpactSummary {
  const summary: ResidentImpactSummary = {
    improvedResidents: 0,
    worsenedResidents: 0,
    unchangedResidents: 0,
    addedResidents: 0,
    removedResidents: 0,
    maxSavedMeters: 0,
    maxLossMeters: 0,
    buildings: [],
  };
  const distOf = (paths: Record<string, PathResult | null>, id: string): number | null => {
    const p = paths[id];
    return p ? p.distanceM : null;
  };
  // Оцениваем только жилые дома (без социальных тегов school/police/hospital/shop:
  // у них нет жителей, они точки обслуживания, а не источник спроса).
  const currentResidential = currentScenario.buildings.filter((b) => !b.tag);
  const baseResidential = baseScenario.buildings.filter((b) => !b.tag);

  for (const b of currentResidential) {
    const after = distOf(current.busPaths, b.id) ?? CITY_DEFAULTS.isolationPenaltyM;
    const beforeRaw = distOf(base.busPaths, b.id);
    if (beforeRaw === null && !(b.id in base.busPaths)) {
      // Дома не было в базе — новострой, сравнивать не с чем.
      summary.addedResidents += b.residents;
      summary.buildings.push({ id: b.id, name: b.name, residents: b.residents, beforeM: null, afterM: after, deltaM: null });
      continue;
    }
    const before = beforeRaw ?? CITY_DEFAULTS.isolationPenaltyM;
    const delta = after - before;
    summary.buildings.push({ id: b.id, name: b.name, residents: b.residents, beforeM: before, afterM: after, deltaM: delta });
    if (delta < -IMPACT_NOISE_M) {
      summary.improvedResidents += b.residents;
      summary.maxSavedMeters = Math.max(summary.maxSavedMeters, Math.abs(delta));
    } else if (delta > IMPACT_NOISE_M) {
      summary.worsenedResidents += b.residents;
      summary.maxLossMeters = Math.max(summary.maxLossMeters, delta);
    } else {
      summary.unchangedResidents += b.residents;
    }
  }
  // Снесённые: были в базе, в текущем нет (только жилые).
  const currentIds = new Set(currentResidential.map((b) => b.id));
  for (const b of baseResidential) {
    if (!currentIds.has(b.id)) summary.removedResidents += b.residents;
  }
  return summary;
}

export function calculateMetrics(scenario: DistrictScenario, baseScenario: DistrictScenario): DistrictMetrics {
  const adj = buildAdjacency(scenario.nodes, scenario.edges);
  const busAmenities = scenario.amenities.filter((a) => a.type === 'bus_stop');
  const parkAmenities = scenario.amenities.filter((a) => a.type === 'park');
  const schoolAmenities = scenario.amenities.filter((a) => a.type === 'school');

  const nodeCoords = new Map(scenario.nodes.map((n) => [n.id, n]));
  const edgeTypeById = new Map(scenario.edges.map((e) => [e.id, e.type]));

  let totalResidents = 0;
  let weightedBusDistanceSum = 0;
  let parkCoveredResidents = 0;
  let schoolCoveredResidents = 0;
  let policeCoveredResidents = 0;
  let hospitalCoveredResidents = 0;
  let shopCoveredResidents = 0;
  let iso5Residents = 0;
  let iso10Residents = 0;
  let bikeCoveredResidents = 0;
  let accessiblePathCount = 0;
  let detourSum = 0;
  let detourCount = 0;

  const busPaths: Record<string, PathResult | null> = {};
  const parkPaths: Record<string, PathResult | null> = {};
  const schoolPaths: Record<string, PathResult | null> = {};
  const policePaths: Record<string, PathResult | null> = {};
  const hospitalPaths: Record<string, PathResult | null> = {};
  const shopPaths: Record<string, PathResult | null> = {};
  const edgeLoads: Record<string, number> = {};
  const busDistances: number[] = [];

  const edgeIdLookup = new Map<string, string>();
  for (const e of scenario.edges) {
    edgeIdLookup.set(`${e.from}->${e.to}`, e.id);
    edgeIdLookup.set(`${e.to}->${e.from}`, e.id);
  }

  const pathEdgeIds = (path: PathResult | null): string[] => {
    if (!path) return [];
    const ids: string[] = [];
    for (let i = 0; i < path.pathNodeIds.length - 1; i++) {
      const eId = edgeIdLookup.get(`${path.pathNodeIds[i]}->${path.pathNodeIds[i + 1]}`);
      if (eId) ids.push(eId);
    }
    return ids;
  };

  // Точки обслуживания: отдельно стоящие объекты + корпуса с тегами
  // (тег работает через gateNodeId корпуса, радиус — дефолтный 500).
  interface ServicePoint {
    nodeId: string;
    radiusM: number;
  }
  const taggedPoints = (tag: 'school' | 'police' | 'hospital' | 'shop'): ServicePoint[] =>
    scenario.buildings
      .filter((b) => b.tag === tag)
      .map((b) => ({
        nodeId: resolveGateNodeId(scenario.nodes, b.gateNodeId, b.x, b.y),
        radiusM: CITY_DEFAULTS.serviceDefaultRadiusM,
      }));
  const schoolPoints: ServicePoint[] = [
    ...schoolAmenities.map((s) => ({
      nodeId: s.nodeId,
      radiusM: s.coverageRadiusM || CITY_DEFAULTS.schoolDefaultRadiusM,
    })),
    ...taggedPoints('school'),
  ];
  const policePoints = taggedPoints('police');
  const hospitalPoints = taggedPoints('hospital');
  const shopPoints = taggedPoints('shop');

  // Лучший путь Дейкстры до ближайшей точки обслуживания + флаг покрытия.
  // Покрытие проверяется по собственному радиусу КАЖДОЙ точки, а не радиусу
  // ближайшей: близкая школа с маленьким радиусом не должна затенять дальнюю
  // с большим (раньше дом считался непокрытым в таком кейсе).
  const bestService = (gateNodeId: string, points: ServicePoint[]) => {
    let best: PathResult | null = null;
    let covered = false;
    for (const sp of points) {
      const p = findShortestPath(gateNodeId, sp.nodeId, adj);
      if (!p) continue;
      if (!best || p.distanceM < best.distanceM) best = p;
      if (p.distanceM <= sp.radiusM) covered = true;
    }
    return { best, covered };
  };

  // Жителями обладают ТОЛЬКО жилые здания (без тегов school, police, hospital, shop).
  const residentialBuildings = scenario.buildings.filter((b) => !b.tag);

  for (const b of residentialBuildings) {
    totalResidents += b.residents;
    const gate = resolveGateNodeId(scenario.nodes, b.gateNodeId, b.x, b.y);

    // Путь к автобусной остановке
    let bestBusPath: PathResult | null = null;
    for (const bus of busAmenities) {
      const p = findShortestPath(gate, bus.nodeId, adj);
      if (p && (!bestBusPath || p.distanceM < bestBusPath.distanceM)) bestBusPath = p;
    }
    busPaths[b.id] = bestBusPath;

    if (bestBusPath) {
      weightedBusDistanceSum += bestBusPath.distanceM * b.residents;
      busDistances.push(bestBusPath.distanceM);
      if (bestBusPath.isFullyAccessible) accessiblePathCount += 1;
      if (bestBusPath.distanceM <= CITY_DEFAULTS.iso5M) iso5Residents += b.residents;
      if (bestBusPath.distanceM <= CITY_DEFAULTS.iso10M) iso10Residents += b.residents;

      // Detour-index: граф / евклидова.
      const from = nodeCoords.get(bestBusPath.fromNodeId);
      const to = nodeCoords.get(bestBusPath.toNodeId);
      if (from && to) {
        const euclid = Math.hypot(to.x - from.x, to.y - from.y);
        if (euclid >= 1) {
          detourSum += bestBusPath.distanceM / euclid;
          detourCount += 1;
        }
      }

      // Вело-доступ: путь использует велополосу.
      const usesBike = pathEdgeIds(bestBusPath).some((id) => edgeTypeById.get(id) === 'bike_lane');
      if (usesBike) bikeCoveredResidents += b.residents;

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
      weightedBusDistanceSum += CITY_DEFAULTS.isolationPenaltyM * b.residents;
      // Изолированный дом участвует в медиане/p90 тем же штрафом, что в среднем:
      // иначе отрезанный район показывал бы «идеальные нули».
      busDistances.push(CITY_DEFAULTS.isolationPenaltyM);
    }

    // Путь к парку (радиус — из карточки сквера, дефолт 350)
    let bestParkPath: PathResult | null = null;
    let parkCovered = false;
    for (const park of parkAmenities) {
      const p = findShortestPath(gate, park.nodeId, adj);
      if (!p) continue;
      if (!bestParkPath || p.distanceM < bestParkPath.distanceM) bestParkPath = p;
      const parkRadius = park.coverageRadiusM || CITY_DEFAULTS.parkDefaultRadiusM;
      if (p.distanceM <= parkRadius) parkCovered = true;
    }
    parkPaths[b.id] = bestParkPath;
    if (bestParkPath && parkCovered) {
      parkCoveredResidents += b.residents;
    }

    // Соцобъекты: школа (+ отдельно стоящие из старых сейвов), полиция,
    // больница, магазин — покрытие по Дейкстре, радиус 500.
    const school = bestService(gate, schoolPoints);
    schoolPaths[b.id] = school.best;
    if (school.best && school.covered) {
      schoolCoveredResidents += b.residents;
    }
    const police = bestService(gate, policePoints);
    policePaths[b.id] = police.best;
    if (police.best && police.covered) {
      policeCoveredResidents += b.residents;
    }
    const hospital = bestService(gate, hospitalPoints);
    hospitalPaths[b.id] = hospital.best;
    if (hospital.best && hospital.covered) {
      hospitalCoveredResidents += b.residents;
    }
    const shop = bestService(gate, shopPoints);
    shopPaths[b.id] = shop.best;
    if (shop.best && shop.covered) {
      shopCoveredResidents += b.residents;
    }
  }

  // Определение критических зон (бутылочных горлышек)
  const bottlenecks: CriticalBottleneck[] = [];
  for (const [eId, load] of Object.entries(edgeLoads)) {
    if (load > CITY_DEFAULTS.bottleneckThreshold) {
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
  const weightedAvgBusTimeMin = Number((weightedAvgBusDistM / CITY_DEFAULTS.walkMMin).toFixed(1));
  const parkAccessPercent = totalResidents > 0 ? Math.round((parkCoveredResidents / totalResidents) * 100) : 0;
  const schoolAccessPercent = totalResidents > 0 ? Math.round((schoolCoveredResidents / totalResidents) * 100) : 0;
  const policeAccessPercent = totalResidents > 0 ? Math.round((policeCoveredResidents / totalResidents) * 100) : 0;
  const hospitalAccessPercent = totalResidents > 0 ? Math.round((hospitalCoveredResidents / totalResidents) * 100) : 0;
  const shopAccessPercent = totalResidents > 0 ? Math.round((shopCoveredResidents / totalResidents) * 100) : 0;
  const iso5BusPercent = totalResidents > 0 ? Math.round((iso5Residents / totalResidents) * 100) : 0;
  const iso10BusPercent = totalResidents > 0 ? Math.round((iso10Residents / totalResidents) * 100) : 0;
  const bikeAccessPercent = totalResidents > 0 ? Math.round((bikeCoveredResidents / totalResidents) * 100) : 0;
  const mobilityIndex = residentialBuildings.length > 0 ? Math.round((accessiblePathCount / residentialBuildings.length) * 100) : 0;
  const avgDetourIndex = detourCount > 0 ? Number((detourSum / detourCount).toFixed(2)) : 0;

  // Зелень: сумма полигонов скверов (+ заглушка под точечные) на жителя.
  let greenAreaM2 = 0;
  for (const park of parkAmenities) {
    if (park.polygon && park.polygon.length >= 3) greenAreaM2 += computePolygonAreaM2(park.polygon);
    else greenAreaM2 += CITY_DEFAULTS.pointParkAreaM2;
  }
  const greenM2PerResident = totalResidents > 0 ? Number((greenAreaM2 / totalResidents).toFixed(1)) : 0;

  // Расчёт бюджета
  void baseScenario;
  let budgetSpentRub = 0;
  for (const e of scenario.edges) {
    if (e.isCustom) {
      if (e.type === 'crossing') budgetSpentRub += INFRA_COSTS.add_crossing;
      if (e.type === 'underpass') budgetSpentRub += INFRA_COSTS.add_underpass;
      // Полосы/тротуары оплачиваются только если построены в сессии:
      // наследники разреза/кольца/ремонта (inherited*) их уже имели.
      if (e.lanes === 4 && !e.inheritedLanes) budgetSpentRub += INFRA_COSTS.upgrade_4_lanes;
      if (e.hasSidewalkLeft && !e.inheritedSidewalkLeft) budgetSpentRub += INFRA_COSTS.add_sidewalk;
      if (e.hasSidewalkRight && !e.inheritedSidewalkRight) budgetSpentRub += INFRA_COSTS.add_sidewalk;
    }
    if (!e.isActive) budgetSpentRub += INFRA_COSTS.block_street;
  }
  budgetSpentRub += scenario.nodes.filter((n) => n.isCustom && n.type === 'roundabout').length * INFRA_COSTS.create_roundabout;
  budgetSpentRub += scenario.amenities.filter((a) => a.isCustom && a.type === 'park').length * INFRA_COSTS.add_park;
  budgetSpentRub += scenario.amenities.filter((a) => a.isCustom && a.type === 'school').length * INFRA_COSTS.add_school;
  budgetSpentRub += scenario.amenities.filter((a) => a.isCustom && a.type === 'bus_stop').length * INFRA_COSTS.relocate_bus_stop;
  budgetSpentRub += residentialBuildings.filter((b) => b.isCustom).length * INFRA_COSTS.build_new_tower;
  // Теги корпусов: платит только тег, назначенный в этой сессии (tagCustom),
  // чтобы старый корпус из сейва не влетал в build_new_tower.
  for (const b of scenario.buildings) {
    if (!b.tag || !b.tagCustom) continue;
    if (b.tag === 'school') budgetSpentRub += INFRA_COSTS.tag_school;
    if (b.tag === 'police') budgetSpentRub += INFRA_COSTS.tag_police;
    if (b.tag === 'hospital') budgetSpentRub += INFRA_COSTS.tag_hospital;
    if (b.tag === 'shop') budgetSpentRub += INFRA_COSTS.tag_shop;
  }

  return {
    weightedAvgBusDistM,
    weightedAvgBusTimeMin,
    medianBusDistM: medianOf(busDistances),
    p90BusDistM: percentile90(busDistances),
    parkAccessPercent,
    parkCoveredResidents,
    schoolAccessPercent,
    schoolCoveredResidents,
    policeAccessPercent,
    policeCoveredResidents,
    hospitalAccessPercent,
    hospitalCoveredResidents,
    shopAccessPercent,
    shopCoveredResidents,
    avgDetourIndex,
    iso5BusPercent,
    iso10BusPercent,
    greenM2PerResident,
    bikeAccessPercent,
    totalResidents,
    mobilityIndex,
    budgetSpentRub,
    budgetLimitRub: BUDGET_LIMIT_RUB,
    costPerCapitaRub: totalResidents > 0 ? Math.round(budgetSpentRub / totalResidents) : 0,
    busPaths,
    parkPaths,
    schoolPaths,
    policePaths,
    hospitalPaths,
    shopPaths,
    edgeLoads,
    bottlenecks,
  };
}
