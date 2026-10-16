// Кейс 03 — ConclusionBox: вердикт + сработавшие if-then правила (§9.7).
// Стекло и интерактив — как остальные панели конструктора (см. AGENTS.md).
'use client';

import type { Conclusion, RuleTone } from '@/lib/city/conclusion';

const toneDot: Record<RuleTone, string> = {
  bad: 'bg-red-500',
  good: 'bg-green-500',
  info: 'bg-gray-400 dark:bg-gray-500',
};

const verdictCls: Record<RuleTone, string> = {
  bad: 'border-red-200/70 bg-red-50/80 text-red-700 dark:border-red-400/30 dark:bg-red-950/40 dark:text-red-300',
  good: 'border-green-200/70 bg-green-50/80 text-green-700 dark:border-green-400/30 dark:bg-green-950/40 dark:text-green-300',
  info: 'border-white/60 bg-white/60 text-gray-700 dark:border-white/20 dark:bg-white/10 dark:text-gray-200',
};

export default function ConclusionBox({ conclusion }: { conclusion: Conclusion }) {
  return (
    <div aria-live="polite">
      <p className={`rounded-2xl border p-4 text-sm font-medium ${verdictCls[conclusion.verdictTone]}`}>
        {conclusion.verdict}
      </p>
      {conclusion.rules.length > 0 && (
        <ul className="mt-3 space-y-2">
          {conclusion.rules.map((r) => (
            <li
              key={r.id}
              className="flex items-start gap-2 rounded-2xl border border-white/60 bg-white/60 p-3 text-sm text-gray-700 dark:border-white/20 dark:bg-white/10 dark:text-gray-200"
            >
              <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${toneDot[r.tone]}`} aria-hidden="true" />
              <span>{r.text}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
        Эвристика из правил (§9.7), не прогноз. Про ветер и цены правил пока нет — появятся с wind.ts и проектами.
      </p>
    </div>
  );
}
