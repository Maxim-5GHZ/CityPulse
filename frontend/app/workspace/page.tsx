// frontend/app/workspace/page.tsx
'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useAuth } from '@/lib/auth';
import AppHeader from '@/components/AppHeader';
import DistrictMap, { ToolMode } from '@/components/city/DistrictMap';
import DistrictToolbar from '@/components/city/DistrictToolbar';
import DistrictSidebar from '@/components/city/DistrictSidebar';
import ProjectsModal from '@/components/city/ProjectsModal';
import { EMPTY_DISTRICT, OBNINSK_2040_DISTRICT } from '@/lib/city-engine/presets';
import { calculateMetrics } from '@/lib/city-engine/metrics';
import { computePolygonAreaM2, findClosestNodeId } from '@/lib/city-engine/geometry';
import { planRoundabout, isRingEdge } from '@/lib/city-engine/roundabout';
import { DistrictScenario, Building, GraphEdge, GraphNode, Amenity } from '@/lib/city-engine/types';
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

export default function WorkspacePage() {
  const { ready, token } = useAuth();
  const router = useRouter();

  // Вход — сразу в район: жюри видит схему, а не пустой холст.
  const [baseScenario, setBaseScenario] = useState<DistrictScenario>(OBNINSK_2040_DISTRICT);
  const [currentScenario, setCurrentScenario] = useState<DistrictScenario>(OBNINSK_2040_DISTRICT);
  const [selectedBuildingId, setSelectedBuildingId] = useState<string | null>('ob51-b3');
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'2d' | '3d'>('2d');
  const [toolMode, setToolMode] = useState<ToolMode>('select');

  // Мобильный таб: на смартфонах переключаемся между чертежом и панелью аудита
  const [mobileTab, setMobileTab] = useState<'canvas' | 'inspector'>('canvas');

  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [projectName, setProjectName] = useState<string>('Проект района 2040');
  const [projectsList, setProjectsList] = useState<ProjectSummary[]>([]);
  const [showProjectsModal, setShowProjectsModal] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);

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
  const selectedBuilding = currentScenario.buildings.find((b) => b.id === selectedBuildingId);
  const selectedEdge = currentScenario.edges.find((e) => e.id === selectedEdgeId) ?? null;

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
        node1 = { id: `n-${Date.now()}-1`, x: x1, y: y1, label: 'Узел', type: 'intersection', isCustom: true };
        newNodes.push(node1);
      }
      if (!node2) {
        node2 = { id: `n-${Date.now()}-2`, x: x2, y: y2, label: 'Узел', type: 'intersection', isCustom: true };
        newNodes.push(node2);
      }

      const lengthM = Math.round(Math.hypot(x2 - x1, y2 - y1) * 1.1);
      const newEdge: GraphEdge = {
        id: `e-${Date.now()}`,
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
      const gateNodeId = findClosestNodeId(points[0].x, points[0].y, prev.nodes);

      const newBuilding: Building = {
        id: `b-${Date.now()}`,
        name: `Корпус ${prev.buildings.length + 1} (Кастом)`,
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
      const gateNodeId = findClosestNodeId(points[0].x, points[0].y, prev.nodes);
      const newAmenity: Amenity = {
        id: `park-${Date.now()}`,
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
      const nx = len > 0 ? -dy / len : 0;
      const ny = len > 0 ? dx / len : 0;

      const n1: GraphNode = {
        id: `nc-${Date.now()}-1`,
        x: Math.round(px + nx * 18),
        y: Math.round(py + ny * 18),
        label: 'Створ перехода',
        type: 'intersection',
        isCustom: true,
      };
      const n2: GraphNode = {
        id: `nc-${Date.now()}-2`,
        x: Math.round(px - nx * 18),
        y: Math.round(py - ny * 18),
        label: 'Створ перехода',
        type: 'intersection',
        isCustom: true,
      };

      const crossingEdge: GraphEdge = {
        id: `cross-${Date.now()}`,
        from: n1.id,
        to: n2.id,
        lengthM: isUnderpass ? 55 : 35,
        type: isUnderpass ? 'underpass' : 'crossing',
        isActive: true,
        isAccessible: !isUnderpass,
        isCustom: true,
      };

      return { ...prev, nodes: [...prev.nodes, n1, n2], edges: [...prev.edges, crossingEdge] };
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
        id: `rn-${Date.now()}`,
        x: px,
        y: py,
        label: 'Зона ремонта',
        type: 'intersection',
        isCustom: true,
      };

      const part1: GraphEdge = {
        ...edge,
        id: `ep1-${Date.now()}`,
        from: edge.from,
        to: repairNode.id,
        lengthM: Math.round(edge.lengthM / 2),
        isActive: true,
        isCustom: true,
      };

      const part2: GraphEdge = {
        ...edge,
        id: `ep2-${Date.now()}`,
        from: repairNode.id,
        to: edge.to,
        lengthM: Math.round(edge.lengthM / 2),
        isActive: false,
        isCustom: true,
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
        e.id === edgeId ? { ...e, lanes: e.lanes === 4 ? 2 : 4, isCustom: true } : e,
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
          ? { ...e, hasSidewalkLeft: !e.hasSidewalkLeft, isCustom: true }
          : { ...e, hasSidewalkRight: !e.hasSidewalkRight, isCustom: true };
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

  const handleSaveProject = async () => {
    if (!token) return;
    setIsSaving(true);
    try {
      const dataStr = JSON.stringify(currentScenario);
      if (currentProjectId) {
        await updateProject(token, currentProjectId, projectName, dataStr);
      } else {
        const created = await createProject(token, projectName, dataStr);
        setCurrentProjectId(created.id);
      }
      await refreshProjectsList();
      showHint('Проект успешно сохранён в БД');
    } finally {
      setIsSaving(false);
    }
  };

  const handleLoadProject = async (id: string) => {
    if (!token) return;
    try {
      const proj = await getProject(token, id);
      const parsed = JSON.parse(proj.data) as DistrictScenario;
      setCurrentScenario(parsed);
      setCurrentProjectId(proj.id);
      setProjectName(proj.name);
      setSelectedBuildingId(parsed.buildings[0]?.id ?? null);
      setShowProjectsModal(false);
      showHint(`Загружен проект: ${proj.name}`);
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
            onLoadPreset={() => {
              setCurrentScenario(OBNINSK_2040_DISTRICT);
              setBaseScenario(OBNINSK_2040_DISTRICT);
              setCurrentProjectId(null);
              setProjectName('51-й микрорайон (Обнинск)');
              setSelectedBuildingId('ob51-b3');
              showHint('Загружен мастер-план Обнинска');
            }}
            onClear={() => {
              setCurrentScenario(EMPTY_DISTRICT);
              setBaseScenario(EMPTY_DISTRICT);
              setCurrentProjectId(null);
              setProjectName('Новый чертёж');
              setSelectedBuildingId(null);
              showHint('Холст очищен');
            }}
            onOpenProjects={() => setShowProjectsModal(true)}
            onSaveProject={handleSaveProject}
            isSaving={isSaving}
            simPlaying={simPlaying}
            onToggleSimPlaying={() => setSimPlaying((p) => !p)}
            simSpeed={simSpeed}
            onSimSpeedChange={setSimSpeed}
          />

          {/* Мобильный сегментированный контрол (только для малых экранов) */}
          <div className="mb-3 flex rounded-full border border-white/60 bg-white/40 p-1 backdrop-blur-xl lg:hidden dark:border-white/20 dark:bg-white/10">
            <button
              type="button"
              onClick={() => setMobileTab('canvas')}
              className={`flex-1 rounded-full py-1.5 text-xs font-semibold transition-all duration-200 ${
                mobileTab === 'canvas'
                  ? 'bg-white text-gray-900 shadow dark:bg-white/25 dark:text-white'
                  : 'text-gray-600 dark:text-gray-300'
              }`}
            >
              {viewMode === '2d' ? '2D Чертёж' : '3D Модель'}
            </button>
            <button
              type="button"
              onClick={() => setMobileTab('inspector')}
              className={`flex-1 rounded-full py-1.5 text-xs font-semibold transition-all duration-200 ${
                mobileTab === 'inspector'
                  ? 'bg-white text-gray-900 shadow dark:bg-white/25 dark:text-white'
                  : 'text-gray-600 dark:text-gray-300'
              }`}
            >
              Аудит и метрики
            </button>
          </div>

          {/* Основная рабочая область: 12-колоночный грид с адаптивным отображением */}
          <div className="grid gap-4 lg:grid-cols-12">
            <div className={`space-y-4 lg:col-span-8 ${mobileTab === 'inspector' ? 'hidden lg:block' : 'block'}`}>
              {viewMode === '2d' ? (
                <DistrictMap
                  scenario={currentScenario}
                  selectedBuildingId={selectedBuildingId}
                  selectedEdgeId={selectedEdgeId}
                  onSelectBuilding={setSelectedBuildingId}
                  onSelectEdge={setSelectedEdgeId}
                  activePathNodeIds={activePathNodeIds}
                  edgeLoads={metrics.edgeLoads}
                  toolMode={toolMode}
                  onAddRoad={handleAddRoad}
                  onAddPolyBuilding={handleAddPolyBuilding}
                  onAddPolyPark={handleAddPolyPark}
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
                  simPlaying={simPlaying}
                  simSpeed={simSpeed}
                />
              )}
            </div>

            <div className={`lg:col-span-4 ${mobileTab === 'canvas' ? 'hidden lg:block' : 'block'}`}>
              <DistrictSidebar
                selectedBuilding={selectedBuilding}
                selectedEdge={selectedEdge}
                activePath={activePath}
                metrics={metrics}
                baseMetrics={baseMetrics}
              />
            </div>
          </div>
        </main>

        <ProjectsModal
          isOpen={showProjectsModal}
          onClose={() => setShowProjectsModal(false)}
          projects={projectsList}
          onSelectProject={handleLoadProject}
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
