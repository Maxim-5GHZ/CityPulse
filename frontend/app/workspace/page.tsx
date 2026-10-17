// frontend/app/workspace/page.tsx
'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useAuth } from '@/lib/auth';
import AppHeader from '@/components/AppHeader';
import DistrictMap, { RouteSelection, ToolMode } from '@/components/city/DistrictMap';
import DistrictToolbar from '@/components/city/DistrictToolbar';
import ProjectsModal from '@/components/city/ProjectsModal';
import AuditDashboardModal, { HistorySnapshot } from '@/components/city/AuditDashboardModal';
import { EMPTY_DISTRICT } from '@/lib/city-engine/presets';
import { calculateMetrics, computeResidentImpact } from '@/lib/city-engine/metrics';
import { computePolygonAreaM2, findClosestNodeId, polygonCentroid, splitEdgeAt } from '@/lib/city-engine/geometry';
import { planRoundabout, isRingEdge } from '@/lib/city-engine/roundabout';
import { uniqueStamp } from '@/lib/city-engine/ids';
import { DistrictScenario, Building, BuildingTag, BUILDING_TAG_LABEL, GraphEdge, GraphNode, Amenity } from '@/lib/city-engine/types';
import { listProjects, createProject, updateProject, getProject, ProjectSummary } from '@/lib/projectApi';

// Deck.gl держит WebGL-контекст — только динамический импорт без SSR.
const DeckCityView = dynamic(() => import('@/components/city/DeckCityView'), {
  ssr: false,
  loading: () => (
    <div className="flex h-[560px] w-full items-center justify-center rounded-xl border border-gray-700 bg-[#161a22] font-mono text-sm text-gray-400">
      Загрузка 3D-двойника Deck.gl…
    </div>
  ),
});

function nextBuildingName(buildings: Building[]): string {
  let max = 0;
  for (const b of buildings) {
    const m = /^Корпус (\d+)/.exec(b.name);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `Корпус ${max + 1} (Кастом)`;
}

export default function WorkspacePage() {
  const { ready, token } = useAuth();
  const router = useRouter();

  // Старт — с пустого холста: пресет Обнинск-51 удалён, район строится с нуля.
  const [baseScenario, setBaseScenario] = useState<DistrictScenario>(EMPTY_DISTRICT);
  const [currentScenario, setCurrentScenario] = useState<DistrictScenario>(EMPTY_DISTRICT);
  // Режим сравнения «До / После»: current — проект, base — зафиксированное ДО
  // (только чтение), diff — наложение: проект + призрак базы.
  const [diffView, setDiffView] = useState<'current' | 'base' | 'diff'>('current');
  // Откуда взялось ДО: для подписи в сайдбаре («ДО = загрузка» / «ДО зафиксировано в …»).
  const [baseStamp, setBaseStamp] = useState<string>('ДО — пустой холст');
  const [selectedBuildingId, setSelectedBuildingId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'2d' | '3d'>('2d');
  const [toolMode, setToolMode] = useState<ToolMode>('select');
  // Маршрут А → Б: точки ставит пользователь через ПКМ только в 3D
  // (DeckCityView: unproject → снап к узлу), 2D лишь показывает линию и точку А;
  // путь считают умным Дейкстрой; те же узлы идут в 3D человечкам.
  const [route, setRoute] = useState<RouteSelection | null>(null);

  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [projectName, setProjectName] = useState<string>('Проект района 2040');
  const [projectsList, setProjectsList] = useState<ProjectSummary[]>([]);
  const [showProjectsModal, setShowProjectsModal] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  // Дашборд глубокого аудита + история замеров для его графика.
  const [showAuditModal, setShowAuditModal] = useState<boolean>(false);
  const [historySnapshots, setHistorySnapshots] = useState<HistorySnapshot[]>([]);

  const [simPlaying, setSimPlaying] = useState<boolean>(true);
  const [simSpeed, setSimSpeed] = useState<1 | 2 | 5>(1);

  const [hint, setHint] = useState<{ id: number; text: string } | null>(null);
  const hintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showHint = (text: string) => {
    if (hintTimer.current) clearTimeout(hintTimer.current);
    setHint({ id: Date.now(), text });
    hintTimer.current = setTimeout(() => setHint(null), 3000);
  };
  useEffect(
    () => () => {
      if (hintTimer.current) clearTimeout(hintTimer.current);
    },
    [],
  );

  useEffect(() => {
    if (ready && !token) router.replace('/login');
  }, [ready, token, router]);

  const refreshProjectsList = useCallback(async () => {
    if (!token) return;
    try {
      const list = await listProjects(token);
      setProjectsList(list);
    } catch {
      // Игнорируем ошибку получения списка
    }
  }, [token]);

  useEffect(() => {
    if (token) void refreshProjectsList();
  }, [token, refreshProjectsList]);

  const metrics = useMemo(
    () => calculateMetrics(currentScenario, baseScenario),
    [currentScenario, baseScenario],
  );
  const baseMetrics = useMemo(
    () => calculateMetrics(baseScenario, baseScenario),
    [baseScenario],
  );

  const activePath = selectedBuildingId ? metrics.busPaths[selectedBuildingId] : null;
  const activePathNodeIds = activePath ? activePath.pathNodeIds : [];
  // Путь того же дома в базовом ДО (серый след в режиме «Дифф»).
  const baseActivePath = selectedBuildingId ? baseMetrics.busPaths[selectedBuildingId] : null;
  const baseActivePathNodeIds = baseActivePath ? baseActivePath.pathNodeIds : [];
  // Персональный аудит: кому короче/длиннее до остановки + дельты по домам
  // для раскраски карты в режиме «Дифф».
  const impact = useMemo(
    () => computeResidentImpact(currentScenario, baseScenario, metrics, baseMetrics),
    [currentScenario, baseScenario, metrics, baseMetrics],
  );
  const buildingDeltas = useMemo(() => {
    const map: Record<string, number> = {};
    for (const b of impact.buildings) {
      if (b.deltaM !== null) map[b.id] = b.deltaM;
    }
    return map;
  }, [impact]);
  const openAudit = useCallback(() => setShowAuditModal(true), []);
  const closeAudit = useCallback(() => setShowAuditModal(false), []);
  // История решений для графика аудита: дебаунс 500мс после изменения метрик,
  // храним последние 12 шагов. Дубли (фиксация ДО без изменения схемы —
  // пересчёт даёт тот же объект метрик) отсекаем сравнением с последним
  // снэпшотом, иначе график засорится плоскими точками.
  useEffect(() => {
    const timer = setTimeout(() => {
      setHistorySnapshots((prev) => {
        const step = (prev[prev.length - 1]?.step ?? 0) + 1;
        const snapshot: HistorySnapshot = {
          step,
          time: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
          label: `Шаг #${step}`,
          busDist: metrics.weightedAvgBusDistM,
          parkPct: metrics.parkAccessPercent,
          schoolPct: metrics.schoolAccessPercent,
          mobilityPct: metrics.mobilityIndex,
          budget: metrics.budgetSpentRub,
          medianBusDist: metrics.medianBusDistM,
          p90BusDist: metrics.p90BusDistM,
          greenM2: metrics.greenM2PerResident,
          bikePct: metrics.bikeAccessPercent,
          bottlenecks: metrics.bottlenecks.length,
          residents: metrics.totalResidents,
        };
        const last = prev[prev.length - 1];
        if (
          last &&
          last.busDist === snapshot.busDist &&
          last.parkPct === snapshot.parkPct &&
          last.schoolPct === snapshot.schoolPct &&
          last.mobilityPct === snapshot.mobilityPct &&
          last.budget === snapshot.budget &&
          last.medianBusDist === snapshot.medianBusDist &&
          last.p90BusDist === snapshot.p90BusDist &&
          last.greenM2 === snapshot.greenM2 &&
          last.bikePct === snapshot.bikePct &&
          last.bottlenecks === snapshot.bottlenecks &&
          last.residents === snapshot.residents
        ) {
          return prev;
        }
        return [...prev.slice(-11), snapshot];
      });
    }, 500);
    return () => clearTimeout(timer);
  }, [metrics]);

  const handleAddRoad = (
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    type: 'road' | 'sidewalk' | 'crossing' = 'sidewalk',
  ) => {
    setCurrentScenario((prev) => {
      let node1 = prev.nodes.find((n) => n.x === x1 && n.y === y1);
      let node2 = prev.nodes.find((n) => n.x === x2 && n.y === y2);
      const newNodes = [...prev.nodes];

      if (!node1) {
        node1 = { id: `n-${uniqueStamp()}-1`, x: x1, y: y1, label: 'Узел', type: 'intersection', isCustom: true };
        newNodes.push(node1);
      }
      if (!node2) {
        node2 = { id: `n-${uniqueStamp()}-2`, x: x2, y: y2, label: 'Узел', type: 'intersection', isCustom: true };
        newNodes.push(node2);
      }

      const lengthM = Math.round(Math.hypot(x2 - x1, y2 - y1) * 1.1);
      const newEdge: GraphEdge = {
        id: `e-${uniqueStamp()}`,
        from: node1.id,
        to: node2.id,
        lengthM,
        type,
        lanes: type === 'road' ? 2 : undefined,
        hasSidewalkLeft: type === 'road',
        hasSidewalkRight: type === 'road',
        isActive: true,
        isAccessible: true,
        isCustom: true,
      };

      return { ...prev, nodes: newNodes, edges: [...prev.edges, newEdge] };
    });
  };

  const handleAddPolyBuilding = (points: { x: number; y: number }[]) => {
    setCurrentScenario((prev) => {
      const area = computePolygonAreaM2(points);
      const floors = 12;
      const estimatedResidents = Math.max(30, Math.round((area * floors) / 32));
      const c = polygonCentroid(points);
      const gateNodeId = findClosestNodeId(c.x, c.y, prev.nodes);

      const newBuilding: Building = {
        id: `b-${uniqueStamp()}`,
        name: nextBuildingName(prev.buildings),
        address: 'Проектируемый квартал',
        floors,
        residentsPerFloor: Math.round(estimatedResidents / floors),
        residents: estimatedResidents,
        gateNodeId,
        x: points[0].x,
        y: points[0].y,
        width: 60,
        height: 40,
        polygon: points,
        isCustom: true,
      };

      setSelectedBuildingId(newBuilding.id);
      return { ...prev, buildings: [...prev.buildings, newBuilding] };
    });
    setToolMode('select');
  };

  const handleAddPolyPark = (points: { x: number; y: number }[]) => {
    setCurrentScenario((prev) => {
      const c = polygonCentroid(points);
      const gateNodeId = findClosestNodeId(c.x, c.y, prev.nodes);
      const newAmenity: Amenity = {
        id: `park-${uniqueStamp()}`,
        name: 'Проектируемый сквер',
        type: 'park',
        nodeId: gateNodeId,
        coverageRadiusM: 350,
        polygon: points,
        isCustom: true,
      };
      return { ...prev, amenities: [...prev.amenities, newAmenity] };
    });
    setToolMode('select');
  };

  // Остановка в любом месте дороги (ПКМ-меню участка): разрез ребра
  // в точке клика + остановка на узле разреза. Клик в торец — встанет
  // на существующий узел без разреза. Кольцо резать нельзя.
  const handleAddBusStopOnEdge = (edgeId: string, px: number, py: number) => {
    setCurrentScenario((prev) => {
      if (prev.nodes.length === 0) {
        showHint('Сначала постройте улицу');
        return prev;
      }
      const edge = prev.edges.find((e) => e.id === edgeId);
      if (!edge) return prev;
      if (isRingEdge(edge)) {
        showHint('Кольцо резать нельзя');
        return prev;
      }
      const cut = splitEdgeAt(prev, edgeId, px, py);
      if (!cut) {
        showHint('Здесь остановку не поставить');
        return prev;
      }
      const count = prev.amenities.filter((a) => a.type === 'bus_stop').length + 1;
      const stop: Amenity = {
        id: `bus-${uniqueStamp()}`,
        name: `Остановка №${count}`,
        type: 'bus_stop',
        nodeId: cut.nodeId,
        coverageRadiusM: 500,
        isCustom: true,
      };
      showHint(`Новая остановка: ${stop.name}`);
      return { ...cut.scenario, amenities: [...cut.scenario.amenities, stop] };
    });
  };

  // Социальный тег корпуса (ПКМ-меню дома): школа/полиция/больница/магазин.
  // null — снять тег (вернуть «Жилой»). Тег платный (tag_* в бюджете),
  // корпус из сейва при этом в build_new_tower не влетает (см. tagCustom).
  const handleSetBuildingTag = (buildingId: string, tag: BuildingTag | null) => {
    setCurrentScenario((prev) => {
      const b = prev.buildings.find((bb) => bb.id === buildingId);
      if (!b) return prev;
      if (!tag) {
        showHint(`Тег снят: ${b.name} — снова жилой`);
        return {
          ...prev,
          buildings: prev.buildings.map((bb) =>
            bb.id === buildingId ? { ...bb, tag: undefined, tagCustom: undefined } : bb,
          ),
        };
      }
      showHint(`${BUILDING_TAG_LABEL[tag]}: ${b.name}`);
      return {
        ...prev,
        buildings: prev.buildings.map((bb) =>
          bb.id === buildingId ? { ...bb, tag, tagCustom: true } : bb,
        ),
      };
    });
    setSelectedBuildingId(buildingId);
  };

  // --- Перемещение объектов мышью (drag-and-drop в режиме «Выбор») ---
  const handleMoveNode = (id: string, x: number, y: number) => {
    setCurrentScenario((prev) => {
      const node = prev.nodes.find((n) => n.id === id);
      if (!node || node.isRoundabout || node.type === 'roundabout') {
        showHint('Элемент кольца двигать нельзя');
        return prev;
      }
      const nodes = prev.nodes.map((n) => (n.id === id ? { ...n, x, y } : n));
      const pos = new Map(nodes.map((n) => [n.id, n] as const));
      const edges = prev.edges.map((e) => {
        if (e.from !== id && e.to !== id) return e;
        const u = pos.get(e.from);
        const v = pos.get(e.to);
        if (!u || !v) return e;
        return { ...e, lengthM: Math.max(5, Math.round(Math.hypot(v.x - u.x, v.y - u.y))) };
      });
      return { ...prev, nodes, edges };
    });
  };

  const handleMoveBuilding = (id: string, x: number, y: number) => {
    setCurrentScenario((prev) => {
      const b = prev.buildings.find((bb) => bb.id === id);
      if (!b) return prev;
      const ox = b.polygon && b.polygon.length > 0 ? b.polygon[0].x : b.x;
      const oy = b.polygon && b.polygon.length > 0 ? b.polygon[0].y : b.y;
      const polygon = b.polygon?.map((p) => ({ x: p.x + (x - ox), y: p.y + (y - oy) }));
      const nx = polygon ? polygon[0].x : x;
      const ny = polygon ? polygon[0].y : y;
      const c = polygon && polygon.length > 0 ? polygonCentroid(polygon) : { x: nx, y: ny };
      const gateNodeId = prev.nodes.length > 0 ? findClosestNodeId(c.x, c.y, prev.nodes) : b.gateNodeId;
      return {
        ...prev,
        buildings: prev.buildings.map((bb) =>
          bb.id === id ? { ...bb, x: nx, y: ny, polygon, gateNodeId } : bb,
        ),
      };
    });
  };

  const handleMoveAmenity = (id: string, x: number, y: number) => {
    setCurrentScenario((prev) => {
      const a = prev.amenities.find((aa) => aa.id === id);
      if (!a || prev.nodes.length === 0) return prev;
      const targetNodeId = findClosestNodeId(x, y, prev.nodes);
      if (a.polygon && a.polygon.length > 0) {
        const dx = x - a.polygon[0].x;
        const dy = y - a.polygon[0].y;
        const polygon = a.polygon.map((p) => ({ x: p.x + dx, y: p.y + dy }));
        return {
          ...prev,
          amenities: prev.amenities.map((aa) =>
            aa.id === id ? { ...aa, nodeId: targetNodeId, polygon, isCustom: true } : aa,
          ),
        };
      }
      return {
        ...prev,
        amenities: prev.amenities.map((aa) =>
          aa.id === id ? { ...aa, nodeId: targetNodeId, isCustom: true } : aa,
        ),
      };
    });
  };

  const handleAddCrossingDirect = (edgeId: string, px: number, py: number, isUnderpass = false) => {
    const edge = currentScenario.edges.find((e) => e.id === edgeId);
    if (edge && isRingEdge(edge)) {
      showHint('На кольце переходы не строят — выберите обычную дорогу');
      return;
    }
    setCurrentScenario((prev) => {
      const edge = prev.edges.find((e) => e.id === edgeId);
      if (!edge) return prev;
      const nFrom = prev.nodes.find((n) => n.id === edge.from);
      const nTo = prev.nodes.find((n) => n.id === edge.to);
      if (!nFrom || !nTo) return prev;

      const dx = nTo.x - nFrom.x;
      const dy = nTo.y - nFrom.y;
      const len = Math.hypot(dx, dy);
      if (len === 0) return prev;
      const nx = -dy / len;
      const ny = dx / len;

      const cut = splitEdgeAt(prev, edgeId, px, py);
      if (!cut) {
        showHint('Здесь переход не построить');
        return prev;
      }
      const center = cut.scenario.nodes.find((n) => n.id === cut.nodeId);
      if (!center) return prev;

      const n1: GraphNode = {
        id: `nc-${uniqueStamp()}-1`,
        x: Math.round(center.x + nx * 18),
        y: Math.round(center.y + ny * 18),
        label: 'Створ перехода',
        type: 'intersection',
        isCustom: true,
      };
      const n2: GraphNode = {
        id: `nc-${uniqueStamp()}-2`,
        x: Math.round(center.x - nx * 18),
        y: Math.round(center.y - ny * 18),
        label: 'Створ перехода',
        type: 'intersection',
        isCustom: true,
      };

      const crossingEdge: GraphEdge = {
        id: `cross-${uniqueStamp()}`,
        from: n1.id,
        to: n2.id,
        lengthM: isUnderpass ? 55 : 35,
        type: isUnderpass ? 'underpass' : 'crossing',
        isActive: true,
        isAccessible: !isUnderpass,
        isCustom: true,
      };
      // Створы обязаны сидеть на графе: половинки зебры от узла разреза
      // геометрически лежат на линии n1–n2 (центр — середина створов),
      // поэтому визуально ничего не добавляют, но компоненту связывают.
      const tieM = isUnderpass ? 27 : 18;
      const mkTie = (n: GraphNode, suffix: string): GraphEdge => ({
        id: `cxt-${uniqueStamp()}-${suffix}`,
        from: center.id,
        to: n.id,
        lengthM: tieM,
        type: isUnderpass ? 'underpass' : 'crossing',
        isActive: true,
        isAccessible: !isUnderpass,
        isCustom: true,
      });

      return {
        ...cut.scenario,
        nodes: [...cut.scenario.nodes, n1, n2],
        edges: [...cut.scenario.edges, crossingEdge, mkTie(n1, '1'), mkTie(n2, '2')],
      };
    });
    setToolMode('select');
  };

  const handleSplitAndBlockSpot = (edgeId: string, px: number, py: number) => {
    const edge = currentScenario.edges.find((e) => e.id === edgeId);
    if (edge && isRingEdge(edge)) {
      showHint('Кольцо ремонтировать нельзя — перекройте примыкание');
      return;
    }
    setCurrentScenario((prev) => {
      const edge = prev.edges.find((e) => e.id === edgeId);
      if (!edge) return prev;

      const repairNode: GraphNode = {
        id: `rn-${uniqueStamp()}`,
        x: px,
        y: py,
        label: 'Зона ремонта',
        type: 'intersection',
        isCustom: true,
      };

      const part1: GraphEdge = {
        ...edge,
        id: `ep1-${uniqueStamp()}`,
        from: edge.from,
        to: repairNode.id,
        lengthM: Math.round(edge.lengthM / 2),
        isActive: true,
        isCustom: true,
        inheritedLanes: true,
        inheritedSidewalkLeft: true,
        inheritedSidewalkRight: true,
      };

      const part2: GraphEdge = {
        ...edge,
        id: `ep2-${uniqueStamp()}`,
        from: repairNode.id,
        to: edge.to,
        lengthM: Math.round(edge.lengthM / 2),
        isActive: false,
        isCustom: true,
        inheritedLanes: true,
        inheritedSidewalkLeft: true,
        inheritedSidewalkRight: true,
      };

      return {
        ...prev,
        nodes: [...prev.nodes, repairNode],
        edges: [...prev.edges.filter((e) => e.id !== edgeId), part1, part2],
      };
    });
    setToolMode('select');
  };

  const handleUpgradeLanes = (edgeId: string) => {
    const edge = currentScenario.edges.find((e) => e.id === edgeId);
    if (edge && isRingEdge(edge)) {
      showHint('Полосы на кольце фиксированы (2)');
      return;
    }
    setCurrentScenario((prev) => ({
      ...prev,
      edges: prev.edges.map((e) =>
        e.id === edgeId ? { ...e, lanes: e.lanes === 4 ? 2 : 4, inheritedLanes: false, isCustom: true } : e,
      ),
    }));
  };

  const handleToggleSidewalk = (edgeId: string, side: 'left' | 'right') => {
    const edge = currentScenario.edges.find((e) => e.id === edgeId);
    if (edge && isRingEdge(edge)) {
      showHint('Тротуары на кольце не строят');
      return;
    }
    setCurrentScenario((prev) => ({
      ...prev,
      edges: prev.edges.map((e) => {
        if (e.id !== edgeId) return e;
        return side === 'left'
          ? { ...e, hasSidewalkLeft: !e.hasSidewalkLeft, inheritedSidewalkLeft: false, isCustom: true }
          : { ...e, hasSidewalkRight: !e.hasSidewalkRight, inheritedSidewalkRight: false, isCustom: true };
      }),
    }));
  };

  const handleMakeRoundabout = (nodeId: string) => {
    const plan = planRoundabout(currentScenario, nodeId);
    if (!plan.ok) {
      showHint(plan.error);
      return;
    }
    setCurrentScenario((prev) => ({ ...prev, nodes: plan.nodes, edges: plan.edges }));
    setToolMode('select');
  };

  const handleDeleteEdge = (id: string) => {
    const edge = currentScenario.edges.find((e) => e.id === id);
    if (edge && isRingEdge(edge)) {
      showHint('Элемент кольца: снос запрещён');
      return;
    }
    setCurrentScenario((p) => ({
      ...p,
      edges: p.edges.filter((e) => e.id !== id),
    }));
  };

  // Конверт персиста в PostgreSQL (поле data таблицы projects — непрозрачный JSON):
  // вместе с проектом храним зафиксированное ДО. Старые сейвы (голый сценарий
  // без version) грузятся как раньше, ДО при этом = копия загруженного.
  const deepCopy = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

  const parseProjectData = (raw: string): { scenario: DistrictScenario; base: DistrictScenario | null } => {
    const parsed = JSON.parse(raw) as DistrictScenario & {
      version?: number;
      scenario?: DistrictScenario;
      baseScenario?: DistrictScenario | null;
    };
    if (parsed && parsed.version === 1 && parsed.scenario) {
      return { scenario: parsed.scenario, base: parsed.baseScenario ?? null };
    }
    return { scenario: parsed, base: null };
  };

  // Железобетонная фиксация ДО: глубокая копия текущего в память.
  // В PostgreSQL база уедет следующим «Сохранить» (конверт выше).
  const handleFixBase = () => {
    setBaseScenario(deepCopy(currentScenario));
    const stamp = `ДО зафиксировано в ${new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`;
    setBaseStamp(stamp);
    setDiffView('current');
    showHint('Точка «ДО» зафиксирована — проектируйте, дельты считаются от неё');
  };

  const handleRollbackToBase = () => {
    setCurrentScenario(deepCopy(baseScenario));
    setSelectedBuildingId(baseScenario.buildings[0]?.id ?? null);
    setSelectedEdgeId(null);
    setDiffView('current');
    showHint('Откатились к зафиксированному «ДО» — все Δ обнулились');
  };

  const handleSaveProject = async () => {
    if (!token) return;
    setIsSaving(true);
    try {
      const dataStr = JSON.stringify({ version: 1, scenario: currentScenario, baseScenario });
      if (currentProjectId) {
        await updateProject(token, currentProjectId, projectName, dataStr);
      } else {
        const created = await createProject(token, projectName, dataStr);
        setCurrentProjectId(created.id);
      }
      await refreshProjectsList();
      showHint('Проект и точка «ДО» сохранены в БД');
    } finally {
      setIsSaving(false);
    }
  };

  const handleLoadProject = async (id: string) => {
    if (!token) return;
    try {
      const proj = await getProject(token, id);
      const { scenario, base } = parseProjectData(proj.data);
      setCurrentScenario(scenario);
      if (base) {
        setBaseScenario(base);
        setBaseStamp('ДО — из сохранения проекта');
        showHint(`Загружен проект: ${proj.name}. Базовая точка «ДО» восстановлена`);
      } else {
        setBaseScenario(deepCopy(scenario));
        setBaseStamp('ДО = загрузка проекта');
        showHint(`Загружен проект: ${proj.name}. Базовая точка «ДО» зафиксирована`);
      }
      setDiffView('current');
      setCurrentProjectId(proj.id);
      setProjectName(proj.name);
      setSelectedBuildingId(scenario.buildings[0]?.id ?? null);
      setSelectedEdgeId(null);
      setShowProjectsModal(false);
    } catch {
      showHint('Ошибка загрузки проекта');
    }
  };

  if (!ready || !token) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center px-6 py-6">
        <p className="text-center font-medium text-sm text-gray-500">Инициализация…</p>
      </main>
    );
  }

  return (
    <div
      className="relative min-h-screen bg-cover bg-center text-gray-800 dark:text-gray-100"
      style={{ backgroundImage: "url('/city.png')" }}
    >
      {/* Общая вуаль Liquid Glass */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-b from-white/30 via-white/10 to-white/40 dark:from-black/60 dark:via-black/40 dark:to-black/70"
      />

      <div className="relative z-10 flex min-h-screen flex-col pb-8">
        <AppHeader />

        <main className="mx-auto w-full max-w-7xl px-3 pt-3 sm:px-6">
          <DistrictToolbar
            projectName={projectName}
            onProjectNameChange={setProjectName}
            buildingCount={currentScenario.buildings.length}
            edgeCount={currentScenario.edges.length}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            toolMode={toolMode}
            onToolModeChange={setToolMode}
            onClear={() => {
              setCurrentScenario(EMPTY_DISTRICT);
              setBaseScenario(EMPTY_DISTRICT);
              setDiffView('current');
              setBaseStamp('ДО — пустой холст');
              setCurrentProjectId(null);
              setProjectName('Новый чертёж');
              setSelectedBuildingId(null);
              showHint('Холст очищен');
            }}
            onFixBase={handleFixBase}
            onRollbackToBase={handleRollbackToBase}
            onOpenAudit={openAudit}
            baseStamp={baseStamp}
            diffView={diffView}
            onDiffViewChange={setDiffView}
            onOpenProjects={() => setShowProjectsModal(true)}
            onSaveProject={handleSaveProject}
            isSaving={isSaving}
            simPlaying={simPlaying}
            onToggleSimPlaying={() => setSimPlaying((p) => !p)}
            simSpeed={simSpeed}
            onSimSpeedChange={setSimSpeed}
          />

          {/* Основная рабочая область: чертёж во всю ширину (инспектор всплывает
              попапом у объекта, сайдбара больше нет) */}
          <div>
            <div className="space-y-4">
              {viewMode === '2d' ? (
                <DistrictMap
                  scenario={currentScenario}
                  baseScenario={baseScenario}
                  diffView={diffView}
                  selectedBuildingId={selectedBuildingId}
                  selectedEdgeId={selectedEdgeId}
                  onSelectBuilding={setSelectedBuildingId}
                  onSelectEdge={setSelectedEdgeId}
                  activePathNodeIds={activePathNodeIds}
                  baseActivePathNodeIds={baseActivePathNodeIds}
                  buildingDeltas={buildingDeltas}
                  edgeLoads={diffView === 'base' ? baseMetrics.edgeLoads : metrics.edgeLoads}
                  busPaths={diffView === 'base' ? baseMetrics.busPaths : metrics.busPaths}
                  toolMode={toolMode}
                  route={route}
                  onRouteChange={setRoute}
                  onNotify={showHint}
                  onAddRoad={handleAddRoad}
                  onAddPolyBuilding={handleAddPolyBuilding}
                  onAddPolyPark={handleAddPolyPark}
                  onAddBusStopOnEdge={handleAddBusStopOnEdge}
                  onSetBuildingTag={handleSetBuildingTag}
                  onAddCrossingDirect={handleAddCrossingDirect}
                  onSplitAndBlockSpot={handleSplitAndBlockSpot}
                  onUpgradeLanes={handleUpgradeLanes}
                  onToggleSidewalk={handleToggleSidewalk}
                  onMakeRoundabout={handleMakeRoundabout}
                  onDeleteBuilding={(id) =>
                    setCurrentScenario((p) => ({
                      ...p,
                      buildings: p.buildings.filter((b) => b.id !== id),
                    }))
                  }
                  onDeleteEdge={handleDeleteEdge}
                  onDeleteAmenity={(id) =>
                    setCurrentScenario((p) => ({
                      ...p,
                      amenities: p.amenities.filter((a) => a.id !== id),
                    }))
                  }
                  onMoveNode={handleMoveNode}
                  onMoveBuilding={handleMoveBuilding}
                  onMoveAmenity={handleMoveAmenity}
                />
              ) : (
                <DeckCityView
                  scenario={currentScenario}
                  selectedBuildingId={selectedBuildingId}
                  onSelectBuilding={(id) => setSelectedBuildingId(id)}
                  activePathNodeIds={activePathNodeIds}
                  edgeLoads={metrics.edgeLoads}
                  busPaths={metrics.busPaths}
                  parkPaths={metrics.parkPaths}
                  schoolPaths={metrics.schoolPaths}
                  shopPaths={metrics.shopPaths}
                  routePathNodeIds={route?.pathNodeIds ?? []}
                  route={route}
                  onRouteChange={setRoute}
                  onNotify={showHint}
                  simPlaying={simPlaying}
                  simSpeed={simSpeed}
                />
              )}
            </div>
          </div>
        </main>

        <ProjectsModal
          isOpen={showProjectsModal}
          onClose={() => setShowProjectsModal(false)}
          projects={projectsList}
          onSelectProject={handleLoadProject}
        />

        <AuditDashboardModal
          isOpen={showAuditModal}
          onClose={closeAudit}
          projectName={projectName}
          baseStamp={baseStamp}
          metrics={metrics}
          baseMetrics={baseMetrics}
          impact={impact}
          history={historySnapshots}
        />

        {/* Стеклянный тост подсказок и инженерных предупреждений */}
        {hint && (
          <div
            key={hint.id}
            className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 transform-gpu rounded-full border border-white/60 bg-white/70 px-5 py-2 text-center text-xs font-semibold text-gray-800 shadow-[inset_1px_1px_2px_rgba(255,255,255,0.8),0_12px_32px_-8px_rgba(20,26,38,0.45)] backdrop-blur-2xl transition-all dark:border-white/20 dark:bg-gray-900/85 dark:text-gray-100"
            role="status"
          >
            {hint.text}
          </div>
        )}
      </div>
    </div>
  );
}
