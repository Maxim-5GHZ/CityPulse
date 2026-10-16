// Кейс 03 — ветер-эвристика (§9.4 сисанализа, Q7): поле 8×8, конус затишья
// L=2*H за зданием, зелень −30%. Это НЕ CFD/OpenFOAM — в UI честная подпись.
// Всё в метрах сетки 0..1000. Направление — КУДА дует, градусы от севера.
import type { DistrictModel } from './model';

export const WIND_GRID = 8;

export interface WindCell {
  /** центр ячейки, м сетки */
  x: number;
  y: number;
  /** единичный вектор КУДА дует */
  ux: number;
  uy: number;
  /** м/с после застройки и зелени */
  speed: number;
  /** комфорт 0..1: штиль — застой, сильный ветер — дискомфорт */
  comfort: number;
}

export interface WindField {
  cells: WindCell[];
  /** средний комфорт по полю 0..1 */
  comfort: number;
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

function centroid(poly: [number, number][]): [number, number] {
  let x = 0;
  let y = 0;
  for (const [px, py] of poly) {
    x += px;
    y += py;
  }
  return [x / poly.length, y / poly.length];
}

export function windField(model: DistrictModel, thetaDeg: number, v0: number): WindField {
  const t = (thetaDeg * Math.PI) / 180;
  const ux = Math.sin(t);
  const uy = Math.cos(t);
  const blocks = model.buildings.map((b) => {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const [x, y] of b.footprint) {
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
    const [cx, cy] = centroid(b.footprint);
    return { cx, cy, h: b.h, r: Math.hypot(maxX - minX, maxY - minY) / 2, poly: b.footprint };
  });

  const step = 1000 / WIND_GRID;
  const cells: WindCell[] = [];
  let comfortSum = 0;
  for (let i = 0; i < WIND_GRID; i++) {
    for (let j = 0; j < WIND_GRID; j++) {
      const x = (i + 0.5) * step;
      const y = (j + 0.5) * step;
      let f = 1;
      for (const b of blocks) {
        if (pointInPoly(x, y, b.poly)) {
          f = Math.min(f, 0.05); // внутри коробки — почти штиль
          break;
        }
        const vx = x - b.cx;
        const vy = y - b.cy;
        const along = vx * ux + vy * uy; // >0 — ячейка по ветру за зданием
        if (along <= 0 || along > 2 * b.h) continue;
        const perp = Math.abs(vx * uy - vy * ux);
        if (perp < b.r + 12) f = Math.min(f, 0.25); // конус затишья L=2H
      }
      for (const g of model.greens) {
        if (pointInPoly(x, y, g.polygon)) f *= 1 - 0.3 * g.porosity; // зелень −30%
      }
      const speed = Math.round(v0 * f * 10) / 10;
      const comfort = speed < 0.5 ? 0.3 : Math.max(0, Math.round((1 - (speed - 0.5) / 9.5) * 1000) / 1000);
      comfortSum += comfort;
      cells.push({ x, y, ux, uy, speed, comfort });
    }
  }
  return { cells, comfort: Math.round((comfortSum / cells.length) * 1000) / 1000 };
}
