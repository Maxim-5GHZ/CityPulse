'use client';

import type { UrbanTool } from '@/lib/urban/types';

interface ToolbarProps {
  tool: UrbanTool;
  onTool: (t: UrbanTool) => void;
  onReset: () => void;
  houseResidents: number;
  onResidents: (n: number) => void;
  paused: boolean;
  onPaused: (v: boolean) => void;
}

const TOOLS: { id: UrbanTool; label: string; hint: string }[] = [
  { id: 'road', label: 'Дорога', hint: 'Клик — узел, второй клик — ребро' },
  { id: 'crossing', label: 'Переход', hint: 'Клик по ребру ставит зебру (×3)' },
  { id: 'house', label: 'Дом', hint: 'Протяни прямоугольник по сетке' },
  { id: 'stop', label: 'Остановка', hint: 'Клик по карте' },
  { id: 'park', label: 'Парк', hint: 'Протяни зону по сетке' },
  { id: 'delete', label: 'Снести', hint: 'Ребро: 1-й клик — ремонт, 2-й — снос' },
];

const BTN =
  'transform-gpu rounded-full px-3 py-1.5 text-sm font-medium transition-all duration-200 ease-out ' +
  'hover:scale-[1.05] active:scale-[0.98] motion-reduce:transform-none motion-reduce:transition-none ' +
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-300/60';

/** Панель инструментов конструктора: сегмент-контрол как табы /login. */
export default function Toolbar({
  tool,
  onTool,
  onReset,
  houseResidents,
  onResidents,
  paused,
  onPaused,
}: ToolbarProps) {
  return (
    <section aria-label="Инструменты конструктора">
      <p className="text-xs uppercase text-gray-500 dark:text-gray-400">Конструктор</p>
      <div
        role="toolbar"
        aria-label="Инструменты"
        className="mt-2 flex flex-wrap gap-1.5 rounded-[24px] border border-white/60 bg-white/40 p-1.5 backdrop-blur-xl dark:border-white/20 dark:bg-white/10"
      >
        {TOOLS.map((t) => (
          <button
            key={t.id}
            type="button"
            title={t.hint}
            aria-pressed={tool === t.id}
            onClick={() => onTool(t.id)}
            className={
              tool === t.id
                ? `${BTN} bg-white text-gray-900 shadow-[0_2px_10px_rgba(20,26,38,0.15),inset_0_1px_1px_rgba(255,255,255,0.9)] dark:bg-white/20 dark:text-white`
                : `${BTN} text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-100`
            }
          >
            {t.label}
          </button>
        ))}
      </div>
      <p className="mt-1.5 min-h-4 text-xs text-gray-500 dark:text-gray-400" aria-live="polite">
        {TOOLS.find((t) => t.id === tool)?.hint ?? ''}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <label
          htmlFor="house-residents"
          className="text-sm font-medium text-gray-600 dark:text-gray-200"
        >
          Жителей в доме
        </label>
        <input
          id="house-residents"
          type="number"
          min={10}
          max={500}
          step={10}
          value={houseResidents}
          onChange={(e) => onResidents(Math.max(10, Math.min(500, Number(e.target.value) || 100)))}
          className="w-20 transform-gpu rounded-full border border-white/60 bg-white/60 px-3 py-1.5 text-sm text-gray-800 backdrop-blur-xl outline-none transition-all duration-200 ease-out hover:scale-[1.02] focus:scale-[1.02] focus:border-blue-400 focus:ring-2 focus:ring-blue-300/60 motion-reduce:transform-none motion-reduce:transition-none dark:border-white/20 dark:bg-white/10 dark:text-gray-100"
        />
        <button
          type="button"
          onClick={() => onPaused(!paused)}
          aria-pressed={paused}
          className={`${BTN} border border-white/60 bg-white/40 text-gray-700 backdrop-blur-xl hover:bg-white/60 dark:border-white/20 dark:bg-white/10 dark:text-gray-200 dark:hover:bg-white/20`}
        >
          {paused ? 'Запустить поток' : 'Пауза'}
        </button>
        <button
          type="button"
          onClick={onReset}
          className={`${BTN} border border-white/60 bg-white/40 text-gray-700 backdrop-blur-xl hover:bg-white/60 dark:border-white/20 dark:bg-white/10 dark:text-gray-200 dark:hover:bg-white/20`}
        >
          Сброс района
        </button>
      </div>
    </section>
  );
}
