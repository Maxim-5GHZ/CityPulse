'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

type FlowMode = 'bus' | 'park' | 'repair';

interface GNode {
  id: string;
  x: number;
  y: number;
  label: string;
  kind: 'house' | 'target' | 'node';
}

interface GEdge {
  a: string;
  b: string;
  len: number;
}

const NODES: GNode[] = [
  { id: 'h1', x: 90, y: 270, label: 'Корпус 1', kind: 'house' },
  { id: 'h2', x: 90, y: 110, label: 'Корпус 2', kind: 'house' },
  { id: 'a', x: 230, y: 270, label: '', kind: 'node' },
  { id: 'b', x: 370, y: 270, label: '', kind: 'node' },
  { id: 'c', x: 230, y: 110, label: '', kind: 'node' },
  { id: 'd', x: 370, y: 110, label: '', kind: 'node' },
  { id: 'm', x: 300, y: 190, label: '', kind: 'node' },
  { id: 'bus', x: 510, y: 270, label: 'Остановка', kind: 'target' },
  { id: 'park', x: 510, y: 110, label: 'Сквер/Школа', kind: 'target' },
];

const EDGES: GEdge[] = [
  { a: 'h1', b: 'a', len: 140 },
  { a: 'a', b: 'b', len: 140 },
  { a: 'b', b: 'bus', len: 140 },
  { a: 'h2', b: 'c', len: 140 },
  { a: 'c', b: 'd', len: 140 },
  { a: 'd', b: 'park', len: 140 },
  { a: 'h1', b: 'h2', len: 160 },
  { a: 'a', b: 'c', len: 160 },
  { a: 'b', b: 'd', len: 160 },
  { a: 'bus', b: 'park', len: 160 },
  { a: 'a', b: 'm', len: 110 },
  { a: 'm', b: 'b', len: 110 },
  { a: 'c', b: 'm', len: 110 },
  { a: 'm', b: 'd', len: 110 },
];

interface DijkstraResult {
  dist: number;
  path: string[];
  visitOrder: string[];
}

function dijkstra(start: string, target: string, blockedKey: string | null): DijkstraResult | null {
  const adj = new Map<string, { to: string; w: number; key: string }[]>();
  for (const e of EDGES) {
    const key = `${e.a}|${e.b}`;
    if (key === blockedKey) continue;
    if (!adj.has(e.a)) adj.set(e.a, []);
    if (!adj.has(e.b)) adj.set(e.b, []);
    adj.get(e.a)?.push({ to: e.b, w: e.len, key });
    adj.get(e.b)?.push({ to: e.a, w: e.len, key });
  }
  const dist = new Map<string, number>([[start, 0]]);
  const prev = new Map<string, string>();
  const done = new Set<string>();
  const visitOrder: string[] = [];
  for (;;) {
    let cur: string | null = null;
    let best = Infinity;
    dist.forEach((d, id) => {
      if (!done.has(id) && d < best) {
        best = d;
        cur = id;
      }
    });
    if (cur === null) return null;
    done.add(cur);
    visitOrder.push(cur);
    if (cur === target) break;
    for (const nb of adj.get(cur) ?? []) {
      const nd = (dist.get(cur) ?? Infinity) + nb.w;
      if (nd < (dist.get(nb.to) ?? Infinity)) {
        dist.set(nb.to, nd);
        prev.set(nb.to, cur);
      }
    }
  }
  const path: string[] = [target];
  let p: string | undefined = prev.get(target);
  while (p !== undefined) {
    path.unshift(p);
    p = prev.get(p);
  }
  return { dist: dist.get(target) ?? Infinity, path, visitOrder };
}

const MODE: Record<FlowMode, { start: string; target: string; blocked: string | null; accent: string }> = {
  bus: { start: 'h1', target: 'bus', blocked: null, accent: '#2563eb' },
  park: { start: 'h2', target: 'park', blocked: null, accent: '#059669' },
  repair: { start: 'h1', target: 'bus', blocked: 'b|bus', accent: '#d97706' },
};

const STEP_MS = 260;

export default function NetworkGraphSimulator() {
  const [mode, setMode] = useState<FlowMode>('bus');
  const [startId, setStartId] = useState<string | null>(null);
  const [visited, setVisited] = useState<string[]>([]);
  const [showPath, setShowPath] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mq.matches);
    const fn = () => setReducedMotion(mq.matches);
    mq.addEventListener('change', fn);
    return () => mq.removeEventListener('change', fn);
  }, []);

  const cfg = MODE[mode];
  const start = startId ?? cfg.start;

  const result = useMemo(() => dijkstra(start, cfg.target, cfg.blocked), [start, cfg.target, cfg.blocked]);
  const baseResult = useMemo(
    () => (cfg.blocked ? dijkstra(start, cfg.target, null) : null),
    [start, cfg.target, cfg.blocked],
  );

  useEffect(() => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
    if (!result) {
      setVisited([]);
      setShowPath(false);
      return;
    }
    if (reducedMotion) {
      setVisited(result.visitOrder);
      setShowPath(true);
      return;
    }
    setVisited([]);
    setShowPath(false);
    result.visitOrder.forEach((id, i) => {
      timers.current.push(
        window.setTimeout(() => setVisited((prev) => (prev.includes(id) ? prev : [...prev, id])), 350 + i * STEP_MS),
      );
    });
    timers.current.push(window.setTimeout(() => setShowPath(true), 350 + result.visitOrder.length * STEP_MS));
    return () => {
      timers.current.forEach((t) => window.clearTimeout(t));
      timers.current = [];
    };
  }, [result, reducedMotion, mode, start]);

  const nodeById = useMemo(() => new Map(NODES.map((n) => [n.id, n])), []);
  const pathSet = useMemo(() => {
    const s = new Set<string>();
    if (showPath && result) {
      for (let i = 0; i < result.path.length - 1; i++) {
        const [u, v] = [result.path[i], result.path[i + 1]];
        s.add(`${u}|${v}`);
        s.add(`${v}|${u}`);
      }
    }
    return s;
  }, [showPath, result]);

  const minutes = result ? (result.dist / 75).toFixed(1) : null;
  const delta = result && baseResult ? result.dist - baseResult.dist : 0;

  const pickMode = (m: FlowMode) => {
    setStartId(null);
    setMode(m);
  };

  return (
    <div className="flex w-full max-w-5xl flex-col items-center gap-4">
      <div className="flex flex-wrap items-center justify-center gap-2">
        <span className="text-xs font-bold uppercase tracking-wider text-gray-800 dark:text-gray-100">
          Сценарии графа:
        </span>
        <button
          type="button"
          onClick={() => pickMode('bus')}
          className={`transform-gpu rounded-full px-4 py-1.5 text-xs font-bold transition-all duration-200 ease-out hover:scale-[1.05] active:scale-[0.98] motion-reduce:transform-none motion-reduce:transition-none ${
            mode === 'bus'
              ? 'bg-blue-600 text-white shadow-md'
              : 'border border-gray-400/50 bg-white/70 text-gray-800 hover:bg-white/90 dark:border-white/20 dark:bg-white/20 dark:text-gray-100'
          }`}
        >
          Транспортная доступность (M1)
        </button>
        <button
          type="button"
          onClick={() => pickMode('park')}
          className={`transform-gpu rounded-full px-4 py-1.5 text-xs font-bold transition-all duration-200 ease-out hover:scale-[1.05] active:scale-[0.98] motion-reduce:transform-none motion-reduce:transition-none ${
            mode === 'park'
              ? 'bg-emerald-600 text-white shadow-md'
              : 'border border-gray-400/50 bg-white/70 text-gray-800 hover:bg-white/90 dark:border-white/20 dark:bg-white/20 dark:text-gray-100'
          }`}
        >
          Рекреация и соцобъекты (M2)
        </button>
        <button
          type="button"
          onClick={() => pickMode('repair')}
          className={`transform-gpu rounded-full px-4 py-1.5 text-xs font-bold transition-all duration-200 ease-out hover:scale-[1.05] active:scale-[0.98] motion-reduce:transform-none motion-reduce:transition-none ${
            mode === 'repair'
              ? 'bg-rose-600 text-white shadow-md'
              : 'border border-gray-400/50 bg-white/70 text-gray-800 hover:bg-white/90 dark:border-white/20 dark:bg-white/20 dark:text-gray-100'
          }`}
        >
          Срезы и «народные тропы»
        </button>
      </div>

      <div className="relative w-full overflow-hidden rounded-[32px] border border-white/60 bg-white/70 p-5 shadow-[inset_1px_1px_2px_rgba(255,255,255,0.9),0_20px_50px_-14px_rgba(20,26,38,0.3)] backdrop-blur-xl dark:border-white/20 dark:bg-gray-900/70">
        <p className="mb-2 text-center text-[12px] font-medium text-gray-700 dark:text-gray-300">
          Кликните любой узел — он станет отправной точкой. Волна показывает логику обхода сети.
        </p>
        <svg
          viewBox="0 0 640 360"
          className="h-auto max-h-[38vh] w-full"
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label="Интерактивная схема работы алгоритма на графе улиц"
        >
          <g strokeLinecap="round">
            {EDGES.map((e) => {
              const a = nodeById.get(e.a);
              const b = nodeById.get(e.b);
              if (!a || !b) return null;
              const key = `${e.a}|${e.b}`;
              const isBlocked = cfg.blocked === key;
              const isPath = pathSet.has(key);
              return (
                <line
                  key={key}
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  stroke={isBlocked ? '#e11d48' : isPath ? cfg.accent : 'currentColor'}
                  strokeWidth={isPath ? 5 : isBlocked ? 5 : 7}
                  strokeDasharray={isBlocked ? '7 6' : undefined}
                  className="text-gray-400 dark:text-gray-600"
                  opacity={isBlocked || isPath ? 1 : 0.6}
                />
              );
            })}
          </g>
          <g fontSize="10" fill="currentColor" className="text-gray-500 dark:text-gray-400 font-bold" fontFamily="monospace">
            {EDGES.map((e) => {
              const a = nodeById.get(e.a);
              const b = nodeById.get(e.b);
              if (!a || !b || cfg.blocked === `${e.a}|${e.b}`) return null;
              return (
                <text key={`len-${e.a}-${e.b}`} x={(a.x + b.x) / 2 + 4} y={(a.y + b.y) / 2 - 6} textAnchor="middle">
                  {e.len}м
                </text>
              );
            })}
          </g>
          {NODES.map((n) => {
            const isStart = n.id === start;
            const isTarget = n.id === cfg.target;
            const isVisited = visited.includes(n.id);
            const r = n.kind === 'node' ? 9 : 20;
            const fill = isStart
              ? '#1e293b'
              : isTarget
                ? cfg.accent
                : isVisited
                  ? '#93c5fd'
                  : n.kind === 'house'
                    ? '#64748b'
                    : '#e2e8f0';
            return (
              <g key={n.id} onClick={() => n.id !== cfg.target && setStartId(n.id)} className="cursor-pointer">
                <title>{n.label || n.id}</title>
                {isVisited && !isStart && !isTarget && (
                  <circle cx={n.x} cy={n.y} r={r + 6} fill="none" stroke={cfg.accent} strokeWidth="2.5" opacity="0.6" />
                )}
                <circle cx={n.x} cy={n.y} r={r} fill={fill} stroke="#ffffff" strokeWidth={n.kind === 'node' ? 2 : 3} />
                {n.kind !== 'node' && (
                  <text
                    x={n.x}
                    y={n.y + 36}
                    textAnchor="middle"
                    fill="currentColor"
                    className="text-gray-900 dark:text-gray-100"
                    fontSize={12}
                    fontWeight="900"
                  >
                    {n.label}
                  </text>
                )}
                {n.kind === 'target' && (
                  <text x={n.x} y={n.y + 5} textAnchor="middle" fill="#ffffff" fontSize="13" fontWeight="900">
                    {n.id === 'bus' ? 'А' : 'П'}
                  </text>
                )}
              </g>
            );
          })}
          {cfg.blocked && (
            <g transform="translate(440, 270)">
              <circle r="13" fill="#e11d48" stroke="#ffffff" strokeWidth="2" />
              <text y="4" textAnchor="middle" fill="#ffffff" fontSize="11" fontWeight="900">✕</text>
              <text y="27" textAnchor="middle" fill="#e11d48" fontSize="10" fontWeight="bold">ПРЕПЯТСТВИЕ</text>
            </g>
          )}
        </svg>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-gray-300 pt-3 text-xs dark:border-gray-700">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 shrink-0 rounded-full bg-blue-600 motion-safe:animate-pulse" />
            <span className="font-mono font-bold text-gray-900 dark:text-gray-100">
              {result ? (
                <>
                  Дистанция: {result.dist} м · {minutes} мин пешком
                  {delta > 0 && <span className="text-rose-600 dark:text-rose-400"> · обход +{delta} м</span>}
                  {mode === 'park' && <span className="text-emerald-600 dark:text-emerald-400"> · M2 в радиусе</span>}
                </>
              ) : (
                'Нет связного пути — изоляция (штраф нормативов)'
              )}
            </span>
          </div>
          <span className="font-mono text-[11px] font-bold text-gray-500">Поиск с учётом преград</span>
        </div>
      </div>

      <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-3 mt-2">
        <div className="rounded-2xl border border-white/60 bg-white/70 p-4 shadow-sm backdrop-blur-md dark:border-white/10 dark:bg-gray-800/60">
          <div className="text-xs font-black uppercase text-blue-700 dark:text-blue-400">Визуализация в 3D</div>
          <p className="mt-2 text-xs font-medium text-gray-800 dark:text-gray-200 leading-relaxed">
            В 3D-режиме этот граф оживает: алгоритм направляет тысячи частиц-пешеходов, показывая реальную загрузку тротуаров.
          </p>
        </div>
        <div className="rounded-2xl border border-white/60 bg-white/70 p-4 shadow-sm backdrop-blur-md dark:border-white/10 dark:bg-gray-800/60">
          <div className="text-xs font-black uppercase text-emerald-700 dark:text-emerald-400">Анализ МГН</div>
          <p className="mt-2 text-xs font-medium text-gray-800 dark:text-gray-200 leading-relaxed">
            Учитывается безбарьерная среда. Если на кратчайшем пути подземный переход — для инвалидов и мам с колясками маршрут пересчитывается в обход.
          </p>
        </div>
        <div className="rounded-2xl border border-white/60 bg-white/70 p-4 shadow-sm backdrop-blur-md dark:border-white/10 dark:bg-gray-800/60">
          <div className="text-xs font-black uppercase text-rose-700 dark:text-rose-400">Выявление ошибок</div>
          <p className="mt-2 text-xs font-medium text-gray-800 dark:text-gray-200 leading-relaxed">
            Алгоритм мгновенно находит «глухие тупики» и показывает, где жители протопчут газон («народная тропа»), чтобы срезать путь к остановке.
          </p>
        </div>
      </div>
    </div>
  );
}
