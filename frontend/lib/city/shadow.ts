// Кейс 03 — солнце и тени. suncalc -> az/alt для Обнинска.
// Соглашение: az от юга (suncalc), сетка y — север. Тень: dx=L*sin(az), dy=L*cos(az).
// L=H/tan(alt). Тот же вектор ставит DirectionalLight в 3D.
import SunCalc from 'suncalc';
import { intersect as turfIntersect, polygon, featureCollection } from '@turf/turf';
import type { Building } from './model';

export const OBS_LAT = 55.096;
export const OBS_LON = 36.61;

export interface SunPos {
  alt: number; // радианы над горизонтом
  az: number; // радианы от юга, к западу +
}

export function sunAt(date: Date): SunPos {
  const p = SunCalc.getPosition(date, OBS_LAT, OBS_LON);
  // suncalc: altitude над горизонтом, azimuth от юга (запад +). Берём как есть.
  return { alt: p.altitude, az: p.azimuth };
}

/** Сдвиг тени здания в метрах сетки. null — солнце за горизонтом. */
export function shadowOffset(h: number, sun: SunPos): [number, number] | null {
  if (sun.alt <= 0.02) return null;
  const L = h / Math.tan(sun.alt);
  return [L * Math.sin(sun.az), L * Math.cos(sun.az)];
}

/** Полигон тени: footprint + сдвиг, выпуклая оболочка пары. */
export function shadowPolygon(footprint: [number, number][], offset: [number, number]): [number, number][] {
  const moved = footprint.map(([x, y]) => [x + offset[0], y + offset[1]] as [number, number]);
  const pts = [...footprint, ...moved];
  return convexHull(pts);
}

function cross(o: [number, number], a: [number, number], b: [number, number]): number {
  return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
}

/** Монотонная цепь, ~15 строк — вместо зависимости. */
export function convexHull(pts: [number, number][]): [number, number][] {
  const sorted = [...pts].sort((a, b) => (a[0] === b[0] ? a[1] - b[1] : a[0] - b[0]));
  if (sorted.length < 4) return sorted;
  const lower: [number, number][] = [];
  for (const p of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper: [number, number][] = [];
  for (let i = sorted.length - 1; i >= 0; i--) {
    const p = sorted[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  lower.pop();
  upper.pop();
  return [...lower, ...upper];
}

function ringArea(ring: [number, number][]): number {
  let s = 0;
  for (let i = 0; i < ring.length; i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[(i + 1) % ring.length];
    s += x1 * y2 - x2 * y1;
  }
  return Math.abs(s / 2);
}

function closed(ring: [number, number][]): [number, number][] {
  if (ring.length === 0) return ring;
  const f = ring[0];
  const l = ring[ring.length - 1];
  if (f[0] === l[0] && f[1] === l[1]) return ring;
  return [...ring, f];
}

/** % площади target, накрытой тенью caster. 0 — нет пересечения. */
export function shadePct(caster: Building, target: Building, sun: SunPos): number {
  const off = shadowOffset(caster.h, sun);
  if (!off) return 0;
  if (caster.id === target.id) return 0;
  try {
    const sh = closed(shadowPolygon(caster.footprint, off));
    const tg = closed(target.footprint);
    const inter = turfIntersect(featureCollection([polygon([sh]), polygon([tg])]));
    if (!inter) return 0;
    const geom = inter.geometry;
    let ia = 0;
    if (geom.type === 'Polygon') ia = ringArea(geom.coordinates[0] as [number, number][]);
    else if (geom.type === 'MultiPolygon') {
      for (const poly of geom.coordinates) ia += ringArea(poly[0] as [number, number][]);
    }
    const ta = ringArea(tg);
    if (ta <= 0) return 0;
    return Math.round((Math.min(1, ia / ta) * 100) * 10) / 10;
  } catch {
    return 0;
  }
}

/** Позиция DirectionalLight в мире three (сцена 1000м, центр 0). R — дистанция. */
export function sunLightPos(sun: SunPos, R = 1500): [number, number, number] {
  const ca = Math.cos(sun.alt);
  return [R * ca * Math.sin(sun.az), R * Math.sin(sun.alt), R * ca * Math.cos(sun.az)];
}
