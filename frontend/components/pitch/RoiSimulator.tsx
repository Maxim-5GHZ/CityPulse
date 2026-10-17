'use client';

import { useState } from 'react';
import Link from 'next/link';

interface RoiSimulatorProps {
  loginHref: string;
}

export default function RoiSimulator({ loginHref }: RoiSimulatorProps) {
  const [protectedMode, setProtectedMode] = useState(false);

  return (
    <div className="flex w-full max-w-4xl flex-col items-center gap-5">
      <div className="flex rounded-full border border-white/60 bg-white/40 p-1 backdrop-blur-xl dark:border-white/20 dark:bg-gray-800/60">
        <button
          type="button"
          onClick={() => setProtectedMode(false)}
          className={`transform-gpu rounded-full px-5 py-2 text-sm font-bold transition-all duration-200 ease-out hover:scale-[1.05] active:scale-[0.98] motion-reduce:transform-none motion-reduce:transition-none ${
            !protectedMode
              ? 'bg-rose-600 text-white shadow-md'
              : 'text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white'
          }`}
        >
          Без аудита
        </button>
        <button
          type="button"
          onClick={() => setProtectedMode(true)}
          className={`transform-gpu rounded-full px-5 py-2 text-sm font-bold transition-all duration-200 ease-out hover:scale-[1.05] active:scale-[0.98] motion-reduce:transform-none motion-reduce:transition-none ${
            protectedMode
              ? 'bg-blue-600 text-white shadow-md'
              : 'text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white'
          }`}
        >
          С «Пульсом»
        </button>
      </div>

      <div className="w-full rounded-[32px] border border-white/60 bg-white/40 p-6 shadow-[inset_1px_1px_2px_rgba(255,255,255,0.8),inset_-1px_-1px_2px_rgba(0,0,0,0.05),0_24px_60px_-16px_rgba(20,26,38,0.35)] backdrop-blur-xl sm:p-8 dark:border-white/20 dark:bg-gray-900/40">
        {!protectedMode ? (
          <div className="flex flex-col items-center gap-5 text-center">
            <h3 className="text-2xl font-black text-gray-900 dark:text-gray-100">
              Цена ошибки в схеме района
            </h3>

            <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-rose-200/80 bg-rose-50/70 p-4 backdrop-blur-md dark:border-rose-900/40 dark:bg-rose-950/30">
                <div className="text-xs font-bold uppercase text-gray-500 dark:text-gray-400">Переделка ППТ</div>
                <div className="mt-2 font-mono text-3xl font-black text-rose-600 dark:text-rose-400">~ 8 млн ₽</div>
                <div className="mt-1 text-xs text-gray-500">Повторный ППТ</div>
              </div>

              <div className="rounded-2xl border border-rose-200/80 bg-rose-50/70 p-4 backdrop-blur-md dark:border-rose-900/40 dark:bg-rose-950/30">
                <div className="text-xs font-bold uppercase text-gray-500 dark:text-gray-400">Срыв согласований</div>
                <div className="mt-2 font-mono text-3xl font-black text-rose-600 dark:text-rose-400">2–4 мес.</div>
                <div className="mt-1 text-xs text-gray-500">Выход на стройку</div>
              </div>

              <div className="rounded-2xl border border-rose-200/80 bg-rose-50/70 p-4 backdrop-blur-md dark:border-rose-900/40 dark:bg-rose-950/30">
                <div className="text-xs font-bold uppercase text-gray-500 dark:text-gray-400">Падение ликвидности</div>
                <div className="mt-2 font-mono text-3xl font-black text-rose-600 dark:text-rose-400">до −12%</div>
                <div className="mt-1 text-xs text-gray-500">Дисконт за изоляцию</div>
              </div>
            </div>

            <p className="max-w-2xl text-sm leading-snug text-gray-600 dark:text-gray-300">
              Ошибка на стройке — поздно. Дефицит виден до утверждения.
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-5 text-center">
            <h3 className="text-2xl font-black text-gray-900 dark:text-gray-100">
              Окупаемость с первой концепции
            </h3>

            <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/70 p-4 backdrop-blur-md dark:border-emerald-900/40 dark:bg-emerald-950/30">
                <div className="text-xs font-bold uppercase text-gray-500 dark:text-gray-400">Валидация решений</div>
                <div className="mt-2 font-mono text-3xl font-black text-emerald-600 dark:text-emerald-400">0 дней</div>
                <div className="mt-1 text-xs text-gray-500">Проверка гипотез</div>
              </div>

              <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/70 p-4 backdrop-blur-md dark:border-emerald-900/40 dark:bg-emerald-950/30">
                <div className="text-xs font-bold uppercase text-gray-500 dark:text-gray-400">Нормативы пешеходов</div>
                <div className="mt-2 font-mono text-3xl font-black text-emerald-600 dark:text-emerald-400">100%</div>
                <div className="mt-1 text-xs text-gray-500">Покрытие по графу</div>
              </div>

              <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/70 p-4 backdrop-blur-md dark:border-emerald-900/40 dark:bg-emerald-950/30">
                <div className="text-xs font-bold uppercase text-gray-500 dark:text-gray-400">Точность расчёта</div>
                <div className="mt-2 font-mono text-3xl font-black text-emerald-600 dark:text-emerald-400">Δ = 0</div>
                <div className="mt-1 text-xs text-gray-500">Возврат схемы</div>
              </div>
            </div>

            <div className="mt-2">
              <Link
                href={loginHref}
                className="inline-block transform-gpu rounded-full bg-[#141a26]/90 px-8 py-3 text-sm font-medium tracking-wide text-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.25),0_14px_30px_-10px_rgba(20,26,38,0.6)] backdrop-blur-xl transition-all duration-200 ease-out hover:scale-[1.05] hover:bg-[#141a26] active:scale-[0.98] motion-reduce:transform-none motion-reduce:transition-none"
              >
                Открыть конструктор района
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
