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
 * Снап ПКМ-точки маршрута А → Б: сначала узлы в радиусе, затем проекция
 * на активные рёбра (клик в середину длинного перегона иначе не привязать —
 * оба конца дальше радиуса). Возвращает id ближнего конца ребра либо null.
 * Неактивные (перекрытые) рёбра игнорируются: Дейкстра их не ходит.
 */
export function snapRouteNodeId(
  nodes: GraphNode[],
  edges: GraphEdge[],
  x: number,
  y: number,
  radiusM: number = ROUTE_SNAP_M,
): string | null {
  const byNode = snapNodeId(nodes, x, y, radiusM);
  if (byNode) return byNode;
  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  let bestId: string | null = null;
  let bestDist = radiusM;
  for (const e of edges) {
    if (!e.isActive) continue;
    const u = nodeById.get(e.from);
    const v = nodeById.get(e.to);
    if (!u || !v) continue;
    const dx = v.x - u.x;
    const dy = v.y - u.y;
    const len2 = dx * dx + dy * dy;
    if (len2 === 0) continue;
    const t = Math.min(1, Math.max(0, ((x - u.x) * dx + (y - u.y) * dy) / len2));
    const d = Math.hypot(x - (u.x + t * dx), y - (u.y + t * dy));
    if (d <= bestDist) {
      bestDist = d;
      bestId = t <= 0.5 ? u.id : v.id;
    }
  }
  return bestId;
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

export interface RouteSnapResult {
  nodeId: string;
  distM: number;
  forced: boolean;
  virtualCoord?: { x: number; y: number };
}

/**
 * Ищет ближайший проходимый узел для выхода с газона на пешеходную сеть.
 * Приоритет — проекциям на тротуары/переходы/парковые дорожки, привязка
 * к голому шоссе без тротуаров штрафуется.
 */
export function findBestNetworkEntryNode(
  nodes: GraphNode[],
  edges: GraphEdge[],
  x: number,
  y: number,
): { nodeId: string; distM: number } | null {
  if (nodes.length === 0) return null;
  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  let bestNodeId: string | null = null;
  let minDist = Infinity;
  for (const e of edges) {
    if (!e.isActive) continue;
    const u = nodeById.get(e.from);
    const v = nodeById.get(e.to);
    if (!u || !v) continue;
    const isBareHighway = e.type === 'road' && !e.hasSidewalkLeft && !e.hasSidewalkRight;
    const penalty = isBareHighway ? 3.0 : 1.0;
    const dx = v.x - u.x;
    const dy = v.y - u.y;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) continue;
    const t = Math.min(1, Math.max(0, ((x - u.x) * dx + (y - u.y) * dy) / lenSq));
    const d = Math.hypot(x - (u.x + t * dx), y - (u.y + t * dy)) * penalty;
    if (d < minDist) {
      minDist = d;
      bestNodeId = t <= 0.5 ? u.id : v.id;
    }
  }
  if (bestNodeId) {
    const target = nodeById.get(bestNodeId)!;
    return { nodeId: bestNodeId, distM: Math.round(Math.hypot(x - target.x, y - target.y)) };
  }
  let fallbackNode = nodes[0];
  let fallbackDist = Math.hypot(nodes[0].x - x, nodes[0].y - y);
  for (let i = 1; i < nodes.length; i++) {
    const d = Math.hypot(nodes[i].x - x, nodes[i].y - y);
    if (d < fallbackDist) {
      fallbackDist = d;
      fallbackNode = nodes[i];
    }
  }
  return { nodeId: fallbackNode.id, distM: Math.round(fallbackDist) };
}

/**
 * Extended-снап ПКМ-точки: pass 1 — узлы/активные рёбра в радиусе ROUTE_SNAP_M,
 * pass 2 — ближайший выход на пешеходную сеть без радиуса (forced), чтобы точку
 * можно было поставить и на траве/в поле. Пустой граф — null.
 */
export function snapRouteNodeIdExtended(
  nodes: GraphNode[],
  edges: GraphEdge[],
  x: number,
  y: number,
  radiusM: number = ROUTE_SNAP_M,
): RouteSnapResult | null {
  const near = snapRouteNodeId(nodes, edges, x, y, radiusM);
  if (near) {
    const n = nodes.find((nn) => nn.id === near);
    return { nodeId: near, distM: n ? Math.round(Math.hypot(n.x - x, n.y - y)) : 0, forced: false, virtualCoord: { x, y } };
  }
  const entry = findBestNetworkEntryNode(nodes, edges, x, y);
  if (!entry) return null;
  return { nodeId: entry.nodeId, distM: entry.distM, forced: true, virtualCoord: { x, y } };
}
