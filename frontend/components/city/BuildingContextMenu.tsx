'use client';

import { BuildingTag, BUILDING_TAG_LABEL, BUILDING_TAGS } from '@/lib/city-engine/types';

interface BuildingContextMenuProps {
  x: number;
  y: number;
  buildingName: string;
  currentTag: BuildingTag | null;
  onSetTag: (tag: BuildingTag | null) => void;
  onDeleteBuilding: () => void;
  onClose: () => void;
}

// Кламп к экрану: меню не улетает за пределы вьюпорта (включая мобильные).
const MENU_W = 240;
const MENU_H = 360;

const TAG_ICON: Record<BuildingTag, string> = {
  school: '🎒',
  police: '🚔',
  hospital: '🏥',
  shop: '🏪',
};

export default function BuildingContextMenu({
  x,
  y,
  buildingName,
  currentTag,
  onSetTag,
  onDeleteBuilding,
  onClose,
}: BuildingContextMenuProps) {
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
      data-ctx-menu
      className="fixed z-50 min-w-[220px] rounded-2xl border border-white/60 bg-white/70 p-1.5 text-xs font-medium text-gray-800 shadow-[inset_1px_1px_2px_rgba(255,255,255,0.8),0_18px_40px_-12px_rgba(20,26,38,0.35)] backdrop-blur-2xl backdrop-saturate-150 dark:border-white/20 dark:bg-gray-900/70 dark:text-gray-100"
      style={{ top, left }}
      onClick={(e) => e.stopPropagation()}
      role="menu"
    >
      <div className="border-b border-white/50 px-2 py-1 font-bold uppercase text-blue-700 dark:border-white/15 dark:text-blue-300">
        {buildingName}
      </div>
      <div className="px-2 pb-0.5 pt-1 text-[10px] font-semibold uppercase text-gray-500 dark:text-gray-400">
        Назначить тег
      </div>
      {BUILDING_TAGS.map((tag) => (
        <button
          key={tag}
          type="button"
          className={itemCls}
          onClick={() => {
            onSetTag(tag);
            onClose();
          }}
        >
          <span className="mr-1.5">{TAG_ICON[tag]}</span>
          {BUILDING_TAG_LABEL[tag]}
          {currentTag === tag && <span className="ml-auto font-bold text-blue-600 dark:text-blue-300">●</span>}
        </button>
      ))}
      {currentTag && (
        <button
          type="button"
          className={itemCls}
          onClick={() => {
            onSetTag(null);
            onClose();
          }}
        >
          🏠 Жилой (снять тег)
        </button>
      )}
      <button
        type="button"
        className={`${itemCls} font-semibold text-red-600 dark:text-red-400`}
        onClick={() => {
          onDeleteBuilding();
          onClose();
        }}
      >
        ✕ Снести здание
      </button>
    </div>
  );
}
