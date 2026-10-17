'use client';

import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { DistrictScenario, GraphNode, GraphEdge, Building, BuildingTag, BUILDING_TAG_LABEL, PathResult } from '@/lib/city-engine/types';
import { CITY_DEFAULTS } from '@/lib/city-engine/metrics';
import { RING_RADIUS, isRingEdge } from '@/lib/city-engine/roundabout';
import { buildAdjacency, findShortestPath } from '@/lib/city-engine/dijkstra';
import DistrictContextMenu from './DistrictContextMenu';
import BuildingContextMenu from './BuildingContextMenu';
import RouteContextMenu from './RouteContextMenu';
import { pointsToSmoothSvgPath } from '@/lib/city-engine/geometry';

export type ToolMode =
  | 'select'
  | 'road'
  | 'sidewalk'
  | 'crossing'
  | 'underpass'
  | 'poly_building'
  | 'poly_park'
  | 'block_spot'
  | 'delete';
// Кнопок «Остановка»/«Школа» больше нет: остановка — ПКМ по дороге,
// соцобъекты — ПКМ по дому (теги). Старые school-amenity из сейвов
// продолжают рендериться и считаться.

/** Маршрут А → Б: точки выбирает пользователь через ПКМ, считает умный Дейкстра. */
export interface RouteSelection {
  startId: string | null;
  pathNodeIds: string[];
}

interface DistrictMapProps {
  scenario: DistrictScenario;
  baseScenario: DistrictScenario;
  // Режим сравнения «До / После»: current — проект (редактирование),
  // base — зафиксированное ДО (только чтение), diff — наложение обоих.
  diffView: 'current' | 'base' | 'diff';
  baseActivePathNodeIds: string[];
  // Дельта пути до остановки по домам (м): минус — стало короче.
  buildingDeltas: Record<string, number>;
  selectedBuildingId: string | null;
  selectedEdgeId: string | null;
  onSelectBuilding: (buildingId: string | null) => void;
  onSelectEdge: (edgeId: string | null) => void;
  activePathNodeIds: string[];
  edgeLoads: Record<string, number>;
  // Пути до остановки для показанного вида (current — metrics, base — baseMetrics):
  // hover по дому с тегом показывает его реальный путь из движка.
  busPaths: Record<string, PathResult | null>;
  toolMode: ToolMode;
  // Маршрут А → Б живёт в странице (видят и 2D, и 3D): точки — ПКМ пользователя.
  route: RouteSelection | null;
  onRouteChange: (route: RouteSelection | null) => void;
  onNotify?: (text: string) => void;
  onAddRoad: (x1: number, y1: number, x2: number, y2: number, type?: 'road' | 'sidewalk' | 'crossing') => void;
  onAddPolyBuilding: (points: { x: number; y: number }[]) => void;
  onAddPolyPark: (points: { x: number; y: number }[]) => void;
  onAddBusStopOnEdge: (edgeId: string, px: number, py: number) => void;
  onSetBuildingTag: (buildingId: string, tag: BuildingTag | null) => void;
  onAddCrossingDirect: (edgeId: string, px: number, py: number, isUnderpass?: boolean) => void;
  onSplitAndBlockSpot: (edgeId: string, px: number, py: number) => void;
  onUpgradeLanes: (edgeId: string) => void;
  onToggleSidewalk: (edgeId: string, side: 'left' | 'right') => void;
  onMakeRoundabout: (nodeId: string) => void;
  onDeleteBuilding: (id: string) => void;
  onDeleteEdge: (id: string) => void;
  onDeleteAmenity: (id: string) => void;
  onMoveNode: (id: string, x: number, y: number) => void;
  onMoveBuilding: (id: string, x: number, y: number) => void;
  onMoveAmenity: (id: string, x: number, y: number) => void;
}

// Половина ширины полотна по числу полос (для подложек стыков).
const halfWidth = (edge: GraphEdge): number => (edge.lanes === 4 ? 17 : 11);

// Палитра полотна: асфальт заметно светлее фона (#141822), бордюр — темнее асфальта.
// Бейдж социального тега корпуса: приглушённые тона, без неона.
const TAG_BADGE: Record<BuildingTag, { letter: string; fill: string }> = {
  school: { letter: 'Ш', fill: '#d97706' },
  police: { letter: 'П', fill: '#2563eb' },
  hospital: { letter: 'Б', fill: '#334155' },
  shop: { letter: 'М', fill: '#64748b' },
};
const ROAD_ASPHALT = '#2f3b52';
const ROAD_CASING = '#0d1219';
const RING_ISLAND = '#1c2433';

export default function DistrictMap({
  scenario: scenarioProp,
  baseScenario,
  diffView,
  baseActivePathNodeIds,
  buildingDeltas,
  selectedBuildingId,
  selectedEdgeId,
  onSelectBuilding,
  onSelectEdge,
  activePathNodeIds,
  edgeLoads,
  busPaths,
  toolMode,
  route,
  onRouteChange,
  onNotify,
  onAddRoad,
  onAddPolyBuilding,
  onAddPolyPark,
  onAddBusStopOnEdge,
  onSetBuildingTag,
  onAddCrossingDirect,
  onSplitAndBlockSpot,
  onUpgradeLanes,
  onToggleSidewalk,
  onMakeRoundabout,
  onDeleteBuilding,
  onDeleteEdge,
  onDeleteAmenity,
  onMoveNode,
  onMoveBuilding,
  onMoveAmenity,
}: DistrictMapProps) {
  // В режимах «Было»/«Дифф» карта только читается: показана база либо
  // наложение, все мутации (drag, инструменты, ПКМ-меню) заблокированы.
  const readOnly = diffView !== 'current';
  const scenario = diffView === 'base' ? baseScenario : scenarioProp;
  const shownPathNodeIds = diffView === 'base' ? baseActivePathNodeIds : activePathNodeIds;
  const [roadStart, setRoadStart] = useState<{ x: number; y: number } | null>(null);
  const [polygonDraft, setPolygonDraft] = useState<{ x: number; y: number }[]>([]);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);
  // Hover-подсветка зоны охвата: наведение на остановку/сквер/школу/дом с тегом
  // показывает реальный радиус пешеходной доступности из CITY_DEFAULTS
  // (500 м для остановок/тегов, настраиваемый для скверов). Без radiusM —
  // только инфоплашка без круга (жилые дома, ТЦ).
  const [hoveredEntity, setHoveredEntity] = useState<{
    id: string;
    name: string;
    kind: 'bus_stop' | 'park' | 'school' | 'police' | 'hospital' | 'shop' | 'building';
    x: number;
    y: number;
    radiusM?: number;
    color: string;
    details?: string;
  } | null>(null);
  // ПКМ-меню: у дома и дороги разный набор. wx/wy — мировая точка клика
  // (нужна остановке для разреза ребра строго в месте клика).
  const [contextMenu, setContextMenu] = useState<{
    kind: 'edge' | 'building' | 'map';
    x: number;
    y: number;
    edgeId?: string;
    buildingId?: string;
    nodeId?: string;
    wx: number;
    wy: number;
  } | null>(null);
  // Панорама и зум: сдвиг вида + масштаб относительно базового viewBox.
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  // Кастомный маршрут А → Б живёт в странице (видят и 2D, и 3D).
  const routeStartId = route?.startId ?? null;
  const routePath = route && route.pathNodeIds.length >= 2 ? route.pathNodeIds : null;
  // Drag объекта: kind + откуда тащим + старт курсора + текущая точка (превью).
  const [drag, setDrag] = useState<{
    kind: 'node' | 'building' | 'amenity' | 'park';
    id: string;
    origX: number;
    origY: number;
    startCX: number;
    startCY: number;
    curX: number;
    curY: number;
    moved: boolean;
  } | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const panStart = useRef<{ cx: number; cy: number; panX: number; panY: number } | null>(null);
  const suppressClick = useRef(false);
  // Зеркало drag и колбэков для window-pointerup (коммит и вне svg).
  const dragRef = useRef<typeof drag | null>(null);
  dragRef.current = drag;
  const actionsRef = useRef({ onMoveNode, onMoveBuilding, onMoveAmenity });
  actionsRef.current = { onMoveNode, onMoveBuilding, onMoveAmenity };

  const nodeMap = new Map<string, GraphNode>(scenario.nodes.map((n) => [n.id, n]));
  // Live-превью перетаскиваемого узла: все рёбра/пути/маркеры тянутся следом.
  const dragDX = drag ? drag.curX - drag.startCX : 0;
  const dragDY = drag ? drag.curY - drag.startCY : 0;
  if (drag?.kind === 'node') {
    const n = nodeMap.get(drag.id);
    if (n) nodeMap.set(drag.id, { ...n, x: n.x + dragDX, y: n.y + dragDY });
  }
  const roadEdges = scenario.edges.filter((e) => e.type === 'road');

  // Радиус подложки стыка: половина ширины самой широкой примыкающей дороги.
  // Ставится только там, где сходятся ≥2 дорог, — на прямых участках швов нет.
  const padRadius = (nodeId: string): number => {
    const adj = roadEdges.filter(
      (e) => e.isActive && (e.from === nodeId || e.to === nodeId),
    );
    if (adj.length < 2) return 0;
    return Math.max(...adj.map(halfWidth));
  };

  // Обрезка концов отрезка на t1/t2 (подложки узлов), чтобы швы ушли под круги.
  const trim = (
    u: GraphNode,
    v: GraphNode,
  ): { x1: number; y1: number; x2: number; y2: number } | null => {
    const dx = v.x - u.x;
    const dy = v.y - u.y;
    const len = Math.hypot(dx, dy);
    if (len < 1) return null;
    const t1 = Math.min(padRadius(u.id), len / 2 - 1);
    const t2 = Math.min(padRadius(v.id), len / 2 - 1);
    if (t1 + t2 >= len - 1) return null;
    const ux = dx / len;
    const uy = dy / len;
    return {
      x1: u.x + ux * Math.max(0, t1),
      y1: u.y + uy * Math.max(0, t1),
      x2: v.x - ux * Math.max(0, t2),
      y2: v.y - uy * Math.max(0, t2),
    };
  };

  const snapToNode = (x: number, y: number): { x: number; y: number } => {
    for (const node of scenario.nodes) {
      if (Math.hypot(node.x - x, node.y - y) <= 16) {
        return { x: node.x, y: node.y };
      }
    }
    return { x: Math.round(x / 10) * 10, y: Math.round(y / 10) * 10 };
  };

  // Реф актуального вида для native-обработчика wheel (чтобы не перевешивать слушатель).
  const viewStateRef = useRef({ zoom, pan });
  viewStateRef.current = { zoom, pan };

  // Базовый вид: дефолт 960×620 + авто-расширение под контент с полями.
  // Карта динамически растёт, когда здания/узлы подходят к краю.
  const baseView = useMemo(() => {
    const M = 90;
    const xs: number[] = [0, 960];
    const ys: number[] = [0, 620];
    for (const n of scenario.nodes) {
      xs.push(n.x);
      ys.push(n.y);
    }
    for (const b of scenario.buildings) {
      if (b.polygon && b.polygon.length >= 3) {
        for (const p of b.polygon) {
          xs.push(p.x);
          ys.push(p.y);
        }
      } else {
        xs.push(b.x, b.x + b.width);
        ys.push(b.y, b.y + b.height);
      }
    }
    for (const a of scenario.amenities) {
      if (a.polygon && a.polygon.length >= 3) {
        for (const p of a.polygon) {
          xs.push(p.x);
          ys.push(p.y);
        }
      }
    }
    const minX = Math.min(...xs) - M;
    const minY = Math.min(...ys) - M;
    const maxX = Math.max(...xs) + M;
    const maxY = Math.max(...ys) + M;
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
  }, [scenario.nodes, scenario.buildings, scenario.amenities]);

  const scaledW = baseView.w / zoom;
  const scaledH = baseView.h / zoom;
  const viewBoxStr = `${baseView.x + pan.x} ${baseView.y + pan.y} ${scaledW} ${scaledH}`;

  // Мировые координаты без снапа (для drag и панорамы).
  const toWorldRaw = (clientX: number, clientY: number): { x: number; y: number } => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    return {
      x: baseView.x + pan.x + ((clientX - rect.left) / rect.width) * scaledW,
      y: baseView.y + pan.y + ((clientY - rect.top) / rect.height) * scaledH,
    };
  };

  const getSvgCoordinates = (e: ReactMouseEvent<SVGSVGElement>): { x: number; y: number } => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = baseView.x + pan.x + ((e.clientX - rect.left) / rect.width) * scaledW;
    const y = baseView.y + pan.y + ((e.clientY - rect.top) / rect.height) * scaledH;
    return snapToNode(x, y);
  };

  // Старт drag объекта (только select, левая кнопка, не кольцо).
  const beginObjectDrag = (
    e: ReactPointerEvent<SVGGElement>,
    kind: 'node' | 'building' | 'amenity' | 'park',
    id: string,
    origX: number,
    origY: number,
  ) => {
    if (readOnly || toolMode !== 'select' || e.button !== 0) return;
    e.stopPropagation();
    setHoveredEntity(null);
    (e.target as Element).releasePointerCapture?.(e.pointerId);
    const w = toWorldRaw(e.clientX, e.clientY);
    setDrag({ kind, id, origX, origY, startCX: w.x, startCY: w.y, curX: w.x, curY: w.y, moved: false });
  };

  // Long-press для тачскринов (у них нет ПКМ): удержание 550мс
  // открывает то же контекстное меню. Мышь игнорируем — у неё есть ПКМ.
  const longPressTimer = useRef<number | null>(null);
  const lpStart = useRef<{ cx: number; cy: number } | null>(null);
  const cancelLongPress = () => {
    if (longPressTimer.current !== null) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    lpStart.current = null;
  };
  const beginLongPress = (e: ReactPointerEvent, open: () => void) => {
    if (readOnly || e.pointerType === 'mouse') return;
    cancelLongPress();
    lpStart.current = { cx: e.clientX, cy: e.clientY };
    longPressTimer.current = window.setTimeout(() => {
      longPressTimer.current = null;
      lpStart.current = null;
      panStart.current = null;
      suppressClick.current = true;
      open();
    }, 550);
  };
  const handleSvgPointerDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    // Фон тащится мышью в ЛЮБОМ режиме (все инструменты — кликовые,
    // конфликта с drag нет; клик после панорамы гасится suppressClick).
    // Объекты останавливают всплытие в beginObjectDrag.
    if (e.button !== 0 || drag) return;
    panStart.current = { cx: e.clientX, cy: e.clientY, panX: pan.x, panY: pan.y };
  };

  const handleSvgPointerMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    // Палец поехал — это пан/тап, а не удержание: long-press отменяем.
    if (lpStart.current && Math.hypot(e.clientX - lpStart.current.cx, e.clientY - lpStart.current.cy) > 12) {
      cancelLongPress();
    }
    const w = toWorldRaw(e.clientX, e.clientY);
    setMousePos({ x: Math.round(w.x), y: Math.round(w.y) });
    if (drag) {
      // Drag объекта: превью следует за курсором, коммит — на pointerup.
      // Сдвиг объекта = курсор минус стартовая точка захвата.
      setDrag((d) => {
        if (!d) return d;
        return {
          ...d,
          curX: w.x,
          curY: w.y,
          moved: d.moved || Math.hypot(w.x - d.startCX, w.y - d.startCY) > 5,
        };
      });
    } else if (panStart.current) {
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const sx = scaledW / rect.width;
      const sy = scaledH / rect.height;
      const nx = panStart.current.panX - (e.clientX - panStart.current.cx) * sx;
      const ny = panStart.current.panY - (e.clientY - panStart.current.cy) * sy;
      if (Math.hypot(e.clientX - panStart.current.cx, e.clientY - panStart.current.cy) > 4) {
        suppressClick.current = true;
      }
      setPan({ x: nx, y: ny });
    }
  };

  // Pointerup на svg: только конец панорамы. Коммит drag — в window-pointerup
  // (он срабатывает всегда, включая отпускание вне карты — двойного коммита нет).
  const handleSvgPointerUp = () => {
    panStart.current = null;
  };

  // Зум колесом мыши с фокусом на курсор (карта не «улетает» при скролле).
  // Native-слушатель: React onWheel пассивный и preventDefault там не сработает.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault(); // гасим скролл страницы над картой
      const rect = svg.getBoundingClientRect();
      const { zoom: z, pan: p } = viewStateRef.current;

      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const worldX = baseView.x + p.x + (mouseX / rect.width) * (baseView.w / z);
      const worldY = baseView.y + p.y + (mouseY / rect.height) * (baseView.h / z);

      const dz = Math.exp(-e.deltaY * 0.002);
      const newZoom = Math.max(0.2, Math.min(6, z * dz));

      const newPanX = worldX - baseView.x - (mouseX / rect.width) * (baseView.w / newZoom);
      const newPanY = worldY - baseView.y - (mouseY / rect.height) * (baseView.h / newZoom);

      setZoom(newZoom);
      setPan({ x: newPanX, y: newPanY });
    };
    svg.addEventListener('wheel', onWheel, { passive: false });
    return () => svg.removeEventListener('wheel', onWheel);
  }, [baseView.x, baseView.y, baseView.w, baseView.h]);

  // Escape + pointerup на уровне окна: отмена/коммит drag и панорамы даже вне svg.
  // Клик/тап вне меню закрывает его (само меню помечено data-ctx-menu).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setDrag(null);
        panStart.current = null;
        setRoadStart(null);
        setPolygonDraft([]);
        setContextMenu(null);
        onRouteChange(null);
        cancelLongPress();
      }
    };
    const onDown = (e: PointerEvent) => {
      if (!(e.target as Element).closest?.('[data-ctx-menu]')) setContextMenu(null);
    };
    const onUp = () => {
      cancelLongPress();
      const d = dragRef.current;
      if (d?.moved) {
        suppressClick.current = true;
        const nx = d.origX + (d.curX - d.startCX);
        const ny = d.origY + (d.curY - d.startCY);
        const acts = actionsRef.current;
        if (d.kind === 'node') acts.onMoveNode(d.id, Math.round(nx / 10) * 10, Math.round(ny / 10) * 10);
        else if (d.kind === 'building') acts.onMoveBuilding(d.id, Math.round(nx / 10) * 10, Math.round(ny / 10) * 10);
        else acts.onMoveAmenity(d.id, Math.round(nx), Math.round(ny));
      } else if (d) {
        suppressClick.current = false;
      }
      if (d) setDrag(null);
      panStart.current = null;
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointerdown', onDown);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointerdown', onDown);
    };
  }, [onRouteChange]);

  // Переход в «Было»/«Дифф» закрывает ПКМ-меню: его действия мутируют текущий
  // сценарий, а карта в readOnly заявляет «ТОЛЬКО ЧТЕНИЕ».
  useEffect(() => {
    if (readOnly) setContextMenu(null);
  }, [readOnly]);

  // Клик после drag/панорамы — глушим (объекты останавливают всплытие,
  // поэтому проверяют флаг сами).
  const consumeSuppressedClick = (): boolean => {
    if (suppressClick.current) {
      suppressClick.current = false;
      return true;
    }
    return false;
  };

  const handleSvgClick = (e: ReactMouseEvent<SVGSVGElement>) => {
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    if (contextMenu) setContextMenu(null);
    if (readOnly) return;
    const coords = getSvgCoordinates(e);

    if (toolMode === 'road' || toolMode === 'sidewalk') {
      if (!roadStart) {
        setRoadStart(coords);
      } else {
        if (Math.hypot(roadStart.x - coords.x, roadStart.y - coords.y) > 15) {
          onAddRoad(roadStart.x, roadStart.y, coords.x, coords.y, toolMode);
        }
        setRoadStart(null);
      }
    } else if (toolMode === 'poly_building' || toolMode === 'poly_park') {      if (polygonDraft.length >= 3) {
        const first = polygonDraft[0];
        if (Math.hypot(first.x - coords.x, first.y - coords.y) <= 22) {
          if (toolMode === 'poly_building') onAddPolyBuilding(polygonDraft);
          else onAddPolyPark(polygonDraft);
          setPolygonDraft([]);
          return;
        }
      }
      setPolygonDraft((prev) => [...prev, coords]);
    } else if (toolMode === 'select') {
      onSelectBuilding(null);
      onSelectEdge(null);
    }
  };

  // ПКМ-меню: у дороги и дома разный набор (остановка vs теги).
  const openEdgeMenu = (clientX: number, clientY: number, edgeId: string) => {
    const w = toWorldRaw(clientX, clientY);
    setContextMenu({
      kind: 'edge',
      x: clientX,
      y: clientY,
      edgeId,
      wx: Math.round(w.x),
      wy: Math.round(w.y),
    });
    onSelectEdge(edgeId);
  };

  const openBuildingMenu = (clientX: number, clientY: number, buildingId: string) => {
    const w = toWorldRaw(clientX, clientY);
    setContextMenu({
      kind: 'building',
      x: clientX,
      y: clientY,
      buildingId,
      wx: Math.round(w.x),
      wy: Math.round(w.y),
    });
    onSelectBuilding(buildingId);
  };

  const handleEdgeContextMenu = (e: ReactMouseEvent, edgeId: string) => {
    if (readOnly) return;
    e.preventDefault();
    e.stopPropagation();
    openEdgeMenu(e.clientX, e.clientY, edgeId);
  };

  const handleBuildingContextMenu = (e: ReactMouseEvent, buildingId: string) => {
    if (readOnly) return;
    e.preventDefault();
    e.stopPropagation();
    openBuildingMenu(e.clientX, e.clientY, buildingId);
  };

  // Радиус снапа ПКМ-точки маршрута к ближайшему узлу графа (м).
  const ROUTE_SNAP_M = 50;

  // ПКМ по фону карты: точка маршрута А/Б на ближайшем узле в радиусе снапа.
  // Маршрут сценарий не мутирует (только оверлей), поэтому доступен и в «Дифф».
  // В «Было» меню нет: 3D всегда показывает current, точки обязаны быть из него.
  const handleSvgContextMenu = (e: ReactMouseEvent<SVGSVGElement>) => {
    if (diffView === 'base') return;
    e.preventDefault();
    const w = toWorldRaw(e.clientX, e.clientY);
    let best: GraphNode | null = null;
    let bestDist = ROUTE_SNAP_M;
    for (const n of scenario.nodes) {
      const d = Math.hypot(n.x - w.x, n.y - w.y);
      if (d <= bestDist) {
        bestDist = d;
        best = n;
      }
    }
    if (!best) {
      onNotify?.('Рядом нет узла графа — кликните ближе к дороге');
      return;
    }
    setContextMenu({
      kind: 'map',
      x: e.clientX,
      y: e.clientY,
      nodeId: best.id,
      wx: Math.round(w.x),
      wy: Math.round(w.y),
    });
  };

  // Точка А: только фиксируем старт, путь появится после точки Б.
  const setRouteStart = (nodeId: string) => {
    onRouteChange({ startId: nodeId, pathNodeIds: [] });
    onNotify?.('Точка А поставлена — кликните ПКМ для точки Б');
  };

  // Точка Б: считаем умным Дейкстрой от зафиксированной точки А.
  const setRouteEnd = (nodeId: string) => {
    const startId = route?.startId;
    if (!startId) return;
    if (startId === nodeId) {
      onRouteChange(null);
      onNotify?.('Точки совпали — маршрут сброшен');
      return;
    }
    const adj = buildAdjacency(scenario.nodes, scenario.edges);
    const path = findShortestPath(startId, nodeId, adj);
    if (!path) {
      onNotify?.('Маршрут не найден: граф несвязен');
      return;
    }
    onRouteChange({ startId, pathNodeIds: path.pathNodeIds });
    onNotify?.(`Маршрут: ${path.distanceM} м, ~${path.timeMinutes} мин пешком`);
  };

  const handleEdgeClick = (
    e: ReactMouseEvent,
    edge: GraphEdge,
    from: GraphNode,
    to: GraphNode,
  ) => {
    if (consumeSuppressedClick()) {
      e.stopPropagation();
      return;
    }
    if (contextMenu) setContextMenu(null);
    // Только чтение: выбор участка разрешён, инструменты — нет.
    if (readOnly) {
      onSelectEdge(edge.id);
      onSelectBuilding(null);
      return;
    }
    const isCarRoad = edge.type === 'road';
    if (toolMode === 'block_spot') {
      e.stopPropagation();
      onSplitAndBlockSpot(edge.id, Math.round(mousePos?.x ?? 0), Math.round(mousePos?.y ?? 0));
    } else if (toolMode === 'crossing' && isCarRoad) {
      e.stopPropagation();
      onAddCrossingDirect(edge.id, (from.x + to.x) / 2, (from.y + to.y) / 2, false);
    } else if (toolMode === 'underpass' && isCarRoad) {
      e.stopPropagation();
      onAddCrossingDirect(edge.id, (from.x + to.x) / 2, (from.y + to.y) / 2, true);
    } else if (toolMode === 'delete') {
      e.stopPropagation();
      onDeleteEdge(edge.id);
    } else if (toolMode === 'select') {
      e.stopPropagation();
      onSelectEdge(edge.id);
      onSelectBuilding(null);
    }
  };

  // Плавная «народная тропа»: путь Дейкстры сплайном Безье вместо ломаной.
  // В режиме «Было» — путь из базового ДО, в «Дифф» текущий путь рисуется
  // поверх, а базовый — серым пунктиром в ghost-слое ниже.
  const activePathD = pointsToSmoothSvgPath(
    shownPathNodeIds
      .map((id) => nodeMap.get(id))
      .filter((n): n is GraphNode => !!n)
      .map((n) => ({ x: n.x, y: n.y })),
  );
  const baseNodeMap = new Map<string, GraphNode>(baseScenario.nodes.map((n) => [n.id, n]));
  const basePathD = pointsToSmoothSvgPath(
    baseActivePathNodeIds
      .map((id) => baseNodeMap.get(id))
      .filter((n): n is GraphNode => !!n)
      .map((n) => ({ x: n.x, y: n.y })),
  );
  // Маршрут А → Б (точки ставит пользователь через ПКМ): сплайн по узлам пути.
  const customRouteSvgPath = routePath
    ? pointsToSmoothSvgPath(
        routePath
          .map((id) => nodeMap.get(id))
          .filter((n): n is GraphNode => !!n)
          .map((n) => ({ x: n.x, y: n.y })),
      )
    : '';
  // Ghost-слой «Дифф»: чего нет в проекте относительно ДО.
  const baseEdgeIds = new Set(baseScenario.edges.map((e) => e.id));
  const currentEdgeIds = new Set(scenarioProp.edges.map((e) => e.id));
  const removedEdges = diffView === 'diff' ? baseScenario.edges.filter((e) => !currentEdgeIds.has(e.id)) : [];
  const addedEdges = diffView === 'diff' ? scenarioProp.edges.filter((e) => !baseEdgeIds.has(e.id)) : [];
  const baseBuildingIds = new Set(baseScenario.buildings.map((b) => b.id));
  const currentBuildingIds = new Set(scenarioProp.buildings.map((b) => b.id));
  const removedBuildings = diffView === 'diff' ? baseScenario.buildings.filter((b) => !currentBuildingIds.has(b.id)) : [];
  // Обводка дома в «Дифф»: зелёный — путь короче, красный — длиннее, ±5 м — шум.
  const deltaStroke = (buildingId: string, fallback: string): string => {
    if (diffView !== 'diff') return fallback;
    if (!baseBuildingIds.has(buildingId)) return '#10b981';
    const d = buildingDeltas[buildingId];
    if (d === undefined) return fallback;
    if (d < -5) return '#10b981';
    if (d > 5) return '#f43f5e';
    return fallback;
  };

  // Hover-зона: конструкторы полезной нагрузки по типам объектов.
  // Радиусы — из CITY_DEFAULTS (единый конфиг, не магические числа).
  const TAG_HOVER: Record<BuildingTag, { color: string; radiusM: number }> = {
    school: { color: '#d97706', radiusM: CITY_DEFAULTS.serviceDefaultRadiusM },
    police: { color: '#2563eb', radiusM: CITY_DEFAULTS.serviceDefaultRadiusM },
    hospital: { color: '#475569', radiusM: CITY_DEFAULTS.serviceDefaultRadiusM },
    shop: { color: '#64748b', radiusM: CITY_DEFAULTS.serviceDefaultRadiusM },
  };
  const hoveredId = hoveredEntity?.id;
  useEffect(() => {
    if (!hoveredId) return;
    const exists =
      scenario.buildings.some((b) => b.id === hoveredId) ||
      scenario.amenities.some((a) => a.id === hoveredId);
    if (!exists) setHoveredEntity(null);
  }, [scenario.buildings, scenario.amenities, hoveredId]);

  const hoverBuilding = (b: Building, x: number, y: number) => {
    if (!b.tag) {
      return {
        id: b.id, name: `Дом «${b.name}»`, kind: 'building' as const,
        x, y, color: '#64748b', details: `${b.residents} чел.`,
      };
    }
    const meta = TAG_HOVER[b.tag];
    const path = busPaths[b.id];
    return {
      id: b.id, name: `${BUILDING_TAG_LABEL[b.tag]} • корпус «${b.name}»`, kind: b.tag,
      x, y, radiusM: meta.radiusM, color: meta.color,
      details: `${b.residents} чел. • путь до остановки: ${path ? `${path.distanceM} м` : 'нет пути'} • зона ${meta.radiusM} м`,
    };
  };

  const roundaboutCenters = scenario.nodes.filter((n) => n.type === 'roundabout');
  const menuEdge =
    contextMenu?.kind === 'edge' && contextMenu.edgeId
      ? scenario.edges.find((e) => e.id === contextMenu.edgeId)
      : undefined;
  const menuEdgeNodes =
    menuEdge && nodeMap.get(menuEdge.from) && nodeMap.get(menuEdge.to)
      ? { from: nodeMap.get(menuEdge.from)!, to: nodeMap.get(menuEdge.to)! }
      : null;
  const menuBuilding =
    contextMenu?.kind === 'building' && contextMenu.buildingId
      ? scenario.buildings.find((b) => b.id === contextMenu.buildingId)
      : undefined;

  return (
    <div className="relative w-full overflow-hidden rounded-xl border border-gray-700 bg-[#1e2430] shadow-xl">
      <div className="flex h-8 items-center justify-between border-b border-gray-700/80 bg-[#161a22] px-3 font-mono text-[11px] text-gray-300 select-none">
        <div className="flex items-center gap-4">
          <span className="text-gray-400">МАСШТАБ: 1ед = 1м</span>
          <span className="text-blue-400 font-semibold uppercase">
            РЕЖИМ: {
              toolMode === 'select' ? 'ВЫБОР (ТАЩИ ОБЪЕКТ • ФОН — ПАНОРАМА • ПКМ — МЕНЮ)' :
              toolMode === 'road' ? 'ТРАССИРОВКА УДС' :
              toolMode === 'sidewalk' ? 'ТРОТУАР' :
              toolMode === 'crossing' ? 'НАЗЕМНЫЙ ПЕРЕХОД' :
              toolMode === 'underpass' ? 'ПОДЗЕМНЫЙ ПЕРЕХОД (НЕ МГН)' :
              toolMode === 'poly_building' ? `КОНТУР ЗДАНИЯ (${polygonDraft.length} ТОЧЕК)` :
              toolMode === 'poly_park' ? `КОНТУР СКВЕРА (${polygonDraft.length} ТОЧЕК)` :
              toolMode === 'block_spot' ? 'ЛОКАЛЬНЫЙ РЕМОНТ' : 'СНОС'
            }
          </span>
          {readOnly && (
            <span className="rounded-full bg-amber-500/20 px-2 py-0.5 font-semibold text-amber-300">
              {diffView === 'base' ? 'ПРОСМОТР «БЫЛО» — ТОЛЬКО ЧТЕНИЕ' : 'ДИФФ — ТОЛЬКО ЧТЕНИЕ'}
            </span>
          )}
        </div>
        <div>
          Масштаб: <span className="text-blue-400 mr-2">{Math.round(zoom * 100)}%</span>
          X: <span className="text-emerald-400">{mousePos?.x ?? 0}м</span> | Y:{' '}
          <span className="text-emerald-400">{mousePos?.y ?? 0}м</span>
        </div>
      </div>

      <svg
        ref={svgRef}
        viewBox={viewBoxStr}
        className="h-auto w-full select-none"
        style={{ minHeight: '520px', cursor: readOnly ? 'default' : toolMode === 'select' ? (drag ? 'grabbing' : 'grab') : 'crosshair', touchAction: 'none' }}
        onClick={handleSvgClick}
        onContextMenu={handleSvgContextMenu}
        onMouseMove={(e) => setMousePos(getSvgCoordinates(e))}
        onPointerDown={handleSvgPointerDown}
        onPointerMove={handleSvgPointerMove}
        onPointerUp={handleSvgPointerUp}
        onPointerLeave={() => {
          setHoveredEntity(null);
          if (!drag && !panStart.current) mousePos && setMousePos(null);
        }}
        role="img"
        aria-label="САПР чертёж района"
      >
        <defs>
          <pattern id="cad-grid-sm" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#2a3242" strokeWidth="0.5" />
          </pattern>
          <pattern id="cad-grid-lg" width="100" height="100" patternUnits="userSpaceOnUse">
            <rect width="100" height="100" fill="url(#cad-grid-sm)" />
            <path d="M 100 0 L 0 0 0 100" fill="none" stroke="#374358" strokeWidth="1" />
          </pattern>
        </defs>

        <rect x={baseView.x + pan.x} y={baseView.y + pan.y} width={baseView.w} height={baseView.h} fill="#141822" />
        <rect x={baseView.x + pan.x} y={baseView.y + pan.y} width={baseView.w} height={baseView.h} fill="url(#cad-grid-lg)" />

        {/* Парки: полигон тянется в select, точка — за маркер */}
        {scenario.amenities
          .filter((a) => a.type === 'park')
          .map((park) => {
            const node = nodeMap.get(park.nodeId);
            if (park.polygon && park.polygon.length >= 3) {
              const isDragged = drag?.kind === 'park' && drag.id === park.id;
              const shifted = isDragged ? park.polygon.map((p) => ({ x: p.x + dragDX, y: p.y + dragDY })) : park.polygon;
              const pts = shifted.map((p) => `${p.x},${p.y}`).join(' ');
              const centroid = shifted.reduce((acc, p) => ({ x: acc.x + p.x / shifted.length, y: acc.y + p.y / shifted.length }), { x: 0, y: 0 });
              const parkRadius = park.coverageRadiusM || CITY_DEFAULTS.parkDefaultRadiusM;
              return (
                <g
                  key={park.id}
                  onPointerDown={(e) => beginObjectDrag(e, 'park', park.id, park.polygon![0].x, park.polygon![0].y)}
                  onMouseEnter={() => {
                    if (!drag) {
                      setHoveredEntity({
                        id: park.id, name: `Сквер «${park.name}»`, kind: 'park',
                        x: centroid.x, y: centroid.y, radiusM: parkRadius, color: '#10b981',
                        details: `Зона ${parkRadius} м • охват считается Дейкстрой от входа в сквер`,
                      });
                    }
                  }}
                  onMouseLeave={() => setHoveredEntity(null)}
                  onClick={(e) => { e.stopPropagation(); if (consumeSuppressedClick()) return; if (toolMode === 'delete' && !readOnly) onDeleteAmenity(park.id); }}
                >
                  <polygon points={pts} fill="#143828" stroke="#2d6a4f" strokeWidth="2" strokeDasharray="4 2" />
                  <text x={shifted[0].x} y={shifted[0].y + 14} fill="#a7f3d0" fontSize="9" fontFamily="monospace">
                    {park.name}
                  </text>
                </g>
              );
            }
            if (!node) return null;
            const isDraggedPt = drag?.kind === 'amenity' && drag.id === park.id;
            const ccx = node.x + (isDraggedPt ? dragDX : 0);
            const ccy = node.y + (isDraggedPt ? dragDY : 0);
            const parkPtRadius = park.coverageRadiusM || CITY_DEFAULTS.parkDefaultRadiusM;
            return (
              <g
                key={park.id}
                onPointerDown={(e) => beginObjectDrag(e, 'amenity', park.id, node.x, node.y)}
                onMouseEnter={() => {
                  if (!drag) {
                    setHoveredEntity({
                      id: park.id, name: `Сквер «${park.name}»`, kind: 'park',
                      x: ccx, y: ccy, radiusM: parkPtRadius, color: '#10b981',
                      details: `Зона ${parkPtRadius} м • охват считается Дейкстрой от входа в сквер`,
                    });
                  }
                }}
                onMouseLeave={() => setHoveredEntity(null)}
                onClick={(e) => { e.stopPropagation(); if (consumeSuppressedClick()) return; if (toolMode === 'delete' && !readOnly) onDeleteAmenity(park.id); }}
              >
                <circle cx={ccx} cy={ccy} r="48" fill="#143828" stroke="#2d6a4f" strokeWidth="1.5" strokeDasharray="4 2" />
                <text x={ccx} y={ccy + 4} textAnchor="middle" fill="#a7f3d0" fontSize="9" fontFamily="monospace" fontWeight="700">
                  {park.name}
                </text>
              </g>
            );
          })}

        {/* Проход 1: окаймления всех дорог (слияние стыков) */}
        {roadEdges.map((edge) => {
          const from = nodeMap.get(edge.from);
          const to = nodeMap.get(edge.to);
          if (!from || !to) return null;
          const t = trim(from, to);
          if (!t) return null;
          const w = edge.lanes === 4 ? 34 : 22;
          return (
            <line
              key={`casing-${edge.id}`}
              x1={t.x1}
              y1={t.y1}
              x2={t.x2}
              y2={t.y2}
              stroke={selectedEdgeId === edge.id ? '#3b82f6' : ROAD_CASING}
              strokeWidth={w + 6}
              strokeLinecap="round"
            />
          );
        })}

        {/* Проход 2: полотна дорог */}
        {roadEdges.map((edge) => {
          const from = nodeMap.get(edge.from);
          const to = nodeMap.get(edge.to);
          if (!from || !to) return null;
          const t = trim(from, to);
          if (!t) return null;
          return (
            <line
              key={`asphalt-${edge.id}`}
              x1={t.x1}
              y1={t.y1}
              x2={t.x2}
              y2={t.y2}
              stroke={ROAD_ASPHALT}
              strokeWidth={edge.lanes === 4 ? 30 : 18}
              strokeLinecap="round"
            />
          );
        })}

        {/* Проход 3: подложки перекрёстков поверх швов */}
        {scenario.nodes.map((node) => {
          const r = padRadius(node.id);
          if (r <= 0) return null;
          return (
            <g key={`pad-${node.id}`}>
              <circle cx={node.x} cy={node.y} r={r + 3} fill={ROAD_CASING} />
              <circle cx={node.x} cy={node.y} r={r} fill={ROAD_ASPHALT} />
            </g>
          );
        })}

        {/* Проход 4: тротуары вдоль дорог и осевые (обрезаны подложками) */}
        {roadEdges.map((edge) => {
          const from = nodeMap.get(edge.from);
          const to = nodeMap.get(edge.to);
          if (!from || !to) return null;
          const t = trim(from, to);
          if (!t) return null;
          const is4Lanes = edge.lanes === 4;
          const dx = to.x - from.x;
          const dy = to.y - from.y;
          const len = Math.hypot(dx, dy);
          const nx = len > 0 ? -dy / len : 0;
          const ny = len > 0 ? dx / len : 0;
          const off = is4Lanes ? 20 : 14;
          return (
            <g key={`detail-${edge.id}`}>
              {edge.hasSidewalkLeft && (
                <line
                  x1={t.x1 + nx * off}
                  y1={t.y1 + ny * off}
                  x2={t.x2 + nx * off}
                  y2={t.y2 + ny * off}
                  stroke="#94a3b8"
                  strokeWidth={5}
                  strokeLinecap="round"
                />
              )}
              {edge.hasSidewalkRight && (
                <line
                  x1={t.x1 - nx * off}
                  y1={t.y1 - ny * off}
                  x2={t.x2 - nx * off}
                  y2={t.y2 - ny * off}
                  stroke="#94a3b8"
                  strokeWidth={5}
                  strokeLinecap="round"
                />
              )}
              {is4Lanes ? (
                <line x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2} stroke="#f59e0b" strokeWidth={1.5} />
              ) : (
                <line x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2} stroke="#64748b" strokeWidth={1} strokeDasharray="8 6" />
              )}
            </g>
          );
        })}

        {/* Кольца поверх стыков: полотно → разметка → островок → зебры съездов */}
        {roundaboutCenters.map((center) => (
          <g key={`ring-${center.id}`}>
            <circle cx={center.x} cy={center.y} r={RING_RADIUS + 15} fill="none" stroke={ROAD_CASING} strokeWidth={30} />
            <circle cx={center.x} cy={center.y} r={RING_RADIUS} fill="none" stroke={ROAD_ASPHALT} strokeWidth={24} />
            <circle cx={center.x} cy={center.y} r={RING_RADIUS} fill="none" stroke="#e2e8f0" strokeWidth={1.5} strokeDasharray="6 5" />
            <circle cx={center.x} cy={center.y} r={RING_RADIUS - 13} fill={RING_ISLAND} stroke="#64748b" strokeWidth={1.5} />
            <circle cx={center.x} cy={center.y} r={2.5} fill="#64748b" />
          </g>
        ))}
        {scenario.edges.map((edge) => {
          if (edge.type !== 'road' || isRingEdge(edge)) return null;
          const from = nodeMap.get(edge.from);
          const to = nodeMap.get(edge.to);
          if (!from || !to) return null;
          // Зебра на съезде: ищем конец ребра, лежащий на окружности кольца.
          const ends = [from, to].map((p) => {
            const c = roundaboutCenters.find(
              (cc) => Math.abs(Math.hypot(p.x - cc.x, p.y - cc.y) - RING_RADIUS) < 4,
            );
            return c ? { p, c } : null;
          });
          const hit = ends[0] ?? ends[1];
          if (!hit) return null;
          const other = hit.p === from ? to : from;
          const dx = other.x - hit.p.x;
          const dy = other.y - hit.p.y;
          const len = Math.hypot(dx, dy);
          if (len < 1) return null;
          const ux = dx / len;
          const uy = dy / len;
          // Полоса зебры на 8 м наружу от съезда, поперёк дороги.
          const qx = hit.p.x + ux * 8;
          const qy = hit.p.y + uy * 8;
          const hw = halfWidth(edge);
          return (
            <line
              key={`zebra-${edge.id}`}
              x1={qx - uy * hw}
              y1={qy + ux * hw}
              x2={qx + uy * hw}
              y2={qy - ux * hw}
              stroke="#ffffff"
              strokeWidth={5}
              strokeDasharray="3 3"
            />
          );
        })}

        {/* Наземные зебры: тёмная подложка-кайма + белый пунктир поверх,
            рисуются после подложек перекрёстков — концы не тонут под падами */}
        {scenario.edges.map((edge) => {
          if (edge.type !== 'crossing') return null;
          const from = nodeMap.get(edge.from);
          const to = nodeMap.get(edge.to);
          if (!from || !to) return null;
          return (
            <g key={edge.id}>
              <line
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
                stroke={ROAD_CASING}
                strokeWidth={18}
                strokeLinecap="round"
              />
              <line
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
                stroke="#ffffff"
                strokeWidth={11}
                strokeDasharray="4 5"
              />
            </g>
          );
        })}

        {/* Подземные переходы */}
        {scenario.edges.map((edge) => {
          if (edge.type !== 'underpass') return null;
          const from = nodeMap.get(edge.from);
          const to = nodeMap.get(edge.to);
          if (!from || !to) return null;
          return (
            <g key={edge.id}>
              <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke="#1e293b" strokeWidth={12} strokeDasharray="6 4" />
              <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke="#38bdf8" strokeWidth={2} />
            </g>
          );
        })}

        {/* Тротуары и велодорожки с тепловой картой нагрузки */}
        {scenario.edges.map((edge) => {
          if (edge.type === 'road' || edge.type === 'crossing' || edge.type === 'underpass') return null;
          const from = nodeMap.get(edge.from);
          const to = nodeMap.get(edge.to);
          if (!from || !to) return null;
          const load = edgeLoads[edge.id] || 0;
          let heatColor = '#475569';
          if (load > 400) heatColor = '#ef4444';
          else if (load > 200) heatColor = '#f59e0b';
          else if (load > 50) heatColor = '#3b82f6';
          return (
            <line
              key={edge.id}
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
              stroke={heatColor}
              strokeWidth={6}
              strokeLinecap="round"
            />
          );
        })}

        {/* Ghost-слой «Дифф / Наложение»: янтарный пунктир — что было в ДО
            и исчезло, изумрудный — новое, серый пунктир — старый путь дома. */}
        {diffView === 'diff' && (
          <g id="ghost-baseline-layer">
            {removedEdges.map((oldEdge) => {
              const u = baseNodeMap.get(oldEdge.from);
              const v = baseNodeMap.get(oldEdge.to);
              if (!u || !v) return null;
              return (
                <line
                  key={`ghost-edge-${oldEdge.id}`}
                  x1={u.x}
                  y1={u.y}
                  x2={v.x}
                  y2={v.y}
                  stroke="#f59e0b"
                  strokeWidth={oldEdge.type === 'crossing' || oldEdge.type === 'underpass' ? 8 : 12}
                  strokeDasharray="6 6"
                  opacity={0.55}
                >
                  <title>Было в «ДО» — удалено или перекрыто</title>
                </line>
              );
            })}
            {addedEdges.map((e) => {
              const u = nodeMap.get(e.from);
              const v = nodeMap.get(e.to);
              if (!u || !v) return null;
              return (
                <line
                  key={`new-edge-${e.id}`}
                  x1={u.x}
                  y1={u.y}
                  x2={v.x}
                  y2={v.y}
                  stroke="#10b981"
                  strokeWidth={4}
                  strokeDasharray="2 5"
                  strokeLinecap="round"
                  opacity={0.95}
                >
                  <title>Новое в проекте (не было в «ДО»)</title>
                </line>
              );
            })}
            {removedBuildings.map((b) =>
              b.polygon && b.polygon.length >= 3 ? (
                <polygon
                  key={`ghost-b-${b.id}`}
                  points={b.polygon.map((p) => `${p.x},${p.y}`).join(' ')}
                  fill="none"
                  stroke="#f59e0b"
                  strokeWidth={2.5}
                  strokeDasharray="7 5"
                  opacity={0.6}
                >
                  <title>{`Было в «ДО» — снесено: ${b.name}`}</title>
                </polygon>
              ) : (
                <rect
                  key={`ghost-b-${b.id}`}
                  x={b.x}
                  y={b.y}
                  width={b.width}
                  height={b.height}
                  fill="none"
                  stroke="#f59e0b"
                  strokeWidth={2.5}
                  strokeDasharray="7 5"
                  opacity={0.6}
                >
                  <title>{`Было в «ДО» — снесено: ${b.name}`}</title>
                </rect>
              ),
            )}
            {basePathD && (
              <path
                d={basePathD}
                fill="none"
                stroke="#94a3b8"
                strokeWidth={4}
                strokeDasharray="5 5"
                strokeLinecap="round"
                opacity={0.8}
              >
                <title>Старый путь дома в «ДО»</title>
              </path>
            )}
          </g>
        )}

        {/* Активный путь Дейкстры — единый плавный сплайн поверх полотен */}
        {activePathD && (
          <path
            d={activePathD}
            fill="none"
            stroke="#3b82f6"
            strokeWidth={5}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={0.9}
          />
        )}

        {/* Инструмент «Маршрут»: кратчайший путь между точками А и Б */}
        {customRouteSvgPath && (
          <path
            d={customRouteSvgPath}
            fill="none"
            stroke="#a855f7"
            strokeWidth={6}
            strokeDasharray="8 6"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={0.9}
          />
        )}

        {/* Интерактив рёбер: оверлеи + хит-зоны */}
        {scenario.edges.map((edge) => {
          const from = nodeMap.get(edge.from);
          const to = nodeMap.get(edge.to);
          if (!from || !to) return null;
          const isBlocked = !edge.isActive;
          return (
            <g
              key={`hit-${edge.id}`}
              className="cursor-pointer"
              onContextMenu={(e) => handleEdgeContextMenu(e, edge.id)}
              onPointerDown={(e) => beginLongPress(e, () => openEdgeMenu(e.clientX, e.clientY, edge.id))}
              onClick={(e) => handleEdgeClick(e, edge, from, to)}
            >
              {isBlocked && (
                <circle cx={(from.x + to.x) / 2} cy={(from.y + to.y) / 2} r="8" fill="#dc2626" stroke="#ffffff" strokeWidth="2" />
              )}
              <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke="transparent" strokeWidth={24} />
            </g>
          );
        })}

        {/* Черновой полигон */}
        {polygonDraft.length > 0 && (
          <g>
            <polyline
              points={[...polygonDraft, mousePos].filter(Boolean).map((p) => `${p!.x},${p!.y}`).join(' ')}
              fill="none"
              stroke="#38bdf8"
              strokeWidth="2"
              strokeDasharray="4 4"
            />
            {polygonDraft.map((pt, i) => (
              <circle key={i} cx={pt.x} cy={pt.y} r={i === 0 ? 6 : 4} fill={i === 0 ? '#10b981' : '#38bdf8'} />
            ))}
          </g>
        )}

        {/* Линия привязки новой дороги */}
        {roadStart && mousePos && (
          <line x1={roadStart.x} y1={roadStart.y} x2={mousePos.x} y2={mousePos.y} stroke="#60a5fa" strokeWidth={14} strokeDasharray="6 4" />
        )}

        {/* Интерактивная зона охвата при наведении: круг радиуса пешеходной
            доступности Дейкстры + бейдж. Рендерится под домами, поверх дорог. */}
        {hoveredEntity?.radiusM && (
          <g id="hover-coverage-layer" className="pointer-events-none">
            <circle
              cx={hoveredEntity.x}
              cy={hoveredEntity.y}
              r={hoveredEntity.radiusM}
              fill={hoveredEntity.color}
              fillOpacity={0.12}
              stroke={hoveredEntity.color}
              strokeWidth={2}
              strokeDasharray="6 4"
              className="motion-safe:animate-pulse"
            />
            <circle
              cx={hoveredEntity.x}
              cy={hoveredEntity.y}
              r={8}
              fill={hoveredEntity.color}
              stroke="#ffffff"
              strokeWidth={2}
            />
            <rect
              x={hoveredEntity.x - 60}
              y={hoveredEntity.y + 14}
              width={120}
              height={18}
              rx={9}
              fill="#0f172a"
              fillOpacity={0.85}
              stroke={hoveredEntity.color}
              strokeWidth={1}
            />
            <text
              x={hoveredEntity.x}
              y={hoveredEntity.y + 26}
              textAnchor="middle"
              fill="#ffffff"
              fontSize="9"
              fontFamily="monospace"
              fontWeight="700"
            >
              Зона охвата: {hoveredEntity.radiusM} м
            </text>
          </g>
        )}

        {/* Дома: в select тянутся мышью (превью со сдвигом), иначе клик — выбор/снов */}
        {scenario.buildings.map((b: Building) => {
          const isSelected = selectedBuildingId === b.id;
          const isDragged = drag?.kind === 'building' && drag.id === b.id;
          if (b.polygon && b.polygon.length >= 3) {
            const shifted = isDragged ? b.polygon.map((p) => ({ x: p.x + dragDX, y: p.y + dragDY })) : b.polygon;
            const pts = shifted.map((p) => `${p.x},${p.y}`).join(' ');
            const centroid = shifted.reduce((acc, p) => ({ x: acc.x + p.x / shifted.length, y: acc.y + p.y / shifted.length }), { x: 0, y: 0 });
            return (
              <g
                key={b.id}
                onPointerDown={(e) => { beginObjectDrag(e, 'building', b.id, b.polygon![0].x, b.polygon![0].y); beginLongPress(e, () => openBuildingMenu(e.clientX, e.clientY, b.id)); }}
                onContextMenu={(e) => handleBuildingContextMenu(e, b.id)}
                onMouseEnter={() => { if (!drag) setHoveredEntity(hoverBuilding(b, centroid.x, centroid.y)); }}
                onMouseLeave={() => setHoveredEntity(null)}
                onClick={(e) => { e.stopPropagation(); if (consumeSuppressedClick()) return; if (contextMenu) setContextMenu(null); toolMode === 'delete' && !readOnly ? onDeleteBuilding(b.id) : onSelectBuilding(b.id); }}
              >
                <polygon points={pts} fill={isSelected ? '#1e3a8a' : '#1e293b'} stroke={deltaStroke(b.id, isSelected ? '#60a5fa' : '#475569')} strokeWidth="2" />
                <text x={shifted[0].x + 10} y={shifted[0].y + 16} fill="#f8fafc" fontSize="9" fontFamily="monospace" fontWeight="700">
                  {b.name} ({b.residents} чел)
                </text>
                {b.tag && (
                  <g>
                    <rect x={shifted[0].x - 11} y={shifted[0].y - 11} width={22} height={22} rx={6} fill={TAG_BADGE[b.tag].fill} stroke="#ffffff" strokeWidth="1.5" />
                    <text x={shifted[0].x} y={shifted[0].y + 3.5} textAnchor="middle" fill="#ffffff" fontSize="9" fontFamily="monospace" fontWeight="900">
                      {TAG_BADGE[b.tag].letter}
                    </text>
                    <title>{BUILDING_TAG_LABEL[b.tag]}</title>
                  </g>
                )}
              </g>
            );
          }
          const bx = isDragged ? b.x + dragDX : b.x;
          const by = isDragged ? b.y + dragDY : b.y;
          const cx = bx + b.width / 2;
          const cy = by + b.height / 2;
          return (
            <g
              key={b.id}
              transform={b.rotationDeg ? `rotate(${b.rotationDeg} ${cx} ${cy})` : undefined}
              onPointerDown={(e) => { beginObjectDrag(e, 'building', b.id, b.x, b.y); beginLongPress(e, () => openBuildingMenu(e.clientX, e.clientY, b.id)); }}
              onContextMenu={(e) => handleBuildingContextMenu(e, b.id)}
              onMouseEnter={() => { if (!drag) setHoveredEntity(hoverBuilding(b, cx, cy)); }}
              onMouseLeave={() => setHoveredEntity(null)}
              onClick={(e) => { e.stopPropagation(); if (consumeSuppressedClick()) return; if (contextMenu) setContextMenu(null); toolMode === 'delete' && !readOnly ? onDeleteBuilding(b.id) : onSelectBuilding(b.id); }}
            >
              <rect x={bx} y={by} width={b.width} height={b.height} rx={8} fill={isSelected ? '#1e3a8a' : '#1e293b'} stroke={deltaStroke(b.id, isSelected ? '#60a5fa' : '#475569')} strokeWidth={isSelected ? 2.5 : 1} />
              <text x={cx} y={cy + 3} textAnchor="middle" fill="#f8fafc" fontSize="9" fontFamily="monospace" fontWeight="700">
                {b.name}
              </text>
              {b.tag && (
                <g>
                  <rect x={bx - 11} y={by - 11} width={22} height={22} rx={6} fill={TAG_BADGE[b.tag].fill} stroke="#ffffff" strokeWidth="1.5" />
                  <text x={bx} y={by - 7.5} textAnchor="middle" fill="#ffffff" fontSize="9" fontFamily="monospace" fontWeight="900">
                    {TAG_BADGE[b.tag].letter}
                  </text>
                  <title>{BUILDING_TAG_LABEL[b.tag]}</title>
                </g>
              )}
            </g>
          );
        })}

        {/* Остановки: маркер со сдвигом от центра узла + поводок,
            чтобы не перекрывать зебру и подложку перекрёстка.
            В select маркер тянется мышью (привязка к ближайшему узлу). */}
        {scenario.amenities.filter((a) => a.type === 'bus_stop').map((bus) => {
          const n = nodeMap.get(bus.nodeId);
          if (!n) return null;
          const isDragged = drag?.kind === 'amenity' && drag.id === bus.id;
          const mx = n.x + 18 + (isDragged ? dragDX : 0);
          const my = n.y - 18 + (isDragged ? dragDY : 0);
          return (
            <g
              key={bus.id}
              onPointerDown={(e) => beginObjectDrag(e, 'amenity', bus.id, n.x + 18, n.y - 18)}
              onMouseEnter={() => {
                if (!drag) {
                  setHoveredEntity({
                    id: bus.id, name: `Остановка «${bus.name}»`, kind: 'bus_stop',
                    x: mx, y: my, radiusM: CITY_DEFAULTS.busDefaultRadiusM, color: '#3b82f6',
                    details: `Зона ${CITY_DEFAULTS.busDefaultRadiusM} м • охват считается Дейкстрой по тротуарам`,
                  });
                }
              }}
              onMouseLeave={() => setHoveredEntity(null)}
              onClick={(e) => {
                e.stopPropagation();
                if (consumeSuppressedClick()) return;
                if (toolMode === 'delete' && !readOnly) onDeleteAmenity(bus.id);
              }}
            >
              <line x1={n.x} y1={n.y} x2={mx} y2={my} stroke="#93c5fd" strokeWidth={1.5} />
              <circle cx={mx} cy={my} r="11" fill="#2563eb" stroke="#ffffff" strokeWidth="1.5" />
              <text x={mx} y={my + 3.5} textAnchor="middle" fill="#ffffff" fontSize="9" fontFamily="monospace" fontWeight="900">
                А
              </text>
              <title>{bus.name}</title>
            </g>
          );
        })}

        {/* Школы: янтарный маркер со сдвигом (в select тянется мышью) */}
        {scenario.amenities.filter((a) => a.type === 'school').map((school) => {
          const n = nodeMap.get(school.nodeId);
          if (!n) return null;
          const isDragged = drag?.kind === 'amenity' && drag.id === school.id;
          const mx = n.x + 20 + (isDragged ? dragDX : 0);
          const my = n.y - 20 + (isDragged ? dragDY : 0);
          return (
            <g
              key={school.id}
              onPointerDown={(e) => beginObjectDrag(e, 'amenity', school.id, n.x + 20, n.y - 20)}
              onMouseEnter={() => {
                if (!drag) {
                  setHoveredEntity({
                    id: school.id, name: `Школа «${school.name}»`, kind: 'school',
                    x: mx, y: my, radiusM: CITY_DEFAULTS.schoolDefaultRadiusM, color: '#d97706',
                    details: `Зона ${CITY_DEFAULTS.schoolDefaultRadiusM} м • охват считается Дейкстрой от входа`,
                  });
                }
              }}
              onMouseLeave={() => setHoveredEntity(null)}
              onClick={(e) => {
                e.stopPropagation();
                if (consumeSuppressedClick()) return;
                if (toolMode === 'delete' && !readOnly) onDeleteAmenity(school.id);
              }}
            >
              <line x1={n.x} y1={n.y} x2={mx} y2={my} stroke="#fcd34d" strokeWidth={1.5} />
              <rect x={mx - 11} y={my - 11} width={22} height={22} rx={6} fill="#d97706" stroke="#ffffff" strokeWidth="1.5" />
              <text x={mx} y={my + 3.5} textAnchor="middle" fill="#ffffff" fontSize="9" fontFamily="monospace" fontWeight="900">
                Ш
              </text>
              <title>{school.name}</title>
            </g>
          );
        })}

        {/* Прочие притяжения (ТЦ): серый маркер со сдвигом (в select тянется) */}
        {scenario.amenities.filter((a) => a.type === 'mall').map((mall) => {
          const n = nodeMap.get(mall.nodeId);
          if (!n) return null;
          const isDragged = drag?.kind === 'amenity' && drag.id === mall.id;
          const mx = n.x + 18 + (isDragged ? dragDX : 0);
          const my = n.y + 18 + (isDragged ? dragDY : 0);
          return (
            <g
              key={mall.id}
              onPointerDown={(e) => beginObjectDrag(e, 'amenity', mall.id, n.x + 18, n.y + 18)}
              onMouseEnter={() => {
                if (!drag) {
                  setHoveredEntity({
                    id: mall.id, name: `ТЦ «${mall.name}»`, kind: 'building',
                    x: mx, y: my, color: '#64748b',
                    details: 'Коммерческое притяжение',
                  });
                }
              }}
              onMouseLeave={() => setHoveredEntity(null)}
              onClick={(e) => {
                e.stopPropagation();
                if (consumeSuppressedClick()) return;
                if (toolMode === 'delete' && !readOnly) onDeleteAmenity(mall.id);
              }}
            >
              <line x1={n.x} y1={n.y} x2={mx} y2={my} stroke="#cbd5e1" strokeWidth={1.5} />
              <circle cx={mx} cy={my} r="10" fill="#475569" stroke="#ffffff" strokeWidth="1.5" />
              <text x={mx} y={my + 3.5} textAnchor="middle" fill="#ffffff" fontSize="8" fontFamily="monospace" fontWeight="900">
                ТЦ
              </text>
              <title>{mall.name}</title>
            </g>
          );
        })}

        {/* Узлы: в select тянутся мышью (кроме кольца),
            клик по подходящему — построить кольцо */}
        {scenario.nodes.map((node) => {
          const rendered = nodeMap.get(node.id) ?? node;
          const roadCount =
            toolMode === 'select' && node.type !== 'roundabout' && !node.isRoundabout
              ? scenario.edges.filter(
                  (e) =>
                    e.type === 'road' &&
                    e.isActive &&
                    !e.isRoundabout &&
                    (e.from === node.id || e.to === node.id),
                ).length
              : 0;
          const canRing = roadCount >= 3;
          const locked = node.type === 'roundabout' || node.isRoundabout;
          return (
            <g key={node.id}>
              {canRing && (
                <circle
                  cx={rendered.x}
                  cy={rendered.y}
                  r={10}
                  fill="none"
                  stroke="#f59e0b"
                  strokeWidth={1.5}
                  strokeDasharray="4 3"
                />
              )}
              <circle
                cx={rendered.x}
                cy={rendered.y}
                r={node.type === 'roundabout' ? 14 : node.isRoundabout ? 2.5 : 3}
                fill={routeStartId === node.id ? '#a855f7' : node.type === 'roundabout' ? '#1e3a8a' : canRing ? '#f59e0b' : '#64748b'}
                style={{ cursor: toolMode === 'select' && !locked ? 'move' : undefined }}
                onPointerDown={(e) => {
                  if (locked) return;
                  beginObjectDrag(e, 'node', node.id, node.x, node.y);
                }}
                onClick={(e) => {
                  if (readOnly || toolMode !== 'select') return;
                  e.stopPropagation();
                  if (consumeSuppressedClick()) return;
                  onMakeRoundabout(node.id);
                }}
              >
                {canRing && <title>Клик — построить кольцо</title>}
              </circle>
              {/* Пульсирующий маркер точки А (маршрут ставится через ПКМ) */}
              {routeStartId === node.id && (
                <circle cx={rendered.x} cy={rendered.y} r={12} fill="none" stroke="#a855f7" strokeWidth={2} className="motion-safe:animate-ping" />
              )}
            </g>
          );
        })}
      </svg>

      {/* Hover-инфоплашка: параметры точки притяжения под курсором */}
      {hoveredEntity && (
        <div className="pointer-events-none absolute right-3 top-10 z-20 max-w-[240px] rounded-2xl border border-white/60 bg-white/80 px-3.5 py-2 text-xs font-semibold text-gray-800 shadow-[inset_1px_1px_2px_rgba(255,255,255,0.8),0_12px_24px_-6px_rgba(20,26,38,0.25)] backdrop-blur-xl dark:border-white/15 dark:bg-gray-900/85 dark:text-gray-100">
          <div className="flex items-center gap-1.5 font-bold text-blue-600 dark:text-blue-400">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: hoveredEntity.color }} />
            <span className="truncate">{hoveredEntity.name}</span>
          </div>
          {hoveredEntity.details && (
            <div className="mt-0.5 text-[11px] font-normal leading-snug text-gray-600 dark:text-gray-300">
              {hoveredEntity.details}
            </div>
          )}
        </div>
      )}

      {/* Легенда наложения «Дифф»: читается жюри без объяснений */}
      {diffView === 'diff' && (
        <div className="pointer-events-none absolute bottom-3 left-3 flex flex-wrap gap-x-3 gap-y-1 rounded-2xl border border-white/20 bg-[#0d1219]/85 px-3 py-2 font-mono text-[10px] text-gray-200 backdrop-blur-xl">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-0 w-6 border-t-2 border-dashed border-amber-500" /> было в «ДО»
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-0 w-6 border-t-2 border-dashed border-emerald-500" /> новое
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-0 w-6 border-t-2 border-dashed border-slate-400" /> старый путь
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-0 w-6 border-t-2 border-blue-500" /> новый путь
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm border-2 border-rose-500" /> дому хуже
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm border-2 border-emerald-500" /> дому лучше
          </span>
        </div>
      )}

      {contextMenu?.kind === 'edge' && menuEdge && menuEdgeNodes && (
        <DistrictContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          edgeId={menuEdge.id}
          lanesLabel={menuEdge.type === 'road' ? `${menuEdge.lanes ?? 2}` : '—'}
          isRing={isRingEdge(menuEdge)}
          showBusStop={menuEdge.type === 'road' && !isRingEdge(menuEdge)}
          onUpgradeLanes={onUpgradeLanes}
          onToggleSidewalk={onToggleSidewalk}
          onDeleteEdge={onDeleteEdge}
          onBuildBusStop={() => {
            onAddBusStopOnEdge(menuEdge.id, contextMenu.wx, contextMenu.wy);
          }}
          onBuildCrossing={(isUnderpass) => {
            onAddCrossingDirect(
              menuEdge.id,
              Math.round((menuEdgeNodes.from.x + menuEdgeNodes.to.x) / 2),
              Math.round((menuEdgeNodes.from.y + menuEdgeNodes.to.y) / 2),
              isUnderpass,
            );
          }}
          onClose={() => setContextMenu(null)}
        />
      )}

      {contextMenu?.kind === 'building' && menuBuilding && (
        <BuildingContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          buildingName={menuBuilding.name}
          currentTag={menuBuilding.tag ?? null}
          onSetTag={(tag) => {
            onSetBuildingTag(menuBuilding.id, tag);
          }}
          onDeleteBuilding={() => {
            onDeleteBuilding(menuBuilding.id);
          }}
          onClose={() => setContextMenu(null)}
        />
      )}

      {contextMenu?.kind === 'map' && contextMenu.nodeId && (
        <RouteContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          nodeLabel={`узел ${contextMenu.wx}, ${contextMenu.wy}`}
          hasStart={!!route?.startId}
          hasRoute={!!routePath}
          onSetStart={() => setRouteStart(contextMenu.nodeId as string)}
          onSetEnd={() => setRouteEnd(contextMenu.nodeId as string)}
          onClear={() => onRouteChange(null)}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}
