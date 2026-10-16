// frontend/lib/city/wind.ts
import type { DistrictModel } from './model';

export const WIND_GRID = 12;

export interface WindCell {
  x: number;
  y: number;
  ux: number;
  uy: number;
  speed: number;
  comfort: number;
  turb: number;
}

export interface WindField {
  cells: WindCell[];
  comfort: number;
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
  const rad = (thetaDeg * Math.PI) / 180;
  const globalUx = Math.sin(rad);
  const globalUy = -Math.cos(rad);

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
    return {
      cx,
      cy,
      h: b.h,
      r: Math.max(15, Math.hypot(maxX - minX, maxY - minY) / 2),
    };
  });

  const step = 1000 / WIND_GRID;
  const cells: WindCell[] = [];
  let comfortSum = 0;

  for (let i = 0; i < WIND_GRID; i++) {
    for (let j = 0; j < WIND_GRID; j++) {
      const x = (i + 0.5) * step;
      const y = (j + 0.5) * step;

      let ux = globalUx;
      let uy = globalUy;
      let speedFactor = 1.0;
      let maxTurb = 0.15;

      for (const b of blocks) {
        const dx = x - b.cx;
        const dy = y - b.cy;
        const dist = Math.hypot(dx, dy);

        if (dist < b.r * 2.8) {
          const along = dx * globalUx + dy * globalUy;
          const perp = Math.abs(dx * globalUy - dy * globalUx);

          if (dist < b.r) {
            const side = (dx * globalUy - dy * globalUx) >= 0 ? 1 : -1;
            ux = -globalUy * side;
            uy = globalUx * side;
            speedFactor = Math.min(speedFactor, 0.45);
            maxTurb = Math.max(maxTurb, 0.7);
          } else if (along > 0 && perp < b.r * 1.4) {
            const wakeK = 1 - along / (b.r * 2.8);
            speedFactor = Math.min(speedFactor, Math.max(0.4, 1 - wakeK * 0.5));
            maxTurb = Math.max(maxTurb, 0.5 + wakeK * 0.4);
          } else if (perp < b.r * 1.5) {
            speedFactor = Math.max(speedFactor, 1.25);
          }
        }
      }

      const len = Math.hypot(ux, uy) || 1;
      ux /= len;
      uy /= len;

      const finalSpeed = Math.max(0.8, Math.round(v0 * speedFactor * 10) / 10);
      const comfort = finalSpeed < 1.5 ? 0.4 : finalSpeed > 8 ? 0.3 : 0.85;
      comfortSum += comfort;

      cells.push({
        x,
        y,
        ux,
        uy,
        speed: finalSpeed,
        comfort,
        turb: Math.min(1, Math.round(maxTurb * 100) / 100),
      });
    }
  }

  return {
    cells,
    comfort: Math.round((comfortSum / cells.length) * 100) / 100,
  };
}