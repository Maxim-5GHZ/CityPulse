'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { ApiError } from '@/lib/api';
import PulseLogo from '@/components/PulseLogo';

export default function LoginPage() {
  const { ready, token, login, register } = useAuth();
  const router = useRouter();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [username, setUsername] = useState(''); // только для вида, API его не хранит
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Флида ID отклонил вход (бэк вернул 302 на /login?flida=error) — показываем плашку.
  const [flidaError, setFlidaError] = useState(false);
  useEffect(() => {
    if (window.location.search.includes('flida=error')) {
      setFlidaError(true);
    }
  }, []);

  useEffect(() => {
    if (ready && token) router.replace('/');
  }, [ready, token, router]);

  const submitSignin = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(email.trim(), password);
      router.replace('/');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Ошибка сети');
    } finally {
      setBusy(false);
    }
  };

  const submitSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      setError('Пароли не совпадают');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await register(email.trim(), password);
      router.replace('/');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Ошибка сети');
    } finally {
      setBusy(false);
    }
  };

  const tab = (m: 'signin' | 'signup', label: string) => (
    <button
      key={m}
      type="button"
      onClick={() => {
        setMode(m);
        setError(null);
      }}
      className={
        mode === m
          ? 'w-1/3 pb-2 font-medium text-center text-gray-800 border-b-2 border-blue-500 dark:border-blue-400 dark:text-white'
          : 'w-1/3 pb-2 font-medium text-center text-gray-500 border-b dark:border-gray-400 dark:text-gray-300'
      }
    >
      {label}
    </button>
  );

  const errBox = error && (
    <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
  );

  const flidaLogo = (
    <svg className="w-6 h-6" viewBox="0 0 40 40" aria-hidden="true">
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
  );

  return (
    <section className="bg-white dark:bg-gray-900">
      <div className="container flex items-center justify-center min-h-screen px-6 py-4 mx-auto">
        {mode === 'signin' ? (
          <div className="flex w-full max-w-sm mx-auto overflow-hidden bg-white rounded-lg shadow-lg dark:bg-gray-800 lg:max-w-4xl">
            <div
              className="hidden bg-cover lg:block lg:w-1/2"
              style={{
                backgroundImage:
                  "url('https://images.unsplash.com/photo-1606660265514-358ebbadc80d?ixid=MXwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHw%3D&ixlib=rb-1.2.1&auto=format&fit=crop&w=1575&q=80')",
              }}
            />

            <div className="w-full px-6 py-6 md:px-8 lg:w-1/2">
              <div className="flex justify-center mx-auto">
                <PulseLogo size="sm" />
              </div>

              <div className="flex items-center justify-center mt-4">
                {tab('signin', 'Вход')}
                {tab('signup', 'Регистрация')}
              </div>

              <p className="mt-2 text-lg text-center text-gray-600 dark:text-gray-200">С возвращением!</p>

              {/*
                ═══════════════════════════════════════════════════════════════
                ФРОНТЕНДЕР, НЕ ПЕРЕЖИВАЙ ПРО ЭТУ КНОПКУ.
                Это обычная ссылка, никакой логики тут нет и не надо:
                1. Клик уходит на /backend/... — Next-прокси отдаёт его Java-бэкенду.
                2. Java сам редиректит браузер на страницу Флиды, сам меняет код
                   на токены С СЕКРЕТОМ (секрет живёт только в env бэкенда) и сам
                   кладёт юзера в Postgres.
                3. Успех возвращается 302 на /flida/finish#token=НАШ_JWT —
                   та страница просто кладёт токен в localStorage (см. finish/page.tsx).
                4. Ошибка возвращается 302 сюда с ?flida=error — показываем плашку ниже.
                Ни SDK, ни fetch, ни секретов на этой стороне. Не чинить — работает.
                ═══════════════════════════════════════════════════════════════
              */}
              <a
                href="/backend/auth/flida/login"
                className="flex items-center justify-center mt-3 w-full text-gray-600 transition-colors duration-300 transform border rounded-lg dark:border-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600"
              >
                <div className="px-4 py-1.5">{flidaLogo}</div>

                <span className="w-5/6 px-4 py-2 font-bold text-center">Войти через Флида ID</span>
              </a>

              {flidaError && (
                <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  Не удалось войти через Флида ID — попробуй ещё раз или войди по email.
                </div>
              )}

              <div className="flex items-center justify-between mt-3">
                <span className="w-1/5 border-b dark:border-gray-600 lg:w-1/4" />
                <span className="text-xs text-center text-gray-500 uppercase dark:text-gray-400">
                  или войдите по почте
                </span>
                <span className="w-1/5 border-b dark:border-gray-400 lg:w-1/4" />
              </div>

              <form onSubmit={submitSignin}>
                <div className="mt-3">
                  <label
                    className="block mb-1 text-sm font-medium text-gray-600 dark:text-gray-200"
                    htmlFor="LoggingEmailAddress"
                  >
                    Электронная почта
                  </label>
                  <input
                    id="LoggingEmailAddress"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    type="email"
                    className="block w-full px-4 py-1.5 text-gray-700 bg-white border rounded-lg dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 focus:border-blue-400 focus:ring-opacity-40 dark:focus:border-blue-300 focus:outline-none focus:ring focus:ring-blue-300"
                  />
                </div>

                <div className="mt-3">
                  <div className="flex justify-between">
                    <label
                      className="block mb-1 text-sm font-medium text-gray-600 dark:text-gray-200"
                      htmlFor="loggingPassword"
                    >
                      Пароль
                    </label>
                  </div>

                  <input
                    id="loggingPassword"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    type="password"
                    className="block w-full px-4 py-1.5 text-gray-700 bg-white border rounded-lg dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 focus:border-blue-400 focus:ring-opacity-40 dark:focus:border-blue-300 focus:outline-none focus:ring focus:ring-blue-300"
                  />
                </div>

                {errBox}

                <div className="mt-4">
                  <button
                    disabled={busy}
                    className="w-full px-6 py-2.5 text-sm font-medium tracking-wide text-white capitalize transition-colors duration-300 transform bg-gray-800 rounded-lg hover:bg-gray-700 focus:outline-none focus:ring focus:ring-gray-300 focus:ring-opacity-50 disabled:opacity-50"
                  >
                    {busy ? '…' : 'Войти'}
                  </button>
                </div>
              </form>

              <div className="flex items-center justify-between mt-3">
                <span className="w-1/5 border-b dark:border-gray-600 md:w-1/4" />
                <button
                  type="button"
                  onClick={() => {
                    setMode('signup');
                    setError(null);
                  }}
                  className="text-xs text-gray-500 uppercase dark:text-gray-400 hover:underline"
                >
                  или зарегистрироваться
                </button>
                <span className="w-1/5 border-b dark:border-gray-600 md:w-1/4" />
              </div>
            </div>
          </div>
        ) : (
          <div className="flex w-full max-w-sm mx-auto overflow-hidden bg-white rounded-lg shadow-lg dark:bg-gray-800 lg:max-w-4xl">
            <div
              className="hidden bg-cover lg:block lg:w-1/2"
              style={{
                backgroundImage:
                  "url('https://images.unsplash.com/photo-1606660265514-358ebbadc80d?ixid=MXwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHw%3D&ixlib=rb-1.2.1&auto=format&fit=crop&w=1575&q=80')",
              }}
            />

            <div className="w-full px-6 py-6 md:px-8 lg:w-1/2">
              <div className="flex justify-center mx-auto">
                <PulseLogo size="sm" />
              </div>

              <div className="flex items-center justify-center mt-4">
                {tab('signin', 'Вход')}
                {tab('signup', 'Регистрация')}
              </div>

              <p className="mt-2 text-lg text-center text-gray-600 dark:text-gray-200">Создайте аккаунт!</p>

              <a
                href="/backend/auth/flida/login"
                className="flex items-center justify-center mt-3 w-full text-gray-600 transition-colors duration-300 transform border rounded-lg dark:border-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600"
              >
                <div className="px-4 py-1.5">{flidaLogo}</div>

                <span className="w-5/6 px-4 py-2 font-bold text-center">Войти через Флида ID</span>
              </a>

              {flidaError && (
                <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  Не удалось войти через Флида ID — попробуй ещё раз или зарегистрируйся по email.
                </div>
              )}

              <div className="flex items-center justify-between mt-3">
                <span className="w-1/5 border-b dark:border-gray-600 lg:w-1/4" />
                <span className="text-xs text-center text-gray-500 uppercase dark:text-gray-400">
                  или зарегистрируйтесь по почте
                </span>
                <span className="w-1/5 border-b dark:border-gray-400 lg:w-1/4" />
              </div>

              <form onSubmit={submitSignup}>
                <div className="mt-3">
                  <label
                    className="block mb-1 text-sm font-medium text-gray-600 dark:text-gray-200"
                    htmlFor="SignupUsername"
                  >
                    Имя пользователя
                  </label>
                  <input
                    id="SignupUsername"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="block w-full px-4 py-1.5 text-gray-700 bg-white border rounded-lg dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 focus:border-blue-400 focus:ring-opacity-40 dark:focus:border-blue-300 focus:outline-none focus:ring focus:ring-blue-300"
                  />
                </div>

                <div className="mt-3">
                  <label
                    className="block mb-1 text-sm font-medium text-gray-600 dark:text-gray-200"
                    htmlFor="SignupEmailAddress"
                  >
                    Электронная почта
                  </label>
                  <input
                    id="SignupEmailAddress"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="block w-full px-4 py-1.5 text-gray-700 bg-white border rounded-lg dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 focus:border-blue-400 focus:ring-opacity-40 dark:focus:border-blue-300 focus:outline-none focus:ring focus:ring-blue-300"
                  />
                </div>

                <div className="mt-3">
                  <label
                    className="block mb-1 text-sm font-medium text-gray-600 dark:text-gray-200"
                    htmlFor="signupPassword"
                  >
                    Пароль
                  </label>
                  <input
                    id="signupPassword"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    className="block w-full px-4 py-1.5 text-gray-700 bg-white border rounded-lg dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 focus:border-blue-400 focus:ring-opacity-40 dark:focus:border-blue-300 focus:outline-none focus:ring focus:ring-blue-300"
                  />
                </div>

                <div className="mt-3">
                  <label
                    className="block mb-1 text-sm font-medium text-gray-600 dark:text-gray-200"
                    htmlFor="signupConfirmPassword"
                  >
                    Подтверждение пароля
                  </label>
                  <input
                    id="signupConfirmPassword"
                    type="password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    required
                    className="block w-full px-4 py-1.5 text-gray-700 bg-white border rounded-lg dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 focus:border-blue-400 focus:ring-opacity-40 dark:focus:border-blue-300 focus:outline-none focus:ring focus:ring-blue-300"
                  />
                </div>

                {errBox}

                <div className="mt-4">
                  <button
                    disabled={busy}
                    className="w-full px-6 py-2.5 text-sm font-medium tracking-wide text-white capitalize transition-colors duration-300 transform bg-gray-800 rounded-lg hover:bg-gray-700 focus:outline-none focus:ring focus:ring-gray-300 focus:ring-opacity-50 disabled:opacity-50"
                  >
                    {busy ? '…' : 'Зарегистрироваться'}
                  </button>
                </div>
              </form>

              
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
