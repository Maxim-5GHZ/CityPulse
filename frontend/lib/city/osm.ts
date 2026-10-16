// Кейс 03 — загрузка OSM-кэша в DistrictModel.
// Кэш: frontend/public/osm/obninsk-center.geojson (коммитим, офлайн-демо).
// Next раздаёт только public/ (см. AGENTS.md). Упрощение tolerance 1м, дроп <20 м² —
// уже сделаны в scripts/osm-to-district.mjs; здесь — честный предел ~300 + валидация.
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

interface OsmCollection {
  type: string;
  features: OsmFeature[];
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

/** Догрузить реальные коробки поверх синтетического сида. Не мутирует вход. */
export async function withOsmBuildings(base: DistrictModel): Promise<DistrictModel> {
  const res = await fetch('/osm/obninsk-center.geojson');
  if (!res.ok) throw new Error(`OSM-кэш недоступен (код ${res.status})`);
  const fc = (await res.json()) as OsmCollection;
  const buildings: Building[] = [];
  for (const f of fc.features) {
    if (f.geometry?.type !== 'Polygon') continue;
    const ring = f.geometry.coordinates[0] ?? [];
    if (ring.length < 4) continue;
    if (ringArea(ring) < MIN_AREA) continue;
    const p = f.properties;
    const h = Number.isFinite(p.h) ? Math.min(75, Math.max(3, p.h)) : 12;
    buildings.push({
      id: `osm-${p.osmId}`,
      label: p.label || `Здание ${p.osmId}`,
      footprint: ring,
      h,
      floors: Number.isFinite(p.floors) && p.floors > 0 ? p.floors : Math.max(1, Math.round(h / 3)),
      roof: p.roof === 'flat' || p.roof === 'hip' ? p.roof : 'gable',
      preset: p.preset ?? 'custom',
      source: { osmId: p.osmId, levels: p.levels, kind: p.kind },
    });
    if (buildings.length >= MAX_BUILDINGS) break;
  }
  return { ...base, buildings };
}
