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

const cardCls =
  'rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-md';

const innerPillCls =
  'rounded-xl border border-white/10 bg-white/5 p-3';

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
        <div className={cardCls}>
          <h3 className="pb-2 text-xs font-bold tracking-tight text-blue-300 uppercase border-b border-white/10">
            Объект: {selectedBuilding.name}
          </h3>
          <div className="mt-3 space-y-2.5 text-xs font-medium">
            <div className="flex justify-between text-zinc-400">
              <span>Этажность:</span>
              <span className="font-bold text-zinc-100">{selectedBuilding.floors} эт.</span>
            </div>
            <div className="flex justify-between text-zinc-400">
              <span>Жителей:</span>
              <span className="font-bold text-zinc-100">{selectedBuilding.residents} чел.</span>
            </div>
            {activePath && (
              <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-2.5 text-blue-200 backdrop-blur-md">
                Кратчайший путь: <b>{activePath.distanceM} м</b> (~{activePath.timeMinutes} мин)
              </div>
            )}
          </div>
        </div>
      ) : selectedEdge ? (
        <div className={cardCls}>
          <h3 className="pb-2 text-xs font-bold tracking-tight uppercase border-b border-white/10 text-amber-300">
            Участок: {selectedEdge.type}
          </h3>
          <div className="mt-3 space-y-2 text-xs font-medium text-zinc-300">
            <div className="flex justify-between">
              <span className="text-zinc-500">Длина:</span>
              <b className="text-zinc-100">{selectedEdge.lengthM} м</b>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">Полосы авто:</span>
              <b className="text-zinc-100">{selectedEdge.lanes ?? '—'}</b>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">Тротуары:</span>
              <b className="text-zinc-100">
                {selectedEdge.hasSidewalkLeft ? 'Слева ' : ''}
                {selectedEdge.hasSidewalkRight ? 'Справа' : ''}
                {!selectedEdge.hasSidewalkLeft && !selectedEdge.hasSidewalkRight ? 'Нет' : ''}
              </b>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">Пассажиропоток:</span>
              <b className="text-emerald-400">{metrics.edgeLoads[selectedEdge.id] || 0} чел/час</b>
            </div>
          </div>
        </div>
      ) : null}

      {/* Панель аналитики */}
      <div className={cardCls}>
        <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
          <h3 className="text-xs font-black tracking-tight uppercase text-zinc-100">
            Аудит пешеходной доступности
          </h3>
          <span className="text-[10px] font-semibold text-zinc-500">ДЕЙКСТРА</span>
        </div>

        <div className="mt-3 space-y-2.5">
          <div className={innerPillCls}>
            <div className="flex items-center justify-between text-xs text-zinc-400">
              <span>К общественному транспорту</span>
              <span className={busDelta <= 0 ? 'font-bold text-emerald-400' : 'font-bold text-rose-400'}>
                {busDelta <= 0 ? `▼ ${Math.abs(busDelta)} м` : `▲ +${busDelta} м`}
              </span>
            </div>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-lg font-black text-zinc-100">{metrics.weightedAvgBusDistM} м</span>
              <span className="text-xs line-through text-zinc-500">{baseMetrics.weightedAvgBusDistM} м</span>
            </div>
          </div>

          <div className={innerPillCls}>
            <div className="flex items-center justify-between text-xs text-zinc-400">
              <span>Доступность парков (≤350м)</span>
              <span className={parkDelta >= 0 ? 'font-bold text-emerald-400' : 'font-bold text-rose-400'}>
                {parkDelta >= 0 ? `▲ +${parkDelta}%` : `▼ ${parkDelta}%`}
              </span>
            </div>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-lg font-black text-zinc-100">{metrics.parkAccessPercent}%</span>
              <span className="text-xs line-through text-zinc-500">{baseMetrics.parkAccessPercent}%</span>
            </div>
          </div>

          <div className={innerPillCls}>
            <div className="flex items-center justify-between text-xs text-zinc-400">
              <span>Доступность для МГН</span>
              <span className={metrics.mobilityIndex < 50 ? 'font-bold text-rose-400' : 'font-bold text-blue-400'}>
                {metrics.mobilityIndex}%
              </span>
            </div>
            <div className="mt-1 text-[11px] text-zinc-500">
              {metrics.mobilityIndex < 50
                ? '⚠ Подземные переходы без пандусов ограничили доступ'
                : 'Безбарьерная городская среда'}
            </div>
          </div>

          <div className={innerPillCls}>
            <div className="flex items-center justify-between text-xs text-zinc-400">
              <span>Инвестиции в благоустройство:</span>
              <span className="font-bold text-zinc-100">
                {metrics.budgetSpentRub.toLocaleString('ru-RU')} ₽
              </span>
            </div>
            <p className="mt-1 text-[10px] text-zinc-500">
              Лимит бюджета: {metrics.budgetLimitRub.toLocaleString('ru-RU')} ₽
            </p>
          </div>
        </div>

        {metrics.bottlenecks.length > 0 && (
          <div className="p-3 mt-3 text-xs text-red-200 border rounded-xl border-red-500/30 bg-red-500/10 backdrop-blur-md">
            <div className="font-bold tracking-tight uppercase">Узкие места:</div>
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