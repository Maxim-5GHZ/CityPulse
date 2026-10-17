// frontend/components/city/DistrictSidebar.tsx
'use client';

import { Building, BuildingTag, BUILDING_TAG_LABEL, GraphEdge, DistrictMetrics, PathResult } from '@/lib/city-engine/types';

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
  const schoolDelta = metrics.schoolAccessPercent - baseMetrics.schoolAccessPercent;
  // Теги корпусов (полиция/больница/магазин): дельты покрытия, как у школы.
  const serviceDeltas: { tag: BuildingTag; delta: number; value: number; base: number }[] = (
    ['police', 'hospital', 'shop'] as BuildingTag[]
  ).map((tag) => ({
    tag,
    delta: metrics[`${tag}AccessPercent`] - baseMetrics[`${tag}AccessPercent`],
    value: metrics[`${tag}AccessPercent`],
    base: baseMetrics[`${tag}AccessPercent`],
  }));
  const medianDelta = metrics.medianBusDistM - baseMetrics.medianBusDistM;
  const timeDelta = Math.round((metrics.weightedAvgBusTimeMin - baseMetrics.weightedAvgBusTimeMin) * 10) / 10;
  const budgetDelta = metrics.budgetSpentRub - baseMetrics.budgetSpentRub;

  const deltaCls = (good: boolean) =>
    good ? 'font-bold text-emerald-600 dark:text-emerald-400' : 'font-bold text-rose-600 dark:text-rose-400';

  // Строки таблицы «Было / Стало»: [подпись, было, стало, дельта-текст, хорошо ли].
  const diffRows: { label: string; before: string; after: string; delta: string; good: boolean }[] = [
    {
      label: 'Путь до остановки',
      before: `${baseMetrics.weightedAvgBusDistM} м`,
      after: `${metrics.weightedAvgBusDistM} м`,
      delta: busDelta === 0 ? '0' : `${busDelta > 0 ? '+' : ''}${busDelta} м`,
      good: busDelta <= 0,
    },
    {
      label: 'Время пешком',
      before: `${baseMetrics.weightedAvgBusTimeMin} мин`,
      after: `${metrics.weightedAvgBusTimeMin} мин`,
      delta: timeDelta === 0 ? '0' : `${timeDelta > 0 ? '+' : ''}${timeDelta} мин`,
      good: timeDelta <= 0,
    },
    {
      label: 'Медиана / p90',
      before: `${baseMetrics.medianBusDistM} м`,
      after: `${metrics.medianBusDistM} м · p90 ${metrics.p90BusDistM} м`,
      delta: medianDelta === 0 ? '0' : `${medianDelta > 0 ? '+' : ''}${medianDelta} м`,
      good: medianDelta <= 0,
    },
    {
      label: 'Парки',
      before: `${baseMetrics.parkAccessPercent}%`,
      after: `${metrics.parkAccessPercent}%`,
      delta: `${parkDelta >= 0 ? '+' : ''}${parkDelta} п.п.`,
      good: parkDelta >= 0,
    },
    {
      label: 'Школа',
      before: `${baseMetrics.schoolAccessPercent}%`,
      after: `${metrics.schoolAccessPercent}%`,
      delta: `${schoolDelta >= 0 ? '+' : ''}${schoolDelta} п.п.`,
      good: schoolDelta >= 0,
    },
    ...serviceDeltas.map((s) => ({
      label: BUILDING_TAG_LABEL[s.tag],
      before: `${s.base}%`,
      after: `${s.value}%`,
      delta: `${s.delta >= 0 ? '+' : ''}${s.delta} п.п.`,
      good: s.delta >= 0,
    })),
    {
      label: '5 / 10 мин',
      before: `${baseMetrics.iso5BusPercent}% / ${baseMetrics.iso10BusPercent}%`,
      after: `${metrics.iso5BusPercent}% / ${metrics.iso10BusPercent}%`,
      delta: `${metrics.iso5BusPercent - baseMetrics.iso5BusPercent >= 0 ? '+' : ''}${metrics.iso5BusPercent - baseMetrics.iso5BusPercent} п.п.`,
      good: metrics.iso5BusPercent - baseMetrics.iso5BusPercent >= 0,
    },
    {
      label: 'МГН',
      before: `${baseMetrics.mobilityIndex}%`,
      after: `${metrics.mobilityIndex}%`,
      delta: `${metrics.mobilityIndex - baseMetrics.mobilityIndex >= 0 ? '+' : ''}${metrics.mobilityIndex - baseMetrics.mobilityIndex} п.п.`,
      good: metrics.mobilityIndex - baseMetrics.mobilityIndex >= 0,
    },
    {
      label: 'Бюджет',
      before: `${baseMetrics.budgetSpentRub.toLocaleString('ru-RU')} ₽`,
      after: `${metrics.budgetSpentRub.toLocaleString('ru-RU')} ₽`,
      delta: budgetDelta === 0 ? '0' : `+${budgetDelta.toLocaleString('ru-RU')} ₽`,
      good: true,
    },
  ];

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
              <span>Доступность школы (≤500м)</span>
              <span className={schoolDelta >= 0 ? 'font-bold text-emerald-600 dark:text-emerald-400' : 'font-bold text-rose-600 dark:text-rose-400'}>
                {schoolDelta >= 0 ? `▲ +${schoolDelta}%` : `▼ ${schoolDelta}%`}
              </span>
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-lg font-black text-gray-900 dark:text-gray-100">{metrics.schoolAccessPercent}%</span>
              <span className="text-xs text-gray-400 line-through dark:text-gray-500">{baseMetrics.schoolAccessPercent}%</span>
            </div>
          </div>

          {serviceDeltas.map((s) => (
            <div key={s.tag} className={innerPillCls}>
              <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                <span>Доступность: {BUILDING_TAG_LABEL[s.tag].toLowerCase()} (≤500м)</span>
                <span className={s.delta >= 0 ? 'font-bold text-emerald-600 dark:text-emerald-400' : 'font-bold text-rose-600 dark:text-rose-400'}>
                  {s.delta >= 0 ? `▲ +${s.delta}%` : `▼ ${s.delta}%`}
                </span>
              </div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-lg font-black text-gray-900 dark:text-gray-100">{s.value}%</span>
                <span className="text-xs text-gray-400 line-through dark:text-gray-500">{s.base}%</span>
              </div>
            </div>
          ))}

          <div className={innerPillCls}>
            <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
              <span>Медиана / p90 до остановки</span>
              <span className={medianDelta <= 0 ? 'font-bold text-emerald-600 dark:text-emerald-400' : 'font-bold text-rose-600 dark:text-rose-400'}>
                {medianDelta <= 0 ? `▼ ${Math.abs(medianDelta)} м` : `▲ +${medianDelta} м`}
              </span>
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-lg font-black text-gray-900 dark:text-gray-100">{metrics.medianBusDistM} м</span>
              <span className="text-xs text-gray-500 dark:text-gray-400">p90 {metrics.p90BusDistM} м</span>
            </div>
            <p className="mt-1 text-[10px] text-gray-500 dark:text-gray-400">
              5 мин: {metrics.iso5BusPercent}% жителей · 10 мин: {metrics.iso10BusPercent}%
            </p>
          </div>

          <div className={innerPillCls}>
            <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
              <span>Кривизна сети (detour)</span>
              <span className="font-bold text-blue-600 dark:text-blue-400">
                {metrics.avgDetourIndex}×
              </span>
            </div>
            <p className="mt-1 text-[10px] text-gray-500 dark:text-gray-400">
              Зелень: {metrics.greenM2PerResident} м²/жит · Вело: {metrics.bikeAccessPercent}%
            </p>
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
              Лимит бюджета: {metrics.budgetLimitRub.toLocaleString('ru-RU')} ₽ ·{' '}
              {metrics.costPerCapitaRub.toLocaleString('ru-RU')} ₽/жит
            </p>
          </div>
        </div>

        <details className="mt-3 rounded-2xl border border-white/60 bg-white/30 px-3 py-2 backdrop-blur-xl dark:border-white/20 dark:bg-gray-900/30">
          <summary className="cursor-pointer text-[11px] font-bold uppercase tracking-tight text-gray-600 dark:text-gray-300">
            Как считаем
          </summary>
          <p className="mt-1 text-[11px] leading-relaxed text-gray-500 dark:text-gray-400">
            Кратчайшие пути — алгоритм Дейкстры по пешеходному графу. Скорость 4.5 км/ч (75 м/мин).
            Радиусы: остановка 500 м, парк из карточки сквера. Школа, полиция, больница и магазин —
            теги корпусов (ПКМ по дому), покрытие 500 м от калитки корпуса. Изоляция штрафуется 3000 м.
            Горлышко — участок с потоком &gt;400 чел/час. Расчёт условный, не является официальным
            прогнозом для городского планирования.
          </p>
        </details>

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

      {/* Сравнение с базой: было / стало / дельта. База = загрузка пресета или проекта.
          Детерминированный пересчёт: возврат схемы даёт Δ = 0. */}
      <div className={cardGlassCls} aria-live="polite">
        <div className="flex items-center justify-between border-b border-white/50 pb-2.5 dark:border-white/15">
          <h3 className="text-xs font-black uppercase tracking-tight text-gray-900 dark:text-gray-100">
            Было / Стало
          </h3>
          <span className="text-[10px] font-semibold text-gray-500 dark:text-gray-400">БАЗА — ЗАГРУЗКА</span>
        </div>
        <table className="mt-2 w-full border-collapse text-[11px]">
          <thead>
            <tr className="text-[10px] uppercase text-gray-500 dark:text-gray-400">
              <th scope="col" className="pb-1 text-left font-semibold">Метрика</th>
              <th scope="col" className="pb-1 text-right font-semibold">Было</th>
              <th scope="col" className="pb-1 text-right font-semibold">Стало</th>
              <th scope="col" className="pb-1 text-right font-semibold">Δ</th>
            </tr>
          </thead>
          <tbody>
            {diffRows.map((r) => (
              <tr key={r.label} className="border-t border-white/40 dark:border-white/10">
                <th scope="row" className="py-1.5 pr-1 text-left font-medium text-gray-600 dark:text-gray-300">
                  {r.label}
                </th>
                <td className="py-1.5 text-right text-gray-400 line-through dark:text-gray-500">{r.before}</td>
                <td className="py-1.5 text-right font-bold text-gray-900 dark:text-gray-100">{r.after}</td>
                <td className={`py-1.5 text-right ${deltaCls(r.good)}`}>{r.delta}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 text-[10px] text-gray-500 dark:text-gray-400">
          Верните схему как была — все Δ станут нулями: пересчёт воспроизводим.
        </p>
      </div>
    </aside>
  );
}
