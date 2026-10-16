// Кейс 03 — метрики M1/M2. Пересчитываются заново после каждого действия.
// M1 — средняя длина пути до остановки, взвешенная по жителям.
// M2 — доля жителей с парком в N м (по кратчайшему пути, не по прямой).
import type { Attraction, CEdge, DistrictModel, House } from './model';
import { buildAdj, dijkstra } from './graph';

export interface Metrics {
  /** средняя длина пути до остановки, м */
  m1: number;
  /** доля жителей с парком в N м, 0..1 */
  m2: number;
  /** радиус N для M2 */
  n: number;
  /** кратчайшие пути от каждого дома (для стрелок на карте) */
  paths: { houseId: string; toOstanovka: number | null; toPark: number | null }[];
}

function nearest(dist: Map<string, number>, targets: Attraction[], nodeOf: Map<string, string>): number | null {
  let best: number | null = null;
  for (const t of targets) {
    const d = dist.get(t.nodeId);
    if (d == null) continue;
    if (best == null || d < best) best = d;
  }
  return best;
}

export function calcMetrics(model: DistrictModel, parkRadiusN = 400): Metrics {
  const adj = buildAdj(model.edges);
  const nodeOfHouse = new Map<string, string>();
  for (const h of model.houses) nodeOfHouse.set(h.id, h.nodeId);
  const ostanovki = model.attractions.filter((a) => a.kind === 'ostanovka');
  const parks = model.attractions.filter((a) => a.kind === 'park');

  let sumW = 0;
  let sumM1 = 0;
  let popPark = 0;
  let popAll = 0;
  const paths: Metrics['paths'] = [];

  for (const h of model.houses) {
    const dist = dijkstra(adj, h.nodeId);
    const dO = nearest(dist, ostanovki, nodeOfHouse);
    const dP = nearest(dist, parks, nodeOfHouse);
    paths.push({ houseId: h.id, toOstanovka: dO, toPark: dP });
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

/** Дельта current − baseline для панели «до/после». */
export function diffMetrics(base: Metrics, cur: Metrics): { dM1: number; dM2: number } {
  return {
    dM1: Math.round((cur.m1 - base.m1) * 10) / 10,
    dM2: Math.round((cur.m2 - base.m2) * 1000) / 1000,
  };
}

export type { House, CEdge };
