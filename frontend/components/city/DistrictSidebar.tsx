// frontend/components/city/DistrictSidebar.tsx
'use client';

import { Building, BUILDING_TAG_LABEL, GraphEdge, DistrictMetrics, PathResult } from '@/lib/city-engine/types';

interface DistrictSidebarProps {
  selectedBuilding?: Building;
  selectedEdge?: GraphEdge | null;
  activePath?: PathResult | null;
  metrics: DistrictMetrics;
  baseStamp: string;
  onFixBase: () => void;
  onRollbackToBase: () => void;
  onOpenAudit: () => void;
}

const cardGlassCls =
  'rounded-[28px] border border-white/60 bg-white/40 p-4 backdrop-blur-xl backdrop-saturate-150 ' +
  'shadow-[inset_1px_1px_2px_rgba(255,255,255,0.8),inset_-1px_-1px_2px_rgba(0,0,0,0.05),0_18px_40px_-12px_rgba(20,26,38,0.25)] ' +
  'dark:border-white/20 dark:bg-gray-900/40';

export default function DistrictSidebar({
  selectedBuilding,
  selectedEdge,
  activePath,
  metrics,
  baseStamp,
  onFixBase,
  onRollbackToBase,
  onOpenAudit,
}: DistrictSidebarProps) {
  // Аудит и «Было / Стало» живут в разделе «Аналитика» (AuditDashboardModal),
  // здесь — только инспектор объекта и действия с базой сравнения.

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
            <div className="flex justify-between text-gray-600 dark:text-gray-300">
              <span>Тег:</span>
              <span className="font-bold text-gray-900 dark:text-gray-100">
                {selectedBuilding.tag ? BUILDING_TAG_LABEL[selectedBuilding.tag] : 'Жилой'}
              </span>
            </div>
            <p className="text-[10px] text-gray-500 dark:text-gray-400">
              ПКМ по дому — сменить тег или снести.
            </p>
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

      {/* Сравнение с базой: кнопки фиксации/отката и переход в «Аналитику».
          Таблицы аудита и «Было / Стало» живут в AuditDashboardModal. */}
      <div className={cardGlassCls} aria-live="polite">
        <div className="flex items-center justify-between border-b border-white/50 pb-2.5 dark:border-white/15">
          <h3 className="text-xs font-black uppercase tracking-tight text-gray-900 dark:text-gray-100">
            Было / Стало
          </h3>
          <span className="text-[10px] font-semibold text-gray-500 dark:text-gray-400">{baseStamp}</span>
        </div>

        <div className="mt-2.5 flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={onFixBase}
            title="Зафиксировать текущее состояние как базовое «ДО»"
            className="flex-1 whitespace-nowrap rounded-full border border-white/60 bg-white/50 px-3 py-1.5 text-[11px] font-bold text-gray-700 backdrop-blur-xl transition-all duration-200 hover:scale-[1.03] active:scale-[0.98] dark:border-white/15 dark:bg-white/10 dark:text-gray-200"
          >
            📌 Зафиксировать ДО
          </button>
          <button
            type="button"
            onClick={onRollbackToBase}
            title="Вернуть проект к зафиксированному «ДО»"
            className="flex-1 whitespace-nowrap rounded-full border border-white/60 bg-white/50 px-3 py-1.5 text-[11px] font-bold text-gray-700 backdrop-blur-xl transition-all duration-200 hover:scale-[1.03] active:scale-[0.98] dark:border-white/15 dark:bg-white/10 dark:text-gray-200"
          >
            ↩ Откатить к ДО
          </button>
        </div>
        <button
          type="button"
          onClick={onOpenAudit}
          title="Открыть дашборд глубокого аудита: динамика решений, баланс среды, выводы алгоритма"
          className="mt-2 w-full rounded-full border border-blue-400/60 bg-blue-600/90 py-1.5 text-xs font-bold text-white shadow-sm transition-all duration-200 ease-out hover:scale-[1.02] active:scale-[0.98] motion-reduce:transform-none motion-reduce:transition-none"
        >
          📊 Развернуть полный отчёт аудита
        </button>
      </div>
    </aside>
  );
}
