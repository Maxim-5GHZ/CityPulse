'use client';

import type { MetricResult } from '@/lib/urban/types';

interface DiffPanelProps {
  baseline: MetricResult | null;
  current: MetricResult;
  onSnapshot: () => void;
  onRollback: () => void;
}

function deltaRow(label: string, diff: number, unit: string, invert = false): { label: string; text: string; good: boolean } {
  const good = invert ? diff <= 0 : diff >= 0;
  const sign = diff > 0 ? '+' : '';
  return { label, text: `${sign}${diff} ${unit}`, good };
}

/** «Было / Стало»: snapshot базы, таблица дельт, мгновенный откат. */
export default function DiffPanel({ baseline, current, onSnapshot, onRollback }: DiffPanelProps) {
  const rows = baseline
    ? [
        deltaRow('До остановки', current.avgDistanceToBus - baseline.avgDistanceToBus, 'м', true),
        deltaRow('Время', Math.round((current.avgTimeToBusMin - baseline.avgTimeToBusMin) * 10) / 10, 'мин', true),
        deltaRow('Охват парками', current.parkCoveragePercent - baseline.parkCoveragePercent, 'п.п.'),
      ]
    : [];

  return (
    <section aria-label="Сравнение сценариев">
      <p className="text-xs uppercase text-gray-500 dark:text-gray-400">Было / Стало</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onSnapshot}
          className="transform-gpu rounded-full bg-[#141a26]/90 px-4 py-1.5 text-sm font-medium text-white backdrop-blur-xl transition-all duration-200 ease-out hover:scale-[1.05] hover:bg-[#141a26] active:scale-[0.98] motion-reduce:transform-none motion-reduce:transition-none shadow-[inset_0_1px_1px_rgba(255,255,255,0.25),0_14px_30px_-10px_rgba(20,26,38,0.6)] focus:outline-none focus:ring-2 focus:ring-blue-300/60"
        >
          Зафиксировать базу
        </button>
        <button
          type="button"
          onClick={onRollback}
          disabled={!baseline}
          className="transform-gpu rounded-full border border-white/60 bg-white/40 px-4 py-1.5 text-sm font-medium text-gray-700 backdrop-blur-xl transition-all duration-200 ease-out hover:scale-[1.05] hover:bg-white/60 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40 motion-reduce:transform-none motion-reduce:transition-none dark:border-white/20 dark:bg-white/10 dark:text-gray-200 dark:hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-blue-300/60"
        >
          Откатить к базе
        </button>
      </div>
      {baseline ? (
        <dl className="mt-2 space-y-1.5" aria-live="polite">
          {rows.map((r) => (
            <div
              key={r.label}
              className="flex items-center justify-between rounded-2xl border border-white/60 bg-white/30 px-4 py-2 backdrop-blur-xl dark:border-white/20 dark:bg-gray-900/30"
            >
              <dt className="text-sm font-medium text-gray-600 dark:text-gray-200">{r.label}</dt>
              <dd
                className={`text-sm font-black tracking-tight ${
                  r.good ? 'text-gray-900 dark:text-gray-100' : 'text-red-700 dark:text-red-300'
                }`}
              >
                {r.text}
              </dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          Зафиксируй базу, сломай район ремонтом — и откати обратно 1-в-1 для жюри.
        </p>
      )}
    </section>
  );
}
