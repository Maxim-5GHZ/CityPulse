// Кейс 03 — пресеты зданий для ручной достройки в конструкторе.
// Реальные коробки прилетают из OSM (lib/city/osm.ts), здесь — шаблоны «построить».
import type { BuildingPreset, RoofShape } from './model';

export interface PresetSpec {
  preset: BuildingPreset;
  label: string;
  /** габариты по умолчанию, м */
  w: number;
  d: number;
  h: number;
  roof: RoofShape;
}

export const PRESETS: PresetSpec[] = [
  { preset: 'panel5', label: 'Панелька, 5 эт.', w: 40, d: 12, h: 15, roof: 'flat' },
  { preset: 'tower16', label: 'Башня, 16 эт.', w: 24, d: 24, h: 48, roof: 'flat' },
  { preset: 'shkola', label: 'Школа', w: 50, d: 20, h: 12, roof: 'gable' },
  { preset: 'tc', label: 'Торговый центр', w: 60, d: 30, h: 10, roof: 'hip' },
  { preset: 'custom', label: 'Своя коробка', w: 20, d: 12, h: 9, roof: 'flat' },
];

/** Прямоугольный футпринт вокруг центра (cx,cy) в метрах сетки. */
export function rectFootprint(cx: number, cy: number, w: number, d: number): [number, number][] {
  const hw = w / 2;
  const hd = d / 2;
  return [
    [cx - hw, cy - hd],
    [cx + hw, cy - hd],
    [cx + hw, cy + hd],
    [cx - hw, cy + hd],
  ];
}

/** Периметр полигона — для обхода при разрыве ребер (см. AGENTS.md: length+=периметр/2). */
export function perimeter(poly: [number, number][]): number {
  let p = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x1, y1] = poly[i];
    const [x2, y2] = poly[(i + 1) % poly.length];
    p += Math.hypot(x2 - x1, y2 - y1);
  }
  return p;
}

/** Площадь по шнуркам, м². */
export function area(poly: [number, number][]): number {
  let s = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x1, y1] = poly[i];
    const [x2, y2] = poly[(i + 1) % poly.length];
    s += x1 * y2 - x2 * y1;
  }
  return Math.abs(s / 2);
}

function bbox(poly: [number, number][]): [number, number, number, number] {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of poly) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return [minX, minY, maxX, maxY];
}

function pointInPoly(x: number, y: number, poly: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function segmentsCross(
  a1: [number, number],
  a2: [number, number],
  b1: [number, number],
  b2: [number, number],
): boolean {
  const d = (p: [number, number], q: [number, number], r: [number, number]) =>
    (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
  const d1 = d(b1, b2, a1);
  const d2 = d(b1, b2, a2);
  const d3 = d(a1, a2, b1);
  const d4 = d(a1, a2, b2);
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}

/** Коллизия футпринтов: пересечение или касание с зазором gap (м). */
export function footprintsCollide(a: [number, number][], b: [number, number][], gap = 2): boolean {
  const [ax0, ay0, ax1, ay1] = bbox(a);
  const [bx0, by0, bx1, by1] = bbox(b);
  if (ax1 + gap < bx0 || bx1 + gap < ax0 || ay1 + gap < by0 || by1 + gap < ay0) return false;
  for (const [x, y] of a) if (pointInPoly(x, y, b)) return true;
  for (const [x, y] of b) if (pointInPoly(x, y, a)) return true;
  for (let i = 0; i < a.length; i++) {
    const a1 = a[i];
    const a2 = a[(i + 1) % a.length];
    for (let j = 0; j < b.length; j++) {
      if (segmentsCross(a1, a2, b[j], b[(j + 1) % b.length])) return true;
    }
  }
  return false;
}

/** Есть ли коллизия нового футпринта с кем-то из списка. Возвращает индекс или -1. */
export function collideIndex(footprint: [number, number][], others: [number, number][][], gap = 2): number {
  for (let i = 0; i < others.length; i++) {
    if (footprintsCollide(footprint, others[i], gap)) return i;
  }
  return -1;
}
