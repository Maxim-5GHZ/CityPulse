#!/usr/bin/env node
/**
 * OSM → DistrictModel / кэши кейса 03 «Обнинск 2040».
 * Реальная геометрия — только OpenStreetMap (ODbL, без ключей). Спутник запрещён (см. AGENTS.md).
 *
 * Профили (--fetch --profile <имя>):
 *   center  — здания центра (кэш obninsk-center.geojson уже сгенерирован; поддерживаем
 *             и старый режим: <overpass-raw.json> <out.geojson>);
 *   water   — реки/пруды вокруг центра в СЕТКЕ ЦЕНТРА (FR-31, грунтовые воды);
 *   roads   — магистрали у центра в сетке центра (FR-30, источники загрязнения);
 *   city    — все здания Обнинска с LOD-упрощением для «3D Весь город».
 *
 * Проекция: equirect вокруг центра (см. AGENTS.md):
 *   x=(lon-lon0)*111320*cos(lat0), y=(lat-lat0)*110540, сдвиг в 0..1000.
 * Волновод: список зеркал Overpass с повторами (основной сервер часто отдаёт 502).
 *
 * Использование:
 *   node scripts/osm-to-district.mjs /tmp/opencode/obninsk-raw.json frontend/public/osm/obninsk-center.geojson
 *   node scripts/osm-to-district.mjs --fetch --profile water
 *   node scripts/osm-to-district.mjs --fetch --profile roads
 *   node scripts/osm-to-district.mjs --fetch --profile city
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';

const SIZE = 1000; // метров сетки 0..1000
const CENTER = { lat: 55.096, lon: 36.61 }; // центр для солнца и проекции

// Фрагмент «Центр» (не меняем — мета уже в frontend/lib/city/proj.ts).
const CENTER_BBOX = { minLat: 55.0895, minLon: 36.598, maxLat: 55.0995, maxLon: 36.618 };
// Вода: захватываем Протву южнее центра и пруды рядом.
const WATER_BBOX = { minLat: 55.07, minLon: 36.572, maxLat: 55.108, maxLon: 36.65 };
// Магистрали у центра — источники загрязнения.
const ROADS_BBOX = { minLat: 55.082, minLon: 36.578, maxLat: 55.112, maxLon: 36.648 };
// Весь Обнинск: bbox города (relation 3396088, Nominatim).
const CITY_BBOX = { minLat: 55.0531, minLon: 36.5372, maxLat: 55.1464, maxLon: 36.6666 };

// Мета центра (из коммитнутого кэша; фолбэк — текущие значения proj.ts).
const CENTER_CACHE = 'frontend/public/osm/obninsk-center.geojson';
const FALLBACK_CENTER_META = {
  scale: 0.7440468685082533,
  dx: 586.3211325277877,
  dy: 594.1151744085284,
};

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

const MIRRORS = [
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function centerMeta() {
  if (existsSync(CENTER_CACHE)) {
    try {
      const fc = JSON.parse(readFileSync(CENTER_CACHE, 'utf8'));
      if (fc.meta?.scale) return { scale: fc.meta.scale, dx: fc.meta.dx, dy: fc.meta.dy };
    } catch {
      /* возьмём фолбэк */
    }
  }
  return FALLBACK_CENTER_META;
}

function makeProjector(center) {
  const cos = Math.cos((center.lat * Math.PI) / 180);
  return (lon, lat) => [(lon - center.lon) * 111320 * cos, (lat - center.lat) * 110540];
}

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

// --- Упрощение (Дуглас-Пекер), координаты — сырые метры от центра ---

function segDist(p, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  if (dx === 0 && dy === 0) return Math.hypot(p[0] - ax, p[1] - ay);
  const t = Math.max(0, Math.min(1, ((p[0] - ax) * dx + (p[1] - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(p[0] - (ax + t * dx), p[1] - (ay + t * dy));
}

function dp(pts, tol) {
  if (pts.length < 3) return pts;
  const [ax, ay] = pts[0];
  const [bx, by] = pts[pts.length - 1];
  let maxD = -1;
  let idx = -1;
  for (let i = 1; i < pts.length - 1; i++) {
    const d = segDist(pts[i], ax, ay, bx, by);
    if (d > maxD) {
      maxD = d;
      idx = i;
    }
  }
  if (maxD <= tol || idx < 0) return [pts[0], pts[pts.length - 1]];
  const left = dp(pts.slice(0, idx + 1), tol);
  const right = dp(pts.slice(idx), tol);
  return left.concat(right.slice(1));
}

function simplifyLine(pts, tol) {
  if (pts.length <= 3 || tol <= 0) return pts;
  return dp(pts, tol);
}

/** Кольцо без дубля последней точки, упрощаем двумя дугами через самые далёкие точки. */
function simplifyRing(ring, tol) {
  if (ring.length <= 4 || tol <= 0) return ring;
  const pts =
    ring.length > 1 && ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1]
      ? ring.slice(0, -1)
      : ring.slice();
  let i0 = 0;
  let i1 = 1;
  let best = -1;
  for (let i = 0; i < pts.length; i++) {
    for (let j = i + 1; j < pts.length; j++) {
      const d = (pts[i][0] - pts[j][0]) ** 2 + (pts[i][1] - pts[j][1]) ** 2;
      if (d > best) {
        best = d;
        i0 = i;
        i1 = j;
      }
    }
  }
  const arc1 = pts.slice(i0, i1 + 1);
  const arc2 = pts.slice(i1).concat(pts.slice(0, i0 + 1));
  const s1 = dp(arc1, tol);
  const s2 = dp(arc2, tol);
  return s1.concat(s2.slice(1, -1));
}

function ringArea(ring) {
  let s = 0;
  for (let i = 0; i < ring.length; i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[(i + 1) % ring.length];
    s += x1 * y2 - x2 * y1;
  }
  return Math.abs(s / 2);
}

// --- Overpass ---

async function fetchOverpass(ql) {
  let lastErr = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    for (const url of MIRRORS) {
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'CityPulse-hackathon/1.0' },
          body: 'data=' + encodeURIComponent(ql),
          signal: AbortSignal.timeout(180000),
        });
        const text = await res.text();
        if (!res.ok || !text.trim().startsWith('{')) throw new Error(`${url}: HTTP ${res.status}`);
        return JSON.parse(text);
      } catch (e) {
        lastErr = e;
        console.warn(`  зеркало ${url} не ответило: ${e.message}`);
      }
      await sleep(1500);
    }
    if (attempt < 3) {
      console.warn(`  повтор через 5 с (попытка ${attempt + 1}/3)…`);
      await sleep(5000);
    }
  }
  throw new Error(`Overpass недоступен: ${lastErr?.message}`);
}

const bboxQl = (b) => `${b.minLat},${b.minLon},${b.maxLat},${b.maxLon}`;

/**
 * Город качаем тайлами 4×4: один сплошной запрос на ~9.6к зданий перегружает
 * зеркала (502/timeout), а тайлы дают прогресс и переживают падение одного запроса.
 * Дубли (way на границе тайлов) схлопываем по id.
 */
async function fetchCityTiled(n = 4) {
  const elements = [];
  const seen = new Set();
  const dLat = (CITY_BBOX.maxLat - CITY_BBOX.minLat) / n;
  const dLon = (CITY_BBOX.maxLon - CITY_BBOX.minLon) / n;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const b = {
        minLat: CITY_BBOX.minLat + i * dLat,
        maxLat: CITY_BBOX.minLat + (i + 1) * dLat,
        minLon: CITY_BBOX.minLon + j * dLon,
        maxLon: CITY_BBOX.minLon + (j + 1) * dLon,
      };
      console.log(`  тайл ${i * n + j + 1}/${n * n}…`);
      const ql = `[out:json][timeout:120];way["building"](${bboxQl(b)});out geom;`;
      const jr = await fetchOverpass(ql);
      for (const el of jr.elements ?? []) {
        if (seen.has(el.id)) continue;
        seen.add(el.id);
        elements.push(el);
      }
      await sleep(1200);
    }
  }
  const rawPath = '/tmp/opencode/obninsk-city-raw.json';
  try {
    writeFileSync(rawPath, JSON.stringify({ elements }));
    console.log(`  сырой ответ сохранён: ${rawPath} (${elements.length} way)`);
  } catch {
    /* /tmp недоступен — не критично */
  }
  return { elements };
}

// --- Конвертеры ---

function convertBuildings(overpass, bbox, opts) {
  const { tolerance = 0, minArea = 20, max = 300, perCell = 0 } = opts;
  const project = makeProjector(CENTER);
  const els = overpass.elements ?? [];
  const feats = [];
  for (const el of els) {
    if (el.type !== 'way' || !Array.isArray(el.geometry) || el.geometry.length < 4) continue;
    const tags = el.tags ?? {};
    if (tags.building == null) continue;
    // Навесы/крыши без стен (building=roof) и руины — не здания для 3D.
    const kind0 = String(tags.building ?? '').toLowerCase();
    if (kind0 === 'roof' || kind0 === 'collapsed') continue;
    const closed =
      el.geometry[0].lat === el.geometry[el.geometry.length - 1].lat &&
      el.geometry[0].lon === el.geometry[el.geometry.length - 1].lon;
    let raw = el.geometry.map((p) => project(p.lon, p.lat));
    if (closed && tolerance > 0) raw = simplifyRing(raw, tolerance);
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
  let skippedTiny = 0;
  for (const f of feats) {
    const ring = f.raw.map(([x, y]) => [Math.round((x * scale + dx) * 10) / 10, Math.round((y * scale + dy) * 10) / 10]);
    const area = ringArea(ring) / (scale * scale); // назад в реальные м²
    if (area < minArea) {
      skippedTiny += 1;
      continue;
    }
    // Ячейка 1 км (сырые метры) — для честного LOD по районам города.
    let rcx = 0;
    let rcy = 0;
    for (const [x, y] of f.raw) {
      rcx += x;
      rcy += y;
    }
    rcx = Math.floor(rcx / f.raw.length / 1000);
    rcy = Math.floor(rcy / f.raw.length / 1000);
    const tags = f.tags;
    const levels = parseLevels(tags);
    let height = parseHeight(tags) ?? (levels != null ? levels * 3.0 : null);
    if (height == null) {
      const kind = String(tags.building ?? '').toLowerCase();
      height = DEFAULT_H[kind] ?? DEFAULT_H[tags.amenity] ?? 12;
    }
    const floors = levels ?? Math.max(1, Math.round(height / 3));
    out.push({
      type: 'Feature',
      properties: {
        id: f.id,
        label: mapLabel(tags, f.id),
        h: Math.round(height * 10) / 10,
        floors,
        roof: mapRoof(tags, height),
        preset: mapPreset(tags, levels),
        osmId: String(f.id),
        levels: levels ?? null,
        kind: tags.building ?? null,
        areaM2: Math.round(area),
      },
      geometry: { type: 'Polygon', coordinates: [ring] },
      _cell: `${rcx}:${rcy}`,
    });
  }
  // Лимит: perCell — квота на км² (LOD всего города, без дыр на окраинах),
  // иначе просто самые крупные первые (центр).
  let limited;
  if (perCell > 0) {
    const byCell = new Map();
    for (const f of out) {
      const arr = byCell.get(f._cell) ?? [];
      arr.push(f);
      byCell.set(f._cell, arr);
    }
    const picked = [];
    for (const arr of byCell.values()) {
      arr.sort((a, b) => b.properties.areaM2 - a.properties.areaM2);
      picked.push(...arr.slice(0, perCell));
    }
    picked.sort((a, b) => b.properties.areaM2 - a.properties.areaM2);
    limited = picked.slice(0, max);
  } else {
    out.sort((a, b) => b.properties.areaM2 - a.properties.areaM2);
    limited = out.slice(0, max);
  }
  const droppedByCap = out.length - limited.length;
  for (const f of limited) delete f._cell;
  return {
    type: 'FeatureCollection',
    meta: {
      source: 'OpenStreetMap (ODbL)',
      profile: 'buildings',
      bbox,
      center: CENTER,
      size: SIZE,
      scale,
      minX,
      minY,
      dx,
      dy,
      count: limited.length,
      elements: els.length,
      skippedTiny,
      droppedByCap,
    },
    features: limited,
  };
}

/** Вода: линии (waterway) и полигоны (natural=water, riverbank) в сетке центра. */
function convertWater(overpass, bbox) {
  const project = makeProjector(CENTER);
  const meta = centerMeta();
  const g2 = ([x, y]) => [
    Math.round((x * meta.scale + meta.dx) * 10) / 10,
    Math.round((y * meta.scale + meta.dy) * 10) / 10,
  ];
  const features = [];
  for (const el of overpass.elements ?? []) {
    if (el.type !== 'way' || !Array.isArray(el.geometry) || el.geometry.length < 2) continue;
    const tags = el.tags ?? {};
    const closed =
      el.geometry[0].lat === el.geometry[el.geometry.length - 1].lat &&
      el.geometry[0].lon === el.geometry[el.geometry.length - 1].lon;
    const rawPts = el.geometry.map((p) => project(p.lon, p.lat));
    const isPoly = closed && (tags.natural === 'water' || tags.waterway === 'riverbank' || tags.water === 'river');
    if (isPoly) {
      const ring = simplifyRing(rawPts, 2).map(g2);
      if (ringArea(rawPts) < 50) continue;
      features.push({
        type: 'Feature',
        properties: { kind: 'water_poly', name: tags.name ?? null },
        geometry: { type: 'Polygon', coordinates: [ring] },
      });
    } else if (tags.waterway) {
      const line = simplifyLine(rawPts, 2).map(g2);
      features.push({
        type: 'Feature',
        properties: { kind: 'water_line', name: tags.name ?? null, waterway: tags.waterway },
        geometry: { type: 'LineString', coordinates: line },
      });
    }
  }
  return {
    type: 'FeatureCollection',
    meta: {
      source: 'OpenStreetMap (ODbL)',
      profile: 'water',
      bbox,
      center: CENTER,
      size: SIZE,
      scale: meta.scale,
      dx: meta.dx,
      dy: meta.dy,
      grid: 'сетка центра: координаты могут выходить за 0..1000 (Протва южнее)',
      count: features.length,
    },
    features,
  };
}

/** Магистрали в сетке центра — источники загрязнения (FR-30). */
function convertRoads(overpass, bbox) {
  const project = makeProjector(CENTER);
  const meta = centerMeta();
  const g2 = ([x, y]) => [
    Math.round((x * meta.scale + meta.dx) * 10) / 10,
    Math.round((y * meta.scale + meta.dy) * 10) / 10,
  ];
  const features = [];
  for (const el of overpass.elements ?? []) {
    if (el.type !== 'way' || !Array.isArray(el.geometry) || el.geometry.length < 2) continue;
    const tags = el.tags ?? {};
    if (!tags.highway) continue;
    const line = simplifyLine(
      el.geometry.map((p) => project(p.lon, p.lat)),
      2,
    ).map(g2);
    features.push({
      type: 'Feature',
      properties: { kind: 'road', cls: tags.highway, name: tags.name ?? null },
      geometry: { type: 'LineString', coordinates: line },
    });
  }
  return {
    type: 'FeatureCollection',
    meta: {
      source: 'OpenStreetMap (ODbL)',
      profile: 'roads',
      bbox,
      center: CENTER,
      size: SIZE,
      scale: meta.scale,
      dx: meta.dx,
      dy: meta.dy,
      grid: 'сетка центра 0..1000',
      count: features.length,
    },
    features,
  };
}

// --- CLI ---

const PROFILES = {
  water: () => ({
    ql: `[out:json][timeout:90];(way["natural"="water"](${bboxQl(WATER_BBOX)});way["waterway"~"^(river|stream|canal|riverbank)$"](${bboxQl(WATER_BBOX)}););out geom;`,
    out: 'frontend/public/osm/obninsk-water.geojson',
    convert: (j) => convertWater(j, WATER_BBOX),
  }),
  roads: () => ({
    ql: `[out:json][timeout:90];way["highway"~"^(motorway|trunk|primary|secondary|tertiary)$"](${bboxQl(ROADS_BBOX)});out geom;`,
    out: 'frontend/public/osm/obninsk-roads.geojson',
    convert: (j) => convertRoads(j, ROADS_BBOX),
  }),
  city: () => ({
    ql: `[out:json][timeout:180];(way["building"](${bboxQl(CITY_BBOX)}););out geom;`,
    out: 'frontend/public/osm/obninsk-city.geojson',
    convert: (j) => convertBuildings(j, CITY_BBOX, { tolerance: 3, minArea: 60, max: 4000, perCell: 45 }),
  }),
};

async function main() {
  const args = process.argv.slice(2);
  const profileIdx = args.indexOf('--profile');
  const profile = profileIdx >= 0 ? args[profileIdx + 1] : null;
  const doFetch = args.includes('--fetch');

  if (profile) {
    if (!PROFILES[profile]) {
      console.error(`Неизвестный профиль «${profile}». Есть: ${Object.keys(PROFILES).join(', ')}`);
      process.exit(1);
    }
    const cfg = PROFILES[profile]();
    let overpass;
    if (doFetch) {
      console.log(`Тяну Overpass (профиль ${profile})…`);
      overpass = profile === 'city' ? await fetchCityTiled(4) : await fetchOverpass(cfg.ql);
    } else {
      const inPath = args.find((a) => a.endsWith('.json'));
      if (!inPath) {
        console.error('Без --fetch укажи входной overpass JSON');
        process.exit(1);
      }
      overpass = JSON.parse(readFileSync(inPath, 'utf8'));
    }
    const fc = cfg.convert(overpass);
    mkdirSync(dirname(cfg.out), { recursive: true });
    writeFileSync(cfg.out, JSON.stringify(fc) + '\n');
    const extra =
      fc.meta.skippedTiny != null
        ? ` (из ${fc.meta.elements ?? '?'} way: мелких ${fc.meta.skippedTiny}, за лимитом ${fc.meta.droppedByCap ?? 0})`
        : '';
    console.log(
      `Готово: ${fc.features.length} фич → ${cfg.out}${extra} · scale ${fc.meta.scale.toFixed(4)} · размер файла ${(
        JSON.stringify(fc).length / 1024
      ).toFixed(0)} КБ`,
    );
    return;
  }

  // Старый режим: overpass JSON → центр.
  const positional = args.filter((a) => a !== '--fetch');
  const inPath = positional[0];
  const outPath = positional[1] ?? 'frontend/public/osm/obninsk-center.geojson';
  if (!inPath) {
    console.error('Укажи входной overpass JSON, либо используй --fetch --profile <water|roads|city>');
    process.exit(1);
  }
  const overpass = JSON.parse(readFileSync(inPath, 'utf8'));
  const fc = convertBuildings(overpass, CENTER_BBOX, { tolerance: 1, minArea: 20, max: 300 });
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(fc) + '\n');
  console.log(`Готово: ${fc.features.length} зданий → ${outPath} (мелких отброшено: ${fc.meta.skippedTiny})`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
