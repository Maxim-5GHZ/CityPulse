// Кейс 03 — FR-31: грунтовые воды.
// Синтетика: W = 0.5·близость_к_Протве + 0.3·низина + 0.2·грунт → 3 класса.
// Вода — реальная геометрия OSM (obninsk-water.geojson, сетка центра), если кэш
// недоступен — условная ось Протвы внизу карты. В UI обязателен бейдж «условно,
// не изыскания»: низина и грунт — не DEM/геология, а сглаженный seed-шум.

export interface WaterFeature {
  kind: 'water_line' | 'water_poly';
  name: string | null;
  /** линия в сетке центра (может выходить за 0..1000: Протва южнее) */
  line?: [number, number][];
  polygon?: [number, number][];
}

export interface GwCell {
  /** левый нижний угол ячейки, м сетки 0..1000 */
  x: number;
  y: number;
  w: number;
  h: number;
  /** 0 — низко, 1 — средне, 2 — высоко */
  cls: 0 | 1 | 2;
  /** сырое значение 0..1 */
  v: number;
}

export interface GwField {
  cells: GwCell[];
  /** доля площади по классам, % */
  share: [number, number, number];
}

export const GW_GRID = 20;

/** Палитра влаги: стально-голубые градации (см. AGENTS.md, неон запрещён). */
export const GW_FILL = ['rgba(147, 197, 253, 0.16)', 'rgba(59, 130, 246, 0.24)', 'rgba(29, 78, 216, 0.34)'];
export const GW_LABELS = ['низко', 'средне', 'высоко'];
/** Цвет линии воды, когда слой грунтовых вод включён. */
export const WATER_COLOR = 'rgba(37, 99, 235, 0.55)';

interface WaterGeoJson {
  features: {
    properties: { kind?: string; name?: string | null };
    geometry: { type: string; coordinates: number[][] | number[][][] };
  }[];
}

/** Условная ось Протвы — только если OSM-кэш воды недоступен (всё равно «условно»). */
const FALLBACK_PROTVA: WaterFeature = {
  kind: 'water_line',
  name: 'Протва (условная ось)',
  line: [
    [-300, 140],
    [0, 100],
    [300, 60],
    [600, 20],
    [900, -20],
    [1200, -60],
  ],
};

export async function loadWater(): Promise<WaterFeature[]> {
  try {
    const res = await fetch('/osm/obninsk-water.geojson');
    if (!res.ok) return [];
    const fc = (await res.json()) as WaterGeoJson;
    const out: WaterFeature[] = [];
    for (const f of fc.features ?? []) {
      const kind = f.properties?.kind === 'water_poly' ? 'water_poly' : 'water_line';
      if (kind === 'water_poly' && f.geometry.type === 'Polygon') {
        const ring = (f.geometry.coordinates as number[][][])[0];
        if (ring && ring.length >= 3) out.push({ kind, name: f.properties.name ?? null, polygon: ring as [number, number][] });
      } else if (kind === 'water_line' && f.geometry.type === 'LineString') {
        const line = f.geometry.coordinates as number[][];
        if (line.length >= 2) out.push({ kind, name: f.properties.name ?? null, line: line as [number, number][] });
      }
    }
    return out;
  } catch {
    return [];
  }
}

function hash(ix: number, iy: number, s: number): number {
  let h = ix * 374761393 + iy * 668265263 + s * 362437;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

/** Билинейный value-noise по решётке: 0..1, где 1 — «выше». */
function smoothNoise(x: number, y: number, cellSize: number, seed: number): number {
  const gx = x / cellSize;
  const gy = y / cellSize;
  const x0 = Math.floor(gx);
  const y0 = Math.floor(gy);
  const tx = gx - x0;
  const ty = gy - y0;
  const sm = (t: number) => t * t * (3 - 2 * t);
  const v00 = hash(x0, y0, seed);
  const v10 = hash(x0 + 1, y0, seed);
  const v01 = hash(x0, y0 + 1, seed);
  const v11 = hash(x0 + 1, y0 + 1, seed);
  const a = v00 + (v10 - v00) * sm(tx);
  const b = v01 + (v11 - v01) * sm(tx);
  return a + (b - a) * sm(ty);
}

function distToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  if (dx === 0 && dy === 0) return Math.hypot(px - ax, py - ay);
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
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

/** Минимальное расстояние точки сетки до воды, м (0 — внутри водоёма). */
function distToWater(x: number, y: number, water: WaterFeature[]): number {
  let best = Infinity;
  for (const w of water) {
    if (w.polygon) {
      if (pointInPoly(x, y, w.polygon)) return 0;
      for (let i = 0; i < w.polygon.length; i++) {
        const [ax, ay] = w.polygon[i];
        const [bx, by] = w.polygon[(i + 1) % w.polygon.length];
        best = Math.min(best, distToSegment(x, y, ax, ay, bx, by));
      }
    }
    if (w.line) {
      for (let i = 0; i < w.line.length - 1; i++) {
        const [ax, ay] = w.line[i];
        const [bx, by] = w.line[i + 1];
        best = Math.min(best, distToSegment(x, y, ax, ay, bx, by));
      }
    }
  }
  return best;
}

/**
 * Поле грунтовых вод 20×20. seed — модель (2040): возврат = те же классы.
 */
export function groundwaterField(water: WaterFeature[], seed: number): GwField {
  const ref = water.length > 0 ? water : [FALLBACK_PROTVA];
  const step = 1000 / GW_GRID;
  const cells: GwCell[] = [];
  const counts: [number, number, number] = [0, 0, 0];
  for (let i = 0; i < GW_GRID; i++) {
    for (let j = 0; j < GW_GRID; j++) {
      const x = (i + 0.5) * step;
      const y = (j + 0.5) * step;
      const d = distToWater(x, y, ref);
      const proximity = Math.max(0, 1 - d / 350);
      // «Рельеф»: крупный шум + мелкая рябь; близость к воде подтягивает низину.
      const elevation = smoothNoise(x, y, 260, seed) * 0.7 + smoothNoise(x, y, 90, seed + 17) * 0.3;
      const lowland = Math.max(0, Math.min(1, 0.6 * (1 - elevation) + 0.4 * proximity));
      const soil = hash(i, j, seed + 7);
      const v = Math.max(0, Math.min(1, 0.5 * proximity + 0.3 * lowland + 0.2 * soil));
      const cls: GwCell['cls'] = v < 0.35 ? 0 : v < 0.6 ? 1 : 2;
      counts[cls] += 1;
      cells.push({ x: i * step, y: j * step, w: step, h: step, cls, v: Math.round(v * 100) / 100 });
    }
  }
  const total = GW_GRID * GW_GRID;
  return {
    cells,
    share: [Math.round((counts[0] / total) * 100), Math.round((counts[1] / total) * 100), Math.round((counts[2] / total) * 100)],
  };
}

/** Ближайший к точке источник поверхностной воды — для подсказки в легенде. */
export function nearestWaterName(x: number, y: number, water: WaterFeature[]): string | null {
  let best = Infinity;
  let name: string | null = null;
  for (const w of water) {
    if (!w.name) continue;
    const d = distToWater(x, y, [w]);
    if (d < best) {
      best = d;
      name = w.name;
    }
  }
  return name;
}
