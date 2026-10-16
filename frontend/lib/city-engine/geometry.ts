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
