#!/usr/bin/env node
/**
 * OSM → DistrictModel для кейса 03 «Обнинск 2040».
 * Реальная геометрия — только OpenStreetMap (ODbL, без ключей). Спутник запрещён (см. AGENTS.md).
 *
 * Вход: overpass JSON (way["building"](bbox); out geom;).
 * Выход: frontend/public/osm/obninsk-center.geojson — футпринты в метрах сетки 0..1000
 *   + высоты/этажи/крыши/пресеты. Коммитим, офлайн-демо.
 *
 * Проекция: equirect вокруг центра (см. AGENTS.md):
 *   x=(lon-lon0)*111320*cos(lat0), y=(lat-lat0)*110540, сдвиг в 0..1000.
 * Высота: height → парс, иначе levels*3.0, иначе дефолт по типу.
 * Крыша: roof:shape flat|gable|hip, иначе flat при h>15, gable при малом.
 * Пресет: levels<=5 panel5, >9 tower16, amenity=school shkola, shop=mall tc, иначе custom.
 * Упрощение на этом этапе не делаем (полигоны из OSM и так грубые, 5–87 точек);
 * дроп <20 м² и лимит ~300 — на стороне lib/city/osm.ts.
 *
 * Использование:
 *   node scripts/osm-to-district.mjs /tmp/opencode/obninsk-raw.json frontend/public/osm/obninsk-center.geojson
 *   node scripts/osm-to-district.mjs --fetch  # тянет Overpass server-side, потом конвертирует
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

// Фрагмент «Центр» (см. AGENTS.md). Bbox запроса Overpass.
const BBOX = { minLat: 55.0895, minLon: 36.598, maxLat: 55.0995, maxLon: 36.618 };
// Центр для солнца и проекции.
const CENTER = { lat: 55.096, lon: 36.61 };
const SIZE = 1000; // метров сетки 0..1000

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
const OVERPASS_QL = `[out:json][timeout:120];(way["building"](${BBOX.minLat},${BBOX.minLon},${BBOX.maxLat},${BBOX.maxLon});relation["building"](${BBOX.minLat},${BBOX.minLon},${BBOX.maxLat},${BBOX.maxLon}););out geom;`;

const DEFAULT_H = {
  residential: 15,
  apartments: 15,
  school: 12,
  retail: 10,
  commercial: 10,
  office: 12,
  garage: 4,
  garages: 4,
  service: 4,
  church: 18,
};

function parseHeight(tags) {
  const raw = tags.height;
  if (raw == null) return null;
  const m = String(raw).match(/[\d.,]+/);
  if (!m) return null;
  const v = parseFloat(m[0].replace(',', '.'));
  return Number.isFinite(v) && v > 0 && v < 300 ? v : null;
}

function parseLevels(tags) {
  const raw = tags['building:levels'];
  if (raw == null) return null;
  const v = parseInt(String(raw).trim(), 10);
  return Number.isFinite(v) && v > 0 && v < 100 ? v : null;
}

function mapRoof(tags, h) {
  const s = String(tags['roof:shape'] ?? tags['building:roof:shape'] ?? '').toLowerCase();
  if (s.includes('flat')) return 'flat';
  if (s.includes('hip')) return 'hip';
  if (s.includes('gabl') || s.includes('gambrel') || s.includes('pitched')) return 'gable';
  // roof:height без shape — скатная крыша.
  if (tags['roof:height'] != null) return 'hip';
  return h > 15 ? 'flat' : 'gable';
}

// Человеческий адрес из тегов OSM для подписей в UI.
function mapLabel(tags, fallbackId) {
  const street = tags.addr ?? tags['addr:street'];
  const num = tags['addr:housenumber'];
  if (street && num) return `${street}, ${num}`;
  if (tags.name) return String(tags.name);
  return `${tags.building ?? 'здание'} ${fallbackId}`;
}

function mapPreset(tags, levels) {
  const amenity = String(tags.amenity ?? '').toLowerCase();
  const shop = String(tags.shop ?? '').toLowerCase();
  if (amenity === 'school') return 'shkola';
  if (shop === 'mall' || tags.building === 'retail') return 'tc';
  if (levels != null && levels <= 5) return 'panel5';
  if (levels != null && levels > 9) return 'tower16';
  return 'custom';
}

function project(lon, lat) {
  const cos = Math.cos((CENTER.lat * Math.PI) / 180);
  const x = (lon - CENTER.lon) * 111320 * cos;
  const y = (lat - CENTER.lat) * 110540;
  return [x, y];
}

async function fetchOverpass() {
  const res = await fetch(OVERPASS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'CityPulse-hackathon/1.0' },
    body: 'data=' + encodeURIComponent(OVERPASS_QL),
  });
  if (!res.ok) throw new Error(`Overpass: HTTP ${res.status}`);
  return res.json();
}

function convert(overpass) {
  const els = overpass.elements ?? [];
  const feats = [];
  let skippedTiny = 0;
  for (const el of els) {
    if (el.type !== 'way' || !Array.isArray(el.geometry) || el.geometry.length < 4) continue;
    const tags = el.tags ?? {};
    if (tags.building == null) continue;
    // Навесы/крыши без стен (building=roof) и руины — не здания для 3D.
    const kind0 = String(tags.building ?? '').toLowerCase();
    if (kind0 === 'roof' || kind0 === 'collapsed') continue;
    // Сырые метры относительно центра.
    const raw = el.geometry.map((p) => project(p.lon, p.lat));
    feats.push({ id: `w${el.id}`, tags, raw });
  }
  // Сдвиг в 0..1000 по bbox сырых координат.
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const f of feats) {
    for (const [x, y] of f.raw) {
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  const w = maxX - minX || 1;
  const hgt = maxY - minY || 1;
  const scale = SIZE / Math.max(w, hgt);
  const dx = (SIZE - w * scale) / 2 - minX * scale;
  const dy = (SIZE - hgt * scale) / 2 - minY * scale;

  const out = [];
  for (const f of feats) {
    const ring = f.raw.map(([x, y]) => [Math.round((x * scale + dx) * 10) / 10, Math.round((y * scale + dy) * 10) / 10]);
    // Площадь по шнуркам (м² в сетке масштаба).
    let area = 0;
    for (let i = 0; i < ring.length; i++) {
      const [x1, y1] = ring[i];
      const [x2, y2] = ring[(i + 1) % ring.length];
      area += x1 * y2 - x2 * y1;
    }
    area = Math.abs(area / 2) / (scale * scale); // назад в реальные м²
    if (area < 20) {
      skippedTiny += 1;
      continue;
    }
    const tags = f.tags;
    const levels = parseLevels(tags);
    let height = parseHeight(tags) ?? (levels != null ? levels * 3.0 : null);
    if (height == null) {
      const kind = String(tags.building ?? '').toLowerCase();
      height = DEFAULT_H[kind] ?? DEFAULT_H[tags.amenity] ?? 12;
    }
    const floors = levels ?? Math.max(1, Math.round(height / 3));
    const roof = mapRoof(tags, height);
    const preset = mapPreset(tags, levels);
    const label = mapLabel(tags, f.id);
    out.push({
      type: 'Feature',
      properties: {
        id: f.id,
        label,
        h: Math.round(height * 10) / 10,
        floors,
        roof,
        preset,
        osmId: String(f.id),
        levels: levels ?? null,
        kind: tags.building ?? null,
        areaM2: Math.round(area),
      },
      geometry: { type: 'Polygon', coordinates: [ring] },
    });
  }
  // Лимит ~300 коробок: самые крупные первые (узнаваемый центр).
  out.sort((a, b) => b.properties.areaM2 - a.properties.areaM2);
  const limited = out.slice(0, 300);
  return {
    type: 'FeatureCollection',
    meta: {
      source: 'OpenStreetMap (ODbL)',
      bbox: BBOX,
      center: CENTER,
      size: SIZE,
      scale,
      minX,
      minY,
      dx,
      dy,
      count: limited.length,
      skippedTiny,
    },
    features: limited,
  };
}

async function main() {
  const args = process.argv.slice(2).filter((a) => a !== '--fetch');
  const doFetch = process.argv.includes('--fetch');
  const outPath = args[1] ?? 'frontend/public/osm/obninsk-center.geojson';
  let overpass;
  if (doFetch) {
    console.log('Тяну Overpass…');
    overpass = await fetchOverpass();
  } else {
    const inPath = args[0];
    if (!inPath) {
      console.error('Укажи входной overpass JSON или --fetch');
      process.exit(1);
    }
    overpass = JSON.parse(readFileSync(inPath, 'utf8'));
  }
  const fc = convert(overpass);
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(fc) + '\n');
  console.log(`Готово: ${fc.features.length} зданий → ${outPath} (мелких отброшено: ${fc.meta.skippedTiny})`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
