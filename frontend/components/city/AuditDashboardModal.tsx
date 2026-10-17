// frontend/components/city/AuditDashboardModal.tsx
'use client';

import { useEffect, useState } from 'react';
import { DistrictMetrics } from '@/lib/city-engine/types';
import { ResidentImpactSummary } from '@/lib/city-engine/metrics';
import { cadBtn, cadBtnActive } from './cadStyles';

// Замер метрик на шаге проектирования: пишется дебаунсом при каждом
// изменении схемы (workspace), хранятся последние 12 шагов.
export interface HistorySnapshot {
  step: number;
  time: string;
  label: string;
  busDist: number;
  parkPct: number;
  schoolPct: number;
  mobilityPct: number;
  budget: number;
  // Расширенный критерий дубля: правки вело/зелени/горлышек тоже пишут шаг.
  medianBusDist: number;
  p90BusDist: number;
  greenM2: number;
  bikePct: number;
  bottlenecks: number;
  residents: number;
}

interface AuditDashboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectName: string;
  baseStamp: string;
  metrics: DistrictMetrics;
  baseMetrics: DistrictMetrics;
  impact: ResidentImpactSummary;
  history: HistorySnapshot[];
  onFixBase: () => void;
  onRollbackToBase: () => void;
}

type ChartMetric = 'busDist' | 'parkPct' | 'schoolPct' | 'mobilityPct' | 'budget';

const CHART_TABS: { key: ChartMetric; label: string; unit: string; format: (v: number) => string }[] = [
  { key: 'busDist', label: 'Транспорт (м)', unit: 'м', format: (v) => `${v} м` },
  { key: 'parkPct', label: 'Парки (%)', unit: '%', format: (v) => `${v}%` },
  { key: 'schoolPct', label: 'Школы (%)', unit: '%', format: (v) => `${v}%` },
  { key: 'mobilityPct', label: 'МГН (%)', unit: '%', format: (v) => `${v}%` },
  {
    key: 'budget',
    label: 'Бюджет (₽)',
    unit: '₽',
    format: (v) => (v === 0 ? '0 ₽' : `${Math.round(v / 1000).toLocaleString('ru-RU')} тыс. ₽`),
  },
];

export default function AuditDashboardModal({
  isOpen,
  onClose,
  projectName,
  baseStamp,
  metrics,
  baseMetrics,
  impact,
  history,
  onFixBase,
  onRollbackToBase,
}: AuditDashboardModalProps) {
  const [activeChartMetric, setActiveChartMetric] = useState<ChartMetric>('busDist');

  // Закрытие по Escape + лок скролла страницы под оверлеем (чистится при размонтировании).
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const busDelta = metrics.weightedAvgBusDistM - baseMetrics.weightedAvgBusDistM;
  const parkDelta = metrics.parkAccessPercent - baseMetrics.parkAccessPercent;
  const schoolDelta = metrics.schoolAccessPercent - baseMetrics.schoolAccessPercent;
  const budgetDelta = metrics.budgetSpentRub - baseMetrics.budgetSpentRub;

  // Строки «Было / Стало»: агрегаты проекта (расстояния, жители, бюджет).
  type CompareTone = 'good' | 'bad' | 'neutral';
  interface CompareRow { label: string; before: string; after: string; delta: string; tone: CompareTone }
  const signed = (d: number, unit: string) => (d === 0 ? '0' : `${d > 0 ? '+' : '−'}${Math.abs(d).toLocaleString('ru-RU')}${unit}`);
  const beforeAfterRows: CompareRow[] = [
    {
      label: 'Средний путь до остановки',
      before: `${baseMetrics.weightedAvgBusDistM.toLocaleString('ru-RU')} м`,
      after: `${metrics.weightedAvgBusDistM.toLocaleString('ru-RU')} м`,
      delta: signed(busDelta, ' м'),
      tone: busDelta === 0 ? 'neutral' : busDelta < 0 ? 'good' : 'bad',
    },
    {
      label: 'Медиана / p90 пути',
      before: `${baseMetrics.medianBusDistM.toLocaleString('ru-RU')} / ${baseMetrics.p90BusDistM.toLocaleString('ru-RU')} м`,
      after: `${metrics.medianBusDistM.toLocaleString('ru-RU')} / ${metrics.p90BusDistM.toLocaleString('ru-RU')} м`,
      delta: signed(metrics.medianBusDistM - baseMetrics.medianBusDistM, ' м'),
      tone: metrics.medianBusDistM === baseMetrics.medianBusDistM ? 'neutral' : metrics.medianBusDistM < baseMetrics.medianBusDistM ? 'good' : 'bad',
    },
    {
      label: 'Время пешком',
      before: `${baseMetrics.weightedAvgBusTimeMin} мин`,
      after: `${metrics.weightedAvgBusTimeMin} мин`,
      delta: signed(Math.round((metrics.weightedAvgBusTimeMin - baseMetrics.weightedAvgBusTimeMin) * 10) / 10, ' мин'),
      tone: metrics.weightedAvgBusTimeMin === baseMetrics.weightedAvgBusTimeMin ? 'neutral' : metrics.weightedAvgBusTimeMin < baseMetrics.weightedAvgBusTimeMin ? 'good' : 'bad',
    },
    {
      label: 'Жители',
      before: `${baseMetrics.totalResidents.toLocaleString('ru-RU')} чел.`,
      after: `${metrics.totalResidents.toLocaleString('ru-RU')} чел.`,
      delta: signed(metrics.totalResidents - baseMetrics.totalResidents, ' чел.'),
      tone: 'neutral',
    },
    {
      label: 'Зелень на жителя',
      before: `${baseMetrics.greenM2PerResident} м²`,
      after: `${metrics.greenM2PerResident} м²`,
      delta: signed(Math.round((metrics.greenM2PerResident - baseMetrics.greenM2PerResident) * 10) / 10, ' м²'),
      tone: metrics.greenM2PerResident === baseMetrics.greenM2PerResident ? 'neutral' : metrics.greenM2PerResident > baseMetrics.greenM2PerResident ? 'good' : 'bad',
    },
    {
      label: 'Узкие места трафика',
      before: `${baseMetrics.bottlenecks.length}`,
      after: `${metrics.bottlenecks.length}`,
      delta: signed(metrics.bottlenecks.length - baseMetrics.bottlenecks.length, ''),
      tone: metrics.bottlenecks.length === baseMetrics.bottlenecks.length ? 'neutral' : metrics.bottlenecks.length < baseMetrics.bottlenecks.length ? 'good' : 'bad',
    },
    {
      label: 'Бюджет сессии',
      before: `${baseMetrics.budgetSpentRub.toLocaleString('ru-RU')} ₽`,
      after: `${metrics.budgetSpentRub.toLocaleString('ru-RU')} ₽`,
      delta: signed(budgetDelta, ' ₽'),
      tone: 'neutral',
    },
  ];

  // Аудит пешеходной доступности: покрытие по каждому сервису (Дейкстра,
  // собственный радиус точки). Дельта в процентных пунктах, хорошо — рост.
  interface AccessRow { label: string; before: number; after: number; residents: string }
  const accessRows: AccessRow[] = [
    { label: 'Остановки · 5 мин', before: baseMetrics.iso5BusPercent, after: metrics.iso5BusPercent, residents: `${Math.round((metrics.iso5BusPercent / 100) * metrics.totalResidents).toLocaleString('ru-RU')} чел.` },
    { label: 'Остановки · 10 мин', before: baseMetrics.iso10BusPercent, after: metrics.iso10BusPercent, residents: `${Math.round((metrics.iso10BusPercent / 100) * metrics.totalResidents).toLocaleString('ru-RU')} чел.` },
    { label: 'Скверы', before: baseMetrics.parkAccessPercent, after: metrics.parkAccessPercent, residents: `${metrics.parkCoveredResidents.toLocaleString('ru-RU')} из ${metrics.totalResidents.toLocaleString('ru-RU')} чел.` },
    { label: 'Школа', before: baseMetrics.schoolAccessPercent, after: metrics.schoolAccessPercent, residents: `${metrics.schoolCoveredResidents.toLocaleString('ru-RU')} из ${metrics.totalResidents.toLocaleString('ru-RU')} чел.` },
    { label: 'Полиция', before: baseMetrics.policeAccessPercent, after: metrics.policeAccessPercent, residents: `${metrics.policeCoveredResidents.toLocaleString('ru-RU')} из ${metrics.totalResidents.toLocaleString('ru-RU')} чел.` },
    { label: 'Медицина', before: baseMetrics.hospitalAccessPercent, after: metrics.hospitalAccessPercent, residents: `${metrics.hospitalCoveredResidents.toLocaleString('ru-RU')} из ${metrics.totalResidents.toLocaleString('ru-RU')} чел.` },
    { label: 'Магазины', before: baseMetrics.shopAccessPercent, after: metrics.shopAccessPercent, residents: `${metrics.shopCoveredResidents.toLocaleString('ru-RU')} из ${metrics.totalResidents.toLocaleString('ru-RU')} чел.` },
    { label: 'Безбарьерность (МГН)', before: baseMetrics.mobilityIndex, after: metrics.mobilityIndex, residents: 'доля домов с доступным путём' },
  ];
  const toneTextCls = (tone: CompareTone) =>
    tone === 'good'
      ? 'text-emerald-600 dark:text-emerald-400'
      : tone === 'bad'
        ? 'text-rose-600 dark:text-rose-400'
        : 'text-gray-500 dark:text-gray-400';

  // Оценки 0–100 для 6 сфер городской среды (сырые значения — рядом).
  const domains = [
    { label: 'Транспорт', score: Math.max(0, Math.min(100, Math.round(100 - metrics.weightedAvgBusDistM / 6))), raw: `${metrics.weightedAvgBusDistM} м`, color: '#3b82f6' },
    { label: 'Зелёные зоны', score: metrics.parkAccessPercent, raw: `${metrics.parkAccessPercent}%`, color: '#10b981' },
    { label: 'Школы', score: metrics.schoolAccessPercent, raw: `${metrics.schoolAccessPercent}%`, color: '#d97706' },
    { label: 'Полиция', score: metrics.policeAccessPercent, raw: `${metrics.policeAccessPercent}%`, color: '#2563eb' },
    { label: 'Медицина', score: metrics.hospitalAccessPercent, raw: `${metrics.hospitalAccessPercent}%`, color: '#475569' },
    { label: 'Среда МГН', score: metrics.mobilityIndex, raw: `${metrics.mobilityIndex}%`, color: '#8b5cf6' },
  ];

  // SVG-график истории: пустая история = две точки «ДО → сейчас», чтобы
  // кривая читалась даже в свежем проекте.
  const chartWidth = 580;
  const chartHeight = 160;
  const paddingX = 36;
  const paddingY = 24;

  const chartData: HistorySnapshot[] =
    history.length > 0
      ? history
      : [
          { step: 1, time: 'ДО', label: 'База', busDist: baseMetrics.weightedAvgBusDistM, parkPct: baseMetrics.parkAccessPercent, schoolPct: baseMetrics.schoolAccessPercent, mobilityPct: baseMetrics.mobilityIndex, budget: baseMetrics.budgetSpentRub, medianBusDist: baseMetrics.medianBusDistM, p90BusDist: baseMetrics.p90BusDistM, greenM2: baseMetrics.greenM2PerResident, bikePct: baseMetrics.bikeAccessPercent, bottlenecks: baseMetrics.bottlenecks.length, residents: baseMetrics.totalResidents },
          { step: 2, time: 'Сейчас', label: 'Проект', busDist: metrics.weightedAvgBusDistM, parkPct: metrics.parkAccessPercent, schoolPct: metrics.schoolAccessPercent, mobilityPct: metrics.mobilityIndex, budget: metrics.budgetSpentRub, medianBusDist: metrics.medianBusDistM, p90BusDist: metrics.p90BusDistM, greenM2: metrics.greenM2PerResident, bikePct: metrics.bikeAccessPercent, bottlenecks: metrics.bottlenecks.length, residents: metrics.totalResidents },
        ];

  const activeTab = CHART_TABS.find((t) => t.key === activeChartMetric) ?? CHART_TABS[0];
  const values = chartData.map((d) => d[activeChartMetric]);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const valSpan = maxVal - minVal || 1;

  const points = chartData.map((d, idx) => {
    const x = paddingX + (idx / Math.max(1, chartData.length - 1)) * (chartWidth - paddingX * 2);
    const normalized = (d[activeChartMetric] - minVal) / valSpan;
    const y = chartHeight - paddingY - normalized * (chartHeight - paddingY * 2);
    return { x, y, ...d };
  });

  const svgPathD = points.reduce((acc, p, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`, '');
  const areaPathD =
    points.length > 1
      ? `${svgPathD} L ${points[points.length - 1].x} ${chartHeight - paddingY} L ${points[0].x} ${chartHeight - paddingY} Z`
      : '';

  // Алгоритмические выводы — только из реальных метрик, без выдумок.
  const coverages = [
    { label: 'скверы', value: metrics.parkAccessPercent },
    { label: 'школы', value: metrics.schoolAccessPercent },
    { label: 'полиция', value: metrics.policeAccessPercent },
    { label: 'медицина', value: metrics.hospitalAccessPercent },
    { label: 'магазины', value: metrics.shopAccessPercent },
  ];
  const weakest = coverages.reduce((a, b) => (b.value < a.value ? b : a));
  const recommendations: { tone: 'good' | 'warn' | 'bad'; text: string }[] = [];
  if (impact.worsenedResidents === 0 && impact.improvedResidents > 0) {
    recommendations.push({ tone: 'good', text: `Ни один житель не проиграл от изменений, выиграли ${impact.improvedResidents} чел.` });
  } else if (impact.worsenedResidents > impact.improvedResidents) {
    recommendations.push({ tone: 'bad', text: `Проигравших больше, чем выигравших: ${impact.worsenedResidents} против ${impact.improvedResidents} чел. — проверьте красные корпуса в режиме «Дифф».` });
  } else if (impact.worsenedResidents > 0) {
    recommendations.push({ tone: 'warn', text: `В минусе ${impact.worsenedResidents} чел. (макс. +${impact.maxLossMeters} м) — детали по домам в сайдбаре.` });
  } else {
    recommendations.push({ tone: 'good', text: 'Баланс жителей не изменился: пути в пределах шума ±5 м.' });
  }
  if (metrics.mobilityIndex < 100) {
    recommendations.push({ tone: 'warn', text: `Безбарьерность ${metrics.mobilityIndex}%: часть путей идёт через подземные переходы — замените их зебрами у домов МГН.` });
  } else {
    recommendations.push({ tone: 'good', text: 'Все пешеходные пути доступны МГН (100%).' });
  }
  if (weakest.value < 100) {
    recommendations.push({ tone: 'warn', text: `Самое слабое покрытие — ${weakest.label}: ${weakest.value}%. Точка роста — ПКМ по дому → тег соцобъекта.` });
  } else {
    recommendations.push({ tone: 'good', text: 'Покрытие по всем пяти сервисам — 100% жителей.' });
  }
  for (const b of metrics.bottlenecks.slice(0, 3)) {
    recommendations.push({ tone: 'warn', text: `Узкое место: ${b.description} (нагрузка ${b.load} чел.).` });
  }
  if (metrics.bottlenecks.length === 0) {
    recommendations.push({ tone: 'good', text: 'Перегруженных рёбер нет — потоки распределены равномерно.' });
  }

  const toneCls = (tone: 'good' | 'warn' | 'bad') =>
    tone === 'good'
      ? 'text-emerald-600 dark:text-emerald-400'
      : tone === 'bad'
        ? 'text-rose-600 dark:text-rose-400'
        : 'text-amber-600 dark:text-amber-400';
  const toneMark = (tone: 'good' | 'warn' | 'bad') => (tone === 'good' ? '✓' : '⚠️');

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#141a26]/40 p-3 backdrop-blur-md motion-safe:animate-fade-in sm:p-5 dark:bg-black/60"
      onClick={onClose}
    >
      <div
        className="relative max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-[32px] border border-white/60 bg-white/75 p-5 shadow-[inset_1px_1px_2px_rgba(255,255,255,0.9),0_24px_60px_-16px_rgba(20,26,38,0.4)] backdrop-blur-2xl backdrop-saturate-150 md:p-8 dark:border-white/20 dark:bg-gray-900/80 dark:text-gray-100"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Аналитический аудит района"
      >
        {/* Шапка модалки */}
        <div className="flex items-start justify-between gap-3 border-b border-white/60 pb-4 dark:border-white/15">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-blue-600/10 px-2.5 py-0.5 font-mono text-[11px] font-bold text-blue-600 dark:bg-blue-400/10 dark:text-blue-300">
                ГРАДОСТРОИТЕЛЬНЫЙ АУДИТ 2040
              </span>
              <span className="text-xs text-gray-400">•</span>
              <span className="text-xs text-gray-500 dark:text-gray-400">{baseStamp}</span>
            </div>
            <h2 className="mt-1 truncate text-xl font-black tracking-tight text-gray-900 sm:text-2xl dark:text-gray-100">
              {projectName}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/60 bg-white/50 text-gray-500 shadow-sm transition-all duration-200 ease-out hover:scale-[1.05] active:scale-[0.98] motion-reduce:transform-none motion-reduce:transition-none dark:border-white/20 dark:bg-white/10 dark:text-gray-300"
            aria-label="Закрыть аналитику"
            title="Закрыть аналитику"
          >
            ✕
          </button>
        </div>

        {/* Сводные KPI-карточки */}
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-2xl border border-white/60 bg-white/40 p-3 shadow-sm dark:border-white/10 dark:bg-white/5">
            <div className="text-[10px] font-bold uppercase text-gray-500 dark:text-gray-400">Путь к транспорту</div>
            <div className="mt-1 flex flex-wrap items-baseline gap-1.5">
              <span className="text-xl font-black text-gray-900 dark:text-white">{metrics.weightedAvgBusDistM} м</span>
              <span className={`text-xs font-bold ${busDelta <= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                {busDelta <= 0 ? `▼ ${Math.abs(busDelta)}` : `▲ +${busDelta}`}
              </span>
            </div>
            <div className="text-[10px] text-gray-500 dark:text-gray-400">~{metrics.weightedAvgBusTimeMin} мин пешком</div>
          </div>

          <div className="rounded-2xl border border-white/60 bg-white/40 p-3 shadow-sm dark:border-white/10 dark:bg-white/5">
            <div className="text-[10px] font-bold uppercase text-gray-500 dark:text-gray-400">Охват скверами</div>
            <div className="mt-1 flex flex-wrap items-baseline gap-1.5">
              <span className="text-xl font-black text-gray-900 dark:text-white">{metrics.parkAccessPercent}%</span>
              <span className={`text-xs font-bold ${parkDelta >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                {parkDelta >= 0 ? `▲ +${parkDelta}%` : `▼ ${parkDelta}%`}
              </span>
            </div>
            <div className="text-[10px] text-gray-500 dark:text-gray-400">{metrics.parkCoveredResidents} из {metrics.totalResidents} чел.</div>
          </div>

          <div className="rounded-2xl border border-white/60 bg-white/40 p-3 shadow-sm dark:border-white/10 dark:bg-white/5">
            <div className="text-[10px] font-bold uppercase text-gray-500 dark:text-gray-400">Школы и сервисы</div>
            <div className="mt-1 flex flex-wrap items-baseline gap-1.5">
              <span className="text-xl font-black text-gray-900 dark:text-white">{metrics.schoolAccessPercent}%</span>
              <span className={`text-xs font-bold ${schoolDelta >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                {schoolDelta >= 0 ? `▲ +${schoolDelta}%` : `▼ ${schoolDelta}%`}
              </span>
            </div>
            <div className="text-[10px] text-gray-500 dark:text-gray-400">Радиус ≤500м</div>
          </div>

          <div className="rounded-2xl border border-white/60 bg-white/40 p-3 shadow-sm dark:border-white/10 dark:bg-white/5">
            <div className="text-[10px] font-bold uppercase text-gray-500 dark:text-gray-400">Инвестиции</div>
            <div className="mt-1 text-base font-black text-gray-900 sm:text-lg dark:text-white">
              {metrics.budgetSpentRub.toLocaleString('ru-RU')} ₽
            </div>
            <div className="text-[10px] text-gray-500 dark:text-gray-400">
              Лимит: {metrics.budgetLimitRub.toLocaleString('ru-RU')} ₽
              {budgetDelta !== 0 && (
                <span className={`font-bold ${budgetDelta > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                  {' '}({budgetDelta > 0 ? '+' : ''}{budgetDelta.toLocaleString('ru-RU')} к ДО)
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Было / Стало: сравнение с зафиксированным ДО */}
        <div className="mt-5 rounded-3xl border border-white/60 bg-white/40 p-4 shadow-sm dark:border-white/10 dark:bg-white/5">
          <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-white/40 pb-2 dark:border-white/10">
            <h3 className="text-xs font-black uppercase tracking-tight text-gray-900 dark:text-gray-100">
              Было / Стало
            </h3>
            <span className="font-mono text-[10px] text-gray-400">база: {baseStamp}</span>
          </div>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[420px] text-xs">
              <thead>
                <tr className="text-left text-[10px] font-bold uppercase text-gray-500 dark:text-gray-400">
                  <th className="py-1.5 pr-2 font-bold">Показатель</th>
                  <th className="py-1.5 pr-2 text-right font-bold">Было</th>
                  <th className="py-1.5 pr-2 text-right font-bold">Стало</th>
                  <th className="py-1.5 text-right font-bold">Δ</th>
                </tr>
              </thead>
              <tbody>
                {beforeAfterRows.map((r) => (
                  <tr key={r.label} className="border-t border-white/50 dark:border-white/10">
                    <td className="py-1.5 pr-2 font-semibold text-gray-700 dark:text-gray-200">{r.label}</td>
                    <td className="py-1.5 pr-2 text-right tabular-nums text-gray-500 dark:text-gray-400">{r.before}</td>
                    <td className="py-1.5 pr-2 text-right font-bold tabular-nums text-gray-900 dark:text-gray-100">{r.after}</td>
                    <td className={`py-1.5 text-right font-black tabular-nums ${toneTextCls(r.tone)}`}>{r.delta}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Пешеходная доступность: покрытие по сервисам (Дейкстра + радиусы) */}
        <div className="mt-5 rounded-3xl border border-white/60 bg-white/40 p-4 shadow-sm dark:border-white/10 dark:bg-white/5">
          <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-white/40 pb-2 dark:border-white/10">
            <h3 className="text-xs font-black uppercase tracking-tight text-gray-900 dark:text-gray-100">
              Пешеходная доступность
            </h3>
            <span className="text-[10px] text-gray-500 dark:text-gray-400">Δ — в процентных пунктах к ДО</span>
          </div>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[420px] text-xs">
              <thead>
                <tr className="text-left text-[10px] font-bold uppercase text-gray-500 dark:text-gray-400">
                  <th className="py-1.5 pr-2 font-bold">Сервис</th>
                  <th className="py-1.5 pr-2 text-right font-bold">Было</th>
                  <th className="py-1.5 pr-2 text-right font-bold">Стало</th>
                  <th className="py-1.5 pr-2 text-right font-bold">Δ</th>
                  <th className="py-1.5 text-right font-bold">Охват</th>
                </tr>
              </thead>
              <tbody>
                {accessRows.map((r) => {
                  const d = r.after - r.before;
                  const tone: CompareTone = d === 0 ? 'neutral' : d > 0 ? 'good' : 'bad';
                  return (
                    <tr key={r.label} className="border-t border-white/50 dark:border-white/10">
                      <td className="py-1.5 pr-2 font-semibold text-gray-700 dark:text-gray-200">{r.label}</td>
                      <td className="py-1.5 pr-2 text-right tabular-nums text-gray-500 dark:text-gray-400">{r.before}%</td>
                      <td className="py-1.5 pr-2 text-right font-bold tabular-nums text-gray-900 dark:text-gray-100">{r.after}%</td>
                      <td className={`py-1.5 pr-2 text-right font-black tabular-nums ${toneTextCls(tone)}`}>
                        {d === 0 ? '0' : `${d > 0 ? '+' : '−'}${Math.abs(d)} п.п.`}
                      </td>
                      <td className="py-1.5 text-right text-[11px] tabular-nums text-gray-500 dark:text-gray-400">{r.residents}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* График динамики решений */}
        <div className="mt-5 rounded-3xl border border-white/60 bg-white/40 p-4 shadow-sm dark:border-white/10 dark:bg-white/5">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/40 pb-2.5 dark:border-white/10">
            <div>
              <h3 className="text-xs font-black uppercase tracking-tight text-gray-900 dark:text-gray-100">
                Динамика решений по шагам проектирования
              </h3>
              <p className="text-[11px] text-gray-500 dark:text-gray-400">
                Замеры алгоритма Дейкстры при каждом изменении схемы
              </p>
            </div>
            <div className="flex flex-wrap gap-1">
              {CHART_TABS.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setActiveChartMetric(t.key)}
                  className={activeChartMetric === t.key ? cadBtnActive : cadBtn}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-3 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="h-40 w-full min-w-[460px] overflow-visible" role="img" aria-label={`График метрики: ${activeTab.label}`}>
              <defs>
                <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.35" />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Направляющие + подписи шкалы */}
              <line x1={paddingX} y1={chartHeight - paddingY} x2={chartWidth - paddingX} y2={chartHeight - paddingY} stroke="#94a3b8" strokeWidth="1" strokeDasharray="4 4" />
              <line x1={paddingX} y1={paddingY} x2={chartWidth - paddingX} y2={paddingY} stroke="#94a3b8" strokeWidth="1" strokeDasharray="4 4" />
              <text x={paddingX - 4} y={paddingY + 3} textAnchor="end" fill="#64748b" fontSize="9" fontFamily="monospace">
                {activeTab.format(maxVal)}
              </text>
              <text x={paddingX - 4} y={chartHeight - paddingY + 3} textAnchor="end" fill="#64748b" fontSize="9" fontFamily="monospace">
                {activeTab.format(minVal)}
              </text>

              {/* Заливка области */}
              {areaPathD && <path d={areaPathD} fill="url(#chartGradient)" />}

              {/* Кривая */}
              <path d={svgPathD} fill="none" stroke="#2563eb" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

              {/* Точки шагов */}
              {points.map((p, idx) => (
                <g key={idx}>
                  <circle cx={p.x} cy={p.y} r="4.5" fill="#ffffff" stroke="#2563eb" strokeWidth="2" />
                  <text x={p.x} y={p.y - 8} textAnchor="middle" fill="#1e293b" fontSize="10" fontWeight="700" className="dark:fill-gray-100">
                    {activeTab.format(p[activeChartMetric])}
                  </text>
                  <text x={p.x} y={chartHeight - 6} textAnchor="middle" fill="#64748b" fontSize="9" fontFamily="monospace">
                    #{p.step} {p.time}
                  </text>
                </g>
              ))}
            </svg>
          </div>
        </div>

        {/* Радар сфер и баланс жителей */}
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {/* Столбцы сфер доступности */}
          <div className="rounded-3xl border border-white/60 bg-white/40 p-4 shadow-sm dark:border-white/10 dark:bg-white/5">
            <h3 className="border-b border-white/40 pb-2 text-xs font-black uppercase tracking-tight text-gray-900 dark:border-white/10 dark:text-gray-100">
              Баланс городской среды (15-минутный район)
            </h3>
            <div className="mt-3 space-y-2.5">
              {domains.map((dom) => (
                <div key={dom.label} className="space-y-1">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-gray-700 dark:text-gray-200">{dom.label}</span>
                    <span className="font-bold text-gray-900 dark:text-gray-100">{dom.raw}</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200/60 dark:bg-gray-700/60">
                    <div
                      style={{ width: `${Math.min(100, Math.max(0, dom.score))}%`, backgroundColor: dom.color }}
                      className="h-full rounded-full transition-all duration-300"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Баланс жителей */}
          <div className="rounded-3xl border border-white/60 bg-white/40 p-4 shadow-sm dark:border-white/10 dark:bg-white/5">
            <h3 className="border-b border-white/40 pb-2 text-xs font-black uppercase tracking-tight text-gray-900 dark:border-white/10 dark:text-gray-100">
              Социальный аудит: выигрыш жителей
            </h3>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-2">
                <div className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400">В плюсе</div>
                <div className="text-lg font-black text-emerald-600 dark:text-emerald-400">{impact.improvedResidents}</div>
                <div className="text-[9px] text-gray-500">человек</div>
              </div>
              <div className="rounded-2xl border border-gray-400/20 bg-gray-400/10 p-2">
                <div className="text-[10px] font-bold text-gray-600 dark:text-gray-300">Без изм.</div>
                <div className="text-lg font-black text-gray-700 dark:text-gray-200">{impact.unchangedResidents}</div>
                <div className="text-[9px] text-gray-500">человек</div>
              </div>
              <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-2">
                <div className="text-[10px] font-bold text-rose-700 dark:text-rose-400">В минусе</div>
                <div className="text-lg font-black text-rose-600 dark:text-rose-400">{impact.worsenedResidents}</div>
                <div className="text-[9px] text-gray-500">человек</div>
              </div>
            </div>

            <div className="mt-3 space-y-1.5 text-xs text-gray-600 dark:text-gray-300">
              {impact.maxSavedMeters > 0 && (
                <div className="flex items-center gap-1.5 font-semibold text-emerald-600 dark:text-emerald-400">
                  <span>✓</span> Максимальный выигрыш дома: −{impact.maxSavedMeters} м пешком
                </div>
              )}
              {impact.maxLossMeters > 0 && (
                <div className="flex items-center gap-1.5 font-semibold text-rose-600 dark:text-rose-400">
                  <span>⚠️</span> Максимальный проигрыш дома: +{impact.maxLossMeters} м пешком
                </div>
              )}
              {metrics.bottlenecks.length > 0 && (
                <div className="flex items-center gap-1.5 font-semibold text-amber-600 dark:text-amber-400">
                  <span>⚠️</span> Обнаружено узких мест пешеходного трафика: {metrics.bottlenecks.length}
                </div>
              )}
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" onClick={onFixBase} className={cadBtn}>
                📌 Зафиксировать «ДО»
              </button>
              <button type="button" onClick={onRollbackToBase} className={cadBtn}>
                ↩ Откатить к «ДО»
              </button>
            </div>
          </div>
        </div>

        {/* Выводы алгоритма: узкие места, безбарьерность, баланс */}
        <div className="mt-5 rounded-3xl border border-white/60 bg-white/40 p-4 shadow-sm dark:border-white/10 dark:bg-white/5">
          <h3 className="border-b border-white/40 pb-2 text-xs font-black uppercase tracking-tight text-gray-900 dark:border-white/10 dark:text-gray-100">
            Выводы алгоритма
          </h3>
          <ul className="mt-2.5 space-y-1.5 text-xs leading-relaxed text-gray-700 dark:text-gray-200">
            {recommendations.map((r, i) => (
              <li key={i} className="flex items-start gap-1.5">
                <span className={`font-black ${toneCls(r.tone)}`}>{toneMark(r.tone)}</span>
                <span>{r.text}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Футер с кнопкой закрытия */}
        <div className="mt-6 flex justify-end border-t border-white/60 pt-4 dark:border-white/15">
          <button type="button" onClick={onClose} className={cadBtnActive}>
            Вернуться к чертежу
          </button>
        </div>
      </div>
    </div>
  );
}
