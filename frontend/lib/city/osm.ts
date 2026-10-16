// Кейс 03 — загрузка OSM-кэшей в DistrictModel.
// Кэши: frontend/public/osm/*.geojson (коммитим, офлайн-демо; генерация —
// scripts/osm-to-district.mjs, профили water/roads/city).
// Next раздаёт только public/ (см. AGENTS.md). Упрощение и лимиты — уже в скрипте;
// здесь — валидация и повторная проверка площади/высоты.
import type { Building, DistrictModel } from './model';

interface OsmFeature {
  type: string;
  properties: {
    id: string;
    label: string;
    h: number;
    floors: number;
    roof: 'flat' | 'gable' | 'hip';
    preset: 'panel5' | 'tower16' | 'shkola' | 'tc' | 'custom';
    osmId: string;
    levels: number | null;
    kind: string | null;
  };
  geometry: { type: string; coordinates: [number, number][][] };
}

export interface OsmMeta {
  scale: number;
  dx: number;
  dy: number;
  center: { lat: number; lon: number };
}

interface OsmCollection {
  type: string;
  features: OsmFeature[];
  meta?: OsmMeta;
}

export interface OsmCity {
  buildings: Building[];
  /**
   * Мета городского кэша: сетка 0..1000 сжата на весь Обнинск.
   * Метры мира для 3D: (grid − 500) / scale.
   */
  meta: OsmMeta;
}

const MAX_BUILDINGS = 300;
const MIN_AREA = 20;

function ringArea(ring: [number, number][]): number {
  let s = 0;
  for (let i = 0; i < ring.length; i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[(i + 1) % ring.length];
    s += x1 * y2 - x2 * y1;
  }
  return Math.abs(s / 2);
}

function parseBuildings(features: OsmFeature[], limit: number, areaScale = 1): Building[] {
  const buildings: Building[] = [];
  for (const f of features) {
    if (f.geometry?.type !== 'Polygon') continue;
    const ring = f.geometry.coordinates[0] ?? [];
    if (ring.length < 4) continue;
    // Площадь в условных единицах сетки кэша: areaScale переводит её в ~м²
    // (городская сетка сжата в разы сильнее центральной — без поправки
    // вылетело бы почти всё: 240 коробок вместо 2796).
    if (ringArea(ring) * areaScale < MIN_AREA) continue;
    const p = f.properties;
    const h = Number.isFinite(p.h) ? Math.min(75, Math.max(3, p.h)) : 12;
    buildings.push({
      id: `osm-${p.osmId}`,
      label: p.label || `Здание ${p.osmId}`,
      footprint: ring,
      h,
      floors: Number.isFinite(p.floors) && p.floors > 0 ? p.floors : Math.max(1, Math.round(h / 3)),
      roof: p.roof === 'hip' ? 'hip' : 'flat',
      preset: p.preset ?? 'custom',
      source: { osmId: p.osmId, levels: p.levels, kind: p.kind },
    });
    if (buildings.length >= limit) break;
  }
  return buildings;
}

/** Догрузить реальные коробки центра поверх синтетического сида. Не мутирует вход. */
export async function withOsmBuildings(base: DistrictModel): Promise<DistrictModel> {
  const res = await fetch('/osm/obninsk-center.geojson');
  if (!res.ok) throw new Error(`OSM-кэш недоступен (код ${res.status})`);
  const fc = (await res.json()) as OsmCollection;
  return { ...base, buildings: parseBuildings(fc.features, MAX_BUILDINGS) };
}

/**
 * Весь Обнинск (LOD-кэш для охвата «Весь город» в 2D и 3D).
 * Городской файл уже ограничен квотой на км² — лимит здесь не нужен.
 * Сетка своя (meta.scale/dx/dy) — перевод в сетку центра делает extent.ts.
 */
export async function withOsmCity(): Promise<OsmCity> {
  const res = await fetch('/osm/obninsk-city.geojson');
  if (!res.ok) throw new Error(`Городской OSM-кэш недоступен (код ${res.status})`);
  const fc = (await res.json()) as OsmCollection;
  const meta = fc.meta;
  if (!meta || !Number.isFinite(meta.scale) || meta.scale <= 0) {
    throw new Error('В кэше города нет валидной меты проекции');
  }
  const areaScale = 1 / (meta.scale * meta.scale);
  return { buildings: parseBuildings(fc.features, Number.POSITIVE_INFINITY, areaScale), meta };
}
