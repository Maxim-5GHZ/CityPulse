'use client';

export interface InspectorRow {
  label: string;
  value: string;
  valueCls?: string;
}

interface ObjectInspectorCardProps {
  title: string;
  titleCls?: string;
  rows: InspectorRow[];
  pathBox?: string | null;
  hint?: string;
  onClose: () => void;
}

// Плавающая карточка инспектора объекта (дом / участок УДС):
// раньше жила статичной колонкой справа, теперь всплывает у объекта.
export default function ObjectInspectorCard({
  title,
  titleCls = 'text-blue-700 dark:text-blue-300',
  rows,
  pathBox,
  hint,
  onClose,
}: ObjectInspectorCardProps) {
  return (
    <div className="pointer-events-auto w-64 max-w-[70vw] rounded-[28px] border border-white/60 bg-white/40 p-4 shadow-[inset_1px_1px_2px_rgba(255,255,255,0.8),inset_-1px_-1px_2px_rgba(0,0,0,0.05),0_18px_40px_-12px_rgba(20,26,38,0.25)] backdrop-blur-xl backdrop-saturate-150 dark:border-white/20 dark:bg-gray-900/40">
      <div className="flex items-start justify-between gap-2 border-b border-white/50 pb-2 dark:border-white/15">
        <h3 className={`text-xs font-bold uppercase tracking-tight ${titleCls}`}>{title}</h3>
        <button
          type="button"
          onClick={onClose}
          title="Закрыть карточку"
          aria-label="Закрыть карточку объекта"
          className="shrink-0 rounded-full px-1.5 text-sm font-bold leading-none text-gray-500 transition-all duration-200 hover:scale-110 hover:text-gray-900 motion-reduce:transform-none motion-reduce:transition-none dark:text-gray-400 dark:hover:text-gray-100"
        >
          ✕
        </button>
      </div>
      <div className="mt-3 space-y-2 text-xs font-medium">
        {rows.map((r) => (
          <div key={r.label} className="flex justify-between gap-2">
            <span className="text-gray-600 dark:text-gray-300">{r.label}</span>
            <span className={`text-right font-bold text-gray-900 dark:text-gray-100 ${r.valueCls ?? ''}`}>
              {r.value}
            </span>
          </div>
        ))}
        {pathBox && (
          <div className="rounded-xl border border-blue-200/70 bg-blue-50/80 p-2.5 text-blue-900 backdrop-blur-xl dark:border-blue-500/30 dark:bg-blue-950/40 dark:text-blue-200">
            {pathBox}
          </div>
        )}
        {hint && <p className="text-[10px] text-gray-500 dark:text-gray-400">{hint}</p>}
      </div>
    </div>
  );
}
