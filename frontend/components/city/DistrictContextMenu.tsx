'use client';

interface DistrictContextMenuProps {
  x: number;
  y: number;
  edgeId: string;
  lanesLabel: string;
  isRing: boolean;
  onUpgradeLanes: (edgeId: string) => void;
  onToggleSidewalk: (edgeId: string, side: 'left' | 'right') => void;
  onDeleteEdge: (edgeId: string) => void;
  onBuildCrossing: (isUnderpass: boolean) => void;
  onClose: () => void;
}

// Кламп к экрану: меню не улетает за пределы вьюпорта (включая мобильные).
const MENU_W = 240;
const MENU_H = 340;

export default function DistrictContextMenu({
  x,
  y,
  edgeId,
  lanesLabel,
  isRing,
  onUpgradeLanes,
  onToggleSidewalk,
  onDeleteEdge,
  onBuildCrossing,
  onClose,
}: DistrictContextMenuProps) {
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1024;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 768;
  const left = Math.max(8, Math.min(x, vw - MENU_W - 8));
  const top = Math.max(8, Math.min(y, vh - MENU_H - 8));

  const itemCls =
    'flex w-full transform-gpu items-center rounded-xl px-2 py-1.5 text-left transition-all duration-200 ' +
    'ease-out hover:scale-[1.02] hover:bg-white/60 active:scale-[0.98] motion-reduce:transform-none ' +
    'motion-reduce:transition-none dark:hover:bg-white/10';

  return (
    <div
      className="fixed z-50 min-w-[220px] rounded-2xl border border-white/60 bg-white/70 p-1.5 text-xs font-medium text-gray-800 shadow-[inset_1px_1px_2px_rgba(255,255,255,0.8),0_18px_40px_-12px_rgba(20,26,38,0.35)] backdrop-blur-2xl backdrop-saturate-150 dark:border-white/20 dark:bg-gray-900/70 dark:text-gray-100"
      style={{ top, left }}
      onClick={(e) => e.stopPropagation()}
      role="menu"
    >
      <div className="border-b border-white/50 px-2 py-1 font-bold uppercase text-blue-700 dark:border-white/15 dark:text-blue-300">
        Участок УДС{lanesLabel !== '—' ? ` • ${lanesLabel} пол.` : ''}
      </div>
      {isRing ? (
        <div className="px-2 py-1.5 font-semibold text-amber-600 dark:text-amber-300">
          Элемент кольца: снос запрещён
        </div>
      ) : (
        <>
          <button
            type="button"
            className={itemCls}
            onClick={() => {
              onUpgradeLanes(edgeId);
              onClose();
            }}
          >
            ↔ Переключить 2 / 4 полосы
          </button>
          <button
            type="button"
            className={itemCls}
            onClick={() => {
              onBuildCrossing(false);
              onClose();
            }}
          >
            ▤ Наземный переход здесь
          </button>
          <button
            type="button"
            className={itemCls}
            onClick={() => {
              onBuildCrossing(true);
              onClose();
            }}
          >
            ▦ Подземный переход здесь
          </button>
          <button
            type="button"
            className={itemCls}
            onClick={() => {
              onToggleSidewalk(edgeId, 'left');
              onClose();
            }}
          >
            + Тротуар слева (бордюр)
          </button>
          <button
            type="button"
            className={itemCls}
            onClick={() => {
              onToggleSidewalk(edgeId, 'right');
              onClose();
            }}
          >
            + Тротуар справа (бордюр)
          </button>
          <button
            type="button"
            className={`${itemCls} font-semibold text-red-600 dark:text-red-400`}
            onClick={() => {
              onDeleteEdge(edgeId);
              onClose();
            }}
          >
            ✕ Удалить участок
          </button>
        </>
      )}
    </div>
  );
}
