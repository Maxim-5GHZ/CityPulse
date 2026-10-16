// Кейс 03 — FR-30: загрязнение воздуха.
// Провайдер по §9.6 сисанализа: рабочий «mock» офлайн — аддитивные плумы от трёх
// источников (трасса, котельная, парк-фон) со сносом по существующему полю ветра.
// Адаптеры OpenAQ / sensor.community / Sentinel-5P — только интерфейс-заглушки:
// ключей и прокси на хакатоне нет, в UI честный бейдж «мок, данные условные».
// Всё в метрах сетки 0..1000, как wind.ts.
import type { DistrictModel } from './model';
import type { WindCell } from './wind';

export interface PollutionSource {
  id: string;
  kind: 'road' | 'boiler' | 'park';
  label: string;
  /** точка-центр влияния, м сетки */
  x: number;
  y: number;
  /** вклад в поле: парк — отрицательный (поглощение/фон) */
  e: number;
  /** радиус влияния, м */
  l: number;
  /** полилиния для линейного источника (трасса) */
  line?: [number, number][];
}

export interface PollutionCell {
  x: number;
  y: number;
  w: number;
  h: number;
  /** 0..1 */
  v: number;
}

export interface PollutionField {
  cells: PollutionCell[];
  sources: PollutionSource[];
  /** максимум по полю — для подписи «пик у трассы» */
  max: number;
}

export interface PollutionProvider {
  kind: 'mock' | 'openaq' | 'sensor_community' | 'sentinel5p';
  getGrid(bbox: [number, number, number, number]): Promise<number[][]>;
}

/** Заглушки: интерфейс единый, подключение ключей — после хакатона (§9.6). */
export const POLLUTION_ADAPTERS = [
  { kind: 'openaq', label: 'OpenAQ', note: 'PM2.5/NO2 ближайших станций — нужен ключ' },
  { kind: 'sensor_community', label: 'sensor.community', note: 'народные датчики — нужен прокси' },
  { kind: 'sentinel5p', label: 'Sentinel-5P', note: 'колонка NO2 — спутник, после хакатона' },
] as const;

export const POL_GRID = 24;
export const POL_BASE = 0.12;
export const POL_THRESHOLDS: [number, number] = [0.33, 0.66];
/** Палитра: изумруд/янтарь/роза — как точки легенды ветра, без неона. */
export const POL_FILL = ['rgba(16, 185, 129, 0.22)', 'rgba(245, 158, 11, 0.26)', 'rgba(225, 29, 72, 0.26)'];
export const POL_LABELS = ['чисто', 'умеренно', 'грязно'];

export interface RoadLine {
  cls: string;
  name: string | null;
  line: [number, number][];
}

interface RoadsGeoJson {
  features: { properties: { cls?: string; name?: string | null }; geometry: { type: string; coordinates: number[][] } }[];
}

export async function loadRoads(): Promise<RoadLine[]> {
  try {
    const res = await fetch('/osm/obninsk-roads.geojson');
    if (!res.ok) return [];
    const fc = (await res.json()) as RoadsGeoJson;
    const out: RoadLine[] = [];
    for (const f of fc.features ?? []) {
      if (f.geometry?.type !== 'LineString') continue;
      const line = f.geometry.coordinates as [number, number][];
      if (line.length >= 2) out.push({ cls: f.properties?.cls ?? 'road', name: f.properties?.name ?? null, line });
    }
    return out;
  } catch {
    return [];
  }
}

/** Условная «трасса» — только если OSM-кэш дорог недоступен. */
const FALLBACK_ROAD: [number, number][] = [
  [-100, 880],
  [300, 870],
  [700, 850],
  [1100, 820],
];

function distToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  if (dx === 0 && dy === 0) return Math.hypot(px - ax, py - ay);
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function distToLine(px: number, py: number, line: [number, number][]): number {
  let best = Infinity;
  for (let i = 0; i < line.length - 1; i++) {
    best = Math.min(best, distToSegment(px, py, line[i][0], line[i][1], line[i + 1][0], line[i + 1][1]));
  }
  return best;
}

/** Три источника мока: самая длинная магистраль, высокая коробка-«котельная», парк. */
export function makeSources(model: DistrictModel, roads: RoadLine[]): PollutionSource[] {
  const sources: PollutionSource[] = [];

  let best: RoadLine | null = null;
  let bestLen = -1;
  for (const r of roads) {
    let len = 0;
    for (let i = 0; i < r.line.length - 1; i++) {
      len += Math.hypot(r.line[i + 1][0] - r.line[i][0], r.line[i + 1][1] - r.line[i][1]);
    }
    // Интересуют трассы, заходящие на карту 0..1000.
    const onMap = r.line.some(([x, y]) => x > -50 && x < 1050 && y > -50 && y < 1050);
    if (onMap && len > bestLen) {
      bestLen = len;
      best = r;
    }
  }
  const roadLine = best?.line ?? FALLBACK_ROAD;
  const mid = roadLine[Math.floor(roadLine.length / 2)];
  sources.push({
    id: 'src-road',
    kind: 'road',
    label: best?.name ? `Трасса «${best.name}»` : 'Трасса (условно)',
    x: mid[0],
    y: mid[1],
    e: 0.85,
    l: 170,
    line: roadLine,
  });

  const tall = [...model.buildings].sort((a, b) => b.h - a.h)[0];
  if (tall) {
    let cx = 0;
    let cy = 0;
    for (const [x, y] of tall.footprint) {
      cx += x;
      cy += y;
    }
    sources.push({
      id: 'src-boiler',
      kind: 'boiler',
      label: `Котельная у «${tall.label}»`,
      x: cx / tall.footprint.length,
      y: cy / tall.footprint.length,
      e: 0.7,
      l: 260,
    });
  }

  const park = model.attractions.find((a) => a.kind === 'park');
  const parkNode = park ? model.nodes.find((n) => n.id === park.nodeId) : null;
  if (parkNode) {
    sources.push({ id: 'src-park', kind: 'park', label: 'Парк (фон)', x: parkNode.x, y: parkNode.y, e: -0.12, l: 230 });
  }

  return sources;
}

function sourceDistance(x: number, y: number, s: PollutionSource): number {
  if (s.line) return distToLine(x, y, s.line);
  return Math.hypot(x - s.x, y - s.y);
}

/** Значение поля в точке: фон + аддитивные плумы exp(-d/L), клампим 0..1. */
function sampleAt(x: number, y: number, sources: PollutionSource[]): number {
  let v = POL_BASE;
  for (const s of sources) {
    v += s.e * Math.exp(-sourceDistance(x, y, s) / s.l);
  }
  return Math.max(0, Math.min(1, v));
}

/**
 * Поле загрязнения 24×24 со сносом ветром: значение ячейки берём с наветренной
 * точки (x − ux·drift, y − uy·drift), затем размываем 3×3. Ветер выключен —
 * drift = 0, шлейф статичен. Эвристика, не гауссовы плумы и не OpenFOAM.
 */
export function pollutionField(model: DistrictModel, roads: RoadLine[], windCells: WindCell[] | null): PollutionField {
  const sources = makeSources(model, roads);
  const u = windCells && windCells.length > 0 ? windCells[0] : null;
  const drift = u ? Math.min(140, u.speed * 24) : 0;
  const ux = u?.ux ?? 0;
  const uy = u?.uy ?? 0;

  const step = 1000 / POL_GRID;
  const raw: number[] = [];
  for (let i = 0; i < POL_GRID; i++) {
    for (let j = 0; j < POL_GRID; j++) {
      const x = (i + 0.5) * step;
      const y = (j + 0.5) * step;
      raw.push(sampleAt(x - ux * drift, y - uy * drift, sources));
    }
  }

  // Размытие 3×3 — мягкий шлейф вместо резких ячеек.
  const cells: PollutionCell[] = [];
  let max = 0;
  const at = (i: number, j: number) => raw[Math.max(0, Math.min(POL_GRID - 1, i)) * POL_GRID + Math.max(0, Math.min(POL_GRID - 1, j))];
  for (let i = 0; i < POL_GRID; i++) {
    for (let j = 0; j < POL_GRID; j++) {
      let sum = 0;
      let n = 0;
      for (let di = -1; di <= 1; di++) {
        for (let dj = -1; dj <= 1; dj++) {
          sum += at(i + di, j + dj);
          n += 1;
        }
      }
      const v = Math.round((sum / n) * 100) / 100;
      max = Math.max(max, v);
      cells.push({ x: i * step, y: j * step, w: step, h: step, v });
    }
  }
  return { cells, sources, max: Math.round(max * 100) / 100 };
}

export function pollutionClass(v: number): 0 | 1 | 2 {
  if (v < POL_THRESHOLDS[0]) return 0;
  if (v < POL_THRESHOLDS[1]) return 1;
  return 2;
}
