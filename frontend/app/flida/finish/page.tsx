'use client';

/*
  ═══════════════════════════════════════════════════════════════════
  ФРОНТЕНДЕР, НЕ ПЕРЕЖИВАЙ ПРО ЭТУ СТРАНИЦУ.

  Это приёмник возврата от Флида ID. Вся «авторизация» тут — 10 строк:
  бэкенд после обмена кода с Флидой редиректит браузер сюда
  с НАШИМ JWT во фрагменте: /flida/finish#token=eyJ...

  Почему во фрагменте (#), а не в query (?): фрагмент никогда не уходит
  в сеть и не пишется в логи — токен видят только этот JS и localStorage.

  Что делает страница: достаёт токен из location.hash, кладёт его в общий
  AuthContext (тот же, что email-вход) и уводит на главную. Всё.
  Ни fetch, ни SDK, ни секретов. Не чинить — работает.

  Обратный путь: прямой заход без токена или битый hash → обратно на /login.
  ═══════════════════════════════════════════════════════════════════
*/

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import PulseLogo from '@/components/PulseLogo';

export default function FlidaFinishPage() {
  const { ready, token, applyToken } = useAuth();
  const router = useRouter();
  const [complaint, setComplaint] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    if (token) {
      router.replace('/');
      return;
    }
    const hash = window.location.hash;
    const found = hash.startsWith('#token=') ? hash.slice('#token='.length) : '';
    if (!found) {
      setComplaint('Нет токена — вернись на страницу входа и попробуй ещё раз.');
      return;
    }
    applyToken(found);
    window.location.hash = '';
    router.replace('/');
  }, [ready, token, applyToken, router]);

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl border bg-white p-6 text-center shadow-sm">
        <PulseLogo as="h1" size="sm" />
        <p className="mt-3 text-sm text-gray-500">
          {complaint ?? 'Завершаем вход через Флида ID…'}
        </p>
        {complaint && (
          <a href="/login" className="mt-4 inline-block text-sm text-blue-600 hover:underline">
            ← На страницу входа
          </a>
        )}
      </div>
    </main>
  );
}
