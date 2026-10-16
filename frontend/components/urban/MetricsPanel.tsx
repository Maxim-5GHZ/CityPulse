'use client';

import type { MetricResult } from '@/lib/urban/types';

interface MetricsPanelProps {
  metrics: MetricResult;
  totalResidents: number;
}

const CARD =
  'rounded-2xl border border-white/60 bg-white/30 px-4 py-3 backdrop-blur-xl ' +
  'shadow-[inset_1px_1px_2px_rgba(255,255,255,0.8),inset_-1px_-1px_2px_rgba(0,0,0,0.05)] ' +
  'dark:border-white/20 dark:bg-gray-900/30';

/** Urban Health Dashboard: мгновенные метрики доступности. */
export default function MetricsPanel({ metrics, totalResidents }: MetricsPanelProps) {
  const bad = metrics.isolatedBuildingsCount > 0;
  return (
    <section aria-label="Метрики района" aria-live="polite">
      <p className="text-xs uppercase text-gray-500 dark:text-gray-400">Здоровье района</p>
      <div className="mt-2 grid gap-2">
        <div className={CARD}>
          <p className="text-xs uppercase text-gray-500 dark:text-gray-400">До остановки</p>
          <p className="mt-1 text-xl font-black tracking-tight text-gray-900 dark:text-gray-100">
            {metrics.avgDistanceToBus} м · {metrics.avgTimeToBusMin} мин
          </p>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
            Среднее по {totalResidents} жителям, скорость 4.5 км/ч
          </p>
        </div>
        <div className={CARD}>
          <p className="text-xs uppercase text-gray-500 dark:text-gray-400">Парки в радиусе 400 м</p>
          <p className="mt-1 text-xl font-black tracking-tight text-gray-900 dark:text-gray-100">
            {metrics.parkCoveragePercent}%
          </p>
          <div
            className="mt-2 h-2 overflow-hidden rounded-full bg-gray-300/50 dark:bg-white/10"
            role="progressbar"
            aria-valuenow={metrics.parkCoveragePercent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Охват парками"
          >
            <div
              className="h-full rounded-full bg-blue-600 transition-all duration-200"
              style={{ width: `${metrics.parkCoveragePercent}%` }}
            />
          </div>
        </div>
        <div
          className={
            bad
              ? 'rounded-2xl border border-red-200/70 bg-red-50/80 px-4 py-3 backdrop-blur-xl dark:border-red-300/20 dark:bg-red-950/40'
              : CARD
          }
        >
          <p className="text-xs uppercase text-gray-500 dark:text-gray-400">Связность</p>
          {bad ? (
            <p className="mt-1 text-sm font-medium text-red-700 dark:text-red-300">
              Отрезано домов: {metrics.isolatedBuildingsCount} — проверь разрывы и ремонт
            </p>
          ) : (
            <p className="mt-1 text-sm font-medium text-gray-700 dark:text-gray-200">
              Все дома связаны с инфраструктурой
            </p>
          )}
          {metrics.bottleneckEdgeIds.length > 0 && (
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Нагруженные участки: {metrics.bottleneckEdgeIds.length} (подсвечены на карте)
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
