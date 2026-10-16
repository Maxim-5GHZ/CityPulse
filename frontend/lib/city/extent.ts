// Кейс 03 — охват «Центр / Весь город» для 2D и 3D-инсоляции.
// Городской кэш сжат в свою сетку 0..1000 (свои scale/dx/dy, см. OsmMeta) —
// здесь переводим его в сетку центра (DEFAULT_META, её трогать нельзя:
// сценарии зависят), чтобы 2D и 3D рисовали город поверх тех же преобразований.
// Расчёты (граф, M1/M2, ветер, эко) остаются на фрагменте центра: город —
// LOD-фон (коробки без фасадов), честная подпись в UI.
import type { Building } from './model';
import type { OsmCity, OsmMeta } from './osm';
import { gridToLonLat, lonLatToGrid } from './proj';

export type Extent = 'center' | 'city';

/** Точка городской сетки → сетка центра (через lon/lat, обе меты известны). */
export function cityGridToCenter(x: number, y: number, meta: OsmMeta): [number, number] {
  const [lon, lat] = gridToLonLat(x, y, { center: meta.center, scale: meta.scale, dx: meta.dx, dy: meta.dy });
  return lonLatToGrid(lon, lat);
}

/**
 * Городские коробки в сетке центра. id переписываем в `city-…`, чтобы не
 * столкнуться с `osm-…` фрагмента (кэши пересекаются в центре).
 */
export function convertCityBuildings(city: OsmCity): Building[] {
  return city.buildings.map((b) => ({
    ...b,
    id: `city-${b.id}`,
    footprint: b.footprint.map(([x, y]) => cityGridToCenter(x, y, city.meta)) as [number, number][],
  }));
}

/** Рамка города (bbox меты, градусы) в сетке центра — для fit вида в 2D. */
export function cityBoundsCenter(meta: OsmMeta): [number, number, number, number] {
  const bbox = (meta as OsmMeta & { bbox?: { minLat: number; minLon: number; maxLat: number; maxLon: number } }).bbox;
  if (!bbox) return [0, 0, 1000, 1000];
  const [x0, y1] = lonLatToGrid(bbox.minLon, bbox.maxLat);
  const [x1, y0] = lonLatToGrid(bbox.maxLon, bbox.minLat);
  return [Math.min(x0, x1), Math.min(y0, y1), Math.max(x0, x1), Math.max(y0, y1)];
}

export interface CityBox {
  cx: number;
  cy: number;
  /** поворот главной оси футпринта, радианы */
  angle: number;
  w: number;
  d: number;
  h: number;
}

/** Коробка по футпринту: центр, габариты и угол главной оси (PCA, только 2D). */
export function boxFromFootprint(fp: [number, number][]): Omit<CityBox, 'h'> {
  let cx = 0;
  let cy = 0;
  for (const [x, y] of fp) {
    cx += x;
    cy += y;
  }
  cx /= fp.length;
  cy /= fp.length;
  let sxx = 0;
  let sxy = 0;
  let syy = 0;
  for (const [x, y] of fp) {
    const dx = x - cx;
    const dy = y - cy;
    sxx += dx * dx;
    sxy += dx * dy;
    syy += dy * dy;
  }
  const angle = 0.5 * Math.atan2(2 * sxy, sxx - syy);
  const ca = Math.cos(angle);
  const sa = Math.sin(angle);
  let minU = Infinity;
  let maxU = -Infinity;
  let minV = Infinity;
  let maxV = -Infinity;
  for (const [x, y] of fp) {
    const dx = x - cx;
    const dy = y - cy;
    const u = dx * ca + dy * sa;
    const v = -dx * sa + dy * ca;
    if (u < minU) minU = u;
    if (u > maxU) maxU = u;
    if (v < minV) minV = v;
    if (v > maxV) maxV = v;
  }
  return { cx, cy, angle, w: Math.max(4, maxU - minU), d: Math.max(4, maxV - minV) };
}

/** Цвет LOD-коробки по высоте: slate + стально-голубой, неон запрещён. */
export function lodBandColor(h: number, dark: boolean): string {
  if (h < 9) return dark ? '#64748b' : '#94a3b8';
  if (h < 18) return dark ? '#6e8299' : '#7f97ad';
  if (h < 30) return dark ? '#7893ad' : '#64809a';
  return dark ? '#85a3c0' : '#4f6d8c';
}
