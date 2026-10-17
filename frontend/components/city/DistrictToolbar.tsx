// frontend/components/city/DistrictToolbar.tsx
'use client';

import { ToolMode } from './DistrictMap';

interface DistrictToolbarProps {
  projectName: string;
  onProjectNameChange: (name: string) => void;
  buildingCount: number;
  edgeCount: number;
  viewMode: '2d' | '3d';
  onViewModeChange: (mode: '2d' | '3d') => void;
  toolMode: ToolMode;
  onToolModeChange: (mode: ToolMode) => void;
  onLoadPreset: () => void;
  onClear: () => void;
  onOpenProjects: () => void;
  onSaveProject: () => void;
  isSaving: boolean;
  simPlaying: boolean;
  onToggleSimPlaying: () => void;
  simSpeed: 1 | 2 | 5;
  onSimSpeedChange: (speed: 1 | 2 | 5) => void;
}

// Общий стиль панелей
const panelCls = 'flex flex-wrap items-center gap-2 p-1.5 backdrop-blur-md';

// Кнопки
const btn = 'shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:bg-white/10 hover:text-zinc-100';
const btnActive = 'shrink-0 rounded-lg bg-white/15 px-3 py-1.5 text-xs font-medium text-zinc-50 transition-colors hover:bg-white/20 shadow-sm';

export default function DistrictToolbar({
  projectName,
  onProjectNameChange,
  buildingCount,
  edgeCount,
  viewMode,
  onViewModeChange,
  toolMode,
  onToolModeChange,
  onLoadPreset,
  onClear,
  onOpenProjects,
  onSaveProject,
  isSaving,
  simPlaying,
  onToggleSimPlaying,
  simSpeed,
  onSimSpeedChange,
}: DistrictToolbarProps) {
  return (
    <div className="flex flex-col gap-2 mb-3">
      {/* Верхняя строка: Проект и действия */}
      <div className={`${panelCls} justify-between px-3 py-2`}>
        <div className="flex items-center flex-1 gap-3">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
            Проект:
          </span>
          <input
            type="text"
            value={projectName}
            onChange={(e) => onProjectNameChange(e.target.value)}
            className="w-full max-w-[240px] rounded-md bg-transparent px-2 py-1 text-sm font-medium text-zinc-100 outline-none transition-colors hover:bg-white/5 focus:bg-white/10 border border-transparent focus:border-white/20"
          />
          <span className="hidden text-xs text-zinc-500 sm:inline">
            [{buildingCount} зданий • {edgeCount} связей]
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button type="button" onClick={onLoadPreset} className={btn}>
            Обнинск-51
          </button>
          <button type="button" onClick={onClear} className={btn}>
            Очистить
          </button>
          <button type="button" onClick={onOpenProjects} className={btn}>
            Проекты
          </button>
          <div className="w-px h-4 mx-1 bg-white/10" />
          <button
            type="button"
            onClick={onSaveProject}
            disabled={isSaving}
            className="shrink-0 rounded-lg bg-blue-600/80 px-4 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-600 disabled:opacity-50"
          >
            {isSaving ? 'Запись…' : 'Сохранить'}
          </button>
        </div>
      </div>

      {/* Нижняя строка: Инструменты САПР */}
      <div className={`${panelCls} justify-between px-3 py-1.5`}>
        {viewMode === '2d' ? (
          <div className="flex flex-1 items-center gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <span className="mr-2 shrink-0 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
              САПР:
            </span>
            {(
              [
                ['select', 'Выбор'],
                ['road', 'Шоссе'],
                ['sidewalk', 'Тротуар'],
                ['crossing', 'Зебра'],
                ['underpass', 'Подземный'],
                ['poly_building', 'Дом'],
                ['poly_park', 'Сквер'],
                ['block_spot', 'Ремонт'],
                ['delete', 'Снос'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => onToolModeChange(id as ToolMode)}
                className={toolMode === id ? btnActive : btn}
              >
                {label}
              </button>
            ))}
          </div>
        ) : (
          <div className="flex flex-1 items-center gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <span className="mr-2 shrink-0 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
              Симуляция:
            </span>
            <button
              type="button"
              onClick={onToggleSimPlaying}
              className={simPlaying ? btn : btnActive}
            >
              {simPlaying ? 'Пауза' : 'Старт'}
            </button>
            <div className="flex gap-1">
              {([1, 2, 5] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => onSimSpeedChange(s)}
                  className={simSpeed === s ? btnActive : btn}
                >
                  {s}x
                </button>
              ))}
            </div>
            <span className="ml-2 hidden text-[11px] font-medium text-emerald-400 sm:inline">
              • Потоки Дейкстры активны
            </span>
          </div>
        )}

        {/* Переключатель 2D / 3D */}
        <div className="ml-2 flex shrink-0 items-center gap-1 rounded-lg bg-black/20 p-0.5 border border-white/5">
          <button
            type="button"
            onClick={() => onViewModeChange('2d')}
            className={viewMode === '2d' ? btnActive : btn}
          >
            2D
          </button>
          <button
            type="button"
            onClick={() => onViewModeChange('3d')}
            className={viewMode === '3d' ? btnActive : btn}
          >
            3D
          </button>
        </div>
      </div>
    </div>
  );
}