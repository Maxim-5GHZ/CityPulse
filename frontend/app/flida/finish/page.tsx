'use client';

/*
  Возврат от Флида ID в схеме Web SDK (redirect, public-клиент без секрета).
  Сюда смотрит redirectUri: Флида отдаёт ?code&state, SDK сам проверяет
  транзакцию из sessionStorage и меняет код на Flida-токены. Дальше фронт
  меняет Flida access_token на НАШ JWT через POST /backend/auth/flida
  (бэкенд перепроверяет токен через userinfo сервер-сервер) и кладёт
  его в общий AuthContext — дальше всё как после email-входа.
  Параметры callback из URL чистим через history.replaceState.
*/

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { exchangeFlida, ApiError } from '@/lib/api';
import { getFlidaSdk, flidaErrorMessage, isAbortError } from '@/lib/flida';
import PulseLogo from '@/components/PulseLogo';

const cardCls =
  'w-full max-w-md rounded-[32px] border border-white/60 bg-white/40 px-6 py-6 backdrop-blur-xl ' +
  'backdrop-saturate-150 md:px-8 ' +
  'shadow-[inset_1px_1px_2px_rgba(255,255,255,0.8),inset_-1px_-1px_2px_rgba(0,0,0,0.05),0_24px_60px_-16px_rgba(20,26,38,0.35)] ' +
  'dark:border-white/20 dark:bg-gray-900/40';

export default function FlidaFinishPage() {
  const { ready, token, applyToken } = useAuth();
  const router = useRouter();
  const [complaint, setComplaint] = useState<string | null>(null);

  useEffect(() => {
    if (!ready || token) {
      if (token) router.replace('/workspace');
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const sdk = await getFlidaSdk();
        const tokens = await sdk.autoAuthorization;
        if (cancelled) return;
        if (!tokens?.access_token) {
          // Прямой заход без OAuth-ответа — нечего обрабатывать.
          setComplaint('Нет данных входа — вернись на страницу входа и попробуй ещё раз.');
          return;
        }
        const r = await exchangeFlida(tokens.access_token);
        if (cancelled) return;
        applyToken(r.token);
        window.history.replaceState(null, '', window.location.pathname);
        router.replace('/workspace');
      } catch (err) {
        if (cancelled || isAbortError(err)) return;
        const msg = err instanceof ApiError ? err.message : flidaErrorMessage(err);
        setComplaint(msg);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, token, applyToken, router]);

  return (
    <section
      className="relative min-h-screen bg-cover bg-center"
      style={{ backgroundImage: "url('/city.png')" }}
    >
      <div className="absolute inset-0 bg-gradient-to-b from-white/30 via-white/10 to-white/40 dark:from-black/60 dark:via-black/40 dark:to-black/70" />
      <main className="container relative mx-auto flex min-h-screen flex-col items-center justify-center px-6 py-6">
        <div className={cardCls}>
          <div className="mx-auto flex justify-center">
            <PulseLogo as="h1" size="lg" className="scale-110 sm:scale-125 my-2" />
          </div>
          <p className="mt-4 text-center text-sm text-gray-600 dark:text-gray-200">
            {complaint ?? 'Завершаем вход через Флида ID…'}
          </p>
          {complaint && (
            <div className="mt-4 text-center">
              <a href="/login" className="text-sm text-blue-600 hover:underline">
                ← На страницу входа
              </a>
            </div>
          )}
        </div>
      </main>
    </section>
  );
}
