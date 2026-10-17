'use client';

interface RouteContextMenuProps {
  x: number;
  y: number;
  nodeLabel: string;
  hasStart: boolean;
  hasRoute: boolean;
  onSetStart: () => void;
  onSetEnd: () => void;
  onClear: () => void;
  onClose: () => void;
}

// ПКМ-меню маршрута А → Б: точки выбирает пользователь, считает умный Дейкстра.
// Кламп к экрану: меню не улетает за пределы вьюпорта (включая мобильные).
const MENU_W = 240;
const MENU_H = 220;

export default function RouteContextMenu({
  x,
  y,
  nodeLabel,
  hasStart,
  hasRoute,
  onSetStart,
  onSetEnd,
  onClear,
  onClose,
}: RouteContextMenuProps) {
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1024;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 768;
  const left = Math.max(8, Math.min(x, vw - MENU_W - 8));
  const top = Math.max(8, Math.min(y, vh - MENU_H - 8));

  const itemCls =
    'flex w-full transform-gpu items-center rounded-xl px-2 py-1.5 text-left transition-all duration-200 ' +
    'ease-out hover:scale-[1.02] hover:bg-white/60 active:scale-[0.98] motion-reduce:transform-none ' +
    'motion-reduce:transition-none dark:hover:bg-white/10 ' +
    'disabled:pointer-events-none disabled:opacity-40';

  return (
    <div
      data-ctx-menu
      className="fixed z-50 min-w-[220px] rounded-2xl border border-white/60 bg-white/70 p-1.5 text-xs font-medium text-gray-800 shadow-[inset_1px_1px_2px_rgba(255,255,255,0.8),0_18px_40px_-12px_rgba(20,26,38,0.35)] backdrop-blur-2xl backdrop-saturate-150 dark:border-white/20 dark:bg-gray-900/70 dark:text-gray-100"
      style={{ top, left }}
      onClick={(e) => e.stopPropagation()}
      role="menu"
      aria-label="Меню маршрута"
    >
      <div className="border-b border-white/50 px-2 py-1 font-bold uppercase text-purple-700 dark:border-white/15 dark:text-purple-300">
        Маршрут • {nodeLabel}
      </div>
      <button
        type="button"
        className={itemCls}
        onClick={() => {
          onSetStart();
          onClose();
        }}
      >
        📍 Точка А — отсюда
      </button>
      <button
        type="button"
        className={itemCls}
        disabled={!hasStart}
        title={hasStart ? 'Построить маршрут от точки А сюда' : 'Сначала поставьте точку А'}
        onClick={() => {
          onSetEnd();
          onClose();
        }}
      >
        🏁 Точка Б — сюда
      </button>
      {hasRoute && (
        <button
          type="button"
          className={`${itemCls} font-semibold text-red-600 dark:text-red-400`}
          onClick={() => {
            onClear();
            onClose();
          }}
        >
          ✕ Очистить маршрут
        </button>
      )}
    </div>
  );
}
