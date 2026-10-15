'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import PulseLogo from '@/components/PulseLogo';

export default function WorkspacePage() {
  const { ready, token, email, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (ready && !token) router.replace('/login');
  }, [ready, token, router]);

  const handleLogout = () => {
    logout();
    router.replace('/login');
  };

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

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center px-6 py-6">
      <div className="rounded-lg border bg-white p-6 shadow-lg dark:border-gray-700 dark:bg-gray-800">
        <PulseLogo as="h1" size="sm" />
        <h2 className="mt-3 text-lg font-medium text-gray-900 dark:text-gray-100">
          Рабочая область
        </h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Здесь будет рабочее пространство
        </p>
        {email && (
          <p className="mt-3 text-sm font-medium text-gray-700 dark:text-gray-200">{email}</p>
        )}

        <div className="mt-4 flex flex-col gap-3">
          <button
            type="button"
            onClick={handleLogout}
            className="rounded-lg bg-gray-800 px-6 py-2.5 text-sm font-medium text-white hover:bg-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600"
          >
            Выйти
          </button>
          <Link
            href="/"
            className="rounded-lg border px-4 py-1.5 text-center text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
          >
            На главную
          </Link>
        </div>
      </div>
    </main>
  );
}
