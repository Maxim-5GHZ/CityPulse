// frontend/lib/city/metrics.ts
import type { Attraction, CEdge, DistrictModel, House } from './model';
import { buildAdj, dijkstra, shortestPath } from './graph';

export interface Metrics {
  m1: number;
  m2: number;
  n: number;
  paths: {
    houseId: string;
    toOstanovka: number | null;
    toPark: number | null;
    ostanovkaNodePath: string[] | null;
  }[];
}

function nearestWithNode(
  dist: Map<string, number>,
  targets: Attraction[],
): { dist: number; nodeId: string } | null {
  let best: { dist: number; nodeId: string } | null = null;
  for (const t of targets) {
    const d = dist.get(t.nodeId);
    if (d == null) continue;
    if (best == null || d < best.dist) best = { dist: d, nodeId: t.nodeId };
  }
  return best;
}

export function calcMetrics(model: DistrictModel, parkRadiusN = 400): Metrics {
  const adj = buildAdj(model.edges);
  const ostanovki = model.attractions.filter((a) => a.kind === 'ostanovka');
  const parks = model.attractions.filter((a) => a.kind === 'park');

  let sumW = 0;
  let sumM1 = 0;
  let popPark = 0;
  let popAll = 0;
  const paths: Metrics['paths'] = [];

  for (const h of model.houses) {
    const distMap = dijkstra(adj, h.nodeId);
    const nearO = nearestWithNode(distMap, ostanovki);
    const nearP = nearestWithNode(distMap, parks);

    const dO = nearO?.dist ?? null;
    const dP = nearP?.dist ?? null;
    const ostanovkaNodePath = nearO ? shortestPath(adj, h.nodeId, nearO.nodeId) : null;

    paths.push({
      houseId: h.id,
      toOstanovka: dO,
      toPark: dP,
      ostanovkaNodePath,
    });

    popAll += h.residents;
    if (dO != null) {
      sumW += h.residents;
      sumM1 += h.residents * dO;
    }
    if (dP != null && dP <= parkRadiusN) popPark += h.residents;
  }

  return {
    m1: sumW > 0 ? Math.round((sumM1 / sumW) * 10) / 10 : 0,
    m2: popAll > 0 ? Math.round((popPark / popAll) * 1000) / 1000 : 0,
    n: parkRadiusN,
    paths,
  };
}

export function diffMetrics(base: Metrics, cur: Metrics): { dM1: number; dM2: number } {
  return {
    dM1: Math.round((cur.m1 - base.m1) * 10) / 10,
    dM2: Math.round((cur.m2 - base.m2) * 1000) / 1000,
  };
}