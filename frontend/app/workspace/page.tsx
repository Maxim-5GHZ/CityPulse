'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import AppHeader from '@/components/AppHeader';

export default function WorkspacePage() {
  const { ready, token, email } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (ready && !token) router.replace('/login');
  }, [ready, token, router]);

  if (!ready) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center px-6 py-6">
        <p className="text-center text-sm text-gray-500 dark:text-gray-400">Загрузка…</p>
      </main>
    );
  }

  if (!token) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center px-6 py-6">
        <p className="text-center text-sm text-gray-500 dark:text-gray-400">
          Перенаправляем на страницу входа…
        </p>
      </main>
    );
  }

  // Стекло как на /login (см. cardCls там): широкий каркас под будущие виджеты, без контента.
  const cardCls =
    'w-full rounded-[32px] border border-white/60 bg-white/40 px-6 py-6 backdrop-blur-xl ' +
    'backdrop-saturate-150 md:px-8 ' +
    'shadow-[inset_1px_1px_2px_rgba(255,255,255,0.8),inset_-1px_-1px_2px_rgba(0,0,0,0.05),0_24px_60px_-16px_rgba(20,26,38,0.35)] ' +
    'dark:border-white/20 dark:bg-gray-900/40';

  const slotCls =
    'rounded-[32px] border border-white/60 bg-white/30 p-5 backdrop-blur-xl ' +
    'shadow-[inset_1px_1px_2px_rgba(255,255,255,0.8),inset_-1px_-1px_2px_rgba(0,0,0,0.05),0_18px_44px_-18px_rgba(20,26,38,0.35)] ' +
    'dark:border-white/20 dark:bg-gray-900/30';

  return (
    <div
      className="relative min-h-screen bg-cover bg-center"
      style={{ backgroundImage: "url('/city.png')" }}
    >
      {/* Вуаль как на / и /login — стекло читается в обеих темах, лежит и под хедером */}
      <div className="absolute inset-0 bg-gradient-to-b from-white/30 via-white/10 to-white/40 dark:from-black/60 dark:via-black/40 dark:to-black/70" />

      <AppHeader />
      <main className="relative z-10 mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
          <div className={cardCls}>
            <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100">
              Рабочая область
            </h2>
            {email && (
              <p className="mt-1 text-sm font-medium text-gray-600 dark:text-gray-200">
                {email}
              </p>
            )}
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Здесь будет рабочее пространство
            </p>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className={slotCls} aria-hidden="true">
                <div className="motion-safe:animate-pulse">
                  <div className="h-3 w-2/3 rounded-full bg-gray-300/60 dark:bg-white/10" />
                  <div className="mt-3 h-3 w-full rounded-full bg-gray-300/50 dark:bg-white/10" />
                  <div className="mt-2 h-3 w-5/6 rounded-full bg-gray-300/50 dark:bg-white/10" />
                </div>
                <p className="mt-4 text-xs uppercase text-gray-500 dark:text-gray-400">
                  Место под виджет
                </p>
              </div>
            ))}
          </div>
        </main>
    </div>
  );
}
