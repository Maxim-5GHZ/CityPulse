'use client';

import { useState } from 'react';

const steps = [
  {
    title: '1. Эскиз и посадка объёмов',
    desc: 'Посадка корпусов.',
    danger: 'На глаз: тупики, 800+ м до остановки.',
    safe: 'Привязка подъезда к графу. M1 при перетаскивании.',
  },
  {
    title: '2. Пешеходный каркас и зебры',
    desc: 'Тротуары и зебры.',
    danger: 'Связи по остатку: перебегают дорогу.',
    safe: 'Теплокарта потока подскажет створ зебры.',
  },
  {
    title: '3. Стресс-тест и ремонты',
    desc: 'Перекрытия.',
    danger: 'Ремонт режет квартал от транспорта.',
    safe: '«Ремонт» проверит дублёры до выхода техники.',
  },
  {
    title: '4. Экспертиза и утверждение ТЭП',
    desc: 'Экспертиза и ТЭП.',
    danger: 'Недели согласований, срыв сроков.',
    safe: 'Отчёт «Было / Стало» с доказательством 15 минут.',
  },
];

const indents = ['md:ml-0', 'md:ml-[8%]', 'md:ml-[16%]', 'md:ml-[24%]'];

export default function UrbanJourneyStaircase() {
  const [activeStep, setActiveStep] = useState(0);

  return (
    <div className="flex w-full max-w-5xl flex-col items-center gap-6 rounded-[32px] border border-white/60 bg-white/40 p-5 shadow-[inset_1px_1px_2px_rgba(255,255,255,0.8),inset_-1px_-1px_2px_rgba(0,0,0,0.05),0_24px_60px_-16px_rgba(20,26,38,0.35)] backdrop-blur-xl md:flex-row md:p-6 dark:border-white/20 dark:bg-gray-900/40">
      <div className="relative flex min-w-0 w-full flex-1 flex-col gap-2">
        {steps.map((step, idx) => {
          const isAct = activeStep === idx;
          return (
            <div
              key={step.title}
              onClick={() => setActiveStep(idx)}
              onMouseEnter={() => setActiveStep(idx)}
              className={`transform-gpu cursor-pointer rounded-2xl p-3.5 transition-all duration-300 ${indents[idx]} ${
                isAct
                  ? 'border border-white/80 bg-white/80 shadow-md dark:border-white/20 dark:bg-gray-800/90'
                  : 'border border-transparent bg-white/10 opacity-70 hover:opacity-100 dark:bg-white/5'
              }`}
            >
              <div className="flex items-center gap-3">
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-black ${
                    isAct ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                  }`}
                >
                  {idx + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-base font-bold text-gray-900 dark:text-gray-100">{step.title}</div>
                  <div className="truncate text-sm text-gray-500 dark:text-gray-400">{step.desc}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex w-full flex-1 flex-col gap-4 rounded-2xl border border-white/60 bg-white/60 p-5 shadow-sm backdrop-blur-md dark:border-white/15 dark:bg-gray-800/60">
        <h3 className="border-b border-black/5 pb-2 text-base font-black text-gray-900 dark:border-white/10 dark:text-gray-100">
          {steps[activeStep].title}
        </h3>
        <div className="flex flex-col gap-3">
          <div className="rounded-xl border border-rose-200/80 bg-rose-50/70 p-3.5 dark:border-rose-900/40 dark:bg-rose-950/30">
            <div className="text-xs font-bold uppercase tracking-wider text-rose-700 dark:text-rose-400">
              Без аудита:
            </div>
            <div className="mt-1 text-sm leading-snug text-gray-700 dark:text-gray-300">
              {steps[activeStep].danger}
            </div>
          </div>
          <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/70 p-3.5 dark:border-emerald-900/40 dark:bg-emerald-950/30">
            <div className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
              С «Пульсом Города»:
            </div>
            <div className="mt-1 text-sm leading-snug text-gray-800 dark:text-gray-200">
              {steps[activeStep].safe}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
