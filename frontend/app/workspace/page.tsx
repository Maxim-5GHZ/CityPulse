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
    <div className="flex aspect-[960/620] w-full items-center justify-center rounded-2xl border border-white/10 bg-white/5 font-mono text-sm text-zinc-400 backdrop-blur-md">
      Загрузка 3D-двойника Deck.gl…
    </div>
  ),
});

export default function WorkspacePage() {
  const { ready, token } = useAuth();
  const router = useRouter();

  const [baseScenario, setBaseScenario] = useState<DistrictScenario>(OBNINSK_2040_DISTRICT);
  const [currentScenario, setCurrentScenario] = useState<DistrictScenario>(OBNINSK_2040_DISTRICT);
  const [selectedBuildingId, setSelectedBuildingId] = useState<string | null>('ob51-b3');
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'2d' | '3d'>('2d');
  const [toolMode, setToolMode] = useState<ToolMode>('select');
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
    setCurrentScenario((prev) => {
      const newEdges = prev.edges.filter((e) => e.id !== id);
      const usedNodeIds = new Set<string>();
      newEdges.forEach((e) => {
        usedNodeIds.add(e.from);
        usedNodeIds.add(e.to);
      });
      prev.buildings.forEach((b) => {
        if (b.gateNodeId) usedNodeIds.add(b.gateNodeId);
      });
      prev.amenities.forEach((a) => {
        if (a.nodeId) usedNodeIds.add(a.nodeId);
      });
      const newNodes = prev.nodes.filter((n) => {
        if (n.isRoundabout || n.type === 'roundabout') return true;
        return usedNodeIds.has(n.id);
      });
      return { ...prev, edges: newEdges, nodes: newNodes };
    });
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
      <div className="relative flex items-center justify-center min-h-screen bg-zinc-950">
        <div
          aria-hidden
          className="fixed inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(ellipse 80% 60% at 50% 40%, rgba(90,98,120,0.22), transparent 70%),' +
              'radial-gradient(ellipse 60% 50% at 20% 80%, rgba(70,78,100,0.14), transparent 65%)',
          }}
        />
        <p className="relative text-sm font-medium text-center text-zinc-400">
          Инициализация…
        </p>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-zinc-950 text-zinc-100">
      <div
        aria-hidden
        className="fixed inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 100% 70% at 50% 30%, rgba(90,98,120,0.20), transparent 70%),' +
            'radial-gradient(ellipse 80% 60% at 15% 80%, rgba(70,78,100,0.14), transparent 65%),' +
            'radial-gradient(ellipse 70% 50% at 85% 75%, rgba(60,68,90,0.10), transparent 60%),' +
            'linear-gradient(180deg, #0a0a0b 0%, #18181b 50%, #09090b 100%)',
        }}
      />

      <div className="relative z-10 flex flex-col min-h-screen pb-6">
        <AppHeader />

        <main className="mx-auto w-full max-w-[1500px] px-4 pt-4 sm:px-6">
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

          <div className="flex p-1 mb-3 border rounded-xl border-white/10 bg-white/5 backdrop-blur-md lg:hidden">
            <button
              type="button"
              onClick={() => setMobileTab('canvas')}
              className={`flex-1 rounded-lg py-1.5 text-xs font-medium transition-colors ${
                mobileTab === 'canvas' ? 'bg-white/15 text-zinc-50' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {viewMode === '2d' ? '2D Чертёж' : '3D Модель'}
            </button>
            <button
              type="button"
              onClick={() => setMobileTab('inspector')}
              className={`flex-1 rounded-lg py-1.5 text-xs font-medium transition-colors ${
                mobileTab === 'inspector' ? 'bg-white/15 text-zinc-50' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Аудит и метрики
            </button>
          </div>

          {/* Сетка: items-stretch (по умолчанию) выровняет высоту карты и сайдбара */}
          <div className="grid gap-4 lg:grid-cols-12">
            <div
              className={`flex flex-col lg:col-span-8 ${
                mobileTab === 'inspector' ? 'hidden lg:flex' : 'flex'
              }`}
            >
              <div className="flex-1 w-full">
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
            </div>

            {/* Сайдбар занимает всю доступную высоту карты. 
                Если контента станет слишком много, он аккуратно скроллится. */}
            <div
              className={`flex flex-col lg:col-span-4 ${
                mobileTab === 'canvas' ? 'hidden lg:flex' : 'flex'
              }`}
            >
              <div className="h-full w-full overflow-y-auto pr-1 lg:[scrollbar-width:thin]">
                <DistrictSidebar
                  selectedBuilding={selectedBuilding}
                  selectedEdge={selectedEdge}
                  activePath={activePath}
                  metrics={metrics}
                  baseMetrics={baseMetrics}
                />
              </div>
            </div>
          </div>
        </main>

        <ProjectsModal
          isOpen={showProjectsModal}
          onClose={() => setShowProjectsModal(false)}
          projects={projectsList}
          onSelectProject={handleLoadProject}
        />

        {hint && (
          <div
            key={hint.id}
            className="fixed z-50 px-5 py-2 text-xs font-medium text-center -translate-x-1/2 border shadow-2xl bottom-6 left-1/2 rounded-xl border-white/15 bg-zinc-900/90 text-zinc-100 shadow-black/50 backdrop-blur-md"
            role="status"
          >
            {hint.text}
          </div>
        )}
      </div>
    </div>
  );
}