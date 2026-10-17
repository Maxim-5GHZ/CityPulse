'use client';

import { useState } from 'react';

const cases = [
  {
    title: 'Оценка обеспеченности ЖК',
    text: 'Квартал на 1 200 жителей: проверка пути до остановок, парков и поликлиник.',
    traditional: {
      status: 'НЕДЕЛИ ОЖИДАНИЯ',
      reason: 'Выгрузка генплана в ГИС, ручная оцифровка тротуаров и создание буферов доступности специалистами.',
      tone: 'text-rose-700 dark:text-rose-400',
      bg: 'border-rose-300/80 bg-rose-100/90 dark:border-rose-800/60 dark:bg-rose-950/50',
    },
    citypulse: {
      status: '15 СЕКУНД',
      reason: 'Мгновенный топологический граф Дейкстры: сразу виден путь M1, охват школами M2 и время в пути пешком.',
      tone: 'text-emerald-700 dark:text-emerald-400',
      bg: 'border-emerald-300/80 bg-emerald-100/90 dark:border-emerald-800/60 dark:bg-emerald-950/50',
    },
  },
  {
    title: 'Капремонт и разрыв УДС',
    text: 'Перекрытие центрального перекрёстка на 4 месяца.',
    traditional: {
      status: 'СЛЕПАЯ ЗОНА',
      reason: 'Сложно оперативно оценить обходные пути — жители вытаптывают газоны и срезают по проезжей части.',
      tone: 'text-rose-700 dark:text-rose-400',
      bg: 'border-rose-300/80 bg-rose-100/90 dark:border-rose-800/60 dark:bg-rose-950/50',
    },
    citypulse: {
      status: 'АУДИТ ОБХОДОВ',
      reason: 'Один клик выключает ребро: алгоритм мгновенно находит перегрузки дублёров и предлагает створ для новой зебры.',
      tone: 'text-emerald-700 dark:text-emerald-400',
      bg: 'border-emerald-300/80 bg-emerald-100/90 dark:border-emerald-800/60 dark:bg-emerald-950/50',
    },
  },
  {
    title: 'Размещение сквера и школы',
    text: 'Поиск оптимального створа с радиусом доступности до 400 метров.',
    traditional: {
      status: 'ПРИБЛИЗИТЕЛЬНО',
      reason: 'Радиусы «по воздуху» (окружности) не учитывают глухие заборы и скоростные шоссе.',
      tone: 'text-rose-700 dark:text-rose-400',
      bg: 'border-rose-300/80 bg-rose-100/90 dark:border-rose-800/60 dark:bg-rose-950/50',
    },
    citypulse: {
      status: 'ТОЧНЫЙ ОХВАТ M2',
      reason: 'Честный пешеходный граф: точный подсчёт доли охваченных жителей с учетом реальной длины тротуаров.',
      tone: 'text-emerald-700 dark:text-emerald-400',
      bg: 'border-emerald-300/80 bg-emerald-100/90 dark:border-emerald-800/60 dark:bg-emerald-950/50',
    },
  },
];

export default function CadComparisonSimulator() {
  const [activeCase, setActiveCase] = useState(0);
  const current = cases[activeCase];

  return (
    <div className="w-full max-w-4xl rounded-[32px] border border-white/60 bg-white/70 p-5 shadow-[inset_1px_1px_2px_rgba(255,255,255,0.9),0_24px_60px_-16px_rgba(20,26,38,0.35)] backdrop-blur-2xl backdrop-saturate-200 sm:p-6 dark:border-white/20 dark:bg-gray-900/70">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-12">
        <div className="flex flex-col gap-3 md:col-span-5">
          <div className="mb-1 text-xs font-black uppercase tracking-wider text-gray-800 dark:text-gray-200">
            Сценарий аудита инфраструктуры:
          </div>
          {cases.map((c, i) => {
            const isSel = activeCase === i;
            return (
              <button
                key={c.title}
                type="button"
                onClick={() => setActiveCase(i)}
                className={`transform-gpu rounded-2xl border px-4 py-3 text-left transition-all duration-200 ease-out hover:scale-[1.02] active:scale-[0.98] motion-reduce:transform-none motion-reduce:transition-none ${
                  isSel
                    ? 'border-blue-500 bg-blue-50 text-gray-900 shadow-md dark:border-blue-400/50 dark:bg-blue-900/30 dark:text-white'
                    : 'border-white/80 bg-white/50 text-gray-700 hover:bg-white/80 dark:border-white/10 dark:bg-gray-800/40 dark:text-gray-300 dark:hover:bg-gray-800/60'
                }`}
              >
                <div className="text-sm font-black">{c.title}</div>
                <div className="mt-1 line-clamp-2 text-xs font-medium text-gray-600 dark:text-gray-400">{c.text}</div>
              </button>
            );
          })}
        </div>

        <div className="flex flex-col gap-4 md:col-span-7">
          <div className="rounded-2xl border border-white/80 bg-white/80 p-4 font-mono text-sm font-semibold text-gray-800 shadow-sm backdrop-blur-md dark:border-white/20 dark:bg-gray-800/80 dark:text-gray-200">
            <span className="font-black text-blue-600 dark:text-blue-400">&gt; Задача:</span> {current.text}
          </div>

          <div className="grid h-full grid-cols-1 gap-4 sm:grid-cols-2">
            <div className={`flex flex-col justify-between rounded-2xl border p-5 backdrop-blur-md ${current.traditional.bg}`}>
              <div>
                <span className="text-balance text-[11px] font-black uppercase leading-snug tracking-wider text-gray-600 dark:text-gray-400">
                  Традиционные ГИС
                </span>
                <div lang="ru" className={`mt-2 hyphens-auto break-words text-lg font-black leading-tight tracking-tight sm:text-xl ${current.traditional.tone}`}>
                  {current.traditional.status}
                </div>
              </div>
              <div className="mt-4 border-t border-black/10 pt-3 text-xs font-medium leading-relaxed text-gray-800 dark:border-white/20 dark:text-gray-200">
                {current.traditional.reason}
              </div>
            </div>

            <div className={`flex flex-col justify-between rounded-2xl border p-5 backdrop-blur-md ${current.citypulse.bg}`}>
              <div>
                <span className="text-balance text-[11px] font-black uppercase leading-snug tracking-wider text-blue-800 dark:text-blue-300">
                  Скоростной САПР «Пульса Города»
                </span>
                <div lang="ru" className={`mt-2 hyphens-auto break-words text-lg font-black leading-tight tracking-tight sm:text-xl ${current.citypulse.tone}`}>
                  {current.citypulse.status}
                </div>
              </div>
              <div className="mt-4 border-t border-black/10 pt-3 text-xs font-medium leading-relaxed text-gray-900 dark:border-white/20 dark:text-gray-100">
                {current.citypulse.reason}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
