'use client';

import { useState } from 'react';

const tabs = [
  {
    title: 'Застройщики',
    role: 'Девелоперы и инвесторы',
    need: 'Обоснование классности жилья и рост капитализации квадратного метра.',
    solution:
      'Мгновенная оцифровка доступности соцобъектов для буклетов продаж и банковских моделей. Подтверждение концепции «15-минутного района» цифрами, а не маркетинговыми лозунгами.',
  },
  {
    title: 'Архитекторы',
    role: 'ГАПы и мастер-планировщики',
    need: 'Быстрая проверка гипотез без ожидания расчётов от смежных отделов.',
    solution:
      'Лёгкий инструмент скоростного прототипирования: перетащил остановку, добавил зебру — сразу увидел изменение пешеходных изолиний и доступности сервисов.',
  },
  {
    title: 'Градостроители',
    role: 'Городские комитеты и ГИП',
    need: 'Контроль соблюдения нормативов пешеходной доступности.',
    solution:
      'Аудит проектов планировки территории. Исключение появления изолированных микрорайонов и транспортных коллапсов ещё на стадии эскиза.',
  },
  {
    title: 'Социологи',
    role: 'Исследователи городской среды',
    need: 'Понимание реальных сценариев жизни района: кто, куда и как ходит.',
    solution:
      'Баланс выигравших и проигравших жителей по каждому решению, детализация «по домам» и честная фильтрация доступности для маломобильных групп.',
  },
  {
    title: 'Экологи',
    role: 'Зелёный каркас и комфорт',
    need: 'Достаточность озеленения и комфорт дворовых пространств.',
    solution:
      'Норматив зелёных зон на жителя, анализ комфорта дворов и контроль того, что пешеходные связи не идут через промзоны и магистрали.',
  },
];

export default function AudienceSimulator() {
  const [activeTab, setActiveTab] = useState(0);

  return (
    <div className="flex w-full max-w-5xl flex-col gap-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-white/60 bg-white/40 p-4 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-gray-900/40">
          <div className="flex items-center justify-between">
            <span className="text-sm font-black text-gray-900 dark:text-gray-100">Web-платформа</span>
            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
              Мгновенный старт
            </span>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-gray-600 dark:text-gray-300">
            Работа в браузере без установки тяжеловесных САПР. Совместная работа проектных команд над вариантами мастер-плана.
          </p>
        </div>

        <div className="rounded-2xl border border-white/60 bg-white/40 p-4 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-gray-900/40">
          <div className="flex items-center justify-between">
            <span className="text-sm font-black text-gray-900 dark:text-gray-100">Упрощённый CAD-дизайн</span>
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
              Скорость prototyping
            </span>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-gray-600 dark:text-gray-300">
            Нарочито лёгкая графика вместо тяжёлых рендеров: схема собирается за минуты, а не недели. Скорость важнее фотореализма.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 rounded-2xl border border-white/60 bg-white/40 p-1.5 backdrop-blur-xl dark:border-white/10 dark:bg-gray-900/40">
        {tabs.map((t, idx) => (
          <button
            key={t.title}
            type="button"
            onClick={() => setActiveTab(idx)}
            className={`min-w-[120px] flex-1 transform-gpu rounded-xl px-3 py-2 text-xs font-bold transition-all duration-200 ease-out hover:scale-[1.02] active:scale-[0.98] motion-reduce:transform-none motion-reduce:transition-none ${
              activeTab === idx
                ? 'bg-gray-800 text-white shadow dark:bg-white dark:text-gray-900'
                : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
            }`}
          >
            {t.title}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-amber-200/80 bg-amber-50/70 p-4 backdrop-blur-md dark:border-amber-900/40 dark:bg-amber-950/30">
          <div className="text-[10px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300">
            Ключевая боль ({tabs[activeTab].role})
          </div>
          <p className="mt-2 text-xs leading-relaxed text-gray-700 dark:text-gray-200">
            {tabs[activeTab].need}
          </p>
        </div>

        <div className="rounded-2xl border border-blue-200/80 bg-blue-50/70 p-4 backdrop-blur-md dark:border-blue-900/40 dark:bg-blue-950/30">
          <div className="text-[10px] font-bold uppercase tracking-wider text-blue-800 dark:text-blue-300">
            Решение в «Пульсе Города»
          </div>
          <p className="mt-2 text-xs leading-relaxed text-gray-800 dark:text-gray-100">
            {tabs[activeTab].solution}
          </p>
        </div>
      </div>
    </div>
  );
}
