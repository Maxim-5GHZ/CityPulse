// Кейс 03 — графовые утилиты. Свой Dijkstra (~30 строк): прозрачность для жюри (п.9 кейса).
// Вес ребра = length (метры). Закрытое ребро исключается.
import type { CEdge } from './model';

export interface AdjEdge {
  to: string;
  w: number;
  edgeId: string;
}

export function buildAdj(edges: CEdge[]): Map<string, AdjEdge[]> {
  const adj = new Map<string, AdjEdge[]>();
  const push = (from: string, to: string, w: number, edgeId: string) => {
    const list = adj.get(from) ?? [];
    list.push({ to, w, edgeId });
    adj.set(from, list);
  };
  for (const e of edges) {
    if (e.closed) continue;
    push(e.a, e.b, e.length, e.id);
    push(e.b, e.a, e.length, e.id);
  }
  return adj;
}

/** Кратчайшие расстояния от src. Граф маленький (≤100 узлов) — очередь без кучи, честность важнее скорости. */
export function dijkstra(adj: Map<string, AdjEdge[]>, src: string): Map<string, number> {
  const dist = new Map<string, number>([[src, 0]]);
  const visited = new Set<string>();
  for (;;) {
    let u: string | null = null;
    let best = Infinity;
    dist.forEach((d, k) => {
      if (!visited.has(k) && d < best) {
        best = d;
        u = k;
      }
    });
    if (u === null) break;
    const cur: string = u;
    visited.add(cur);
    for (const e of adj.get(cur) ?? []) {
      const nd = best + e.w;
      if (nd < (dist.get(e.to) ?? Infinity)) dist.set(e.to, nd);
    }
  }
  return dist;
}

/** Канонический JSON графа для hash (воспроизводимость: возврат = те же цифры). */
export function canonicalGraph(edges: CEdge[]): string {
  const rows = edges
    .map((e) => [e.a, e.b, Math.round(e.length * 100) / 100, e.type, e.closed ? 1 : 0].join('|'))
    .sort();
  return JSON.stringify(rows);
}

/** sha1 hex без node:crypto (работает и в браузере). */
export async function sha1Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
