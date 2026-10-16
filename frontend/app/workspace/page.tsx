'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import AppHeader from '@/components/AppHeader';
import DistrictMap from '@/components/city/DistrictMap';
import DistrictMap3D from '@/components/city/DistrictMap3D';
import { OBNINSK_MARX_DISTRICT } from '@/lib/city-engine/presets';
import { calculateMetrics } from '@/lib/city-engine/metrics';
import { DistrictScenario, GraphEdge, Building, Amenity } from '@/lib/city-engine/types';

const cardCls =
  'rounded-[28px] border border-white/60 bg-white/40 p-5 shadow-[inset_1px_1px_2px_rgba(255,255,255,0.8),inset_-1px_-1px_2px_rgba(0,0,0,0.05),0_20px_50px_-16px_rgba(20,26,38,0.25)] ' +
  'backdrop-blur-xl backdrop-saturate-150 dark:border-white/20 dark:bg-gray-900/40';

const glassBtn =
  'transform-gpu rounded-full border border-white/60 bg-white/60 px-4 py-2 text-xs font-semibold text-gray-700 shadow-sm backdrop-blur-xl ' +
  'transition-all duration-200 ease-out hover:scale-[1.05] hover:bg-white active:scale-[0.98] motion-reduce:transform-none motion-reduce:transition-none ' +
  'dark:border-white/20 dark:bg-white/10 dark:text-gray-200 dark:hover:bg-white/20';

const glassBtnActive =
  'transform-gpu rounded-full bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-md backdrop-blur-xl ' +
  'transition-all duration-200 ease-out hover:scale-[1.05] hover:bg-blue-700 active:scale-[0.98] motion-reduce:transform-none motion-reduce:transition-none';

export default function WorkspacePage() {
  const { ready, token } = useAuth();
  const router = useRouter();
  const [baseScenario] = useState<DistrictScenario>(OBNINSK_MARX_DISTRICT);
  const [currentScenario, setCurrentScenario] = useState<DistrictScenario>(OBNINSK_MARX_DISTRICT);
  const [selectedBuildingId, setSelectedBuildingId] = useState<string>('b3');
  const [viewMode, setViewMode] = useState<'2d' | '3d'>('3d');

  useEffect(() => {
    if (ready && !token) router.replace('/login');
  }, [ready, token, router]);

  const baseMetrics = useMemo(() => calculateMetrics(baseScenario, baseScenario), [baseScenario]);
  const currentMetrics = useMemo(() => calculateMetrics(currentScenario, baseScenario), [currentScenario, baseScenario]);

  const hasCustomCrossing = currentScenario.edges.some(
    (e) => ((e.from === 'n8' && e.to === 'n13') || (e.from === 'n13' && e.to === 'n8')) && e.isActive,
  );
  const currentBusStop = currentScenario.amenities.find((a) => a.type === 'bus_stop');
  const busStopNodeId = currentBusStop ? currentBusStop.nodeId : 'n14';
  const hasCustomPark = currentScenario.amenities.some((a) => a.id === 'a-park-north');
  const hasNewBuilding = currentScenario.buildings.some((b) => b.id === 'b-new-tower');

  const activePath = selectedBuildingId ? currentMetrics.busPaths[selectedBuildingId] : null;
  const activePathNodeIds = activePath ? activePath.pathNodeIds : [];
  const selectedBuilding = currentScenario.buildings.find((b) => b.id === selectedBuildingId);

  const toggleCrossing = () => {
    setCurrentScenario((prev) => {
      const exists = prev.edges.some((e) => (e.from === 'n8' && e.to === 'n13') || (e.from === 'n13' && e.to === 'n8'));
      if (exists) {
        return { ...prev, edges: prev.edges.filter((e) => !((e.from === 'n8' && e.to === 'n13') || (e.from === 'n13' && e.to === 'n8'))) };
      }
      const newEdge: GraphEdge = {
        id: 'cross-marx-tsiolkovsky', from: 'n8', to: 'n13', lengthM: 110,
        type: 'crossing', isActive: true, isAccessible: true, isCustom: true,
      };
      return { ...prev, edges: [...prev.edges, newEdge] };
    });
  };

  const toggleStop = () => {
    setCurrentScenario((prev) => {
      const nextNode = busStopNodeId === 'n14' ? 'n7' : 'n14';
      return { ...prev, amenities: prev.amenities.map((a) => (a.type === 'bus_stop' ? { ...a, nodeId: nextNode } : a)) };
    });
  };

  const toggleNorthPark = () => {
    setCurrentScenario((prev) => {
      const exists = prev.amenities.some((a) => a.id === 'a-park-north');
      if (exists) return { ...prev, amenities: prev.amenities.filter((a) => a.id !== 'a-park-north') };
      const newPark: Amenity = {
        id: 'a-park-north', name: 'Новый карманный сквер (Север)', type: 'park',
        nodeId: 'n2', coverageRadiusM: 350, isCustom: true,
      };
      return { ...prev, amenities: [...prev.amenities, newPark] };
    });
  };

  const toggleNewBuilding = () => {
    setCurrentScenario((prev) => {
      const exists = prev.buildings.some((b) => b.id === 'b-new-tower');
      if (exists) {
        if (selectedBuildingId === 'b-new-tower') setSelectedBuildingId('b3');
        return {
          ...prev,
          buildings: prev.buildings.filter((b) => b.id !== 'b-new-tower'),
          edges: prev.edges.filter((e) => e.id !== 'e-new-tower-path'),
        };
      }
      const newTower: Building = {
        id: 'b-new-tower', name: 'Новый ЖК «Гагаринский»', address: 'г. Обнинск, ул. Гагарина, стр. 1',
        floors: 16, residentsPerFloor: 32, residents: 512, gateNodeId: 'n-new-site',
        x: 760, y: 40, width: 80, height: 55, isCustom: true,
      };
      const newEdge: GraphEdge = {
        id: 'e-new-tower-path', from: 'n-new-site', to: 'n5', lengthM: 80,
        type: 'sidewalk', isActive: true, isAccessible: true, isCustom: true,
      };
      setSelectedBuildingId('b-new-tower');
      return { ...prev, buildings: [...prev.buildings, newTower], edges: [...prev.edges, newEdge] };
    });
  };

  const toggleBlock = (edgeId: string) => {
    setCurrentScenario((prev) => ({
      ...prev,
      edges: prev.edges.map((e) => (e.id === edgeId ? { ...e, isActive: !e.isActive } : e)),
    }));
  };

  const changeFloors = (delta: number) => {
    if (!selectedBuildingId) return;
    setCurrentScenario((prev) => ({
      ...prev,
      buildings: prev.buildings.map((b) => {
        if (b.id !== selectedBuildingId) return b;
        const floors = Math.min(25, Math.max(1, b.floors + delta));
        return { ...b, floors, residents: floors * b.residentsPerFloor };
      }),
    }));
  };

  const applyScenario = (mode: 'base' | 'crossing' | 'dense' | 'green') => {
    if (mode === 'base') {
      setCurrentScenario(baseScenario);
      setSelectedBuildingId('b3');
    } else if (mode === 'crossing') {
      setCurrentScenario({
        ...baseScenario,
        edges: [...baseScenario.edges, {
          id: 'cross-marx-tsiolkovsky', from: 'n8', to: 'n13', lengthM: 110,
          type: 'crossing' as const, isActive: true, isAccessible: true, isCustom: true,
        }],
      });
      setSelectedBuildingId('b3');
    } else if (mode === 'dense') {
      setCurrentScenario({
        ...baseScenario,
        edges: [...baseScenario.edges,
          { id: 'cross-marx-tsiolkovsky', from: 'n8', to: 'n13', lengthM: 110, type: 'crossing', isActive: true, isAccessible: true, isCustom: true },
          { id: 'e-new-tower-path', from: 'n-new-site', to: 'n5', lengthM: 80, type: 'sidewalk', isActive: true, isAccessible: true, isCustom: true },
        ],
        buildings: [
          ...baseScenario.buildings.map((b) => (b.id === 'b3' ? { ...b, floors: 24, residents: 864 } : b)),
          { id: 'b-new-tower', name: 'Новый ЖК «Гагаринский»', address: 'г. Обнинск, ул. Гагарина, стр. 1', floors: 22, residentsPerFloor: 32, residents: 704, gateNodeId: 'n-new-site', x: 760, y: 40, width: 80, height: 55, isCustom: true },
        ],
      });
      setSelectedBuildingId('b-new-tower');
    } else if (mode === 'green') {
      setCurrentScenario({
        ...baseScenario,
        edges: [...baseScenario.edges, {
          id: 'cross-marx-tsiolkovsky', from: 'n8', to: 'n13', lengthM: 110,
          type: 'crossing', isActive: true, isAccessible: true, isCustom: true,
        }],
        amenities: [...baseScenario.amenities, {
          id: 'a-park-north', name: 'Новый карманный сквер (Север)', type: 'park',
          nodeId: 'n2', coverageRadiusM: 350, isCustom: true,
        }],
      });
      setSelectedBuildingId('b2');
    }
  };

  const deltaBusDist = currentMetrics.weightedAvgBusDistM - baseMetrics.weightedAvgBusDistM;
  const deltaParkAccess = currentMetrics.parkAccessPercent - baseMetrics.parkAccessPercent;
  const budgetRatio = Math.min(100, Math.round((currentMetrics.budgetSpentRub / currentMetrics.budgetLimitRub) * 100));

  if (!ready || !token) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center px-6 py-6">
        <p className="text-center text-sm text-gray-500 dark:text-gray-400">
          {!ready ? 'Загрузка…' : 'Перенаправляем на страницу входа…'}
        </p>
      </main>
    );
  }

  return (
    <div className="relative min-h-screen bg-cover bg-center" style={{ backgroundImage: "url('/city.png')" }}>
      <div className="absolute inset-0 bg-gradient-to-b from-white/60 via-white/40 to-white/70 dark:from-black/80 dark:via-black/70 dark:to-black/85" />
      <AppHeader />
      <main className="relative z-10 mx-auto w-full max-w-7xl px-4 py-5 sm:px-6">
        <div className={`${cardCls} mb-4 flex flex-col justify-between gap-4 md:flex-row md:items-center`}>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-gray-900 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider text-white dark:bg-gray-700">
                Кейс 03
              </span>
              <span className="text-xs font-medium text-gray-600 dark:text-gray-300">
                Обнинск 2040: Симулятор решений городской среды
              </span>
            </div>
            <h1 className="mt-1 text-xl font-bold tracking-tight text-gray-900 sm:text-2xl dark:text-gray-100">
              51-й микрорайон: пр. Маркса / ул. Гагарина / ТРК «Плаза»
            </h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Население: {currentMetrics.totalResidents.toLocaleString('ru-RU')} жителей • {currentScenario.buildings.length} жилых домов • {currentScenario.edges.length} связей сети • 2 магистрали
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">Сценарии жюри:</span>
            <button type="button" onClick={() => applyScenario('base')} className={glassBtn}>Базовый</button>
            <button type="button" onClick={() => applyScenario('crossing')} className={glassBtn}>+ Переход Маркса</button>
            <button type="button" onClick={() => applyScenario('dense')} className={glassBtn}>Уплотнение (24 эт.)</button>
            <button type="button" onClick={() => applyScenario('green')} className={glassBtn}>Зелёный каркас</button>
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-12">
          <div className="space-y-4 lg:col-span-8">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex rounded-full border border-white/60 bg-white/60 p-1 backdrop-blur-xl dark:border-white/20 dark:bg-gray-800/60">
                <button type="button" onClick={() => setViewMode('2d')} className={viewMode === '2d' ? glassBtnActive : glassBtn}>2D Генплан</button>
                <button type="button" onClick={() => setViewMode('3d')} className={viewMode === '3d' ? glassBtnActive : glassBtn}>3D Интерактив</button>
              </div>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {viewMode === '3d' ? 'Зажмите левую кнопку мыши для 3D-обзора' : 'Кликайте по дорожкам для перекрытия (ремонт)'}
              </span>
            </div>

            {viewMode === '3d' ? (
              <DistrictMap3D
                scenario={currentScenario}
                selectedBuildingId={selectedBuildingId}
                onSelectBuilding={setSelectedBuildingId}
                activePathNodeIds={activePathNodeIds}
                onToggleCrossing={toggleCrossing}
                onToggleStop={toggleStop}
                hasCustomCrossing={hasCustomCrossing}
                busStopNodeId={busStopNodeId}
                hasCustomPark={hasCustomPark}
                onToggleNewBuilding={toggleNewBuilding}
                hasNewBuilding={hasNewBuilding}
              />
            ) : (
              <DistrictMap
                scenario={currentScenario}
                selectedBuildingId={selectedBuildingId}
                onSelectBuilding={setSelectedBuildingId}
                activePathNodeIds={activePathNodeIds}
                onToggleCrossing={toggleCrossing}
                onToggleStop={toggleStop}
                onToggleBlock={toggleBlock}
                hasCustomCrossing={hasCustomCrossing}
                busStopNodeId={busStopNodeId}
                hasCustomPark={hasCustomPark}
                onToggleNewBuilding={toggleNewBuilding}
                hasNewBuilding={hasNewBuilding}
              />
            )}

            <div className={`${cardCls} space-y-3`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-200">
                  Интерактивные вмешательства в район:
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  <button type="button" onClick={toggleCrossing} className={hasCustomCrossing ? glassBtnActive : glassBtn}>
                    {hasCustomCrossing ? '✓ Переход у ЖК «Циолковский»' : '+ Переход через пр. Маркса'}
                  </button>
                  <button type="button" onClick={toggleStop} className={busStopNodeId === 'n7' ? glassBtnActive : glassBtn}>
                    {busStopNodeId === 'n7' ? '✓ Остановка у жилых домов' : 'Остановка у ТРК «Плаза»'}
                  </button>
                  <button type="button" onClick={toggleNorthPark} className={hasCustomPark ? glassBtnActive : glassBtn}>
                    {hasCustomPark ? '✓ Карманный сквер активен' : '+ Разбить сквер на Севере'}
                  </button>
                  <button type="button" onClick={toggleNewBuilding} className={hasNewBuilding ? glassBtnActive : glassBtn}>
                    {hasNewBuilding ? '✓ Корпус «Гагаринский»' : '+ Построить новый ЖК'}
                  </button>
                </div>
              </div>
              {selectedBuilding && activePath && (
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/60 pt-3 dark:border-white/10" aria-live="polite">
                  <div className="text-xs text-gray-700 dark:text-gray-200">
                    <span className="font-bold text-gray-900 dark:text-gray-100">{selectedBuilding.name}:</span>{' '}
                    {selectedBuilding.floors} эт. • {selectedBuilding.residents} чел. • путь до остановки:{' '}
                    <span className="font-semibold text-blue-600 dark:text-blue-400">{activePath.distanceM} м ({activePath.timeMinutes} мин)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">Этажность:</span>
                    <button type="button" onClick={() => changeFloors(-1)} aria-label="Убавить этаж"
                      className="flex h-7 w-7 items-center justify-center rounded-full border border-white/60 bg-white/70 text-sm font-bold text-gray-800 shadow-sm transition-all duration-200 ease-out hover:scale-[1.1] hover:bg-white active:scale-95 dark:border-white/20 dark:bg-gray-800 dark:text-white">−</button>
                    <span className="min-w-6 text-center font-mono text-sm font-bold text-gray-900 dark:text-white">{selectedBuilding.floors}</span>
                    <button type="button" onClick={() => changeFloors(1)} aria-label="Добавить этаж"
                      className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white shadow-sm transition-all duration-200 ease-out hover:scale-[1.1] hover:bg-blue-700 active:scale-95">+</button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4 lg:col-span-4">
            <div className={cardCls}>
              <h2 className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-200">
                Показатели качества среды района
              </h2>
              <div className="mt-4 space-y-3.5">
                <div className="rounded-2xl border border-white/60 bg-white/70 p-4 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-gray-800/70">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Средний путь до остановки ОТ</p>
                      <p className="mt-1 text-2xl font-black tracking-tight text-gray-900 dark:text-gray-100">{currentMetrics.weightedAvgBusDistM} м</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Пешком: ~{currentMetrics.weightedAvgBusTimeMin} мин (при 4,5 км/ч)</p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold ${
                      deltaBusDist <= 0
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                        : 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                    }`}>{deltaBusDist <= 0 ? `${deltaBusDist} м` : `+${deltaBusDist} м`}</span>
                  </div>
                  <div className="mt-2 text-[11px] text-gray-400">Исходный показатель: {baseMetrics.weightedAvgBusDistM} м</div>
                </div>
                <div className="rounded-2xl border border-white/60 bg-white/70 p-4 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-gray-800/70">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Доступ к паркам (≤ 350 м)</p>
                      <p className="mt-1 text-2xl font-black tracking-tight text-gray-900 dark:text-gray-100">{currentMetrics.parkAccessPercent}%</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Охват: {currentMetrics.parkCoveredResidents} из {currentMetrics.totalResidents} жителей</p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold ${
                      deltaParkAccess >= 0
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                        : 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                    }`}>{deltaParkAccess >= 0 ? `+${deltaParkAccess}%` : `${deltaParkAccess}%`}</span>
                  </div>
                  <div className="mt-2 text-[11px] text-gray-400">Исходный показатель: {baseMetrics.parkAccessPercent}%</div>
                </div>
                <div className="rounded-2xl border border-white/60 bg-white/70 p-4 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-gray-800/70">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Безбарьерный доступ</p>
                      <p className="mt-1 text-xl font-black tracking-tight text-gray-900 dark:text-gray-100">{currentMetrics.mobilityIndex}% домов</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Маршруты без надземных/подземных препятствий</p>
                    </div>
                    <span className="shrink-0 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-bold text-blue-800 dark:bg-blue-950/60 dark:text-blue-300">Норматив</span>
                  </div>
                </div>
                <div className="rounded-2xl border border-white/60 bg-white/70 p-4 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-gray-800/70">
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Затраты на благоустройство</p>
                  <p className="mt-1 text-xl font-black tracking-tight text-gray-900 dark:text-gray-100">
                    {currentMetrics.budgetSpentRub.toLocaleString('ru-RU')} ₽
                  </p>
                  <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                    <div className={`h-full transition-all duration-300 ${currentMetrics.budgetSpentRub > currentMetrics.budgetLimitRub ? 'bg-rose-500' : 'bg-blue-600'}`}
                      style={{ width: `${budgetRatio}%` }} />
                  </div>
                  <p className="mt-2 text-[11px] text-gray-400">
                    Лимит программы: {currentMetrics.budgetLimitRub.toLocaleString('ru-RU')} ₽ ({budgetRatio}%)
                    {currentMetrics.budgetSpentRub > currentMetrics.budgetLimitRub ? ' — превышение лимита!' : ''}
                  </p>
                </div>
              </div>
            </div>
            <div className={cardCls}>
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-200">
                Обоснование методики (для жюри)
              </h3>
              <div className="mt-2.5 space-y-2 text-xs leading-relaxed text-gray-600 dark:text-gray-300">
                <p>• <b>Честный расчёт графа:</b> алгоритм Дейкстры рассчитывает реальный путь от дверей каждого подъезда до объектов.</p>
                <p>• <b>Взвешивание по жителям:</b> средняя дистанция учитывает точное количество жильцов на каждом этаже.</p>
                <p>• <b>Градостроительные нормы:</b> радиус доступности парков 350 м строго по СП 42.13330.2016 «Градостроительство».</p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
