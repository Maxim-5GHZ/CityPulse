'use client';

interface FlidaButtonProps {
  label: string;
  busy: boolean;
  onClick: () => void;
}

const flidaBtnCls =
  'mt-4 flex w-full transform-gpu items-center justify-center gap-2 rounded-full border border-white/60 bg-white/50 ' +
  'px-4 py-2 text-sm font-bold text-gray-700 backdrop-blur-xl transition-all duration-200 ease-out ' +
  'hover:scale-[1.05] active:scale-[0.98] motion-reduce:transform-none motion-reduce:transition-none ' +
  'shadow-[inset_0_1px_1px_rgba(255,255,255,0.9),0_6px_18px_-8px_rgba(20,26,38,0.4)] ' +
  'hover:bg-white/70 dark:border-white/20 dark:bg-white/10 dark:text-gray-100 dark:hover:bg-white/20';

export default function FlidaButton({ label, busy, onClick }: FlidaButtonProps) {
  return (
    <button type="button" onClick={onClick} disabled={busy} className={flidaBtnCls}>
      <svg className="h-6 w-6 shrink-0" viewBox="0 0 40 40" aria-hidden="true">
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
      <span>{busy ? 'Открываем Флида ID…' : label}</span>
    </button>
  );
}
