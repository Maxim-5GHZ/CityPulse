'use client';

import { Loader2 } from 'lucide-react';

interface FlidaButtonProps {
  label: string;
  busy: boolean;
  onClick: () => void;
}

const flidaBtnCls =
  'mt-1 flex w-full items-center justify-center gap-2 rounded-xl ' +
  'border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-medium text-zinc-100 ' +
  'backdrop-blur-md transition-colors hover:bg-white/10 active:bg-white/15 ' +
  'disabled:cursor-not-allowed disabled:opacity-60 ' +
  'focus:outline-none focus:ring-2 focus:ring-white/20';

export default function FlidaButton({ label, busy, onClick }: FlidaButtonProps) {
  return (
    <button type="button" onClick={onClick} disabled={busy} className={flidaBtnCls}>
      {busy ? (
        <Loader2 className="w-5 h-5 shrink-0 animate-spin text-zinc-300" />
      ) : (
        <svg className="w-5 h-5 shrink-0" viewBox="0 0 40 40" aria-hidden="true">
          <rect width="40" height="40" rx="9" fill="#7C3AED" />
          <text
            x="20"
            y="28.5"
            textAnchor="middle"
            fontSize="22"
            fontWeight="800"
            fill="#fff"
            fontFamily="Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
          >
            Ф
          </text>
        </svg>
      )}
      <span>{busy ? 'Открываем Флида ID…' : label}</span>
    </button>
  );
}