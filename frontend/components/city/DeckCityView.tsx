'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DeckGL } from '@deck.gl/react';
import {
  OrbitView,
  LightingEffect,
  AmbientLight,
  DirectionalLight,
} from '@deck.gl/core';
import type { OrbitViewState, Deck } from '@deck.gl/core';
import { PolygonLayer, PathLayer, ScatterplotLayer, TextLayer } from '@deck.gl/layers';
import {
  DistrictScenario,
  Building,
  BuildingTag,
  BUILDING_TAG_LABEL,
  GraphEdge,
  GraphNode,
  Amenity,
  PathResult,
} from '@/lib/city-engine/types';

interface DeckCityViewProps {
  scenario: DistrictScenario;
  selectedBuildingId: string | null;
  onSelectBuilding: (buildingId: string) => void;
  activePathNodeIds: string[];
  edgeLoads: Record<string, number>;
  busPaths: Record<string, PathResult | null>;
  parkPaths: Record<string, PathResult | null>;
  schoolPaths?: Record<string, PathResult | null>;
  shopPaths?: Record<string, PathResult | null>;
  // Маршрут А → Б из ПКМ: когда задан — отдельная группа идёт строго по нему.
  routePathNodeIds?: string[];
  simPlaying?: boolean;
  simSpeed?: 1 | 2 | 5;
}

type Vec3 = [number, number, number];

// САПР (960×620, Y вниз) → мир Deck.gl (центр в нуле, север вверх, Z вверх).
const toWorld = (x: number, y: number, z = 0): Vec3 => [x - 480, 320 - y, z];

// Вертикальные уровни слоёв (метры мира): разнесены, чтобы геометрия
// не z-файтила на скользящих углах камеры.
const Z_PARK = 0.2; // земля/газоны
const Z_UNDER = 0.35; // тоннель — под дорогой, но над землёй
const Z_ROAD = 0.6; // проезжая часть
const Z_RING = 0.65; // кольцо — чуть выше примыканий
const Z_SIDEWALK = 0.9; // тротуары/переходы/тропы — над асфальтом
const Z_GRASS_WALK = 0.85; // пешеходы по траве и полям — на уровне лужайки
const Z_PAVED_WALK = 1.4; // пешеходы на приподнятом тротуаре
const Z_ACTIVE_PATH = 2.2; // активный путь Дейкстры — поверх пешеходов
const Z_BUS_STOP = 3;

// Ширина полотна (метры).
const ROAD_WIDTH_WIDE = 22; // 4 полосы
const ROAD_WIDTH_NARROW = 14; // 2 полосы / кольцо
const CROSSING_WIDTH = 6;
const MINOR_WIDTH = 4; // тротуары, велодорожки, тропы

// Тепловая карта нагрузки (чел/час): WARN — порог bottleneck из metrics.ts:81,
// CRIT — двойной порог.
const HEAT_WARN = 400;
const HEAT_CRIT = 800;

// Сдвиг тротуара/велодорожки от оси дороги: половина узкой проезжей (7 м) +
// зазор, чтобы линия не лежала на асфальте и не z-файтила с дорогой.
const SIDEWALK_OFFSET_M = 7;

// Подложка-«планшет»: район лежит на земле, а не висит в бездне.
const GROUND_MARGIN_M = 140; // поля планшета вокруг застройки
const GRID_STEP_M = 50; // шаг САПР-сетки

// Заглушка парка (октагон): радиус из coverageRadiusM; кламп — чтобы не
// накрывать соседние дороги и не схлопываться в точку.
const DEFAULT_PARK_COVERAGE_M = 350;
const PARK_RADIUS_DIVISOR = 5;
const PARK_RADIUS_MIN = 28;
const PARK_RADIUS_MAX = 70;

// Ширина активного пути Дейкстры (метры).
const ACTIVE_PATH_WIDTH = 7;

// Цветовая палитра одежды горожан: живые, но некислотные городские цвета.
const CITIZEN_PALETTE: [number, number, number][] = [
  [37, 99, 235], // индиго
  [16, 185, 129], // изумрудный
  [217, 119, 6], // охра / тёплый песок
  [225, 29, 72], // рубиновый
  [124, 58, 237], // фиолетовый
  [14, 165, 233], // лазурный
  [234, 88, 12], // терракотовый
  [226, 232, 240], // светлый беж
  [74, 222, 128], // оливковый
  [244, 114, 182], // пудровый
];

const CITIZEN_NAMES = [
  'Иван', 'Анна', 'Дмитрий', 'Мария', 'Алексей',
  'Елена', 'Сергей', 'Ольга', 'Михаил', 'Полина',
  'Артём', 'Дарья', 'Никита', 'Екатерина', 'Роман',
];

// Подошва корпуса в координатах САПР: полигон как есть, иначе прямоугольник
// с поворотом как в SVG 2D-карты (rotate(a) по часовой при a>0 в Y-вниз: знак +a).
function buildingFootprintCAD(b: Building): [number, number][] {
  // Вырожденный контур (<3 точек) — осознанный фолбэк в прямоугольник.
  if (b.polygon && b.polygon.length >= 3) {
    return b.polygon.map((p): [number, number] => [p.x, p.y]);
  }
  const corners: [number, number][] = [
    [b.x, b.y],
    [b.x + b.width, b.y],
    [b.x + b.width, b.y + b.height],
    [b.x, b.y + b.height],
  ];
  if (!b.rotationDeg) return corners;
  const cx = b.x + b.width / 2;
  const cy = b.y + b.height / 2;
  const rad = (b.rotationDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return corners.map(([px, py]) => {
    const dx = px - cx;
    const dy = py - cy;
    return [cx + dx * cos - dy * sin, cy + dx * sin + dy * cos];
  });
}

// Сдвиг линии вбок (тротуары/велодорожки не лежат на оси дороги — иначе z-fight).
function offsetLineCAD(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  offset: number,
): [[number, number], [number, number]] {
  const dx = bx - ax;
  const dy = by - ay;
  const len = Math.hypot(dx, dy) || 1;
  const nx = (-dy / len) * offset;
  const ny = (dx / len) * offset;
  return [
    [ax + nx, ay + ny],
    [bx + nx, by + ny],
  ];
}

// Сшивка дуговых рёбер кольца в непрерывные пути: стыки отдельных хорд
// PathLayer не скругляет, поэтому кольцо едем одним объектом.
function buildRingPaths(edges: GraphEdge[], nodeMap: Map<string, GraphNode>): Vec3[][] {
  const ring = edges.filter((e) => e.isRoundabout);
  if (ring.length === 0) return [];
  const byNode = new Map<string, GraphEdge[]>();
  const link = (nodeId: string, e: GraphEdge): void => {
    const list = byNode.get(nodeId);
    if (list) list.push(e);
    else byNode.set(nodeId, [e]);
  };
  ring.forEach((e) => {
    link(e.from, e);
    link(e.to, e);
  });
  const used = new Set<string>();
  const paths: Vec3[][] = [];
  for (const seed of ring) {
    if (used.has(seed.id)) continue;
    used.add(seed.id);
    // Обход кольца: у узла простого кольца степень ровно 2, поэтому выбор
    // ребра, не ведущего назад, детерминирован. Обход ограничен числом рёбер.
    const seq: string[] = [seed.from, seed.to];
    let cur = seed.to;
    let prev = seed.from;
    for (let g = 0; g < ring.length; g++) {
      if (cur === seq[0]) break;
      const cands = (byNode.get(cur) ?? []).filter((e) => !used.has(e.id));
      if (cands.length === 0) break;
      const nxt = cands.find((e) => e.from !== prev && e.to !== prev) ?? cands[0];
      used.add(nxt.id);
      const nextNode = nxt.from === cur ? nxt.to : nxt.from;
      prev = cur;
      cur = nextNode;
      seq.push(cur);
    }
    const pts: Vec3[] = [];
    seq.forEach((id) => {
      const n = nodeMap.get(id);
      if (n) pts.push(toWorld(n.x, n.y, Z_RING));
    });
    if (pts.length >= 2) paths.push(pts);
  }
  return paths;
}

interface RoadChain {
  path: Vec3[];
  edgeIds: string[];
  isActive: boolean;
  width: number;
}

// Склейка рёбер проезжей части в непрерывные полилайны: проспект едет одним
// объектом, концы — только на тупиках. Иначе «цепочка сосисок»: круглый конец
// 22-метрового полотна на каждом узле даёт утолщения, которые глаз считывает
// как неровный край дороги. Цепь рвётся на поворотах (порог скалярного
// произведения 0.5), смене ширины и смене активности. Класса окраски в цепи
// больше нет: полотно всегда благородный асфальт, нагрузка видна только
// на тротуарах (см. minor-ways-layer) — дорога никогда не краснеет целиком.
function chainRoadEdges(
  edges: GraphEdge[],
  nodeMap: Map<string, GraphNode>,
): RoadChain[] {
  const roads = edges.filter((e) => e.type === 'road' && !e.isRoundabout);
  if (roads.length === 0) return [];
  const widthOf = (e: GraphEdge): number =>
    e.lanes === 4 ? ROAD_WIDTH_WIDE : ROAD_WIDTH_NARROW;
  const atNode = new Map<string, GraphEdge[]>();
  roads.forEach((e) => {
    atNode.set(e.from, [...(atNode.get(e.from) ?? []), e]);
    atNode.set(e.to, [...(atNode.get(e.to) ?? []), e]);
  });
  const used = new Set<string>();
  const chains: RoadChain[] = [];
  for (const seed of roads) {
    if (used.has(seed.id)) continue;
    used.add(seed.id);
    const width = widthOf(seed);
    const active = seed.isActive;
    const seq: string[] = [seed.from, seed.to];
    const ids: string[] = [seed.id];
    const extend = (end: 'head' | 'tail'): void => {
      for (let g = 0; g < roads.length; g++) {
        const curId = end === 'head' ? seq[seq.length - 1] : seq[0];
        const prevId = end === 'head' ? seq[seq.length - 2] : seq[1];
        const cur = nodeMap.get(curId);
        const prev = nodeMap.get(prevId);
        if (!cur || !prev) break;
        const ax = cur.x - prev.x;
        const ay = cur.y - prev.y;
        const alen = Math.hypot(ax, ay) || 1;
        let best: GraphEdge | null = null;
        let bestDot = 0.5;
        for (const cand of atNode.get(curId) ?? []) {
          if (used.has(cand.id)) continue;
          if (widthOf(cand) !== width) continue;
          if (cand.isActive !== active) continue;
          const otherId = cand.from === curId ? cand.to : cand.from;
          if (otherId === prevId) continue;
          const other = nodeMap.get(otherId);
          if (!other) continue;
          const bx = other.x - cur.x;
          const by = other.y - cur.y;
          const blen = Math.hypot(bx, by) || 1;
          const dot = (ax * bx + ay * by) / (alen * blen);
          if (dot > bestDot) {
            bestDot = dot;
            best = cand;
          }
        }
        if (!best) break;
        used.add(best.id);
        ids.push(best.id);
        const nextId = best.from === curId ? best.to : best.from;
        if (end === 'head') seq.push(nextId);
        else seq.unshift(nextId);
      }
    };
    extend('head');
    extend('tail');
    const pts: Vec3[] = [];
    seq.forEach((id) => {
      const n = nodeMap.get(id);
      if (n) pts.push(toWorld(n.x, n.y, Z_ROAD));
    });
    if (pts.length >= 2) chains.push({ path: pts, edgeIds: ids, isActive: active, width });
  }
  return chains;
}

interface MapLabel {
  position: Vec3;
  text: string;
  size: number;
}

// Подписи улиц привязаны к рёбрам пресета через nodeMap: нет ребра
// (кастомный проект) — нет подписи, висячих текстов не бывает.
const STREET_LABELS = [
  { edgeId: 'e-r2', text: 'пр. Маркса', offX: 0, offY: -26 },
  { edgeId: 'e-r6', text: 'ул. Гагарина', offX: 28, offY: 0 },
  { edgeId: 'e-k1', text: 'ул. Энгельса', offX: 0, offY: 30 },
] as const;

export type PathSurfaceType = 'trophinka' | 'trava';

interface PedestrianAgent {
  id: string;
  name: string;
  buildingId: string;
  fromName: string;
  toName: string;
  activity: string;
  pathType: PathSurfaceType;
  path: Vec3[];
  cumDist: number[];
  totalDist: number;
  speed: number; // м/с
  dist: number; // текущая позиция по длине пути (м)
  direction: 1 | -1; // 1 — к цели, -1 — обратно домой
  color: [number, number, number];
  pauseRemaining: number;
}

interface DisplayPedestrian {
  id: string;
  name: string;
  buildingId: string;
  fromName: string;
  toName: string;
  activity: string;
  pathType: PathSurfaceType;
  x: number;
  y: number;
  z: number;
  speed: number;
  direction: 1 | -1;
  color: [number, number, number];
}

// --- Геометрические проверки: пешеходы не ходят через шоссе и дома ---

function lineSegmentsIntersect(
  x1: number, y1: number, x2: number, y2: number,
  x3: number, y3: number, x4: number, y4: number,
  margin = 0.04,
): boolean {
  const d = (x2 - x1) * (y4 - y3) - (y2 - y1) * (x4 - x3);
  if (Math.abs(d) < 1e-9) return false;
  const t = ((x3 - x1) * (y4 - y3) - (y3 - y1) * (x4 - x3)) / d;
  const u = ((x3 - x1) * (y2 - y1) - (y3 - y1) * (x2 - x1)) / d;
  return t >= margin && t <= 1 - margin && u >= margin && u <= 1 - margin;
}

function isPointInsidePoly(px: number, py: number, poly: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0];
    const yi = poly[i][1];
    const xj = poly[j][0];
    const yj = poly[j][1];
    const intersect = yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function segmentHitsPolygon(
  x1: number, y1: number, x2: number, y2: number,
  poly: [number, number][],
): boolean {
  if (poly.length < 3) return false;
  if (isPointInsidePoly(x1, y1, poly) || isPointInsidePoly(x2, y2, poly)) return true;
  // Пробуем середины: отрезок может целиком лежать внутри полигона,
  // не задевая рёбер концами.
  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2;
  if (isPointInsidePoly(midX, midY, poly)) return true;
  const q1X = x1 * 0.75 + x2 * 0.25;
  const q1Y = y1 * 0.75 + y2 * 0.25;
  if (isPointInsidePoly(q1X, q1Y, poly)) return true;
  const q3X = x1 * 0.25 + x2 * 0.75;
  const q3Y = y1 * 0.25 + y2 * 0.75;
  if (isPointInsidePoly(q3X, q3Y, poly)) return true;

  for (let i = 0; i < poly.length; i++) {
    const next = (i + 1) % poly.length;
    if (
      lineSegmentsIntersect(
        x1, y1, x2, y2,
        poly[i][0], poly[i][1], poly[next][0], poly[next][1],
        0.01,
      )
    ) {
      return true;
    }
  }
  return false;
}

function segmentHitsAnyBuilding(
  x1: number, y1: number, x2: number, y2: number,
  buildings: Building[],
): boolean {
  for (const b of buildings) {
    if (segmentHitsPolygon(x1, y1, x2, y2, buildingFootprintCAD(b))) return true;
  }
  return false;
}

// Запрет пересечения шоссе вне санкционированных переходов: пересечь
// проезжую часть можно только по створам зебр/тоннелей из графа УДС,
// срезка напрямик через type==='road' запрещена.
function segmentCrossesHighway(
  x1: number, y1: number, x2: number, y2: number,
  scenario: DistrictScenario,
  nodeMap: Map<string, GraphNode>,
): boolean {
  for (const edge of scenario.edges) {
    if (edge.type !== 'road') continue;
    const u = nodeMap.get(edge.from);
    const v = nodeMap.get(edge.to);
    if (!u || !v) continue;
    if (lineSegmentsIntersect(x1, y1, x2, y2, u.x, u.y, v.x, v.y, 0.05)) {
      return true;
    }
  }
  return false;
}

interface GrassPoint {
  x: number;
  y: number;
}

// Срезка пути по газону / открытым полям (стринг-пуллинг): из текущей точки
// тянемся к самой дальней достижимой — отрезок годен, пока не задевает здания
// и не пересекает шоссе. Возвращает подмножество исходных точек (те же ссылки).
function shortcutRouteAcrossGrass(
  rawPoints: GrassPoint[],
  buildings: Building[],
  scenario: DistrictScenario,
  nodeMap: Map<string, GraphNode>,
): GrassPoint[] {
  if (rawPoints.length <= 2) return rawPoints;
  const result: GrassPoint[] = [rawPoints[0]];
  let curr = 0;
  while (curr < rawPoints.length - 1) {
    let furthest = curr + 1;
    for (let candidate = rawPoints.length - 1; candidate > curr + 1; candidate--) {
      const pA = rawPoints[curr];
      const pB = rawPoints[candidate];
      const hitsB = segmentHitsAnyBuilding(pA.x, pA.y, pB.x, pB.y, buildings);
      const crossesR = segmentCrossesHighway(pA.x, pA.y, pB.x, pB.y, scenario, nodeMap);
      if (!hitsB && !crossesR) {
        furthest = candidate;
        break;
      }
    }
    result.push(rawPoints[furthest]);
    curr = furthest;
  }
  return result;
}

// Построение маршрута по тропинкам / тротуарам (приоритизированный, по графу УДС).
// sidePreference: -1 — тротуар слева, +1 — справа, 0 — строго по оси
// (для активного пути Дейкстры: линия-подсветка идёт по центру, а не по обочине).
function buildPavedRoute(
  nodeIds: string[],
  scenario: DistrictScenario,
  nodeMap: Map<string, GraphNode>,
  sidePreference: -1 | 0 | 1,
  jitter: number,
  targetZ = Z_PAVED_WALK,
): Vec3[] {
  if (nodeIds.length < 2) return [];

  const edgeLookup = new Map<string, GraphEdge>();
  for (const e of scenario.edges) {
    edgeLookup.set(`${e.from}->${e.to}`, e);
    edgeLookup.set(`${e.to}->${e.from}`, e);
  }

  const result: Vec3[] = [];

  for (let i = 0; i < nodeIds.length; i++) {
    const curId = nodeIds[i];
    const curNode = nodeMap.get(curId);
    if (!curNode) continue;

    // Определяем прилегающее ребро к следующему или предыдущему узлу.
    const nextId = nodeIds[i + 1];
    const prevId = nodeIds[i - 1];
    const edge = nextId
      ? edgeLookup.get(`${curId}->${nextId}`)
      : prevId
        ? edgeLookup.get(`${prevId}->${curId}`)
        : null;

    let px = curNode.x;
    let py = curNode.y;

    if (edge && edge.type === 'road' && sidePreference !== 0) {
      const refNode = nextId
        ? nodeMap.get(nextId)
        : prevId
          ? nodeMap.get(prevId)
          : null;
      if (refNode) {
        const dx = refNode.x - curNode.x;
        const dy = refNode.y - curNode.y;
        const len = Math.hypot(dx, dy) || 1;
        const nx = -dy / len;
        const ny = dx / len;
        const halfW = edge.lanes === 4 ? 11 : 7;
        const offset = (halfW + 2.4) * sidePreference + jitter;
        px += nx * offset;
        py += ny * offset;
      }
    } else if (edge && (edge.type === 'sidewalk' || edge.type === 'park_path')) {
      px += jitter * 0.4;
      py += jitter * 0.4;
    }

    result.push(toWorld(px, py, targetZ));
  }

  return result;
}

// Построение маршрута срезкой через траву и поля: углы кварталов срезаются
// напрямик по лужайкам (стринг-пуллинг), шоссе и дома не задеваются.
// Нюанс: хорда между соседними узлами графа совпадает с ребром УДС — если это
// проезжая часть, идём по тротуару вдоль неё (сдвиг), а не по асфальту.
function buildGrassRoute(
  nodeIds: string[],
  scenario: DistrictScenario,
  nodeMap: Map<string, GraphNode>,
  jitter: number,
  targetZ = Z_GRASS_WALK,
): Vec3[] {
  if (nodeIds.length < 2) return [];

  const rawPts: GrassPoint[] = [];
  const rawIds: string[] = [];
  nodeIds.forEach((id) => {
    const n = nodeMap.get(id);
    if (n) {
      rawPts.push({ x: n.x, y: n.y });
      rawIds.push(id);
    }
  });
  if (rawPts.length < 2) return [];

  const cutPts = shortcutRouteAcrossGrass(rawPts, scenario.buildings, scenario, nodeMap);
  const rawIndex = new Map<GrassPoint, number>();
  rawPts.forEach((p, i) => rawIndex.set(p, i));

  const edgeLookup = new Map<string, GraphEdge>();
  for (const e of scenario.edges) {
    edgeLookup.set(`${e.from}->${e.to}`, e);
    edgeLookup.set(`${e.to}->${e.from}`, e);
  }

  const result: Vec3[] = [];
  for (let s = 0; s < cutPts.length - 1; s++) {
    const a = cutPts[s];
    const b = cutPts[s + 1];
    let ax = a.x + jitter * 0.3;
    let ay = a.y + jitter * 0.3;
    let bx = b.x + jitter * 0.3;
    let by = b.y + jitter * 0.3;

    // Хорда = ребро проезжей части: уходим на тротуар вдоль неё.
    const ia = rawIndex.get(a);
    const ib = rawIndex.get(b);
    if (ia !== undefined && ib !== undefined && Math.abs(ia - ib) === 1) {
      const edge = edgeLookup.get(`${rawIds[ia]}->${rawIds[ib]}`);
      if (edge && edge.type === 'road') {
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const len = Math.hypot(dx, dy) || 1;
        const halfW = edge.lanes === 4 ? 11 : 7;
        const off = halfW + 2.4;
        ax = a.x + (-dy / len) * off;
        ay = a.y + (dx / len) * off;
        bx = b.x + (-dy / len) * off;
        by = b.y + (dx / len) * off;
      }
    }

    if (s === 0) result.push(toWorld(ax, ay, targetZ));
    result.push(toWorld(bx, by, targetZ));
  }

  return result;
}

function computeCumulativeDistances(pts: Vec3[]): number[] {
  const cum = [0];
  for (let i = 1; i < pts.length; i++) {
    const dx = pts[i][0] - pts[i - 1][0];
    const dy = pts[i][1] - pts[i - 1][1];
    const dz = pts[i][2] - pts[i - 1][2];
    cum.push(cum[i - 1] + Math.hypot(dx, dy, dz));
  }
  return cum;
}

// Точка на пути на дистанции dist (метры): бинпоиск сегмента + лерп.
function samplePointOnPath(pts: Vec3[], cum: number[], dist: number): Vec3 {
  if (dist <= 0) return pts[0];
  const last = pts.length - 1;
  if (dist >= cum[last]) return pts[last];
  let lo = 0;
  let hi = last;
  while (lo + 1 < hi) {
    const mid = (lo + hi) >> 1;
    if (cum[mid] <= dist) lo = mid;
    else hi = mid;
  }
  const span = cum[hi] - cum[lo] || 1;
  const t = (dist - cum[lo]) / span;
  const a = pts[lo];
  const b = pts[hi];
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ];
}

function agentToDisplay(ag: PedestrianAgent): DisplayPedestrian {
  const pt = samplePointOnPath(ag.path, ag.cumDist, ag.dist);
  return {
    id: ag.id,
    name: ag.name,
    buildingId: ag.buildingId,
    fromName: ag.fromName,
    toName: ag.toName,
    activity: ag.activity,
    pathType: ag.pathType,
    x: pt[0],
    y: pt[1],
    z: pt[2],
    speed: ag.speed,
    direction: ag.direction,
    color: ag.color,
  };
}

// Архитектурный свет для экструдированных корпусов (синглтоны — вне рендера).
const ambientLight = new AmbientLight({ color: [255, 255, 255], intensity: 0.9 });
const dirLight = new DirectionalLight({
  color: [255, 255, 255],
  intensity: 1.8,
  direction: [-300, -500, -400],
});
const lightingEffect = new LightingEffect({ ambientLight, dirLight });
const orbitView = new OrbitView({ id: 'orbit' });

export default function DeckCityView({
  scenario,
  selectedBuildingId,
  onSelectBuilding,
  activePathNodeIds,
  edgeLoads,
  busPaths,
  parkPaths,
  schoolPaths = {},
  shopPaths = {},
  routePathNodeIds = [],
  simPlaying = true,
  simSpeed = 1,
}: DeckCityViewProps) {
  const nodeMap = useMemo(
    () => new Map<string, GraphNode>(scenario.nodes.map((n) => [n.id, n])),
    [scenario.nodes],
  );

  // Генерация пула независимых пешеходов (вразнобой): каждый юнит —
  // автономный агент со своим именем, скоростью, фазой пути, направлением,
  // целью (школа/остановка/сквер/магазин) и типом покрытия (тропинка/трава).
  // Чередуем приоритизированный маршрут по тротуарам и срезку по газонам.
  const initialAgents = useMemo<PedestrianAgent[]>(() => {
    const agents: PedestrianAgent[] = [];
    let globalIdx = 0;

    scenario.buildings.forEach((b) => {
      const busPath = busPaths[b.id];
      const parkPath = parkPaths[b.id];
      const schoolPath = schoolPaths?.[b.id];
      const shopPath = shopPaths?.[b.id];

      // 1. Школьники: дом <-> школа (школы — и отдельные объекты, и корпуса
      // с тегом school: оба уже сведены в schoolPaths движком).
      if (schoolPath && schoolPath.pathNodeIds.length >= 2) {
        const schoolCount = Math.min(4, Math.max(2, Math.round(b.residents / 300)));
        for (let k = 0; k < schoolCount; k++) {
          globalIdx++;
          // Школьники обожают срезать: 75% идут напрямик по газонам.
          const isGrass = k % 4 !== 0;
          const jitter = ((k * 19) % 7 - 3) * 0.45;
          const path = isGrass
            ? buildGrassRoute(schoolPath.pathNodeIds, scenario, nodeMap, jitter, Z_GRASS_WALK)
            : buildPavedRoute(
                schoolPath.pathNodeIds,
                scenario,
                nodeMap,
                k % 2 === 0 ? 1 : -1,
                jitter,
                Z_PAVED_WALK,
              );
          if (path.length < 2) continue;
          const cumDist = computeCumulativeDistances(path);
          const totalDist = cumDist[cumDist.length - 1];
          if (totalDist < 5) continue;

          // Кто-то идёт из школы домой, кто-то из дома в школу.
          const startsFromSchool = (globalIdx + k) % 2 === 1;
          const startDist = (globalIdx * 61.3 + k * 31) % totalDist;
          const speed = 1.1 + ((globalIdx * 13) % 5) * 0.08;
          agents.push({
            id: `ped-school-${b.id}-${k}`,
            name: `${CITIZEN_NAMES[globalIdx % CITIZEN_NAMES.length]} (Ученик)`,
            buildingId: b.id,
            fromName: startsFromSchool ? 'Школа' : b.name,
            toName: startsFromSchool ? b.name : 'Школа',
            activity: startsFromSchool ? 'Из школы домой' : 'В школу',
            pathType: isGrass ? 'trava' : 'trophinka',
            path,
            cumDist,
            totalDist,
            speed,
            dist: startDist,
            direction: 1,
            color: isGrass ? [234, 179, 8] : [249, 115, 22],
            pauseRemaining: 0,
          });
        }
      }

      // 2. Пешеходы к остановке / с остановки: часть — по тротуарам,
      // половина спешит и срезает через газон/поле.
      if (busPath && busPath.pathNodeIds.length >= 2) {
        const busAgentCount = Math.min(5, Math.max(2, Math.round(b.residents / 350)));
        for (let k = 0; k < busAgentCount; k++) {
          globalIdx++;
          // Взрослые спешат: 50% идут по траве.
          const isGrass = k % 2 !== 0;
          const jitter = ((k * 17) % 5 - 2) * 0.55;
          const path = isGrass
            ? buildGrassRoute(busPath.pathNodeIds, scenario, nodeMap, jitter, Z_GRASS_WALK)
            : buildPavedRoute(
                busPath.pathNodeIds,
                scenario,
                nodeMap,
                k % 2 === 0 ? 1 : -1,
                jitter,
                Z_PAVED_WALK,
              );
          if (path.length < 2) continue;
          const cumDist = computeCumulativeDistances(path);
          const totalDist = cumDist[cumDist.length - 1];
          if (totalDist < 5) continue;

          const startsFromStop = (globalIdx + k) % 2 === 1;
          const startDist = (globalIdx * 73.1 + k * 29) % totalDist;
          const speed = 1.15 + ((globalIdx * 19) % 7) * 0.06; // ~4.1–5.4 км/ч
          agents.push({
            id: `ped-bus-${b.id}-${k}`,
            name: CITIZEN_NAMES[globalIdx % CITIZEN_NAMES.length],
            buildingId: b.id,
            fromName: startsFromStop ? 'Остановка' : b.name,
            toName: startsFromStop ? b.name : 'Остановка',
            activity: startsFromStop ? 'С остановки домой' : 'На остановку',
            pathType: isGrass ? 'trava' : 'trophinka',
            path,
            cumDist,
            totalDist,
            speed,
            dist: startDist,
            direction: 1,
            color: isGrass
              ? [16, 185, 129]
              : CITIZEN_PALETTE[(globalIdx * 3) % CITIZEN_PALETTE.length],
            pauseRemaining: 0,
          });
        }
      }

      // 3. Пешеходы в сквер: в парк чаще идут по траве и полям.
      if (parkPath && parkPath.pathNodeIds.length >= 2) {
        const parkAgentCount = Math.min(3, Math.max(1, Math.round(b.residents / 500)));
        for (let k = 0; k < parkAgentCount; k++) {
          globalIdx++;
          // Гуляющие не любят асфальт: 75% идут по траве.
          const isGrass = k % 4 !== 3;
          const jitter = ((k * 13) % 5 - 2) * 0.6;
          const path = isGrass
            ? buildGrassRoute(parkPath.pathNodeIds, scenario, nodeMap, jitter, Z_GRASS_WALK)
            : buildPavedRoute(parkPath.pathNodeIds, scenario, nodeMap, -1, jitter, Z_PAVED_WALK);
          if (path.length < 2) continue;
          const cumDist = computeCumulativeDistances(path);
          const totalDist = cumDist[cumDist.length - 1];
          if (totalDist < 5) continue;

          const startDist = (globalIdx * 53.7 + k * 37) % totalDist;
          const speed = 1.05 + ((globalIdx * 11) % 6) * 0.06;
          agents.push({
            id: `ped-park-${b.id}-${k}`,
            name: CITIZEN_NAMES[(globalIdx + 5) % CITIZEN_NAMES.length],
            buildingId: b.id,
            fromName: b.name,
            toName: 'Сквер',
            activity: isGrass ? 'Прогулка по траве' : 'В сквер',
            pathType: isGrass ? 'trava' : 'trophinka',
            path,
            cumDist,
            totalDist,
            speed,
            dist: startDist,
            direction: 1,
            color: [74, 222, 128],
            pauseRemaining: 0,
          });
        }
      }

      // 4. Пешеходы в магазин / сервисы (один на дом, если путь есть).
      if (shopPath && shopPath.pathNodeIds.length >= 2) {
        globalIdx++;
        const isGrass = globalIdx % 2 === 1;
        const path = isGrass
          ? buildGrassRoute(shopPath.pathNodeIds, scenario, nodeMap, 0.4, Z_GRASS_WALK)
          : buildPavedRoute(shopPath.pathNodeIds, scenario, nodeMap, 1, 0, Z_PAVED_WALK);
        if (path.length >= 2) {
          const cumDist = computeCumulativeDistances(path);
          const totalDist = cumDist[cumDist.length - 1];
          if (totalDist >= 5) {
            agents.push({
              id: `ped-shop-${b.id}`,
              name: CITIZEN_NAMES[(globalIdx + 3) % CITIZEN_NAMES.length],
              buildingId: b.id,
              fromName: b.name,
              toName: 'Магазин',
              activity: 'За покупками',
              pathType: isGrass ? 'trava' : 'trophinka',
              path,
              cumDist,
              totalDist,
              speed: 1.2,
              dist: (globalIdx * 43.1) % totalDist,
              direction: 1,
              color: [147, 51, 234],
              pauseRemaining: 0,
            });
          }
        }
      }
    });

    // 5. Маршрут А → Б (точки ставит пользователь через ПКМ на 2D-карте):
    // отдельная группа из 6 агентов идёт строго по заданной линии туда-обратно.
    // Маршрута нет — все ведут себя как обычно (блоки 1–4 выше).
    if (routePathNodeIds.length >= 2) {
      const routePath = buildPavedRoute(routePathNodeIds, scenario, nodeMap, 0, 0, Z_PAVED_WALK);
      if (routePath.length >= 2) {
        const cumDist = computeCumulativeDistances(routePath);
        const totalDist = cumDist[cumDist.length - 1];
        if (totalDist >= 5) {
          for (let k = 0; k < 6; k++) {
            globalIdx++;
            // Чётные — туда (А → Б), нечётные — обратно по развёрнутой линии.
            const back = k % 2 === 1;
            const path = back ? [...routePath].reverse() : routePath;
            const cum = back ? computeCumulativeDistances(path) : cumDist;
            agents.push({
              id: `ped-route-${k}`,
              name: CITIZEN_NAMES[globalIdx % CITIZEN_NAMES.length],
              buildingId: '',
              fromName: back ? 'Точка Б' : 'Точка А',
              toName: back ? 'Точка А' : 'Точка Б',
              activity: 'По маршруту А → Б',
              pathType: 'trophinka',
              path,
              cumDist: cum,
              totalDist,
              speed: 1.2 + (k % 3) * 0.07,
              dist: (k * totalDist) / 6,
              direction: 1,
              color: [168, 85, 247],
              pauseRemaining: 0,
            });
          }
        }
      }
    }

    return agents;
  }, [scenario, busPaths, parkPaths, schoolPaths, shopPaths, routePathNodeIds, nodeMap]);

  // Мутабельный массив агентов для симуляции 60 кадров/сек.
  const agentsRef = useRef<PedestrianAgent[]>([]);
  useEffect(() => {
    agentsRef.current = initialAgents.map((a) => ({ ...a }));
  }, [initialAgents]);

  const [displayAgents, setDisplayAgents] = useState<DisplayPedestrian[]>([]);

  // Колбэк выбора через ref: родитель передаёт инлайн-стрелку каждый рендер,
  // ей не место в deps слоёв, иначе статика пересоздаётся постоянно.
  const selectRef = useRef(onSelectBuilding);
  useEffect(() => {
    selectRef.current = onSelectBuilding;
  }, [onSelectBuilding]);

  // Уважение к prefers-reduced-motion: один статичный кадр вместо петли.
  const [reducedMotion, setReducedMotion] = useState(false);
  useEffect(() => {
    const q = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(q.matches);
    const fn = () => setReducedMotion(q.matches);
    q.addEventListener('change', fn);
    return () => q.removeEventListener('change', fn);
  }, []);

  // Игровая петля независимых пешеходов; пауза и скорость — из тулбара.
  // Уважение к prefers-reduced-motion — ниже: вместо петли один статичный кадр.
  useEffect(() => {
    if (!simPlaying || reducedMotion) return;
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.08, (now - last) / 1000);
      last = now;

      const mult = simSpeed ?? 1;
      agentsRef.current.forEach((ag) => {
        if (ag.pauseRemaining > 0) {
          ag.pauseRemaining -= dt * mult;
          return;
        }

        ag.dist += ag.direction * ag.speed * dt * mult;

        if (ag.dist >= ag.totalDist) {
          ag.dist = ag.totalDist;
          ag.direction = -1;
          ag.pauseRemaining = 1.5 + (ag.speed % 1.5); // отдых перед возвращением
        } else if (ag.dist <= 0) {
          ag.dist = 0;
          ag.direction = 1;
          ag.pauseRemaining = 2.0 + (ag.speed % 2.0); // дома перед выходом
        }
      });

      setDisplayAgents(agentsRef.current.map(agentToDisplay));
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [simPlaying, simSpeed, reducedMotion]);

  // Пауза замораживает сцену, а не опустошает её: при остановке петли
  // один раз фиксируем текущие позиции (иначе displayAgents остаётся []).
  // Покрывает и старт с паузой, и возврат в 3D после размонтирования.
  useEffect(() => {
    if (simPlaying || reducedMotion) return;
    setDisplayAgents(agentsRef.current.map(agentToDisplay));
  }, [simPlaying, reducedMotion, initialAgents]);

  // prefers-reduced-motion: один статичный кадр вместо петли — агенты стоят
  // на стартовых дистанциях, геометрия и подписи на месте.
  useEffect(() => {
    if (!reducedMotion) return;
    setDisplayAgents(initialAgents.map(agentToDisplay));
  }, [reducedMotion, initialAgents]);

  // Активный маршрут Дейкстры для выделенного дома: линия-подсветка идёт
  // строго по оси (sidePreference 0 — без сдвига на тротуар).
  const activePathCoords = useMemo(
    () => buildPavedRoute(activePathNodeIds, scenario, nodeMap, 0, 0, Z_ACTIVE_PATH),
    [activePathNodeIds, scenario, nodeMap],
  );

  // Центр кадра — по bbox сценария, а не жёсткий [0,0,0]: кастомные
  // дороги из handleAddRoad иначе уезжают из вида. Однопроходный min/max.
  const viewTarget = useMemo<Vec3>(() => {
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    const eat = (x: number, y: number): void => {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    };
    scenario.nodes.forEach((n) => eat(n.x, n.y));
    scenario.buildings.forEach((b) => {
      buildingFootprintCAD(b).forEach(([px, py]) => eat(px, py));
    });
    if (minX > maxX) return [0, 0, 0];
    return [(minX + maxX) / 2 - 480, 320 - (minY + maxY) / 2, 0];
  }, [scenario.nodes, scenario.buildings]);

  // Контролируемая камера: пользователь крутит свободно, за новым сценарием
  // едем только target'ом — зум и наклон сохраняем.
  const [viewState, setViewState] = useState<OrbitViewState>({
    target: viewTarget,
    zoom: 0.4,
    rotationX: 50,
    rotationOrbit: 0,
    minZoom: -2,
    maxZoom: 5,
  });
  useEffect(() => {
    setViewState((v) => ({ ...v, target: viewTarget }));
  }, [viewTarget]);

  // Статика: пересоздаётся только при смене сценария/выбора/нагрузок.
  // Сюда НЕ входит time — иначе все слои rebuild'ились бы 60 раз/сек.
  const staticLayers = useMemo(() => {
    // Земля-«планшет» + САПР-сетка: район лежит на подложке, чёрная
    // бездна под сценой закрыта. Тот же bbox, что у viewTarget.
    let gMinX = Infinity;
    let gMaxX = -Infinity;
    let gMinY = Infinity;
    let gMaxY = -Infinity;
    scenario.nodes.forEach((n) => {
      if (n.x < gMinX) gMinX = n.x;
      if (n.x > gMaxX) gMaxX = n.x;
      if (n.y < gMinY) gMinY = n.y;
      if (n.y > gMaxY) gMaxY = n.y;
    });
    scenario.buildings.forEach((b) => {
      buildingFootprintCAD(b).forEach(([px, py]) => {
        if (px < gMinX) gMinX = px;
        if (px > gMaxX) gMaxX = px;
        if (py < gMinY) gMinY = py;
        if (py > gMaxY) gMaxY = py;
      });
    });
    if (!isFinite(gMinX)) {
      gMinX = 0;
      gMaxX = 960;
      gMinY = 0;
      gMaxY = 620;
    }
    const gx0 = gMinX - GROUND_MARGIN_M;
    const gx1 = gMaxX + GROUND_MARGIN_M;
    const gy0 = gMinY - GROUND_MARGIN_M;
    const gy1 = gMaxY + GROUND_MARGIN_M;
    const ground = new PolygonLayer<{ poly: Vec3[] }>({
      id: 'ground-layer',
      data: [
        {
          poly: [
            toWorld(gx0, gy0, 0),
            toWorld(gx1, gy0, 0),
            toWorld(gx1, gy1, 0),
            toWorld(gx0, gy1, 0),
          ],
        },
      ],
      getPolygon: (d) => d.poly,
      getFillColor: [26, 33, 46, 255],
      stroked: false,
      filled: true,
      pickable: false,
    });
    const gridLines: Vec3[][] = [];
    for (
      let gx = Math.floor(gx0 / GRID_STEP_M) * GRID_STEP_M;
      gx <= gx1;
      gx += GRID_STEP_M
    ) {
      gridLines.push([toWorld(gx, gy0, 0.05), toWorld(gx, gy1, 0.05)]);
    }
    for (
      let gy = Math.floor(gy0 / GRID_STEP_M) * GRID_STEP_M;
      gy <= gy1;
      gy += GRID_STEP_M
    ) {
      gridLines.push([toWorld(gx0, gy, 0.05), toWorld(gx1, gy, 0.05)]);
    }
    const grid = new PathLayer<{ path: Vec3[] }>({
      id: 'grid-layer',
      data: gridLines.map((path) => ({ path })),
      getPath: (d) => d.path,
      getColor: [148, 163, 184, 36],
      getWidth: 1,
      widthMinPixels: 1,
      pickable: false,
    });
    const parks = new PolygonLayer<Amenity>({
      id: 'parks-layer',
      data: scenario.amenities.filter((a) => a.type === 'park'),
      getPolygon: (p) => {
        if (p.polygon && p.polygon.length >= 3) {
          return p.polygon.map((pt) => toWorld(pt.x, pt.y, Z_PARK));
        }
        const n = nodeMap.get(p.nodeId);
        const cx = n?.x ?? 250;
        const cy = n?.y ?? 450;
        // Октагон-заглушка из coverageRadiusM — fixed-прямоугольник
        // накрывал соседние дороги.
        const r = Math.max(
          PARK_RADIUS_MIN,
          Math.min(
            PARK_RADIUS_MAX,
            (p.coverageRadiusM || DEFAULT_PARK_COVERAGE_M) / PARK_RADIUS_DIVISOR,
          ),
        );
        const pts: Vec3[] = [];
        for (let k = 0; k < 8; k++) {
          const a = (k / 8) * Math.PI * 2;
          pts.push(toWorld(cx + Math.cos(a) * r, cy + Math.sin(a) * r, Z_PARK));
        }
        return pts;
      },
      getFillColor: [20, 83, 45, 180],
      getLineColor: [34, 197, 94, 200],
      lineWidthMinPixels: 1,
      stroked: true,
      filled: true,
    });

    const roadChains = new PathLayer<RoadChain>({
      id: 'road-chains-layer',
      data: chainRoadEdges(scenario.edges, nodeMap),
      getPath: (d) => d.path,
      // Проезжая часть — всегда благородный асфальт, вне зависимости от нагрузки.
      getColor: (d) => (d.isActive ? [45, 55, 72, 255] : [220, 38, 38, 200]),
      getWidth: (d) => d.width,
      widthMinPixels: 2,
      capRounded: false, // торцы только на тупиках — стыки цепи бесшовные
      jointRounded: true,
      pickable: true,
    });

    // Второстепенные пути — по-прежнему порёберно (ширина 4–6 м, круглые
    // концы на них не дают «сосисок»), но каждый тип своим цветом.
    const minorWays = new PathLayer<GraphEdge>({
      id: 'minor-ways-layer',
      data: scenario.edges.filter((e) => e.type !== 'road' && !e.isRoundabout),
      getPath: (e) => {
        const u = nodeMap.get(e.from);
        const v = nodeMap.get(e.to);
        if (!u || !v) return [];
        // Тоннель — под дорогой; остальное — по оси. Сдвиг нужен только
        // тротуарам/велодорожкам, иначе они лежат ровно на оси соседнего
        // полотна. Парковые тропы тоже по оси — сдвиг выносил бы их
        // за границу маленьких скверов.
        if (
          e.type === 'crossing' ||
          e.type === 'underpass' ||
          e.type === 'park_path'
        ) {
          const z = e.type === 'underpass' ? Z_UNDER : Z_SIDEWALK;
          return [toWorld(u.x, u.y, z), toWorld(v.x, v.y, z)];
        }
        const [
          [ax, ay],
          [bx, by],
        ] = offsetLineCAD(u.x, u.y, v.x, v.y, SIDEWALK_OFFSET_M);
        return [toWorld(ax, ay, Z_SIDEWALK), toWorld(bx, by, Z_SIDEWALK)];
      },
      getColor: (e) => {
        if (!e.isActive) return [239, 68, 68, 220];
        // Свои цвета типов — всегда: зебра белая, вело — teal, тоннель — sky.
        // Нагрузка подсвечивается только там, где реально идут люди, —
        // на тротуарах и тропах скверов.
        if (e.type === 'crossing') return [255, 255, 255, 255];
        if (e.type === 'underpass') return [56, 189, 248, 240];
        if (e.type === 'bike_lane') return [45, 212, 191, 230];
        const load = edgeLoads[e.id] || 0;
        if (load > HEAT_CRIT) return [244, 63, 94, 240]; // коралловый при перегрузе
        if (load > HEAT_WARN) return [245, 158, 11, 240]; // янтарный при высокой нагрузке
        if (e.type === 'park_path') return [74, 222, 128, 230];
        return [100, 116, 139, 210];
      },
      getWidth: (e) => (e.type === 'crossing' ? CROSSING_WIDTH : MINOR_WIDTH),
      widthMinPixels: 2,
      capRounded: true,
      jointRounded: true,
      pickable: true,
    });

    const ringPaths = buildRingPaths(scenario.edges, nodeMap);
    const rings =
      ringPaths.length > 0
        ? new PathLayer<{ path: Vec3[] }>({
            id: 'rings-layer',
            data: ringPaths.map((path) => ({ path })),
            getPath: (d) => d.path,
            getColor: [51, 65, 85, 255],
            getWidth: ROAD_WIDTH_NARROW,
            widthMinPixels: 2,
            capRounded: false,
            jointRounded: true,
          })
        : null;

    const activePath =
      activePathCoords.length >= 2
        ? new PathLayer<{ path: Vec3[] }>({
            id: 'active-dijkstra-path',
            data: [{ path: activePathCoords }],
            getPath: (d) => d.path,
            getColor: [56, 189, 248, 255],
            getWidth: ACTIVE_PATH_WIDTH,
            widthMinPixels: 4,
            capRounded: true,
            jointRounded: true,
          })
        : null;

    const buildings = new PolygonLayer<Building>({
      id: 'buildings-3d-layer',
      data: scenario.buildings,
      extruded: true,
      wireframe: false,
      getPolygon: (b) => buildingFootprintCAD(b).map(([px, py]) => toWorld(px, py)),
      getElevation: (b) => b.floors * 4.8,
      getFillColor: (b) =>
        b.id === selectedBuildingId ? [37, 99, 235, 230] : [30, 41, 59, 215],
      getLineColor: (b) =>
        b.id === selectedBuildingId ? [147, 197, 253, 255] : [71, 85, 105, 160],
      lineWidthMinPixels: 1.5,
      pickable: true,
      onClick: (info) => {
        const picked = info.object as Building | undefined;
        if (picked) selectRef.current(picked.id);
      },
    });

    const busStops = new ScatterplotLayer<Amenity>({
      id: 'bus-stops-layer',
      data: scenario.amenities.filter((a) => a.type === 'bus_stop'),
      getPosition: (s) => {
        const n = nodeMap.get(s.nodeId);
        return toWorld(n?.x ?? 0, n?.y ?? 0, Z_BUS_STOP);
      },
      getRadius: 10,
      radiusMinPixels: 5,
      getFillColor: [59, 130, 246, 255],
      getLineColor: [255, 255, 255, 255],
      stroked: true,
      lineWidthMinPixels: 2,
      pickable: true,
    });

    const schools = new ScatterplotLayer<Amenity>({
      id: 'schools-layer',
      data: scenario.amenities.filter((a) => a.type === 'school'),
      getPosition: (s) => {
        const n = nodeMap.get(s.nodeId);
        return toWorld(n?.x ?? 0, n?.y ?? 0, Z_BUS_STOP);
      },
      getRadius: 12,
      radiusMinPixels: 6,
      getFillColor: [217, 119, 6, 255],
      getLineColor: [255, 255, 255, 255],
      stroked: true,
      lineWidthMinPixels: 2,
      pickable: true,
    });

    // Теги корпусов (ПКМ по дому): точка над калиткой корпуса, цвет — как бейдж в 2D.
    const TAG_COLOR: Record<BuildingTag, [number, number, number, number]> = {
      school: [217, 119, 6, 255],
      police: [37, 99, 235, 255],
      hospital: [51, 65, 85, 255],
      shop: [100, 116, 139, 255],
    };
    const taggedBuildings = new ScatterplotLayer<Building>({
      id: 'tagged-layer',
      data: scenario.buildings.filter((b) => b.tag),
      getPosition: (b) => {
        const n = nodeMap.get(b.gateNodeId);
        return toWorld(n?.x ?? b.x, n?.y ?? b.y, Z_BUS_STOP);
      },
      getRadius: 12,
      radiusMinPixels: 6,
      getFillColor: (b) => (b.tag ? TAG_COLOR[b.tag] : [100, 116, 139, 255]),
      getLineColor: [255, 255, 255, 255],
      stroked: true,
      lineWidthMinPixels: 2,
      pickable: true,
    });

    // Подписи: дома — над крышей, объекты — над точкой, улицы — вдоль
    // своих рёбер. Кириллица — через characterSet: 'auto'.
    const labelItems: MapLabel[] = [];
    scenario.buildings.forEach((b) => {
      const fp = buildingFootprintCAD(b);
      const cx = fp.reduce((s, p) => s + p[0], 0) / fp.length;
      const cy = fp.reduce((s, p) => s + p[1], 0) / fp.length;
      labelItems.push({
        position: toWorld(cx, cy, b.floors * 4.8 + 12),
        text: b.tag ? `${b.name} · ${BUILDING_TAG_LABEL[b.tag]}` : b.name,
        size: 15,
      });
    });
    scenario.amenities.forEach((a) => {
      const n = nodeMap.get(a.nodeId);
      if (!n) return;
      labelItems.push({
        position: toWorld(n.x, n.y - 24, a.type === 'park' ? 22 : 16),
        text:
          a.type === 'bus_stop'
            ? `Остановка · ${a.name}`
            : a.type === 'school'
              ? `Школа · ${a.name}`
              : a.name,
        size: 13,
      });
    });
    STREET_LABELS.forEach((s) => {
      const e = scenario.edges.find((ed) => ed.id === s.edgeId);
      const u = e ? nodeMap.get(e.from) : undefined;
      const v = e ? nodeMap.get(e.to) : undefined;
      if (!e || !u || !v) return;
      labelItems.push({
        position: toWorld(
          (u.x + v.x) / 2 + s.offX,
          (u.y + v.y) / 2 + s.offY,
          4,
        ),
        text: s.text,
        size: 20,
      });
    });
    const labelLayer = new TextLayer<MapLabel>({
      id: 'labels-layer',
      data: labelItems,
      getPosition: (d) => d.position,
      getText: (d) => d.text,
      getSize: (d) => d.size,
      sizeUnits: 'meters',
      getColor: [226, 232, 240, 245],
      fontFamily: 'Inter, system-ui, sans-serif',
      characterSet: 'auto',
      pickable: false,
    });

    return [
      ground,
      grid,
      parks,
      roadChains,
      minorWays,
      rings,
      activePath,
      buildings,
      busStops,
      schools,
      taggedBuildings,
      labelLayer,
    ].filter((l) => l !== null);
  }, [
    scenario.amenities,
    scenario.buildings,
    scenario.edges,
    scenario.nodes,
    nodeMap,
    edgeLoads,
    activePathCoords,
    selectedBuildingId,
  ]);

  // Доступ к Deck для форварда клика: пешеход pickable (тултип), но клик
  // сквозь него должен выбирать дом под курсором, а не глотаться.
  const deckRef = useRef<Deck | null>(null);
  const forwardBuildingClick = useCallback((x: number, y: number): void => {
    const pick = deckRef.current?.pickObject({
      x,
      y,
      layerIds: ['buildings-3d-layer'],
    });
    const b = pick?.object as Building | undefined;
    if (b) selectRef.current(b.id);
  }, []);

  // Динамика: только пешеходы зависят от кадра симуляции, статика не трогается.
  const pedestrianLayers = useMemo(() => {
    // 1. Лёгкие тени под пешеходами: на траве — на уровне лужайки,
    // на тротуаре — на бордюре.
    const shadows = new ScatterplotLayer<DisplayPedestrian>({
      id: 'pedestrian-shadows',
      data: displayAgents,
      getPosition: (d) => [d.x, d.y, d.pathType === 'trava' ? 0.22 : Z_SIDEWALK + 0.05],
      getRadius: 1.0,
      radiusMinPixels: 2,
      radiusMaxPixels: 6,
      getFillColor: [15, 23, 42, 110],
      stroked: false,
      pickable: false,
    });

    // 2. Индивидуальные юниты: на тропинках — с белой каймой, по траве/полям —
    // с изумрудной. Pickable ради тултипа, клик форвардится дому под курсором.
    const units = new ScatterplotLayer<DisplayPedestrian>({
      id: 'pedestrian-units',
      data: displayAgents,
      getPosition: (d) => [d.x, d.y, d.z],
      getRadius: 1.8,
      radiusMinPixels: 3.5,
      radiusMaxPixels: 9,
      getFillColor: (d) => [...d.color, 255],
      getLineColor: (d) => (d.pathType === 'trava' ? [52, 211, 153, 240] : [255, 255, 255, 220]),
      stroked: true,
      lineWidthMinPixels: 1.4,
      pickable: true,
      onClick: (info) => {
        forwardBuildingClick(info.x, info.y);
        return true;
      },
    });

    return [shadows, units];
  }, [displayAgents, forwardBuildingClick]);

  const layers = useMemo(
    () => [...staticLayers, ...pedestrianLayers],
    [staticLayers, pedestrianLayers],
  );

  const pedestrianCount = displayAgents.length;
  const grassCount = displayAgents.filter((a) => a.pathType === 'trava').length;
  const pavedCount = pedestrianCount - grassCount;
  const ariaSummary = `3D-модель района: ${scenario.buildings.length} зданий, ${scenario.edges.length} участков дорог, ${pedestrianCount} независимых пешеходов (по тротуарам: ${pavedCount}, по полям и траве: ${grassCount}). Подписи объектов включены.`;

  return (
    <div className="relative w-full overflow-hidden rounded-xl border border-gray-700 bg-[#161a22] shadow-xl">
      <div className="flex h-8 items-center justify-between border-b border-gray-700 bg-[#11141c] px-3 font-mono text-[11px] text-gray-300 select-none">
        <span className="font-semibold text-blue-400">
          3D ДВОЙНИК НА DECK.GL: АВТОНОМНЫЕ ПЕШЕХОДЫ (ТРОТУАРЫ, ПОЛЯ И ШКОЛЫ)
        </span>
        <span className="text-gray-400">
          Пешеходов: {pedestrianCount} (тропинки: {pavedCount}, трава/поля: {grassCount})
        </span>
      </div>
      <div
        className="relative h-[560px] w-full cursor-grab active:cursor-grabbing"
        role="img"
        aria-label={ariaSummary}
      >
        <p className="sr-only">{ariaSummary}</p>
        <DeckGL
          ref={deckRef}
          views={orbitView}
          viewState={viewState}
          onViewStateChange={({ viewState: vs }) =>
            setViewState(vs as OrbitViewState)
          }
          controller
          layers={layers}
          effects={[lightingEffect]}
          getTooltip={({ object, layer }) => {
            if (!object || !layer) return null;
            if (layer.id === 'pedestrian-units') {
              const p = object as DisplayPedestrian;
              const typeLabel =
                p.pathType === 'trava'
                  ? '🌿 По траве и полям (напрямик)'
                  : '🚶 По тропинке / тротуару (приоритизировано)';
              const routeText =
                p.direction === 1 ? `${p.fromName} → ${p.toName}` : `${p.toName} → ${p.fromName}`;
              return {
                text: `Пешеход: ${p.name}\nЦель: ${p.activity}\nМаршрут: ${routeText}\nТип пути: ${typeLabel}\nСкорость: ${(p.speed * 3.6).toFixed(1)} км/ч`,
              };
            }
            if (layer.id === 'buildings-3d-layer') {
              const b = object as Building;
              return {
                text: `${b.name}\n${b.floors} эт. · ${b.residents} жит.`,
              };
            }
            if (layer.id === 'road-chains-layer') {
              const c = object as RoadChain;
              const maxLoad = Math.max(
                0,
                ...c.edgeIds.map((id) => edgeLoads[id] || 0),
              );
              const warn = maxLoad > HEAT_WARN ? ' — узкое место' : '';
              return { text: `Проезжая часть · ${maxLoad} чел/час${warn}` };
            }
            if (layer.id === 'minor-ways-layer') {
              const e = object as GraphEdge;
              const kind =
                e.type === 'crossing'
                  ? 'Пешеходный переход'
                  : e.type === 'bike_lane'
                    ? 'Велодорожка'
                    : e.type === 'park_path'
                      ? 'Тропа сквера'
                        : e.type === 'underpass'
                          ? 'Подземный переход'
                          : 'Тротуар';
              const load = edgeLoads[e.id] || 0;
              const warn = load > HEAT_WARN ? ' (высокая нагрузка)' : '';
              return { text: `${kind} · ${load} чел/час${warn}` };
            }
            if (layer.id === 'bus-stops-layer') {
              const s = object as Amenity;
              return { text: `Остановка · ${s.name}` };
            }
            return null;
          }}
        />
        <div className="pointer-events-none absolute bottom-2 left-2 flex flex-wrap gap-x-3 gap-y-1 rounded-lg bg-black/55 px-2.5 py-1.5 font-mono text-[10px] text-gray-300 backdrop-blur-sm">
          <span><i className="mr-1 inline-block h-2 w-4 rounded-sm bg-slate-600" />дорога</span>
          <span><i className="mr-1 inline-block h-2 w-4 rounded-sm bg-slate-400" />тротуар</span>
          <span><i className="mr-1 inline-block h-2 w-4 rounded-sm bg-white" />зебра</span>
          <span><i className="mr-1 inline-block h-2 w-4 rounded-sm bg-teal-300" />вело</span>
          <span><i className="mr-1 inline-block h-2 w-4 rounded-sm bg-green-400" />тропа</span>
          <span><i className="mr-1 inline-block h-2 w-4 rounded-sm bg-orange-500" />нагрузка</span>
          <span><i className="mr-1 inline-block h-2 w-4 rounded-sm bg-sky-400" />путь Дейкстры</span>
          <span><i className="mr-1 inline-block h-2 w-2 rounded-full border border-white bg-blue-500" />по тропинке</span>
          <span><i className="mr-1 inline-block h-2 w-2 rounded-full border border-emerald-400 bg-emerald-500" />по траве и полям</span>
        </div>
      </div>
    </div>
  );
}
