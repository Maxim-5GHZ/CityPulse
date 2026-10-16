// Кейс 03 — проекция сетка 0..1000 <-> lon/lat <-> EPSG:3857.
// Прямой ход — scripts/osm-to-district.mjs. Здесь обратный для подложки OSM.
export interface ProjMeta {
  center: { lat: number; lon: number };
  scale: number;
  dx: number;
  dy: number;
}

/** Дефолт из frontend/public/osm/obninsk-center.geojson (перегенерируй при смене кэша). */
export const DEFAULT_META: ProjMeta = {
  center: { lat: 55.096, lon: 36.61 },
  scale: 0.7440468685082533,
  dx: 586.3211325277877,
  dy: 594.1151744085284,
};

const COS_LAT = Math.cos((DEFAULT_META.center.lat * Math.PI) / 180);

export function gridToLonLat(x: number, y: number, meta: ProjMeta = DEFAULT_META): [number, number] {
  const rx = (x - meta.dx) / meta.scale;
  const ry = (y - meta.dy) / meta.scale;
  const cos = Math.cos((meta.center.lat * Math.PI) / 180);
  const lon = meta.center.lon + rx / (111320 * cos);
  const lat = meta.center.lat + ry / 110540;
  return [lon, lat];
}

export function lonLatToGrid(lon: number, lat: number, meta: ProjMeta = DEFAULT_META): [number, number] {
  const cos = Math.cos((meta.center.lat * Math.PI) / 180);
  const rx = (lon - meta.center.lon) * 111320 * cos;
  const ry = (lat - meta.center.lat) * 110540;
  return [rx * meta.scale + meta.dx, ry * meta.scale + meta.dy];
}

export { COS_LAT };
