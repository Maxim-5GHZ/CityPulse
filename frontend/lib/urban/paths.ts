// Маршруты жителей и нагрузка рёбер: для тепловой карты и частиц.
// Каждый дом идёт к ближайшей остановке и ближайшему парку (Dijkstra).

import type { DistrictState } from './types';
import { buildAdj, dijkstra, pathEdges } from './graph';

export interface ResidentRoute {
  buildingId: string;
  residents: number;
  /** цепочка рёбер до цели */
  edgeIds: string[];
  /** длина пути с учётом переходов, метры */
  lengthM: number;
  kind: 'bus' | 'park';
}

/** Посчитать маршруты + проставить flowCount на рёбра (мутирует копию). */
export function computeRoutes(state: DistrictState): { routes: ResidentRoute[]; flowByEdge: Map<string, number> } {
  const adj = buildAdj(state.nodes, state.edges);
  const byId = new Map(state.edges.map((e) => [e.id, e]));
  const stops = state.pois.filter((p) => p.type === 'BUS_STOP');
  const parks = state.pois.filter((p) => p.type === 'PARK');
  const routes: ResidentRoute[] = [];
  const flowByEdge = new Map<string, number>();

  const add = (edgeIds: string[], residents: number) => {
    for (const id of edgeIds) flowByEdge.set(id, (flowByEdge.get(id) ?? 0) + residents);
  };

  for (const b of state.buildings) {
    const { dist, prevNode, prevEdge } = dijkstra(b.nearestNodeId, adj);
    // Ближайшая остановка по графу.
    let bestStop: string | null = null;
    let bestStopD = Infinity;
    for (const s of stops) {
      const d = dist.get(s.nearestNodeId) ?? Infinity;
      if (d < bestStopD) {
        bestStopD = d;
        bestStop = s.nearestNodeId;
      }
    }
    if (bestStop !== null && bestStopD < Infinity) {
      const edgeIds = pathEdges(bestStop, b.nearestNodeId, prevNode, prevEdge);
      const lengthM = edgeIds.reduce((acc, id) => acc + (byId.get(id)?.length ?? 0), 0);
      routes.push({ buildingId: b.id, residents: b.residents, edgeIds, lengthM, kind: 'bus' });
      add(edgeIds, b.residents);
    }
    // Ближайший парк по графу.
    let bestPark: string | null = null;
    let bestParkD = Infinity;
    for (const p of parks) {
      const d = dist.get(p.nearestNodeId) ?? Infinity;
      if (d < bestParkD) {
        bestParkD = d;
        bestPark = p.nearestNodeId;
      }
    }
    if (bestPark !== null && bestParkD < Infinity) {
      const edgeIds = pathEdges(bestPark, b.nearestNodeId, prevNode, prevEdge);
      const lengthM = edgeIds.reduce((acc, id) => acc + (byId.get(id)?.length ?? 0), 0);
      routes.push({ buildingId: b.id, residents: b.residents, edgeIds, lengthM, kind: 'park' });
      // Парковые потоки легче: считаем половину жителей (не все идут в парк сразу).
      add(edgeIds, Math.round(b.residents / 2));
    }
  }
  return { routes, flowByEdge };
}
