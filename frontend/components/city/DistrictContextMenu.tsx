'use client';

import {
  ArrowLeftRight,
  Footprints,
  Route,
  PanelLeft,
  PanelRight,
  Trash2,
} from 'lucide-react';

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

// Кламп к экрану: меню не улетает за пределы вьюпорта.
const MENU_W = 260;
const MENU_H = 360;

const itemCls =
  'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-xs font-medium ' +
  'text-zinc-200 transition-colors hover:bg-white/5 hover:text-zinc-50';

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

  return (
    <div
      className="fixed z-50 min-w-[240px] rounded-xl border border-white/10 bg-zinc-900/95 p-1.5 text-xs font-medium text-zinc-200 shadow-2xl shadow-black/50 backdrop-blur-md"
      style={{ top, left }}
      onClick={(e) => e.stopPropagation()}
      role="menu"
    >
      <div className="border-b border-white/10 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wide text-blue-300">
        Участок УДС{lanesLabel !== '—' ? ` • ${lanesLabel} пол.` : ''}
      </div>

      {isRing ? (
        <div className="px-2.5 py-2 font-semibold text-amber-300">
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
            <ArrowLeftRight className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
            Переключить 2 / 4 полосы
          </button>
          <button
            type="button"
            className={itemCls}
            onClick={() => {
              onBuildCrossing(false);
              onClose();
            }}
          >
            <Footprints className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
            Наземный переход здесь
          </button>
          <button
            type="button"
            className={itemCls}
            onClick={() => {
              onBuildCrossing(true);
              onClose();
            }}
          >
            <Route className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
            Подземный переход здесь
          </button>
          <button
            type="button"
            className={itemCls}
            onClick={() => {
              onToggleSidewalk(edgeId, 'left');
              onClose();
            }}
          >
            <PanelLeft className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
            Тротуар слева (бордюр)
          </button>
          <button
            type="button"
            className={itemCls}
            onClick={() => {
              onToggleSidewalk(edgeId, 'right');
              onClose();
            }}
          >
            <PanelRight className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
            Тротуар справа (бордюр)
          </button>
          <div className="my-1 border-t border-white/10" />
          <button
            type="button"
            className={`${itemCls} text-red-300 hover:text-red-200`}
            onClick={() => {
              onDeleteEdge(edgeId);
              onClose();
            }}
          >
            <Trash2 className="h-3.5 w-3.5 shrink-0" />
            Удалить участок
          </button>
        </>
      )}
    </div>
  );
}