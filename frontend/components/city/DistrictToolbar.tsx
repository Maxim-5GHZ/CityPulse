// frontend/components/city/DistrictToolbar.tsx
'use client';

import { ToolMode } from './DistrictMap';
import { cadBtn, cadBtnActive } from './cadStyles';

interface DistrictToolbarProps {
  projectName: string;
  onProjectNameChange: (name: string) => void;
  buildingCount: number;
  edgeCount: number;
  viewMode: '2d' | '3d';
  onViewModeChange: (mode: '2d' | '3d') => void;
  toolMode: ToolMode;
  onToolModeChange: (mode: ToolMode) => void;
  onClear: () => void;
  onOpenProjects: () => void;
  onSaveProject: () => void;
  isSaving: boolean;
  simPlaying: boolean;
  onToggleSimPlaying: () => void;
  simSpeed: 1 | 2 | 5;
  onSimSpeedChange: (speed: 1 | 2 | 5) => void;
  diffView: 'current' | 'base' | 'diff';
  onDiffViewChange: (mode: 'current' | 'base' | 'diff') => void;
  onFixBase: () => void;
  onRollbackToBase: () => void;
  onOpenAudit: () => void;
  baseStamp: string;
}

const glassPanelCls =
  'rounded-[24px] border border-white/60 bg-white/40 p-2.5 backdrop-blur-xl backdrop-saturate-150 ' +
  'shadow-[inset_1px_1px_2px_rgba(255,255,255,0.8),inset_-1px_-1px_2px_rgba(0,0,0,0.05),0_12px_30px_-10px_rgba(20,26,38,0.2)] ' +
  'dark:border-white/20 dark:bg-gray-900/40';

export default function DistrictToolbar({
  projectName,
  onProjectNameChange,
  buildingCount,
  edgeCount,
  viewMode,
  onViewModeChange,
  toolMode,
  onToolModeChange,
  onClear,
  onOpenProjects,
  onSaveProject,
  isSaving,
  simPlaying,
  onToggleSimPlaying,
  simSpeed,
  onSimSpeedChange,
  diffView,
  onDiffViewChange,
  onFixBase,
  onRollbackToBase,
  onOpenAudit,
  baseStamp,
}: DistrictToolbarProps) {
  return (
    <div className="mb-3 space-y-2">
      {/* Верхняя строка проекта: имя + пресеты + сохранение */}
      <div className={`${glassPanelCls} flex flex-wrap items-center justify-between gap-2.5`}>
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="shrink-0 text-xs font-semibold uppercase text-gray-500 dark:text-gray-300">
            Проект:
          </span>
          <input
            type="text"
            value={projectName}
            onChange={(e) => onProjectNameChange(e.target.value)}
            className="w-full max-w-[200px] sm:max-w-xs transform-gpu rounded-full border border-white/60 bg-white/60 px-3.5 py-1 text-xs font-bold text-gray-800 shadow-[inset_0_2px_4px_rgba(0,0,0,0.06),inset_0_-1px_2px_rgba(255,255,255,0.9)] backdrop-blur-xl outline-none hover:scale-[1.02] focus:scale-[1.02] focus:border-blue-400 dark:border-white/20 dark:bg-white/10 dark:text-gray-100"
          />
          <span className="hidden text-xs text-gray-500 sm:inline dark:text-gray-400">
            [{buildingCount} зданий • {edgeCount} связей]
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-1.5 overflow-x-auto py-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <button type="button" onClick={onClear} className={cadBtn}>
            Очистить
          </button>
          <button type="button" onClick={onOpenProjects} className={cadBtn}>
            Проекты
          </button>
          <button type="button" onClick={onSaveProject} disabled={isSaving} className={cadBtnActive}>
            {isSaving ? 'Запись…' : 'Сохранить'}
          </button>
        </div>
      </div>

      {/* Панель инструментов: скроллируемый ряд пилюль */}
      <div className={`${glassPanelCls} flex items-center justify-between gap-3`}>
        {viewMode === '2d' ? (
          <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <span className="mr-1 shrink-0 text-xs font-semibold uppercase text-gray-500 dark:text-gray-300">
              САПР:
            </span>
            <button
              type="button"
              onClick={() => onToolModeChange('select')}
              className={toolMode === 'select' ? cadBtnActive : cadBtn}
            >
              Выбор
            </button>
            <button
              type="button"
              onClick={() => onToolModeChange('road')}
              className={toolMode === 'road' ? cadBtnActive : cadBtn}
            >
              Шоссе
            </button>
            <button
              type="button"
              onClick={() => onToolModeChange('sidewalk')}
              className={toolMode === 'sidewalk' ? cadBtnActive : cadBtn}
            >
              Тротуар
            </button>
            <button
              type="button"
              onClick={() => onToolModeChange('crossing')}
              className={toolMode === 'crossing' ? cadBtnActive : cadBtn}
            >
              Зебра
            </button>
            <button
              type="button"
              onClick={() => onToolModeChange('underpass')}
              className={toolMode === 'underpass' ? cadBtnActive : cadBtn}
            >
              Подземный
            </button>
            <button
              type="button"
              onClick={() => onToolModeChange('poly_building')}
              className={toolMode === 'poly_building' ? cadBtnActive : cadBtn}
            >
              Дом
            </button>
            <button
              type="button"
              onClick={() => onToolModeChange('poly_park')}
              className={toolMode === 'poly_park' ? cadBtnActive : cadBtn}
            >
              Сквер
            </button>
            <button
              type="button"
              onClick={() => onToolModeChange('block_spot')}
              className={toolMode === 'block_spot' ? cadBtnActive : cadBtn}
            >
              Ремонт
            </button>
            <button
              type="button"
              onClick={() => onToolModeChange('delete')}
              className={toolMode === 'delete' ? cadBtnActive : cadBtn}
            >
              Снос
            </button>
          </div>
        ) : (
          <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <span className="shrink-0 text-xs font-semibold uppercase text-gray-500 dark:text-gray-300">
              Симуляция:
            </span>
            <button
              type="button"
              onClick={onToggleSimPlaying}
              className={simPlaying ? cadBtn : cadBtnActive}
            >
              {simPlaying ? 'Пауза' : 'Старт'}
            </button>
            <div className="flex gap-1">
              {([1, 2, 5] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => onSimSpeedChange(s)}
                  className={simSpeed === s ? cadBtnActive : cadBtn}
                >
                  {s}x
                </button>
              ))}
            </div>
            <span className="hidden text-xs font-medium text-emerald-600 sm:inline dark:text-emerald-400">
              • Пешеходные потоки: тротуары, тропинки, трава и школы
            </span>
          </div>
        )}

        {/* Переключатель 2D / 3D */}
        <div className="flex shrink-0 items-center gap-1 rounded-full border border-white/60 bg-white/40 p-0.5 backdrop-blur-xl dark:border-white/20 dark:bg-white/10">
          <button
            type="button"
            onClick={() => onViewModeChange('2d')}
            className={viewMode === '2d' ? cadBtnActive : cadBtn}
          >
            2D
          </button>
          <button
            type="button"
            onClick={() => onViewModeChange('3d')}
            className={viewMode === '3d' ? cadBtnActive : cadBtn}
          >
            3D
          </button>
        </div>
      </div>

      {/* Сравнение «До / После»: фиксация базы и режимы просмотра для жюри */}
      <div className={`${glassPanelCls} flex flex-wrap items-center gap-2`}>
        <span className="shrink-0 text-xs font-semibold uppercase text-gray-500 dark:text-gray-300">
          До / После:
        </span>
        <div className="flex shrink-0 items-center gap-1 rounded-full border border-white/60 bg-white/40 p-0.5 backdrop-blur-xl dark:border-white/20 dark:bg-white/10">
          {(
            [
              ['current', 'Сейчас'],
              ['base', 'Было'],
              ['diff', 'Дифф'],
            ] as const
          ).map(([mode, label]) => (
            <button
              key={mode}
              type="button"
              onClick={() => onDiffViewChange(mode)}
              title={
                mode === 'current'
                  ? 'Текущий проект (редактирование)'
                  : mode === 'base'
                    ? 'Зафиксированное «ДО» (только чтение)'
                    : 'Наложение: проект + призрак «ДО»'
              }
              className={diffView === mode ? cadBtnActive : cadBtn}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={onFixBase}
          title="Зафиксировать текущее состояние как базовое «ДО» — дельты будут считаться от него"
          className={cadBtn}
        >
          📌 Зафиксировать ДО
        </button>
        <button
          type="button"
          onClick={onRollbackToBase}
          title="Вернуть проект к зафиксированному «ДО» — все дельты обнулятся"
          className={cadBtn}
        >
          ↩ Откатить к ДО
        </button>
        <button
          type="button"
          onClick={onOpenAudit}
          disabled={buildingCount === 0}
          title={buildingCount === 0 ? 'Сначала добавьте дома на чертёж — аудиту пока нечего считать' : 'Открыть дашборд глубокого аудита: динамика решений, баланс среды, выводы алгоритма'}
          className={`${cadBtnActive} disabled:pointer-events-none disabled:opacity-40`}
        >
          📊 Аналитика
        </button>
        <span aria-live="polite" className="ml-auto shrink-0 text-[10px] font-semibold text-gray-500 dark:text-gray-400">
          {baseStamp}
        </span>
      </div>
    </div>
  );
}
