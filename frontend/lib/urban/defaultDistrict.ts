// Эталонный район «Обнинск»: 12 узлов, 5 домов, 2 остановки, 1 парк.
// Сетка 24×16 клеток, 1 клетка = 25 м.

import type { DistrictState } from './types';
import { METERS_PER_CELL } from './types';

function edgeLen(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(bx - ax, by - ay) * METERS_PER_CELL;
}

function link(ax: number, ay: number, bx: number, by: number): number {
  return Math.round(edgeLen(ax, ay, bx, by));
}

let seq = 0;
function nid(x: number, y: number): string {
  seq += 1;
  return `n${seq}_${x}_${y}`;
}

export const GRID_W = 24;
export const GRID_H = 16;

export function defaultDistrict(): DistrictState {
  seq = 0;
  // Два жилых квартала, соединённые центральным бульваром.
  const pts: [number, number][] = [
    [3, 3], [8, 3], [13, 3], [18, 3],
    [3, 8], [8, 8], [13, 8], [18, 8],
    [3, 13], [8, 13], [13, 13], [18, 13],
  ];
  const nodes = pts.map(([x, y]) => ({ id: nid(x, y), x, y }));
  const at = (x: number, y: number) => nodes.find((n) => n.x === x && n.y === y)?.id ?? '';

  const pairs: [number, number, number, number, boolean?][] = [
    // Верхняя улица
    [3, 3, 8, 3], [8, 3, 13, 3], [13, 3, 18, 3],
    // Средняя улица (бульвар, с переходами)
    [3, 8, 8, 8, true], [8, 8, 13, 8, true], [13, 8, 18, 8, true],
    // Нижняя улица
    [3, 13, 8, 13], [8, 13, 13, 13], [13, 13, 18, 13],
    // Вертикали
    [3, 3, 3, 8], [3, 8, 3, 13],
    [8, 3, 8, 8], [8, 8, 8, 13],
    [13, 3, 13, 8], [13, 8, 13, 13],
    [18, 3, 18, 8], [18, 8, 18, 13],
  ];
  const edges = pairs.map(([ax, ay, bx, by, cross], i) => ({
    id: `e${i + 1}`,
    from: at(ax, ay),
    to: at(bx, by),
    length: link(ax, ay, bx, by),
    ...(cross ? { hasCrossing: true } : {}),
  }));

  const buildings = [
    { id: 'b1', x: 4, y: 4, w: 3, h: 2, residents: 120, nearestNodeId: at(3, 3) },
    { id: 'b2', x: 9, y: 4, w: 3, h: 2, residents: 200, nearestNodeId: at(8, 3) },
    { id: 'b3', x: 14, y: 4, w: 3, h: 2, residents: 90, nearestNodeId: at(13, 3) },
    { id: 'b4', x: 4, y: 9, w: 3, h: 2, residents: 150, nearestNodeId: at(3, 8) },
    { id: 'b5', x: 14, y: 9, w: 3, h: 2, residents: 110, nearestNodeId: at(13, 8) },
  ];

  const pois = [
    { id: 'p-stop-1', type: 'BUS_STOP' as const, x: 8, y: 8, nearestNodeId: at(8, 8), name: 'Остановка «Бульвар»' },
    { id: 'p-stop-2', type: 'BUS_STOP' as const, x: 18, y: 13, nearestNodeId: at(18, 13), name: 'Остановка «Южная»' },
    { id: 'p-park-1', type: 'PARK' as const, x: 18, y: 3, nearestNodeId: at(18, 3), name: 'Сквер «Северный»' },
  ];

  return { nodes, edges, buildings, pois };
}

/** Найти ближайший узел графа к точке сетки. */
export function nearestNode(
  nodes: { id: string; x: number; y: number }[],
  x: number,
  y: number,
): string {
  let best = '';
  let bestD = Infinity;
  for (const n of nodes) {
    const d = Math.hypot(n.x - x, n.y - y);
    if (d < bestD) {
      bestD = d;
      best = n.id;
    }
  }
  return best;
}
