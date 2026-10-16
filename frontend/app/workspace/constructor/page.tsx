// Кейс 03 — конструктор, живёт на /workspace (/workspace/constructor — тот же экран).
// шапка (AppHeader) сверху, слева большая карта, справа сайдбар «Настройки + Состояние».
// P0: синтетический граф поверх реальных коробок OSM. 2D OpenLayers + 3D Three.js.
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
import { buildAdj, canonicalGraph, dijkstraWithPrev, sha1Hex, shortestPath } from '@/lib/city/graph';
import { PRESETS, rectFootprint, type PresetSpec } from '@/lib/city/buildings';
import { shadePct, shadowOffset, shadowPolygon, sunAt } from '@/lib/city/shadow';
import { buildConclusion } from '@/lib/city/conclusion';

const CityMap = dynamic(() => import('@/components/city/CityMap'), { ssr: false });
const City3D = dynamic(() => import('@/components/city/City3D'), { ssr: false });
const ConclusionBox = dynamic(() => import('@/components/city/ConclusionBox'), { ssr: false });
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

const mapCls =
  'h-[52vh] min-h-[380px] w-full overflow-hidden rounded-[24px] border border-white/60 lg:h-[calc(100vh-220px)] lg:min-h-[480px] ' +
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
function ruptureEdges(model: DistrictModel, footprint: [number, number][]): DistrictModel {
  const [cx, cy] = centroid(footprint);
  const edges = model.edges.map((e) => {
    const A = model.nodes.find((n) => n.id === e.a);
    const B = model.nodes.find((n) => n.id === e.b);
    if (!A || !B) return e;
    const mx = (A.x + B.x) / 2;
    const my = (A.y + B.y) / 2;
    const d = Math.hypot(mx - cx, my - cy);
    if (d < 60) return { ...e, closed: true };
    return e;
  });
  return { ...model, edges };
}

export default function ConstructorPage() {
  const { ready, token } = useAuth();
  const router = useRouter();
  const [model, setModel] = useState<DistrictModel>(() => seedModel());
  const [osmCount, setOsmCount] = useState<number>(0);
  const [osmError, setOsmError] = useState<string | null>(null);
  const [view, setView] = useState<'2d' | '3d'>('2d');
  const [hour, setHour] = useState(13);
  const [parkN, setParkN] = useState(400);
  const [preset, setPreset] = useState<PresetSpec>(PRESETS[0]);
  const [addMode, setAddMode] = useState(false);
  const [edgeMode, setEdgeMode] = useState(false);
  const [edgeFrom, setEdgeFrom] = useState<string | null>(null);
  const [showRoutes, setShowRoutes] = useState(true);
  const [selectedAttrId, setSelectedAttrId] = useState<string | null>(null);
  const [selectedBld, setSelectedBld] = useState<string | null>(null);
  const [hash, setHash] = useState('');

  useEffect(() => {
    if (ready && !token) router.replace('/login');
  }, [ready, token, router]);

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

  const baseline = useMemo(() => calcMetrics(seedModel(), parkN), [parkN]);
  const current = useMemo(() => calcMetrics(model, parkN), [model, parkN]);
  const diff = useMemo(() => diffMetrics(baseline, current), [baseline, current]);

  useEffect(() => {
    sha1Hex(canonicalGraph(model)).then(setHash).catch(() => setHash(''));
  }, [model]);

  /** Геометрия кратчайших путей домов до ближайшей остановки (считает Dijkstra). */
  const routeLines = useMemo<[number, number][][]>(() => {
    if (!showRoutes) return [];
    const adj = buildAdj(model.edges);
    const nodeById = new Map(model.nodes.map((n) => [n.id, n]));
    const stops = model.attractions.filter((a) => a.kind === 'ostanovka');
    const out: [number, number][][] = [];
    for (const h of model.houses) {
      const { dist } = dijkstraWithPrev(adj, h.nodeId);
      let best: string | null = null;
      let bestD = Infinity;
      for (const s of stops) {
        const d = dist.get(s.nodeId);
        if (d != null && d < bestD) {
          bestD = d;
          best = s.nodeId;
        }
      }
      if (!best) continue;
      const chain = shortestPath(adj, h.nodeId, best);
      if (!chain) continue;
      out.push(chain.map((id) => {
        const n = nodeById.get(id)!;
        return [n.x, n.y];
      }));
    }
    return out;
  }, [model, showRoutes]);

  const sun = useMemo(() => {
    const d = new Date();
    d.setHours(hour, 0, 0, 0);
    return sunAt(d);
  }, [hour]);

  /** Заключение-эвристика: вердикт + сработавшие правила (§9.7). */
  const conclusion = useMemo(
    () => buildConclusion({ model, baseline, current, hour, sun }),
    [model, baseline, current, hour, sun],
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

  const toggleEdge = useCallback((edgeId: string) => {
    setModel((m) => ({ ...m, edges: m.edges.map((e) => (e.id === edgeId ? { ...e, closed: !e.closed } : e)) }));
  }, []);

  const moveAttr = useCallback((attrId: string, nodeId: string) => {
    setModel((m) => ({
      ...m,
      attractions: m.attractions.map((a) => (a.id === attrId ? { ...a, nodeId } : a)),
    }));
    setSelectedAttrId(null);
  }, []);

  const deleteEdge = useCallback((edgeId: string) => {
    setModel((m) => ({ ...m, edges: m.edges.filter((e) => e.id !== edgeId) }));
  }, []);

  /** Клик по узлу в режиме перехода: первая точка — запомнить, вторая — создать/удалить ребро. */
  const pickNode = useCallback(
    (nodeId: string) => {
      if (!edgeFrom) {
        setEdgeFrom(nodeId);
        return;
      }
      if (edgeFrom === nodeId) {
        setEdgeFrom(null);
        return;
      }
      setModel((m) => {
        const exists = m.edges.find(
          (e) => (e.a === edgeFrom && e.b === nodeId) || (e.a === nodeId && e.b === edgeFrom),
        );
        if (exists) return { ...m, edges: m.edges.filter((e) => e.id !== exists.id) };
        const A = m.nodes.find((n) => n.id === edgeFrom);
        const B = m.nodes.find((n) => n.id === nodeId);
        if (!A || !B) return m;
        const length = Math.round(Math.hypot(B.x - A.x, B.y - A.y) * 10) / 10;
        return {
          ...m,
          edges: [...m.edges, { id: `e-${Date.now()}`, a: edgeFrom, b: nodeId, length, type: 'perehod' as const }],
        };
      });
      setEdgeFrom(null);
    },
    [edgeFrom],
  );

  const addBuilding = useCallback(
    (x: number, y: number) => {
      const b: Building = {
        id: `custom-${Date.now()}`,
        label: `${preset.label} (своя)`,
        footprint: rectFootprint(x, y, preset.w, preset.d),
        h: preset.h,
        floors: Math.max(1, Math.round(preset.h / 3)),
        roof: preset.roof,
        preset: preset.preset,
      };
      setModel((m) => ruptureEdges({ ...m, buildings: [...m.buildings, b] }, b.footprint));
      setAddMode(false);
      setSelectedBld(b.id);
    },
    [preset],
  );

  const reset = useCallback(() => {
    withOsmBuildings(seedModel()).then(setModel).catch(() => setModel(seedModel()));
    setSelectedAttrId(null);
    setSelectedBld(null);
    setAddMode(false);
    setEdgeMode(false);
    setEdgeFrom(null);
  }, []);

  /** Открыть проект с сервера: граф целиком заменяет текущий, режимы сбрасываем. */
  const openProject = useCallback((m: DistrictModel) => {
    setModel(m);
    setSelectedAttrId(null);
    setSelectedBld(null);
    setAddMode(false);
    setEdgeMode(false);
    setEdgeFrom(null);
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
      <main className="relative z-10 mx-auto w-full max-w-[1400px] gap-4 px-4 py-6 sm:px-6 lg:flex lg:items-start">
        {/* Карта — слева, большая */}
        <section className={`${cardCls} lg:flex-1`} aria-label="Карта района">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h1 className="text-xl font-black tracking-tight text-gray-900 dark:text-gray-100">
              Конструктор «Обнинск 2040»
            </h1>
            <div className="flex gap-2" role="group" aria-label="Режим карты">
              <button type="button" onClick={() => setView('2d')} className={view === '2d' ? pillActive : pillBtn} aria-pressed={view === '2d'}>
                2D
              </button>
              <button type="button" onClick={() => setView('3d')} className={view === '3d' ? pillActive : pillBtn} aria-pressed={view === '3d'}>
                3D
              </button>
            </div>
          </div>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
            Реальные коробки центра из OpenStreetMap ({osmCount || '…'}). Данные условные, не прогноз (п.11).
            {osmError && <span className="text-red-700 dark:text-red-300"> {osmError} — работаем на сиде.</span>}
          </p>
          {selAttr && !edgeMode && (
            <p className="mt-2 text-sm font-medium text-blue-700 dark:text-blue-300" aria-live="polite">
              Переносим «{selAttr.label}»: кликни по узлу сети (тёмные точки — дома) или потяни маркер.
            </p>
          )}
          {addMode && (
            <p className="mt-2 text-sm font-medium text-blue-700 dark:text-blue-300" aria-live="polite">
              Кликни по карте — поставим «{preset.label}» ({preset.w}×{preset.d} м, h={preset.h} м).
            </p>
          )}
          {edgeMode && (
            <p className="mt-2 text-sm font-medium text-blue-700 dark:text-blue-300" aria-live="polite">
              {edgeFrom
                ? 'Первая точка выбрана (синяя). Кликни по второму узлу — создадим переход; повторный клик по паре — удалит.'
                : 'Кликни по первому узлу сети. Клик по синему переходу в этом режиме — удалить его.'}
            </p>
          )}
          <div className="mt-3">
            {view === '2d' ? (
              <CityMap
                model={model}
                selectedAttrId={selectedAttrId}
                addMode={addMode}
                edgeMode={edgeMode}
                edgeFrom={edgeFrom}
                routeLines={routeLines}
                shadowPolys={shadowPolys}
                onToggleEdge={toggleEdge}
                onDeleteEdge={deleteEdge}
                onSelectAttr={setSelectedAttrId}
                onMoveAttrToNode={moveAttr}
                onNodePick={pickNode}
                onAddAt={addBuilding}
                className={mapCls}
              />
            ) : (
              <City3D model={model} sun={sun} selectedId={selectedBld} onSelect={setSelectedBld} className={mapCls} />
            )}
          </div>
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            Клик по переходу — закрыть/открыть · клик по О/П/Ш — выбрать, затем клик по узлу или drag — перенести ·{' '}
            <span className="font-mono">seed 2040 · hash {hash.slice(0, 10) || '…'}</span> · © OpenStreetMap
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
              <button
                type="button"
                onClick={() => {
                  setEdgeMode((v) => !v);
                  setEdgeFrom(null);
                  setSelectedAttrId(null);
                }}
                className={edgeMode ? pillActive : pillBtn}
                aria-pressed={edgeMode}
              >
                {edgeMode ? 'Отмена' : '+ Переход'}
              </button>
              <button type="button" onClick={reset} className={pillBtn}>
                Сбросить
              </button>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setShowRoutes((v) => !v)}
                className={showRoutes ? pillActive : pillBtn}
                aria-pressed={showRoutes}
                title="Синие пунктиры — кратчайшие пути домов до остановки"
              >
                Маршруты
              </button>
            </div>
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

          <section className={cardCls} aria-label="Состояние" aria-live="polite">
            <h2 className={sectionTitle}>Состояние</h2>
            <div className="mt-3 space-y-3">
              <div className="rounded-2xl border border-white/60 bg-white/60 p-4 dark:border-white/20 dark:bg-white/10">
                <p className={sectionTitle}>M1 · путь до остановки</p>
                <p className="text-2xl font-black text-gray-900 dark:text-gray-100">
                  {current.m1} м{' '}
                  <span className={diff.dM1 > 0 ? 'text-sm font-medium text-red-600' : 'text-sm font-medium text-green-600'}>
                    {diff.dM1 > 0 ? `+${diff.dM1}` : diff.dM1} (было {baseline.m1})
                  </span>
                </p>
              </div>
              <div className="rounded-2xl border border-white/60 bg-white/60 p-4 dark:border-white/20 dark:bg-white/10">
                <p className={sectionTitle}>M2 · жители с парком в {parkN} м</p>
                <p className="text-2xl font-black text-gray-900 dark:text-gray-100">
                  {Math.round(current.m2 * 100)}%{' '}
                  <span className={diff.dM2 < 0 ? 'text-sm font-medium text-red-600' : 'text-sm font-medium text-green-600'}>
                    {diff.dM2 > 0 ? `+${Math.round(diff.dM2 * 100)}п.п.` : `${Math.round(diff.dM2 * 100)}п.п.`} (было{' '}
                    {Math.round(baseline.m2 * 100)}%)
                  </span>
                </p>
              </div>
            </div>
            {selBld ? (
              <div className="mt-3 rounded-2xl border border-white/60 bg-white/60 p-4 dark:border-white/20 dark:bg-white/10">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {selBld.label} · h={selBld.h} м
                </p>
                {shadeRows.length === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400">В этот час тень ни на кого не падает.</p>
                ) : (
                  <ul className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                    {shadeRows.map((r) => (
                      <li key={r.label}>
                        {r.label} — затенён на {r.pct}%
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : (
              <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">Кликни по зданию — покажем, на кого падает тень.</p>
            )}
            <details className="mt-3 text-sm text-gray-600 dark:text-gray-300">
              <summary className="cursor-pointer font-medium">Как считаем</summary>
              <ul className="mt-1 list-disc space-y-1 pl-5">
                <li>Граф — синтетический сид (12 узлов, 5 домов, остановка+парк+школа). Dijkstra заново после каждого действия.</li>
                <li>Новая коробка закрывает ребра в радиусе ~60 м — обход удлиняет M1.</li>
                <li>Тень: suncalc для Обнинска (55.096, 36.610), L=H/tan(alt). В 3D тот же вектор ставит свет.</li>
                <li>Здания — реальные футпринты OSM (ODbL). Не точный двойник (п.7).</li>
                <li>Заключение — эвристика из if-then правил (§9.7), без LLM.</li>
              </ul>
            </details>
          </section>

          <section className={cardCls} aria-label="Заключение">
            <h2 className={sectionTitle}>Заключение</h2>
            <div className="mt-3">
              <ConclusionBox conclusion={conclusion} />
            </div>
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
