'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import AppHeader from '@/components/AppHeader';
import DistrictMap, { ToolMode } from '@/components/city/DistrictMap';
import DistrictMap3D from '@/components/city/DistrictMap3D';
import { EMPTY_DISTRICT, OBNINSK_MARX_DISTRICT } from '@/lib/city-engine/presets';
import { calculateMetrics } from '@/lib/city-engine/metrics';
import { DistrictScenario, Building, GraphEdge, GraphNode, Amenity } from '@/lib/city-engine/types';
import { listProjects, createProject, updateProject, deleteProject, getProject, ProjectSummary } from '@/lib/projectApi';

const cadBtn =
  'px-3 py-1.5 text-xs font-mono font-medium rounded border border-gray-600 bg-gray-800 text-gray-200 ' +
  'hover:bg-gray-700 hover:border-gray-500 active:bg-gray-900 transition-colors disabled:opacity-50';

const cadBtnActive =
  'px-3 py-1.5 text-xs font-mono font-semibold rounded border border-blue-500 bg-blue-600 text-white ' +
  'hover:bg-blue-500 transition-colors shadow-sm';

export default function WorkspacePage() {
  const { ready, token } = useAuth();
  const router = useRouter();

  const [baseScenario, setBaseScenario] = useState<DistrictScenario>(EMPTY_DISTRICT);
  const [currentScenario, setCurrentScenario] = useState<DistrictScenario>(EMPTY_DISTRICT);
  const [selectedBuildingId, setSelectedBuildingId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'2d' | '3d'>('2d');
  const [toolMode, setToolMode] = useState<ToolMode>('select');

  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [projectName, setProjectName] = useState<string>('Проект района 2040');
  const [projectsList, setProjectsList] = useState<ProjectSummary[]>([]);
  const [showProjectsModal, setShowProjectsModal] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [projectsError, setProjectsError] = useState<string | null>(null);

  const [simPlaying, setSimPlaying] = useState<boolean>(true);
  const [simSpeed, setSimSpeed] = useState<1 | 2 | 5>(1);

  useEffect(() => {
    if (ready && !token) router.replace('/login');
  }, [ready, token, router]);

  const refreshProjectsList = useCallback(async () => {
    if (!token) return;
    try {
      setProjectsError(null);
      const list = await listProjects(token);
      setProjectsList(list);
    } catch {
      setProjectsError('Не удалось загрузить проекты');
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

  const busDelta = metrics.weightedAvgBusDistM - baseMetrics.weightedAvgBusDistM;
  const parkDelta = metrics.parkAccessPercent - baseMetrics.parkAccessPercent;
  const activePath = selectedBuildingId ? metrics.busPaths[selectedBuildingId] : null;
  const activePathNodeIds = activePath ? activePath.pathNodeIds : [];
  const selectedBuilding = currentScenario.buildings.find((b) => b.id === selectedBuildingId);

  const findClosestNodeId = (x: number, y: number, nodes: GraphNode[]): string => {
    let best = nodes[0]?.id ?? 'n1';
    let minD = Infinity;
    for (const n of nodes) {
      const d = Math.hypot(n.x - x, n.y - y);
      if (d < minD) {
        minD = d;
        best = n.id;
      }
    }
    return best;
  };

  // Трассировка дорог и тротуаров
  const handleAddRoad = (x1: number, y1: number, x2: number, y2: number, type: 'road' | 'sidewalk' | 'crossing' = 'sidewalk') => {
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
        isActive: true,
        isAccessible: true,
        isCustom: true,
      };

      return { ...prev, nodes: newNodes, edges: [...prev.edges, newEdge] };
    });
  };

  // ПЕРЕХОД В 1 КЛИК: разбивает полосу автодороги перпендикуляром
  const handleAddCrossingDirect = (edgeId: string, px: number, py: number) => {
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

      // Два створа по обеим сторонам проезжей части (отступ 18px)
      const nSide1: GraphNode = {
        id: `nc-${Date.now()}-1`,
        x: Math.round(px + nx * 18),
        y: Math.round(py + ny * 18),
        label: 'Створ перехода',
        type: 'intersection',
        isCustom: true,
      };
      const nSide2: GraphNode = {
        id: `nc-${Date.now()}-2`,
        x: Math.round(px - nx * 18),
        y: Math.round(py - ny * 18),
        label: 'Створ перехода',
        type: 'intersection',
        isCustom: true,
      };

      const crossingEdge: GraphEdge = {
        id: `cross-${Date.now()}`,
        from: nSide1.id,
        to: nSide2.id,
        lengthM: 35,
        type: 'crossing',
        isActive: true,
        isAccessible: true,
        isCustom: true,
      };

      return {
        ...prev,
        nodes: [...prev.nodes, nSide1, nSide2],
        edges: [...prev.edges, crossingEdge],
      };
    });
    setToolMode('select');
  };

  // ПЕРЕКРЫТИЕ ПУТИ (РЕМОНТ / БЛОКИРОВКА)
  const handleToggleBlockEdge = (edgeId: string) => {
    setCurrentScenario((prev) => ({
      ...prev,
      edges: prev.edges.map((e) => (e.id === edgeId ? { ...e, isActive: !e.isActive } : e)),
    }));
  };

  // Добавление дома
  const handleAddBuilding = (x: number, y: number) => {
    setCurrentScenario((prev) => {
      const gateNodeId = findClosestNodeId(x + 40, y + 25, prev.nodes);
      const newBuilding: Building = {
        id: `b-${Date.now()}`,
        name: `Корпус ${prev.buildings.length + 1}`,
        address: 'Проектируемый проезд',
        floors: 9,
        residentsPerFloor: 24,
        residents: 216,
        gateNodeId,
        x,
        y,
        width: 80,
        height: 50,
        isCustom: true,
      };
      setSelectedBuildingId(newBuilding.id);
      return { ...prev, buildings: [...prev.buildings, newBuilding] };
    });
    setToolMode('select');
  };

  // Добавление остановки или парка
  const handleAddAmenity = (type: 'bus_stop' | 'park', x: number, y: number) => {
    setCurrentScenario((prev) => {
      let targetNode = prev.nodes.find((n) => Math.hypot(n.x - x, n.y - y) <= 25);
      const newNodes = [...prev.nodes];
      if (!targetNode) {
        targetNode = {
          id: `n-${Date.now()}`,
          x,
          y,
          label: type === 'bus_stop' ? 'Остановка' : 'Сквер',
          type: type === 'bus_stop' ? 'bus_stop' : 'park_gate',
          isCustom: true,
        };
        newNodes.push(targetNode);
      }

      const newAmenity: Amenity = {
        id: `a-${Date.now()}`,
        name: type === 'bus_stop' ? 'Новая остановка' : 'Городской сквер',
        type,
        nodeId: targetNode.id,
        coverageRadiusM: type === 'bus_stop' ? 500 : 350,
        isCustom: true,
      };
      return { ...prev, nodes: newNodes, amenities: [...prev.amenities, newAmenity] };
    });
    setToolMode('select');
  };

  // Удаление
  const handleDeleteBuilding = (id: string) => {
    setCurrentScenario((prev) => ({
      ...prev,
      buildings: prev.buildings.filter((b) => b.id !== id),
    }));
    if (selectedBuildingId === id) setSelectedBuildingId(null);
  };

  const handleDeleteEdge = (id: string) => {
    setCurrentScenario((prev) => ({
      ...prev,
      edges: prev.edges.filter((e) => e.id !== id),
    }));
  };

  const handleDeleteAmenity = (id: string) => {
    setCurrentScenario((prev) => ({
      ...prev,
      amenities: prev.amenities.filter((a) => a.id !== id),
    }));
  };

  const updateSelectedBuilding = (fields: Partial<Building>) => {
    if (!selectedBuildingId) return;
    setCurrentScenario((prev) => ({
      ...prev,
      buildings: prev.buildings.map((b) => {
        if (b.id !== selectedBuildingId) return b;
        const updated = { ...b, ...fields };
        if (fields.floors !== undefined || fields.residentsPerFloor !== undefined) {
          updated.residents = updated.floors * updated.residentsPerFloor;
        }
        return updated;
      }),
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
    } catch (e) {
      setProjectsError(e instanceof Error ? e.message : 'Ошибка сохранения');
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
    } catch {
      setProjectsError('Не удалось открыть проект');
    }
  };

  if (!ready || !token) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center px-6 py-6">
        <p className="text-center font-mono text-sm text-gray-400">Инициализация...</p>
      </main>
    );
  }

  return (
    <div className="relative min-h-screen bg-[#0e121a] text-gray-200">
      <AppHeader />

      <main className="mx-auto w-full max-w-7xl px-4 py-4 sm:px-6">
        {/* Инженерная верхняя командная строка */}
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-700 bg-[#161c26] p-2.5">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-gray-400">ПРОЕКТ:</span>
            <input
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              className="rounded border border-gray-600 bg-gray-900 px-2 py-1 font-mono text-xs font-bold text-gray-100 outline-none focus:border-blue-500"
            />
            <span className="font-mono text-xs text-gray-500">
              [{currentScenario.buildings.length} домов | {currentScenario.edges.length} связей]
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setCurrentScenario(OBNINSK_MARX_DISTRICT);
                setBaseScenario(OBNINSK_MARX_DISTRICT);
                setCurrentProjectId(null);
                setProjectName('51-й микрорайон (Обнинск)');
              }}
              className={cadBtn}
            >
              Загрузить Обнинск-51
            </button>
            <button
              type="button"
              onClick={() => {
                setCurrentScenario(EMPTY_DISTRICT);
                setBaseScenario(EMPTY_DISTRICT);
                setCurrentProjectId(null);
                setProjectName('Новый пустой чертёж');
              }}
              className={cadBtn}
            >
              Очистить чертёж
            </button>
            <button type="button" onClick={() => setShowProjectsModal(true)} className={cadBtn}>
              Проекты БД
            </button>
            <button type="button" onClick={handleSaveProject} disabled={isSaving} className={cadBtnActive}>
              {isSaving ? 'Запись...' : 'Сохранить'}
            </button>
          </div>
        </div>

        {/* Панель инструментов CAD */}
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-700 bg-[#161c26] px-3 py-2">
          {viewMode === '2d' ? (
            <div className="flex flex-wrap items-center gap-1 font-mono text-xs">
              <span className="mr-2 text-gray-400">ИНСТРУМЕНТЫ:</span>
              <button type="button" onClick={() => setToolMode('select')} className={toolMode === 'select' ? cadBtnActive : cadBtn}>
                ВЫБОР
              </button>
              <button type="button" onClick={() => setToolMode('road')} className={toolMode === 'road' ? cadBtnActive : cadBtn}>
                АВТОДОРОГА
              </button>
              <button type="button" onClick={() => setToolMode('sidewalk')} className={toolMode === 'sidewalk' ? cadBtnActive : cadBtn}>
                ТРОТУАР
              </button>
              <button type="button" onClick={() => setToolMode('crossing')} className={toolMode === 'crossing' ? cadBtnActive : cadBtn} title="Кликните по автодороге для создания перехода">
                ПЕРЕХОД [1-КЛИК]
              </button>
              <button type="button" onClick={() => setToolMode('block')} className={toolMode === 'block' ? cadBtnActive : cadBtn} title="Клик по пути для блокировки/ремонта">
                ПЕРЕКРЫТЬ
              </button>
              <button type="button" onClick={() => setToolMode('building')} className={toolMode === 'building' ? cadBtnActive : cadBtn}>
                КОРПУС
              </button>
              <button type="button" onClick={() => setToolMode('bus_stop')} className={toolMode === 'bus_stop' ? cadBtnActive : cadBtn}>
                ОСТАНОВКА
              </button>
              <button type="button" onClick={() => setToolMode('park')} className={toolMode === 'park' ? cadBtnActive : cadBtn}>
                СКВЕР
              </button>
              <button type="button" onClick={() => setToolMode('delete')} className={toolMode === 'delete' ? cadBtnActive : cadBtn}>
                СНОС
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
              <span className="text-gray-400">СИМУЛЯЦИЯ:</span>
              <button type="button" onClick={() => setSimPlaying((p) => !p)} className={simPlaying ? cadBtn : cadBtnActive}>
                {simPlaying ? 'ПАУЗА' : 'СТАРТ'}
              </button>
              <div className="flex gap-1">
                {([1, 2, 5] as const).map((s) => (
                  <button key={s} type="button" onClick={() => setSimSpeed(s)} className={simSpeed === s ? cadBtnActive : cadBtn}>
                    {s}X
                  </button>
                ))}
              </div>
              <span className="text-emerald-400">Трафик Обнинска активен</span>
            </div>
          )}

          {/* Переключатель 2D / 3D */}
          <div className="flex gap-1 font-mono text-xs">
            <button type="button" onClick={() => setViewMode('2d')} className={viewMode === '2d' ? cadBtnActive : cadBtn}>
              2D ЧЕРТЁЖ
            </button>
            <button type="button" onClick={() => setViewMode('3d')} className={viewMode === '3d' ? cadBtnActive : cadBtn}>
              3D СИМУЛЯЦИЯ
            </button>
          </div>
        </div>

        {/* Рабочее поле и инспектор параметров */}
        <div className="grid gap-4 lg:grid-cols-12">
          <div className="space-y-4 lg:col-span-8">
            {viewMode === '2d' ? (
              <DistrictMap
                scenario={currentScenario}
                selectedBuildingId={selectedBuildingId}
                onSelectBuilding={setSelectedBuildingId}
                activePathNodeIds={activePathNodeIds}
                toolMode={toolMode}
                onAddRoad={handleAddRoad}
                onAddBuilding={handleAddBuilding}
                onAddAmenity={handleAddAmenity}
                onAddCrossingDirect={handleAddCrossingDirect}
                onToggleBlockEdge={handleToggleBlockEdge}
                onDeleteBuilding={handleDeleteBuilding}
                onDeleteEdge={handleDeleteEdge}
                onDeleteAmenity={handleDeleteAmenity}
              />
            ) : (
              <DistrictMap3D
                scenario={currentScenario}
                selectedBuildingId={selectedBuildingId}
                onSelectBuilding={(id: string) => setSelectedBuildingId(id)}
                activePathNodeIds={activePathNodeIds}
                simPlaying={simPlaying}
                simSpeed={simSpeed}
              />
            )}
          </div>

          {/* Правая панель свойств */}
          <div className="space-y-4 lg:col-span-4">
            {selectedBuilding ? (
              <div className="rounded-xl border border-gray-700 bg-[#161c26] p-4 font-mono">
                <h3 className="border-b border-gray-700 pb-2 text-xs font-bold uppercase text-blue-400">
                  ПАРАМЕТРЫ ОБЪЕКТА: {selectedBuilding.name}
                </h3>
                <div className="mt-3 space-y-3 text-xs">
                  <div>
                    <label className="text-gray-400">ИМЕНОВАНИЕ:</label>
                    <input
                      type="text"
                      value={selectedBuilding.name}
                      onChange={(e) => updateSelectedBuilding({ name: e.target.value })}
                      className="mt-1 w-full rounded border border-gray-600 bg-gray-900 px-2 py-1 text-gray-100"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">ЭТАЖНОСТЬ:</span>
                      <span className="font-bold text-gray-100">{selectedBuilding.floors} ЭТ.</span>
                    </div>
                    <input
                      type="range"
                      min={1}
                      max={35}
                      value={selectedBuilding.floors}
                      onChange={(e) => updateSelectedBuilding({ floors: Number(e.target.value) })}
                      className="mt-1 w-full accent-blue-500"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">ЖИТЕЛЕЙ НА ЭТАЖ:</span>
                      <span className="font-bold text-gray-100">{selectedBuilding.residentsPerFloor} ЧЕЛ.</span>
                    </div>
                    <input
                      type="range"
                      min={4}
                      max={60}
                      value={selectedBuilding.residentsPerFloor}
                      onChange={(e) => updateSelectedBuilding({ residentsPerFloor: Number(e.target.value) })}
                      className="mt-1 w-full accent-blue-500"
                    />
                  </div>
                  <div className="rounded border border-blue-900 bg-blue-950/40 p-2.5 text-xs text-blue-300">
                    <div>НАСЕЛЕНИЕ КОРПУСА: <b>{selectedBuilding.residents}</b> чел.</div>
                    {activePath && (
                      <div className="mt-1">
                        КРАТЧАЙШИЙ ПУТЬ К ТРАНСПОРТУ: <b>{activePath.distanceM} м</b> (~{activePath.timeMinutes} мин)
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-gray-800 bg-[#141822] p-4 text-center font-mono text-xs text-gray-500">
                ВЫБЕРИТЕ ОБЪЕКТ НА ЧЕРТЕЖЕ ДЛЯ РЕДАКТИРОВАНИЯ
              </div>
            )}

            {/* Аудит последствий решений «Было → Стало» */}
            <div className="rounded-xl border border-gray-700 bg-[#161c26] p-4 font-mono">
              <div className="flex items-center justify-between border-b border-gray-700 pb-2">
                <h3 className="text-xs font-bold uppercase text-gray-100">
                  АУДИТ РЕШЕНИЙ (ДЕЙКСТРА)
                </h3>
                <span className="text-[10px] text-gray-400">БЫЛО → СТАЛО</span>
              </div>

              <div className="mt-3 space-y-2.5 text-xs">
                {/* Метрика 1 */}
                <div className="rounded border border-gray-700 bg-gray-900/80 p-2.5">
                  <div className="flex items-center justify-between text-gray-400">
                    <span>СРЕДНИЙ ПУТЬ ДО ОСТАНОВКИ</span>
                    <span className={busDelta <= 0 ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                      {busDelta <= 0 ? `▼ ${Math.abs(busDelta)} м` : `▲ +${busDelta} м`}
                    </span>
                  </div>
                  <div className="mt-1 flex items-baseline gap-2">
                    <span className="text-xl font-bold text-gray-100">{metrics.weightedAvgBusDistM} м</span>
                    <span className="text-xs text-gray-500 line-through">{baseMetrics.weightedAvgBusDistM} м</span>
                  </div>
                </div>

                {/* Метрика 2 */}
                <div className="rounded border border-gray-700 bg-gray-900/80 p-2.5">
                  <div className="flex items-center justify-between text-gray-400">
                    <span>ДОСТУПНОСТЬ ПАРКОВ (≤350М)</span>
                    <span className={parkDelta >= 0 ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                      {parkDelta >= 0 ? `▲ +${parkDelta}%` : `▼ ${parkDelta}%`}
                    </span>
                  </div>
                  <div className="mt-1 flex items-baseline gap-2">
                    <span className="text-xl font-bold text-gray-100">{metrics.parkAccessPercent}%</span>
                    <span className="text-xs text-gray-500 line-through">{baseMetrics.parkAccessPercent}%</span>
                  </div>
                </div>

                {/* Метрика 3 (МГН) */}
                <div className="rounded border border-gray-700 bg-gray-900/80 p-2.5">
                  <div className="flex items-center justify-between text-gray-400">
                    <span>ДОСТУПНОСТЬ ДЛЯ МГН (КОЛЯСКИ)</span>
                    <span className="font-bold text-blue-400">{metrics.mobilityIndex}%</span>
                  </div>
                  <div className="mt-1 text-[11px] text-gray-500">
                    Безбарьерные маршруты к узловым точкам
                  </div>
                </div>

                {/* Бюджет */}
                <div className="rounded border border-gray-700 bg-gray-900/80 p-2.5">
                  <div className="flex items-center justify-between text-gray-400">
                    <span>ЗАТРАТЫ БЛАГОУСТРОЙСТВА:</span>
                    <span className="font-bold text-gray-100">{metrics.budgetSpentRub.toLocaleString('ru-RU')} ₽</span>
                  </div>
                  <p className="mt-1 text-[10px] text-gray-500">
                    Лимит инвестиций: {metrics.budgetLimitRub.toLocaleString('ru-RU')} ₽
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Модалка проектов */}
      {showProjectsModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 font-mono"
          onClick={() => setShowProjectsModal(false)}
        >
          <div
            className="w-full max-w-md rounded-lg border border-gray-700 bg-gray-900 p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-sm font-bold uppercase text-gray-100">СОХРАНЁННЫЕ ПРОЕКТЫ В POSTGRES</h2>
            <div className="mt-4 max-h-60 space-y-2 overflow-y-auto">
              {projectsList.length === 0 ? (
                <p className="text-xs text-gray-500">Проектов нет. Нажмите «Сохранить».</p>
              ) : (
                projectsList.map((p) => (
                  <div key={p.id} className="flex items-center justify-between rounded border border-gray-800 p-2.5 hover:bg-gray-800/50">
                    <div>
                      <h4 className="text-xs font-bold text-gray-200">{p.name}</h4>
                      <p className="text-[10px] text-gray-500">{new Date(p.updatedAt).toLocaleDateString('ru-RU')}</p>
                    </div>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => handleLoadProject(p.id)} className={cadBtnActive}>
                        ОТКРЫТЬ
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          if (token) {
                            await deleteProject(token, p.id);
                            await refreshProjectsList();
                          }
                        }}
                        className="text-xs text-rose-400 hover:underline"
                      >
                        УДАЛИТЬ
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="mt-4 flex justify-end">
              <button type="button" onClick={() => setShowProjectsModal(false)} className={cadBtn}>
                ЗАКРЫТЬ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
