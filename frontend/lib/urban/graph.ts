// Честный Dijkstra по пешеходному графу (единственный алгоритм движка).
// Вес ребра = length / CROSSING_FACTOR при hasCrossing, blocked — непроходимы.

import { CROSSING_FACTOR } from './types';

export interface AdjEntry {
  to: string;
  w: number;
  edgeId: string;
}

export type AdjList = Map<string, AdjEntry[]>;

export function edgeWeight(length: number, hasCrossing?: boolean): number {
  return hasCrossing ? length / CROSSING_FACTOR : length;
}

export function buildAdj(
  nodes: { id: string }[],
  edges: { id: string; from: string; to: string; length: number; hasCrossing?: boolean; blocked?: boolean }[],
): AdjList {
  const adj: AdjList = new Map();
  for (const n of nodes) adj.set(n.id, []);
  for (const e of edges) {
    if (e.blocked) continue;
    if (!adj.has(e.from) || !adj.has(e.to)) continue;
    const w = edgeWeight(e.length, e.hasCrossing);
    adj.get(e.from)?.push({ to: e.to, w, edgeId: e.id });
    adj.get(e.to)?.push({ to: e.from, w, edgeId: e.id });
  }
  return adj;
}

export interface DijkstraResult {
  dist: Map<string, number>;
  prevNode: Map<string, string | null>;
  prevEdge: Map<string, string | null>;
}

/** Классический Dijkstra с линейным выбором минимума (граф < 200 узлов — достаточно). */
export function dijkstra(startId: string, adj: AdjList): DijkstraResult {
  const dist = new Map<string, number>();
  const prevNode = new Map<string, string | null>();
  const prevEdge = new Map<string, string | null>();
  const visited = new Set<string>();
  adj.forEach((_v, id) => {
    dist.set(id, Infinity);
    prevNode.set(id, null);
    prevEdge.set(id, null);
  });
  if (!adj.has(startId)) return { dist, prevNode, prevEdge };
  dist.set(startId, 0);

  for (;;) {
    let u: string | null = null;
    let best = Infinity;
    dist.forEach((d, id) => {
      if (!visited.has(id) && d < best) {
        best = d;
        u = id;
      }
    });
    if (u === null || best === Infinity) break;
    visited.add(u);
    for (const e of adj.get(u) ?? []) {
      const alt = (dist.get(u) ?? Infinity) + e.w;
      if (alt < (dist.get(e.to) ?? Infinity)) {
        dist.set(e.to, alt);
        prevNode.set(e.to, u);
        prevEdge.set(e.to, e.edgeId);
      }
    }
  }
  return { dist, prevNode, prevEdge };
}

/** Восстановить цепочку рёбер start → target после dijkstra(start). */
export function pathEdges(
  targetId: string,
  startId: string,
  prevNode: Map<string, string | null>,
  prevEdge: Map<string, string | null>,
): string[] {
  if (targetId === startId) return [];
  const out: string[] = [];
  let cur: string | null = targetId;
  let guard = 10000;
  while (cur !== null && cur !== startId && guard-- > 0) {
    const e = prevEdge.get(cur);
    if (!e) return [];
    out.push(e);
    cur = prevNode.get(cur) ?? null;
  }
  if (cur !== startId) return [];
  return out.reverse();
}

/** Восстановить цепочку узлов start → target. */
export function pathNodes(
  targetId: string,
  startId: string,
  prevNode: Map<string, string | null>,
): string[] {
  if (targetId === startId) return [startId];
  const out: string[] = [targetId];
  let cur: string | null = targetId;
  let guard = 10000;
  while (cur !== null && cur !== startId && guard-- > 0) {
    cur = prevNode.get(cur) ?? null;
    if (cur !== null) out.push(cur);
  }
  if (cur !== startId) return [];
  return out.reverse();
}
