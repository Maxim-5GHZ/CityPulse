import { DistrictScenario, GraphEdge, GraphNode } from './types';

/**
 * Площадь многоугольника по формуле Гаусса (Shoelace formula).
 */
export function computePolygonAreaM2(points: { x: number; y: number }[]): number {
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length;
    area += points[i].x * points[j].y;
    area -= points[j].x * points[i].y;
  }
  return Math.abs(area / 2);
}

/**
 * Поиск ближайшего узла графа к координатам клика.
 */
export function findClosestNodeId(x: number, y: number, nodes: GraphNode[]): string {
  let best = nodes[0]?.id ?? 'n1';
  let minD = Infinity;
  for (const n of nodes) {
    const d = Math.hypot(n.x - x, n.y - y);
    if (d < minD) {
      minD = d;
      best = n.id;
    }
  }
  return best;
}

/**
 * Проекция точки клика на отрезок ребра.
 * Возвращает точку проекции и параметр t (0 — начало, 1 — конец).
 */
export function closestPointOnEdge(
  px: number,
  py: number,
  from: GraphNode,
  to: GraphNode,
): { x: number; y: number; t: number } {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq < 1) return { x: from.x, y: from.y, t: 0 };
  const t = Math.max(0, Math.min(1, ((px - from.x) * dx + (py - from.y) * dy) / lenSq));
  return { x: Math.round(from.x + dx * t), y: Math.round(from.y + dy * t), t };
}

// Клик в торец ребра (ближе snapM к узлу) — разрезать не надо,
// остановка встанет на существующий узел.
const SPLIT_SNAP_M = 12;

/**
 * Разрезает ребро в точке клика: новый узел + два ребра-наследника
 * (наслеиуют lanes/тротуары/активность, lengthM пересчитывается).
 * Возвращает id узла разреза (нового или торцевого) либо null,
 * если резать нельзя (ребро не найдено, кольцо, слишком короткое).
 */
export function splitEdgeAt(
  scenario: DistrictScenario,
  edgeId: string,
  px: number,
  py: number,
): { scenario: DistrictScenario; nodeId: string } | null {
  const edge = scenario.edges.find((e) => e.id === edgeId);
  if (!edge || edge.isRoundabout) return null;
  if (edge.type !== 'road' && edge.type !== 'sidewalk') return null;
  const from = scenario.nodes.find((n) => n.id === edge.from);
  const to = scenario.nodes.find((n) => n.id === edge.to);
  if (!from || !to) return null;

  const proj = closestPointOnEdge(px, py, from, to);
  if (proj.t * Math.hypot(to.x - from.x, to.y - from.y) <= SPLIT_SNAP_M) {
    return { scenario, nodeId: from.id };
  }
  if ((1 - proj.t) * Math.hypot(to.x - from.x, to.y - from.y) <= SPLIT_SNAP_M) {
    return { scenario, nodeId: to.id };
  }

  const stamp = Date.now();
  const cutId = `n-cut-${stamp}`;
  const cutNode: GraphNode = {
    id: cutId,
    x: proj.x,
    y: proj.y,
    label: 'Разрез УДС',
    type: 'intersection',
    isCustom: true,
  };
  const mkEdge = (id: string, a: string, b: string, ax: number, ay: number, bx: number, by: number): GraphEdge => ({
    ...edge,
    id,
    from: a,
    to: b,
    lengthM: Math.max(5, Math.round(Math.hypot(bx - ax, by - ay))),
    isCustom: true,
  });
  const e1 = mkEdge(`e-cut-${stamp}-a`, edge.from, cutId, from.x, from.y, proj.x, proj.y);
  const e2 = mkEdge(`e-cut-${stamp}-b`, cutId, edge.to, proj.x, proj.y, to.x, to.y);
  return {
    scenario: {
      ...scenario,
      nodes: [...scenario.nodes, cutNode],
      edges: [...scenario.edges.filter((e) => e.id !== edgeId), e1, e2],
    },
    nodeId: cutId,
  };
}
/**
 * Превращает ломаную графа в плавную пешеходную траекторию (квадратичные Безье).
 * Человек срезает углы — маршрут выглядит «народной тропой», а не электросхемой.
 */
export function pointsToSmoothSvgPath(points: { x: number; y: number }[]): string {
  if (points.length < 2) return '';
  if (points.length === 2) {
    return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;
  }
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length - 1; i++) {
    const xc = (points[i].x + points[i + 1].x) / 2;
    const yc = (points[i].y + points[i + 1].y) / 2;
    d += ` Q ${points[i].x} ${points[i].y}, ${xc} ${yc}`;
  }
  const last = points[points.length - 1];
  d += ` L ${last.x} ${last.y}`;
  return d;
}
