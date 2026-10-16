import { GraphNode } from './types';

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
