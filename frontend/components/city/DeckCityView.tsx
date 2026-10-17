'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { DeckGL } from '@deck.gl/react';
import {
  OrbitView,
  LightingEffect,
  AmbientLight,
  DirectionalLight,
} from '@deck.gl/core';
import type { OrbitViewState } from '@deck.gl/core';
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
const Z_FLOW = 2; // головы потоков — над разметкой
const Z_ACTIVE_PATH = 2.5; // активный путь Дейкстры — поверх потоков
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

// Скорость «головы» потоков на ×1, м/с: динамика видна без streak-эффекта
// (было 45 м/с ≈ 162 км/ч).
const FLOW_SPEED_BASE = 12;

// Люди-точками: голова рейса + шлейф из точек позади (единицы — метры мира).
const FLOW_DOT_RADIUS = 3.5; // человек — виден и вблизи, и издалека
const FLOW_DOT_MIN_PIXELS = 3; // точки не схлопываются на дальнем зуме (демо с проектора)
const FLOW_HALO_RADIUS = 9; // мягкое свечение вокруг человека
const FLOW_TRAIL_DOTS = 4; // точек шлейфа за головой — направление читается без лент
const FLOW_DOT_SPACING_M = 12; // шаг шлейфа

// Ширина активного пути Дейкстры (метры).
const ACTIVE_PATH_WIDTH = 7;

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

// Класс окраски ребра: цепочка склеивается только из рёбер одного класса,
// иначе один объект PathLayer не смог бы показать heat по длине.
type RoadPaint = 'off' | 'crit' | 'warn' | 'on';

function roadPaintOf(e: GraphEdge, edgeLoads: Record<string, number>): RoadPaint {
  if (!e.isActive) return 'off';
  const load = edgeLoads[e.id] || 0;
  if (load > HEAT_CRIT) return 'crit';
  if (load > HEAT_WARN) return 'warn';
  return 'on';
}

const ROAD_PAINT_COLOR: Record<RoadPaint, [number, number, number, number]> = {
  off: [239, 68, 68, 220],
  crit: [239, 68, 68, 230],
  warn: [249, 115, 22, 230],
  on: [51, 65, 85, 255],
};

interface RoadChain {
  path: Vec3[];
  edgeIds: string[];
  paint: RoadPaint;
  width: number;
}

// Склейка рёбер проезжей части в непрерывные полилайны: проспект едет одним
// объектом, концы — только на тупиках. Иначе «цепочка сосисок»: круглый конец
// 22-метрового полотна на каждом узле даёт утолщения, которые глаз считывает
// как неровный край дороги. Цепь рвётся на поворотах (порог скалярного
// произведения 0.5), смене ширины и смене класса окраски.
function chainRoadEdges(
  edges: GraphEdge[],
  nodeMap: Map<string, GraphNode>,
  edgeLoads: Record<string, number>,
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
    const paint = roadPaintOf(seed, edgeLoads);
    const width = widthOf(seed);
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
          if (roadPaintOf(cand, edgeLoads) !== paint) continue;
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
    if (pts.length >= 2) chains.push({ path: pts, edgeIds: ids, paint, width });
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

interface Trip {
  path: Vec3[];
  timestamps: number[];
  color: [number, number, number];
}

// Путь Дейкстры → «рейс»: метки времени = накопленная длина (метры), хвост догоняет голову.
function pathToTrip(
  ids: string[],
  nodeMap: Map<string, GraphNode>,
  z: number,
  color: [number, number, number],
): Trip | null {
  const pts: Vec3[] = [];
  ids.forEach((id) => {
    const n = nodeMap.get(id);
    if (n) pts.push(toWorld(n.x, n.y, z));
  });
  if (pts.length < 2) return null;
  const timestamps: number[] = [0];
  for (let i = 1; i < pts.length; i++) {
    timestamps.push(
      timestamps[i - 1] +
        Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]),
    );
  }
  return { path: pts, timestamps, color };
}

interface FlowDot {
  position: Vec3;
  color: [number, number, number];
}

// Точка на пути на «времени» t (метки — метры): бинпоиск сегмента + лерп.
// Хвост идёт назад по вершинам, а не по прямой, — шлейф лежит на дороге
// и не срезает повороты.
function pointAtTime(trip: Trip, t: number): Vec3 {
  const { path, timestamps } = trip;
  if (t <= 0) return path[0];
  const last = timestamps.length - 1;
  if (t >= timestamps[last]) return path[last];
  let lo = 0;
  let hi = last;
  while (lo + 1 < hi) {
    const mid = (lo + hi) >> 1;
    if (timestamps[mid] <= t) lo = mid;
    else hi = mid;
  }
  const t0 = timestamps[lo];
  const seg = timestamps[hi] - t0 || 1;
  const k = (t - t0) / seg;
  const a = path[lo];
  const b = path[hi];
  return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
}

// Рейс → люди-точками: голова + шлейф позади. Время зациклено длиной пути,
// поэтому поток бесконечный без телепортов в начало кадра.
function sampleTripDots(trip: Trip, time: number): FlowDot[] {
  const total = trip.timestamps[trip.timestamps.length - 1] || 1;
  const dots: FlowDot[] = [];
  for (let i = 0; i <= FLOW_TRAIL_DOTS; i++) {
    const t = (((time - i * FLOW_DOT_SPACING_M) % total) + total) % total;
    dots.push({ position: pointAtTime(trip, t), color: trip.color });
  }
  return dots;
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
  simPlaying = true,
  simSpeed = 1,
}: DeckCityViewProps) {
  const nodeMap = useMemo(
    () => new Map<string, GraphNode>(scenario.nodes.map((n) => [n.id, n])),
    [scenario.nodes],
  );

  const busTrips = useMemo(
    () =>
      Object.values(busPaths)
        .map((p) => (p ? pathToTrip(p.pathNodeIds, nodeMap, Z_FLOW, [96, 165, 250]) : null))
        .filter((t): t is Trip => t !== null),
    [busPaths, nodeMap],
  );
  const parkTrips = useMemo(
    () =>
      Object.values(parkPaths)
        .map((p) => (p ? pathToTrip(p.pathNodeIds, nodeMap, Z_FLOW, [52, 211, 153]) : null))
        .filter((t): t is Trip => t !== null),
    [parkPaths, nodeMap],
  );

  const maxTime = useMemo(() => {
    let m = 0;
    [...busTrips, ...parkTrips].forEach((t) => {
      const last = t.timestamps[t.timestamps.length - 1] ?? 0;
      if (last > m) m = last;
    });
    return m > 1 ? m : 100;
  }, [busTrips, parkTrips]);

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

  // Игровая петля «головы» потоков; пауза и скорость — из тулбара симуляции.
  const [time, setTime] = useState(0);
  useEffect(() => {
    if (!simPlaying || reducedMotion) return;
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      setTime((t) => (t + dt * FLOW_SPEED_BASE * (simSpeed ?? 1)) % maxTime);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [simPlaying, simSpeed, maxTime, reducedMotion]);

  // Время дальше нового maxTime (сценарий сменился) — клампим, иначе кадр
  // без потоков до первого тика петли.
  useEffect(() => {
    setTime((t) => (t > maxTime ? 0 : t));
  }, [maxTime]);

  const activePathCoords = useMemo(() => {
    const pts: Vec3[] = [];
    activePathNodeIds.forEach((id) => {
      const n = nodeMap.get(id);
      if (n) pts.push(toWorld(n.x, n.y, Z_ACTIVE_PATH));
    });
    return pts;
  }, [activePathNodeIds, nodeMap]);

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
      data: chainRoadEdges(scenario.edges, nodeMap, edgeLoads),
      getPath: (d) => d.path,
      getColor: (d) => ROAD_PAINT_COLOR[d.paint],
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
        // Тепловая карта поверх всех типов: перегруз виден и на тропах.
        const load = edgeLoads[e.id] || 0;
        if (load > HEAT_CRIT) return [239, 68, 68, 230];
        if (load > HEAT_WARN) return [249, 115, 22, 230];
        if (e.type === 'crossing') return [255, 255, 255, 240];
        if (e.type === 'underpass') return [56, 189, 248, 240];
        if (e.type === 'bike_lane') return [45, 212, 191, 230];
        if (e.type === 'park_path') return [74, 222, 128, 230];
        return [100, 116, 139, 200];
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

  // Динамика: только точки потоков зависят от time.
  // Люди-точками: семплируем позиции голов и шлейфов на текущем time.
  // Подсчёт — микросекунды (рейсов десятки), статика не трогается.
  const flowLayers = useMemo(() => {
    const dots: FlowDot[] = [];
    [...busTrips, ...parkTrips].forEach((trip) => {
      dots.push(...sampleTripDots(trip, time));
    });

    const halo = new ScatterplotLayer<FlowDot>({
      id: 'flow-halo',
      data: dots,
      getPosition: (d) => d.position,
      getFillColor: (d) => [...d.color, 64],
      getRadius: FLOW_HALO_RADIUS,
      radiusMinPixels: 6,
      stroked: false,
      pickable: false,
    });

    const people = new ScatterplotLayer<FlowDot>({
      id: 'flow-dots',
      data: dots,
      getPosition: (d) => d.position,
      getFillColor: (d) => [...d.color, 255],
      getLineColor: [255, 255, 255, 220],
      getRadius: FLOW_DOT_RADIUS,
      radiusMinPixels: FLOW_DOT_MIN_PIXELS,
      stroked: true,
      lineWidthMinPixels: 1,
      pickable: false, // точки не перехватывают клики по домам
    });

    return [halo, people];
  }, [busTrips, parkTrips, time]);

  const layers = useMemo(
    () => [...staticLayers, ...flowLayers],
    [staticLayers, flowLayers],
  );

  const peopleCount = busTrips.length + parkTrips.length;
  const ariaSummary = `3D-модель района: ${scenario.buildings.length} зданий, ${scenario.edges.length} участков дорог, потоки показаны движущимися точками — в пути ${peopleCount}. Подписи объектов включены.`;

  return (
    <div className="relative w-full overflow-hidden rounded-xl border border-gray-700 bg-[#161a22] shadow-xl">
      <div className="flex h-8 items-center justify-between border-b border-gray-700 bg-[#11141c] px-3 font-mono text-[11px] text-gray-300 select-none">
        <span className="font-semibold text-blue-400">
          3D ДВОЙНИК НА DECK.GL: ПОТОКИ ПО ДЕЙКСТРЕ
        </span>
        <span className="text-gray-400">
          ЛКМ: Вращение | ПКМ: Панорама | Колесо: Зум | В пути: {peopleCount}
        </span>
      </div>
      <div
        className="relative h-[560px] w-full cursor-grab active:cursor-grabbing"
        role="img"
        aria-label={ariaSummary}
      >
        <p className="sr-only">{ariaSummary}</p>
        <DeckGL
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
              return { text: `${kind} · ${edgeLoads[e.id] || 0} чел/час` };
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
          <span><i className="mr-1 inline-block h-2 w-4 rounded-sm bg-orange-500" />перегруз</span>
          <span><i className="mr-1 inline-block h-2 w-4 rounded-sm bg-sky-400" />путь Дейкстры</span>
          <span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-blue-500" />люди</span>
        </div>
      </div>
    </div>
  );
}
