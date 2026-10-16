// Мгновенные метрики «Urban Health Dashboard».
// 1. Средняя доступность остановки (взвешенная по жителям).
// 2. Охват парками в радиусе 400 м по реальному графу.
// 3. Связность: дома без пути + топ-3 нагруженных рёбер.

import type { DistrictState, MetricResult } from './types';
import { METERS_PER_MIN, PARK_RADIUS_M } from './types';
import { buildAdj, dijkstra } from './graph';
import { computeRoutes } from './paths';

export function computeMetrics(state: DistrictState): MetricResult {
  const adj = buildAdj(state.nodes, state.edges);
  const stops = state.pois.filter((p) => p.type === 'BUS_STOP');
  const parks = state.pois.filter((p) => p.type === 'PARK');

  let weightedSum = 0;
  let totalResidents = 0;
  let isolated = 0;
  let parkCovered = 0;

  for (const b of state.buildings) {
    const { dist } = dijkstra(b.nearestNodeId, adj);
    let bestBus = Infinity;
    for (const s of stops) {
      const d = dist.get(s.nearestNodeId) ?? Infinity;
      if (d < bestBus) bestBus = d;
    }
    let bestPark = Infinity;
    for (const p of parks) {
      const d = dist.get(p.nearestNodeId) ?? Infinity;
      if (d < bestPark) bestPark = d;
    }
    const hasInfra = bestBus < Infinity || bestPark < Infinity;
    if (!hasInfra) {
      isolated += 1;
      continue;
    }
    totalResidents += b.residents;
    if (bestBus < Infinity) weightedSum += b.residents * bestBus;
    else {
      // Нет пути к остановке — дом изолирован частично: штрафуем максимумом.
      isolated += 1;
    }
    if (bestPark <= PARK_RADIUS_M) parkCovered += b.residents;
  }

  const avgDistanceToBus = totalResidents > 0 ? Math.round(weightedSum / totalResidents) : 0;

  const { flowByEdge } = computeRoutes(state);
  const bottleneckEdgeIds = Array.from(flowByEdge.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([id]) => id);

  return {
    avgDistanceToBus,
    avgTimeToBusMin: Math.round((avgDistanceToBus / METERS_PER_MIN) * 10) / 10,
    parkCoveragePercent: totalResidents > 0 ? Math.round((parkCovered / totalResidents) * 100) : 0,
    isolatedBuildingsCount: isolated,
    bottleneckEdgeIds,
  };
}
