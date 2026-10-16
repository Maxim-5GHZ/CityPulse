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
