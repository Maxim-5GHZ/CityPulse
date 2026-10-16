// frontend/components/city/DistrictSidebar.tsx
'use client';

import { Building, GraphEdge, DistrictMetrics, PathResult } from '@/lib/city-engine/types';

interface DistrictSidebarProps {
  selectedBuilding?: Building;
  selectedEdge?: GraphEdge | null;
  activePath?: PathResult | null;
  metrics: DistrictMetrics;
  baseMetrics: DistrictMetrics;
}

const cardGlassCls =
  'rounded-[28px] border border-white/60 bg-white/40 p-4 backdrop-blur-xl backdrop-saturate-150 ' +
  'shadow-[inset_1px_1px_2px_rgba(255,255,255,0.8),inset_-1px_-1px_2px_rgba(0,0,0,0.05),0_18px_40px_-12px_rgba(20,26,38,0.25)] ' +
  'dark:border-white/20 dark:bg-gray-900/40';

const innerPillCls =
  'rounded-2xl border border-white/60 bg-white/50 p-3 backdrop-blur-xl shadow-[inset_0_1px_1px_rgba(255,255,255,0.8)] ' +
  'dark:border-white/15 dark:bg-gray-800/50';

export default function DistrictSidebar({
  selectedBuilding,
  selectedEdge,
  activePath,
  metrics,
  baseMetrics,
}: DistrictSidebarProps) {
  const busDelta = metrics.weightedAvgBusDistM - baseMetrics.weightedAvgBusDistM;
  const parkDelta = metrics.parkAccessPercent - baseMetrics.parkAccessPercent;

  return (
    <aside className="space-y-4">
      {/* Инспектор выделенного объекта */}
      {selectedBuilding ? (
        <div className={cardGlassCls}>
          <h3 className="border-b border-white/50 pb-2 text-xs font-bold uppercase tracking-tight text-blue-700 dark:border-white/15 dark:text-blue-300">
            Объект: {selectedBuilding.name}
          </h3>
          <div className="mt-3 space-y-2.5 text-xs font-medium">
            <div className="flex justify-between text-gray-600 dark:text-gray-300">
              <span>Этажность:</span>
              <span className="font-bold text-gray-900 dark:text-gray-100">{selectedBuilding.floors} эт.</span>
            </div>
            <div className="flex justify-between text-gray-600 dark:text-gray-300">
              <span>Жителей:</span>
              <span className="font-bold text-gray-900 dark:text-gray-100">{selectedBuilding.residents} чел.</span>
            </div>
            {activePath && (
              <div className="rounded-xl border border-blue-200/70 bg-blue-50/80 p-2.5 text-blue-900 backdrop-blur-xl dark:border-blue-500/30 dark:bg-blue-950/40 dark:text-blue-200">
                Кратчайший путь: <b>{activePath.distanceM} м</b> (~{activePath.timeMinutes} мин)
              </div>
            )}
          </div>
        </div>
      ) : selectedEdge ? (
        <div className={cardGlassCls}>
          <h3 className="border-b border-white/50 pb-2 text-xs font-bold uppercase tracking-tight text-amber-700 dark:border-white/15 dark:text-amber-300">
            Участок: {selectedEdge.type}
          </h3>
          <div className="mt-3 space-y-2 text-xs font-medium text-gray-700 dark:text-gray-200">
            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-gray-400">Длина:</span>
              <b className="text-gray-900 dark:text-gray-100">{selectedEdge.lengthM} м</b>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-gray-400">Полосы авто:</span>
              <b className="text-gray-900 dark:text-gray-100">{selectedEdge.lanes ?? '—'}</b>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-gray-400">Тротуары:</span>
              <b className="text-gray-900 dark:text-gray-100">
                {selectedEdge.hasSidewalkLeft ? 'Слева ' : ''}
                {selectedEdge.hasSidewalkRight ? 'Справа' : ''}
                {!selectedEdge.hasSidewalkLeft && !selectedEdge.hasSidewalkRight ? 'Нет' : ''}
              </b>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-gray-400">Пассажиропоток:</span>
              <b className="text-emerald-600 dark:text-emerald-400">{metrics.edgeLoads[selectedEdge.id] || 0} чел/час</b>
            </div>
          </div>
        </div>
      ) : null}

      {/* Панель аналитики и графовых метрик */}
      <div className={cardGlassCls}>
        <div className="flex items-center justify-between border-b border-white/50 pb-2.5 dark:border-white/15">
          <h3 className="text-xs font-black uppercase tracking-tight text-gray-900 dark:text-gray-100">
            Аудит пешеходной доступности
          </h3>
          <span className="text-[10px] font-semibold text-gray-500 dark:text-gray-400">ДЕЙКСТРА</span>
        </div>

        <div className="mt-3 space-y-2.5">
          <div className={innerPillCls}>
            <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
              <span>К общественному транспорту</span>
              <span className={busDelta <= 0 ? 'font-bold text-emerald-600 dark:text-emerald-400' : 'font-bold text-rose-600 dark:text-rose-400'}>
                {busDelta <= 0 ? `▼ ${Math.abs(busDelta)} м` : `▲ +${busDelta} м`}
              </span>
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-lg font-black text-gray-900 dark:text-gray-100">{metrics.weightedAvgBusDistM} м</span>
              <span className="text-xs text-gray-400 line-through dark:text-gray-500">{baseMetrics.weightedAvgBusDistM} м</span>
            </div>
          </div>

          <div className={innerPillCls}>
            <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
              <span>Доступность парков (≤350м)</span>
              <span className={parkDelta >= 0 ? 'font-bold text-emerald-600 dark:text-emerald-400' : 'font-bold text-rose-600 dark:text-rose-400'}>
                {parkDelta >= 0 ? `▲ +${parkDelta}%` : `▼ ${parkDelta}%`}
              </span>
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-lg font-black text-gray-900 dark:text-gray-100">{metrics.parkAccessPercent}%</span>
              <span className="text-xs text-gray-400 line-through dark:text-gray-500">{baseMetrics.parkAccessPercent}%</span>
            </div>
          </div>

          <div className={innerPillCls}>
            <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
              <span>Доступность для МГН</span>
              <span className={metrics.mobilityIndex < 50 ? 'font-bold text-rose-600 dark:text-rose-400' : 'font-bold text-blue-600 dark:text-blue-400'}>
                {metrics.mobilityIndex}%
              </span>
            </div>
            <div className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
              {metrics.mobilityIndex < 50
                ? '⚠️ Подземные переходы без пандусов ограничили доступ'
                : 'Безбарьерная городская среда'}
            </div>
          </div>

          <div className={innerPillCls}>
            <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
              <span>Инвестиции в благоустройство:</span>
              <span className="font-bold text-gray-900 dark:text-gray-100">
                {metrics.budgetSpentRub.toLocaleString('ru-RU')} ₽
              </span>
            </div>
            <p className="mt-1 text-[10px] text-gray-500 dark:text-gray-400">
              Лимит бюджета: {metrics.budgetLimitRub.toLocaleString('ru-RU')} ₽
            </p>
          </div>
        </div>

        {metrics.bottlenecks.length > 0 && (
          <div className="mt-3 rounded-2xl border border-red-200/70 bg-red-50/80 p-3 text-xs text-red-700 backdrop-blur-xl dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
            <div className="font-bold uppercase tracking-tight">Узкие места:</div>
            <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[11px]">
              {metrics.bottlenecks.slice(0, 3).map((b) => (
                <li key={b.edgeId}>{b.description}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </aside>
  );
}
