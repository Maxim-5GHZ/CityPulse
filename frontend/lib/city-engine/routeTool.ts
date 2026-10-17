import { buildAdjacency, findShortestPath } from './dijkstra';
import { GraphEdge, GraphNode, PathResult } from './types';

// Радиус привязки ПКМ-точки маршрута к ближайшему узлу графа (м).
export const ROUTE_SNAP_M = 50;

/** Ближайший узел в радиусе снапа, иначе null. */
export function snapNodeId(
  nodes: GraphNode[],
  x: number,
  y: number,
  radiusM: number = ROUTE_SNAP_M,
): string | null {
  let best: GraphNode | null = null;
  let bestDist = radiusM;
  for (const n of nodes) {
    const d = Math.hypot(n.x - x, n.y - y);
    if (d <= bestDist) {
      bestDist = d;
      best = n;
    }
  }
  return best?.id ?? null;
}

/**
 * Путь А → Б умным Дейкстрой. Возвращает полный результат (узлы, честные
 * метры, минуты) либо null (точки совпали или граф несвязен).
 */
export function buildRouteAB(
  nodes: GraphNode[],
  edges: GraphEdge[],
  startId: string,
  endId: string,
): PathResult | null {
  if (startId === endId) return null;
  const adj = buildAdjacency(nodes, edges);
  return findShortestPath(startId, endId, adj);
}
