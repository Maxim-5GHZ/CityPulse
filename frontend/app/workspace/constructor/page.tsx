// Кейс 03 — конструктор, живёт на /workspace (/workspace/constructor — тот же экран).
// шапка (AppHeader) сверху, слева большая 2D-карта, справа сайдбар «Настройки + Состояние».
// Графы сети/маршрутов вырезаны из UI: только здания, ветер, тени. M1/M2 считаются внутри.
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import AppHeader from '@/components/AppHeader';
import { useAuth } from '@/lib/auth';
import type { Building, DistrictModel } from '@/lib/city/model';
import { seedModel } from '@/lib/city/seed';
import { withOsmBuildings } from '@/lib/city/osm';
import { calcMetrics, diffMetrics } from '@/lib/city/metrics';
import { PRESETS, collideIndex, rectFootprint, type PresetSpec } from '@/lib/city/buildings';
import { shadePct, shadowOffset, shadowPolygon, sunAt } from '@/lib/city/shadow';
import { windField } from '@/lib/city/wind';
import { GW_LABELS, groundwaterField, loadWater, type WaterFeature } from '@/lib/city/water';
import { POL_LABELS, loadRoads, pollutionField, type RoadLine } from '@/lib/city/pollution';

const CityMap = dynamic(() => import('@/components/city/CityMap'), { ssr: false });
const City3D = dynamic(() => import('@/components/city/City3D'), { ssr: false });
const ProjectsPanel = dynamic(() => import('@/components/city/ProjectsPanel'), { ssr: false });

// Стекло как на /login и /workspace (см. AGENTS.md, cardCls).
const cardCls =
  'w-full rounded-[32px] border border-white/60 bg-white/40 px-5 py-5 backdrop-blur-xl ' +
  'backdrop-saturate-150 ' +
  'shadow-[inset_1px_1px_2px_rgba(255,255,255,0.8),inset_-1px_-1px_2px_rgba(0,0,0,0.05),0_24px_60px_-16px_rgba(20,26,38,0.35)] ' +
  'dark:border-white/20 dark:bg-gray-900/40';

const pillBtn =
  'transform-gpu rounded-full border border-white/60 bg-white/40 px-4 py-1.5 text-sm font-medium text-gray-700 backdrop-blur-xl ' +
  'transition-all duration-200 ease-out hover:scale-[1.05] hover:bg-white/60 active:scale-[0.98] ' +
  'motion-reduce:transform-none motion-reduce:transition-none ' +
  'dark:border-white/20 dark:bg-white/10 dark:text-gray-200 dark:hover:bg-white/20 ' +
  'disabled:opacity-40 disabled:pointer-events-none';

const pillActive =
  'transform-gpu rounded-full bg-gray-800 px-4 py-1.5 text-sm font-medium text-white ' +
  'transition-all duration-200 ease-out hover:scale-[1.05] active:scale-[0.98] ' +
  'motion-reduce:transform-none motion-reduce:transition-none dark:bg-white dark:text-gray-900';

const sectionTitle = 'text-xs uppercase text-gray-500 dark:text-gray-400';

/** Точки легенд эко-слоёв — консистентны с заливками GW_FILL / POL_FILL. */
const GW_DOTS = ['bg-blue-200', 'bg-blue-400', 'bg-blue-700'];
const POL_DOTS = ['bg-emerald-400', 'bg-amber-400', 'bg-rose-500'];
const condBadge =
  'rounded-full border border-amber-300/70 bg-amber-50/80 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-700 ' +
  'dark:border-amber-700/50 dark:bg-amber-950/50 dark:text-amber-300';

const mapCls =
  'h-[52vh] min-h-[380px] w-full overflow-hidden rounded-[24px] border border-white/60 lg:h-[calc(100vh-200px)] lg:min-h-[520px] ' +
  'dark:border-white/20 [&>canvas]:block [&>canvas]:h-full [&>canvas]:w-full';

function centroid(poly: [number, number][]): [number, number] {
  let x = 0;
  let y = 0;
  for (const [px, py] of poly) {
    x += px;
    y += py;
  }
  return [x / poly.length, y / poly.length];
}

/** Коробка рвёт ребра в радиусе ~60 м: Dijkstra пересчитается, M1 вырастет. */
function ruptureEdges(model: DistrictModel, footprint: [number, number][]): { model: DistrictModel; newlyClosed: number } {
  const [cx, cy] = centroid(footprint);
  let newlyClosed = 0;
  const edges = model.edges.map((e) => {
    const A = model.nodes.find((n) => n.id === e.a);
    const B = model.nodes.find((n) => n.id === e.b);
    if (!A || !B) return e;
    const mx = (A.x + B.x) / 2;
    const my = (A.y + B.y) / 2;
    const d = Math.hypot(mx - cx, my - cy);
    if (d < 60) {
      if (!e.closed) newlyClosed += 1;
      return { ...e, closed: true };
    }
    return e;
  });
  return { model: { ...model, edges }, newlyClosed };
}

export default function ConstructorPage() {
  const { ready, token } = useAuth();
  const router = useRouter();
  const [model, setModel] = useState<DistrictModel>(() => seedModel());
  const [osmCount, setOsmCount] = useState<number>(0);
  const [osmError, setOsmError] = useState<string | null>(null);
  const [hour, setHour] = useState(13);
  const [parkN, setParkN] = useState(400);
  const [preset, setPreset] = useState<PresetSpec>(PRESETS[0]);
  const [addMode, setAddMode] = useState(false);
  const [ghostCollides, setGhostCollides] = useState(false);
  const [showWind, setShowWind] = useState(true);
  const [showShadow, setShowShadow] = useState(true);
  const [showOsm, setShowOsm] = useState(true);
  const [showTurb, setShowTurb] = useState(true);
  const [showGw, setShowGw] = useState(false);
  const [showPol, setShowPol] = useState(false);
  const [water, setWater] = useState<WaterFeature[]>([]);
  const [roads, setRoads] = useState<RoadLine[]>([]);
  const [windDir, setWindDir] = useState(90);
  const [windSpeed, setWindSpeed] = useState(4);
  const [selectedAttrId, setSelectedAttrId] = useState<string | null>(null);
  const [selectedBld, setSelectedBld] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'2d' | '3d'>('2d');
  const [ruptureInfo, setRuptureInfo] = useState<string | null>(null);

  useEffect(() => {
    if (ready && !token) router.replace('/login');
  }, [ready, token, router]);

  // Esc отменяет режим добавления.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setAddMode(false);
      setSelectedAttrId(null);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  // Реальные коробки из OSM-кэша поверх сида.
  useEffect(() => {
    let alive = true;
    withOsmBuildings(seedModel())
      .then((m) => {
        if (!alive) return;
        setModel(m);
        setOsmCount(m.buildings.length);
      })
      .catch((e) => {
        if (!alive) return;
        setOsmError(e instanceof Error ? e.message : 'OSM-кэш недоступен');
      });
    return () => {
      alive = false;
    };
  }, []);

  // Эко-данные из OSM-кэшей: вода (FR-31) и дороги для источников (FR-30).
  // Загружаем сразу — включение чекбокса обязано быть мгновенным.
  useEffect(() => {
    let alive = true;
    Promise.all([loadWater(), loadRoads()]).then(([w, r]) => {
      if (!alive) return;
      setWater(w);
      setRoads(r);
    });
    return () => {
      alive = false;
    };
  }, []);

  const baseline = useMemo(() => calcMetrics(seedModel(), parkN), [parkN]);
  const current = useMemo(() => calcMetrics(model, parkN), [model, parkN]);
  const diff = useMemo(() => diffMetrics(baseline, current), [baseline, current]);

  const sun = useMemo(() => {
    const d = new Date();
    d.setHours(hour, 0, 0, 0);
    return sunAt(d);
  }, [hour]);

  /** Ветер-эвристика: поле 8×8, конус затишья L=2H, зелень −30% (не OpenFOAM). */
  const wind = useMemo(() => windField(model, windDir, windSpeed), [model, windDir, windSpeed]);

  /** Грунтовые воды (FR-31): синтетика по реальной воде OSM, бейдж «условно». */
  const gw = useMemo(() => (showGw ? groundwaterField(water, model.seed) : null), [showGw, water, model.seed]);

  /** Загрязнение (FR-30): мок-источники + снос по полю ветра, пересчёт на ползунки. */
  const pollution = useMemo(
    () => (showPol ? pollutionField(model, roads, wind.cells) : null),
    [showPol, model, roads, wind],
  );

  const shadowPolys = useMemo<[number, number][][]>(() => {
    const out: [number, number][][] = [];
    for (const b of model.buildings) {
      const off = shadowOffset(b.h, sun);
      if (off) out.push(shadowPolygon(b.footprint, off));
    }
    return out;
  }, [model, sun]);

  const shadeRows = useMemo(() => {
    const sel = model.buildings.find((b) => b.id === selectedBld);
    if (!sel) return [];
    return model.buildings
      .filter((b) => b.id !== sel.id)
      .map((b) => ({ label: b.label, pct: shadePct(sel, b, sun) }))
      .filter((r) => r.pct > 0)
      .sort((a, b) => b.pct - a.pct)
      .slice(0, 5);
  }, [model, selectedBld, sun]);

  const moveAttr = useCallback((attrId: string, nodeId: string) => {
    setModel((m) => ({
      ...m,
      attractions: m.attractions.map((a) => (a.id === attrId ? { ...a, nodeId } : a)),
    }));
    setSelectedAttrId(null);
  }, []);

  const addBuilding = useCallback(
    (x: number, y: number) => {
      const footprint = rectFootprint(x, y, preset.w, preset.d);
      // Коллизия: нельзя ставить поверх существующих коробок (зазор 2 м).
      const hit = collideIndex(footprint, [...model.buildings.map((b) => b.footprint)]);
      if (hit >= 0) {
        setRuptureInfo('Сюда нельзя: коробка пересекается с существующим зданием. Выбери свободное место.');
        return;
      }
      const b: Building = {
        id: `custom-${Date.now()}`,
        label: `${preset.label} (своя)`,
        footprint,
        h: preset.h,
        floors: Math.max(1, Math.round(preset.h / 3)),
        roof: preset.roof,
        preset: preset.preset,
      };
      setModel((m) => ruptureEdges({ ...m, buildings: [...m.buildings, b] }, b.footprint).model);
      setSelectedBld(b.id);
      // Остаёмся в addMode для постановки нескольких коробок — выход по Esc/Отмена.
      setRuptureInfo(`Поставили «${preset.label}» — рёбра в радиусе 60 м закрыты, M1 пересчитан. Esc — выйти.`);
    },
    [preset, model],
  );

  const deleteSelectedBld = useCallback(() => {
    if (!selectedBld) return;
    setModel((m) => {
      const target = m.buildings.find((b) => b.id === selectedBld);
      if (!target || target.preset !== 'custom') return m;
      return {
        ...m,
        buildings: m.buildings.filter((b) => b.id !== selectedBld),
        // M1/M2 и ветер пересчитаются сразу.
      };
    });
    setSelectedBld(null);
  }, [selectedBld]);

  const reset = useCallback(() => {
    withOsmBuildings(seedModel()).then(setModel).catch(() => setModel(seedModel()));
    setSelectedAttrId(null);
    setSelectedBld(null);
    setRuptureInfo(null);
    setGhostCollides(false);
    setAddMode(false);
  }, []);

  /** Открыть проект с сервера: граф целиком заменяет текущий, режимы сбрасываем. */
  const openProject = useCallback((m: DistrictModel) => {
    setModel(m);
    setSelectedAttrId(null);
    setSelectedBld(null);
    setRuptureInfo(null);
    setGhostCollides(false);
    setAddMode(false);
  }, []);

  if (!ready) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center px-6 py-6">
        <p className="text-center text-sm text-gray-500 dark:text-gray-400">Загрузка…</p>
      </main>
    );
  }
  if (!token) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center px-6 py-6">
        <p className="text-center text-sm text-gray-500 dark:text-gray-400">Перенаправляем на страницу входа…</p>
      </main>
    );
  }

  const selAttr = model.attractions.find((a) => a.id === selectedAttrId) ?? null;
  const selBld = model.buildings.find((b) => b.id === selectedBld) ?? null;

  return (
    <div
      className="relative min-h-screen bg-cover bg-center"
      style={{ backgroundImage: "url('/city.png')" }}
    >
      <div className="absolute inset-0 bg-gradient-to-b from-white/30 via-white/10 to-white/40 dark:from-black/60 dark:via-black/40 dark:to-black/70" />
      <AppHeader />
      <main className="relative z-10 flex w-full flex-col gap-4 px-4 py-6 sm:px-6 lg:flex-row lg:items-start">
        {/* Карта — занимает всё свободное место */}
        <section className={`${cardCls} min-w-0 flex-1`} aria-label="Карта района">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-xl font-black tracking-tight text-gray-900 dark:text-gray-100">
              Конструктор «Обнинск 2040»
            </h1>
            {/* Переключатель 2D / 3D — стеклянный сегментированный контрол */}
            <div className="flex flex-wrap items-center gap-2">
              <div
                role="tablist"
                aria-label="Режим просмотра"
                className="transform-gpu flex rounded-full border border-white/60 bg-white/40 p-1 backdrop-blur-xl dark:border-white/20 dark:bg-gray-800/60"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={viewMode === '2d'}
                  onClick={() => setViewMode('2d')}
                  className={`rounded-full px-4 py-1.5 text-xs font-bold transition-all duration-200 ease-out ${
                    viewMode === '2d'
                      ? 'bg-blue-600 text-white shadow'
                      : 'text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white'
                  }`}
                >
                  2D Потоки
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={viewMode === '3d'}
                  onClick={() => setViewMode('3d')}
                  className={`rounded-full px-4 py-1.5 text-xs font-bold transition-all duration-200 ease-out ${
                    viewMode === '3d'
                      ? 'bg-blue-600 text-white shadow'
                      : 'text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white'
                  }`}
                >
                  3D Инсоляция
                </button>
              </div>
            </div>
          </div>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
            Реальные коробки центра из OpenStreetMap ({osmCount || '…'}). Данные условные, не прогноз (п.11).
            {osmError && <span className="text-red-700 dark:text-red-300"> {osmError} — работаем на сиде.</span>}
          </p>
          {selAttr && (
            <p className="mt-2 text-sm font-medium text-blue-700 dark:text-blue-300" aria-live="polite">
              Переносим «{selAttr.label}»: потяни маркер — привяжем к ближайшему узлу.
            </p>
          )}
          {addMode && (
            <p className="mt-2 text-sm font-medium text-blue-700 dark:text-blue-300" aria-live="polite">
              {ghostCollides
                ? 'Сюда нельзя: пересечение со зданием — выбери свободное место.'
                : `Кликни по карте — поставим «${preset.label}» (${preset.w}×${preset.d} м, h=${preset.h} м). Можно несколько подряд. Esc — выйти.`}
            </p>
          )}
          {ruptureInfo && !addMode && (
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-300" aria-live="polite">
              {ruptureInfo}
            </p>
          )}
          <div className="mt-3">
            {viewMode === '2d' ? (
              <CityMap
                model={model}
                selectedAttrId={selectedAttrId}
                addMode={addMode}
                shadowPolys={showShadow ? shadowPolys : []}
                windCells={showWind ? wind.cells : null}
                showShadow={showShadow}
                showOsm={showOsm}
                showTurb={showTurb && showWind}
                gwCells={gw ? gw.cells : null}
                water={water}
                pollutionCells={pollution ? pollution.cells : null}
                ghostW={addMode ? preset.w : 0}
                ghostD={addMode ? preset.d : 0}
                ghostCollides={ghostCollides}
                onGhostCollide={setGhostCollides}
                onSelectBld={setSelectedBld}
                onSelectAttr={setSelectedAttrId}
                onMoveAttrToNode={moveAttr}
                onAddAt={addBuilding}
                className={mapCls}
              />
            ) : (
              <City3D
                model={model}
                sun={sun}
                selectedId={selectedBld}
                onSelect={setSelectedBld}
                showWind={showWind}
                showShadow={showShadow}
                showOsm={showOsm}
                windDir={windDir}
                windSpeed={windSpeed}
                hour={hour}
                ghostW={preset.w}
                ghostD={preset.d}
                onSelectAttr={setSelectedAttrId}
                addMode={addMode}
                onAddAt={addBuilding}
                className={mapCls}
              />
            )}
          </div>
          {showWind && (
            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-gray-600 dark:text-gray-300" aria-label="Легенда ветра">
              <span className="font-medium">Ветер:</span>
              <span className="flex items-center gap-1"><span aria-hidden="true" className="inline-block h-2.5 w-2.5 rounded-full bg-sky-400" /> штиль</span>
              <span className="flex items-center gap-1"><span aria-hidden="true" className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-400" /> слабый</span>
              <span className="flex items-center gap-1"><span aria-hidden="true" className="inline-block h-2.5 w-2.5 rounded-full bg-amber-400" /> умеренный</span>
              <span className="flex items-center gap-1"><span aria-hidden="true" className="inline-block h-2.5 w-2.5 rounded-full bg-rose-500" /> сильный</span>
              {showTurb && (
                <span className="flex items-center gap-1"><span aria-hidden="true" className="inline-block h-2.5 w-4 rounded-sm bg-rose-500/40" /> зона вихрей</span>
              )}
              <span className="text-gray-500 dark:text-gray-400">труба: внутрь коробок нельзя — эвристика</span>
            </div>
          )}
          {showGw && gw && (
            <div
              className="mt-2 flex flex-wrap items-center gap-3 text-xs text-gray-600 dark:text-gray-300"
              aria-label="Легенда грунтовых вод"
            >
              <span className="font-medium">Грунтовые воды (FR-31):</span>
              {GW_LABELS.map((label, i) => (
                <span key={label} className="flex items-center gap-1">
                  <span aria-hidden="true" className={`inline-block h-2.5 w-2.5 rounded-full ${GW_DOTS[i]}`} /> {label}
                </span>
              ))}
              <span className="text-gray-500 dark:text-gray-400">
                доля площади: {gw.share[0]}% / {gw.share[1]}% / {gw.share[2]}%
              </span>
              <span className={condBadge}>условно, не изыскания</span>
            </div>
          )}
          {showPol && pollution && (
            <div
              className="mt-2 flex flex-wrap items-center gap-3 text-xs text-gray-600 dark:text-gray-300"
              aria-label="Легенда загрязнения воздуха"
            >
              <span className="font-medium">Загрязнение (FR-30):</span>
              {POL_LABELS.map((label, i) => (
                <span key={label} className="flex items-center gap-1">
                  <span aria-hidden="true" className={`inline-block h-2.5 w-2.5 rounded-full ${POL_DOTS[i]}`} /> {label}
                </span>
              ))}
              <span className="text-gray-500 dark:text-gray-400">
                источники: {pollution.sources.map((s) => s.label).join(' · ')} · шлейф сносит по ветру
              </span>
              <span className={condBadge}>мок, не прогноз (п.11)</span>
            </div>
          )}
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            Клик по зданию — выбрать (свою можно удалить) · маркер О/П/Ш можно тянуть · © OpenStreetMap
          </p>
        </section>

        {/* Сайдбар — справа: настройки + состояние */}
        <aside className="mt-4 flex w-full flex-col gap-4 lg:mt-0 lg:w-[340px] lg:shrink-0" aria-label="Настройки и состояние">
          <section className={cardCls} aria-label="Настройки">
            <h2 className={sectionTitle}>Настройки</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" onClick={() => setAddMode((v) => !v)} className={addMode ? pillActive : pillBtn} aria-pressed={addMode}>
                {addMode ? 'Отмена' : '+ Коробка'}
              </button>
              <button type="button" onClick={reset} className={pillBtn}>
                Сбросить
              </button>
            </div>
            <fieldset className="mt-3">
              <legend className={sectionTitle}>Слои</legend>
              <div className="mt-2 flex flex-col gap-2 text-sm text-gray-700 dark:text-gray-200">
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={showWind}
                    onChange={(e) => setShowWind(e.target.checked)}
                    className="h-4 w-4 accent-blue-600"
                  />
                  Ветер — цветные частицы (эвристика, не OpenFOAM)
                </label>
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={showTurb}
                    onChange={(e) => setShowTurb(e.target.checked)}
                    className="h-4 w-4 accent-blue-600"
                  />
                  Зоны турбулентности (где вихрей много)
                </label>
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={showShadow}
                    onChange={(e) => setShowShadow(e.target.checked)}
                    className="h-4 w-4 accent-blue-600"
                  />
                  Тени зданий
                </label>
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={showGw}
                    onChange={(e) => setShowGw(e.target.checked)}
                    className="h-4 w-4 accent-blue-600"
                  />
                  Грунтовые воды — условно, не изыскания
                </label>
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={showPol}
                    onChange={(e) => setShowPol(e.target.checked)}
                    className="h-4 w-4 accent-blue-600"
                  />
                  Загрязнение воздуха (мок + снос ветром)
                </label>
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={showOsm}
                    onChange={(e) => setShowOsm(e.target.checked)}
                    className="h-4 w-4 accent-blue-600"
                  />
                  Дома OSM (выкл — чистое поле)
                </label>
              </div>
            </fieldset>
            <label className="mt-3 block text-sm text-gray-600 dark:text-gray-300">
              Ветер: {windDir}° · {windSpeed} м/с
              <span className="mt-1 flex gap-2">
                <input
                  type="range"
                  min={0}
                  max={360}
                  step={15}
                  value={windDir}
                  onChange={(e) => setWindDir(Number(e.target.value))}
                  className="w-full"
                  aria-label="Направление ветра в градусах"
                />
                <input
                  type="range"
                  min={0}
                  max={12}
                  step={0.5}
                  value={windSpeed}
                  onChange={(e) => setWindSpeed(Number(e.target.value))}
                  className="w-full"
                  aria-label="Скорость ветра в метрах в секунду"
                />
              </span>
            </label>
            <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Пресет здания">
              {PRESETS.map((p) => (
                <button
                  key={p.preset}
                  type="button"
                  onClick={() => {
                    setPreset(p);
                    setAddMode(true);
                  }}
                  className={preset.preset === p.preset ? pillActive : pillBtn}
                  aria-pressed={preset.preset === p.preset}
                  title={`${p.w}×${p.d} м, h=${p.h}`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <label className="mt-4 block text-sm text-gray-600 dark:text-gray-300">
              Время: {hour}:00 (тень)
              <input
                type="range"
                min={8}
                max={20}
                step={1}
                value={hour}
                onChange={(e) => setHour(Number(e.target.value))}
                className="w-full"
                aria-label="Время суток для тени"
              />
            </label>
            <label className="mt-2 block text-sm text-gray-600 dark:text-gray-300">
              Радиус парка N: {parkN} м
              <input
                type="range"
                min={200}
                max={800}
                step={50}
                value={parkN}
                onChange={(e) => setParkN(Number(e.target.value))}
                className="w-full"
                aria-label="Радиус парка N в метрах"
              />
            </label>
          </section>

          {/* Блок СОСТОЯНИЕ — представительский KPI-дашборд */}
          <section className={cardCls} aria-label="Состояние" aria-live="polite">
            <div className="flex items-center justify-between">
              <h2 className={sectionTitle}>Состояние района</h2>
              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
                Live Аналитика
              </span>
            </div>

            <div className="mt-3 space-y-3">
              {/* M1: Пешеходный путь */}
              <div className="rounded-2xl border border-white/60 bg-white/70 p-3.5 shadow-sm backdrop-blur-md dark:border-white/10 dark:bg-gray-800/60">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">M1 · До остановки</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                      current.m1 <= 400
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                        : 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                    }`}
                  >
                    {current.m1 <= 400 ? 'Норма ≤400м' : 'Превышение'}
                  </span>
                </div>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-2xl font-black tracking-tight text-gray-900 dark:text-gray-100">
                    {current.m1} <span className="text-sm font-medium text-gray-500">м</span>
                  </span>
                  <span
                    className={`text-xs font-bold ${
                      diff.dM1 > 0 ? 'text-rose-600' : diff.dM1 < 0 ? 'text-emerald-600' : 'text-gray-400'
                    }`}
                  >
                    {diff.dM1 > 0 ? `+${diff.dM1} м` : diff.dM1 < 0 ? `${diff.dM1} м` : 'без изменений'}
                  </span>
                </div>
              </div>

              {/* Ветер: комфорт двора */}
              <div className="rounded-2xl border border-white/60 bg-white/70 p-3.5 shadow-sm backdrop-blur-md dark:border-white/10 dark:bg-gray-800/60">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">Ветер · Комфорт двора</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                      wind.comfort >= 0.5
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                        : wind.comfort >= 0.35
                        ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                        : 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                    }`}
                  >
                    {wind.comfort >= 0.5 ? 'Оптимально' : wind.comfort >= 0.35 ? 'Умеренно' : 'Застой воздуха'}
                  </span>
                </div>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-2xl font-black tracking-tight text-gray-900 dark:text-gray-100">
                    {wind.comfort.toFixed(2)}
                  </span>
                  <span className="text-xs text-gray-400">индекс 0..1 (эвристика)</span>
                </div>
                {/* Индикаторная шкала */}
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                  <div
                    className={`h-full transition-all duration-300 ${
                      wind.comfort >= 0.5 ? 'bg-emerald-500' : wind.comfort >= 0.35 ? 'bg-amber-500' : 'bg-rose-500'
                    }`}
                    style={{ width: `${Math.round(wind.comfort * 100)}%` }}
                  />
                </div>
              </div>

              {/* M2: Доступность парка */}
              <div className="rounded-2xl border border-white/60 bg-white/70 p-3.5 shadow-sm backdrop-blur-md dark:border-white/10 dark:bg-gray-800/60">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                    M2 · Парк в {parkN} м
                  </span>
                  <span
                    className={`text-xs font-bold ${
                      diff.dM2 > 0 ? 'text-emerald-600' : diff.dM2 < 0 ? 'text-rose-600' : 'text-gray-400'
                    }`}
                  >
                    {diff.dM2 > 0 ? `+${Math.round(diff.dM2 * 100)} п.п.` : diff.dM2 < 0 ? `${Math.round(diff.dM2 * 100)} п.п.` : '0 п.п.'}
                  </span>
                </div>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-2xl font-black tracking-tight text-gray-900 dark:text-gray-100">
                    {Math.round(current.m2 * 100)}%
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">жителей охвачено</span>
                </div>
                {/* Прогресс-бар парка */}
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                  <div
                    className="h-full bg-blue-600 transition-all duration-300"
                    style={{ width: `${Math.round(current.m2 * 100)}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Выбранное здание */}
            {selBld ? (
              <div className="mt-3 rounded-2xl border border-blue-200/80 bg-blue-50/70 p-3.5 backdrop-blur-md dark:border-blue-800/40 dark:bg-blue-950/40">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold text-gray-900 dark:text-gray-100">{selBld.label}</p>
                  <span className="rounded-full bg-blue-600 px-2 py-0.5 text-[11px] font-bold text-white">
                    h = {selBld.h} м
                  </span>
                </div>
                {selBld.preset === 'custom' && (
                  <button
                    type="button"
                    onClick={deleteSelectedBld}
                    className="mt-2 w-full rounded-full border border-red-200 bg-red-50 py-1 text-xs font-bold text-red-600 transition-all hover:bg-red-100 active:scale-95 dark:border-red-800/50 dark:bg-red-950/50 dark:text-red-300"
                  >
                    Удалить свою коробку
                  </button>
                )}
                {shadeRows.length === 0 ? (
                  <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">В этот час тень ни на кого не падает.</p>
                ) : (
                  <div className="mt-2 space-y-1">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      Затенение соседей:
                    </p>
                    <ul className="text-xs text-gray-700 dark:text-gray-300">
                      {shadeRows.map((r) => (
                        <li key={r.label} className="flex justify-between py-0.5">
                          <span>{r.label}</span>
                          <span className="font-bold text-rose-600 dark:text-rose-400">−{r.pct}%</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <p className="mt-3 text-center text-xs text-gray-400">Кликни по зданию — покажем затенение соседей</p>
            )}

            <details className="mt-3 text-xs text-gray-500 dark:text-gray-400">
              <summary className="cursor-pointer font-medium hover:text-gray-700 dark:hover:text-gray-200">
                Как производятся расчёты
              </summary>
              <ul className="mt-1.5 list-disc space-y-1 pl-4">
                <li>Обход зданий: коробка закрывает рёбра в радиусе 60 м, пересчитывая Dijkstra.</li>
                <li>Инсоляция: SunCalc для Обнинска (55.096, 36.610), L=H/tan(alt).</li>
                <li>Ветер: шелковистые линии тока, обтекание стен, доплеровские вихри следа.</li>
              </ul>
            </details>
          </section>

          <section className={cardCls} aria-label="Проекты">
            <h2 className={sectionTitle}>Проекты</h2>
            <div className="mt-3">
              <ProjectsPanel token={token} currentModel={model} onOpen={openProject} />
            </div>
          </section>
        </aside>
      </main>
    </div>
  );
}
