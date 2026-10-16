'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { ApiError } from '@/lib/api';
import { getFlidaSdk, flidaErrorMessage, isAbortError } from '@/lib/flida';
import PulseLogo from '@/components/PulseLogo';

// Liquid Glass: пилюля-инпут с эффектом линзы.
const INPUT_CLS =
  'block w-full transform-gpu rounded-full border border-white/60 bg-white/60 px-5 py-2 text-gray-800 ' +
  'shadow-[inset_0_2px_4px_rgba(0,0,0,0.06),inset_0_-1px_2px_rgba(255,255,255,0.9)] ' +
  'backdrop-blur-xl outline-none transition-all duration-200 ease-out placeholder:text-gray-400 ' +
  'hover:scale-[1.02] focus:scale-[1.02] focus:border-blue-400 focus:ring-2 focus:ring-blue-300/60 ' +
  'motion-reduce:transform-none motion-reduce:transition-none ' +
  'dark:border-white/20 dark:bg-white/10 dark:text-gray-100 dark:placeholder:text-gray-500';

const LABEL_CLS = 'block mb-1.5 ml-2 text-sm font-medium text-gray-600 dark:text-gray-200';

// То же стекло, но с отступом справа под кнопку-глазик.
const INPUT_PW_CLS = INPUT_CLS + ' pr-12';

export default function LoginPage() {
  const { ready, token, login, register } = useAuth();
  const router = useRouter();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [showSigninPw, setShowSigninPw] = useState(false);
  const [showSignupPw, setShowSignupPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Ошибка входа через Флида ID — висит максимум 3 секунды, затем гаснет и чистит URL.
  const [flidaError, setFlidaError] = useState<string | null>(null);
  const [flidaBusy, setFlidaBusy] = useState(false);
  const showFlidaError = (hint: string) => {
    setFlidaError(hint);
    setTimeout(() => {
      setFlidaError(null);
      window.history.replaceState(null, '', window.location.pathname);
    }, 3000);
  };
  useEffect(() => {
    if (window.location.search.includes('flida=error')) {
      showFlidaError('Не удалось войти через Флида ID — попробуй ещё раз или войди по email.');
      return;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (ready && token) router.replace('/workspace');
  }, [ready, token, router]);

  const submitSignin = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(email.trim(), password);
      router.replace('/workspace');
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
      router.replace('/workspace');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Ошибка сети');
    } finally {
      setBusy(false);
    }
  };

  // Вход через Флида ID (Web SDK, public-клиент без секрета):
  // authorize() в redirect-режиме запускает переход на Флиду и возвращает undefined —
  // токены заберёт /flida/finish через autoAuthorization. Прямо из клика вызываем,
  // чтобы браузер не резал навигацию.
  const flidaSignIn = async () => {
    if (flidaBusy) return;
    setFlidaBusy(true);
    try {
      const sdk = await getFlidaSdk();
      await sdk.authorize();
    } catch (err) {
      if (!isAbortError(err)) showFlidaError(flidaErrorMessage(err));
    } finally {
      setFlidaBusy(false);
    }
  };
  // Сегментированный стеклянный контрол: активный таб — выпуклая пилюля.
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
          ? 'flex-1 rounded-full bg-white px-4 py-1.5 text-sm font-medium text-gray-900 shadow-[0_2px_10px_rgba(20,26,38,0.15),inset_0_1px_1px_rgba(255,255,255,0.9)] transition-all duration-200 ease-out hover:scale-[1.05] active:scale-[0.98] motion-reduce:transform-none motion-reduce:transition-none dark:bg-white/20 dark:text-white'
          : 'flex-1 rounded-full px-4 py-1.5 text-sm font-medium text-gray-500 transition-all duration-200 ease-out hover:scale-[1.05] hover:text-gray-800 active:scale-[0.98] motion-reduce:transform-none motion-reduce:transition-none dark:text-gray-400 dark:hover:text-gray-100'
      }
    >
      {label}
    </button>
  );

  const eyeIcon = (open: boolean) => (
    <svg
      className="h-5 w-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {open ? (
        <>
          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
          <circle cx="12" cy="12" r="3" />
        </>
      ) : (
        <>
          <path d="M17.94 17.94A10.5 10.5 0 0 1 12 19c-6.5 0-10-7-10-7a17.6 17.6 0 0 1 4.06-4.94" />
          <path d="M9.9 4.24A10.5 10.5 0 0 1 12 5c6.5 0 10 7 10 7a17.7 17.7 0 0 1-2.16 3.19" />
          <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
          <line x1="2" y1="2" x2="22" y2="22" />
        </>
      )}
    </svg>
  );

  // Кнопка-глазик внутри пилюли-инпута: показывает/скрывает пароль.
  const pwToggle = (show: boolean, setShow: (v: boolean) => void) => (
    <button
      type="button"
      onClick={() => setShow(!show)}
      aria-label={show ? 'Скрыть пароль' : 'Показать пароль'}
      aria-pressed={show}
      className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 transition-all duration-200 ease-out hover:scale-110 hover:text-gray-800 active:scale-95 motion-reduce:transform-none motion-reduce:transition-none dark:text-gray-400 dark:hover:text-gray-100"
    >
      {eyeIcon(show)}
    </button>
  );

  const errBox = error && (
    <div className="mt-3 rounded-2xl border border-red-200/70 bg-red-50/80 px-4 py-2 text-sm text-red-700 backdrop-blur-xl">
      {error}
    </div>
  );

  const flidaLogo = (
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
  );

  const flidaBtn =
    'mt-4 flex w-full transform-gpu items-center justify-center gap-2 rounded-full border border-white/60 bg-white/50 ' +
    'px-4 py-2 text-sm font-bold text-gray-700 backdrop-blur-xl transition-all duration-200 ease-out ' +
    'hover:scale-[1.05] active:scale-[0.98] motion-reduce:transform-none motion-reduce:transition-none ' +
    'shadow-[inset_0_1px_1px_rgba(255,255,255,0.9),0_6px_18px_-8px_rgba(20,26,38,0.4)] ' +
    'hover:bg-white/70 dark:border-white/20 dark:bg-white/10 dark:text-gray-100 dark:hover:bg-white/20';

  const submitBtn =
    'w-full transform-gpu rounded-full bg-[#141a26]/90 px-6 py-2.5 text-sm font-medium tracking-wide text-white ' +
    'backdrop-blur-xl transition-all duration-200 ease-out hover:scale-[1.05] hover:bg-[#141a26] active:scale-[0.98] disabled:opacity-50 ' +
    'motion-reduce:transform-none motion-reduce:transition-none ' +
    'shadow-[inset_0_1px_1px_rgba(255,255,255,0.25),0_14px_30px_-10px_rgba(20,26,38,0.6)] ' +
    'focus:outline-none focus:ring-2 focus:ring-blue-300/60 focus-visible:scale-[1.05]';

  const divider = (label: string) => (
    <div className="mt-3 flex items-center justify-between">
      <span className="w-1/5 border-b border-white/70 dark:border-white/20" />
      <span className="px-2 text-center text-xs uppercase text-gray-500 dark:text-gray-300">{label}</span>
      <span className="w-1/5 border-b border-white/70 dark:border-white/20" />
    </div>
  );

  const cardCls =
    'w-full max-w-md rounded-[32px] border border-white/60 bg-white/40 px-6 py-6 backdrop-blur-xl ' +
    'backdrop-saturate-150 md:px-8 ' +
    'shadow-[inset_1px_1px_2px_rgba(255,255,255,0.8),inset_-1px_-1px_2px_rgba(0,0,0,0.05),0_24px_60px_-16px_rgba(20,26,38,0.35)] ' +
    'dark:border-white/20 dark:bg-gray-900/40';

  const flidaErrorBox = flidaError && (
    <div className="mt-3 rounded-2xl border border-red-200/70 bg-red-50/80 px-4 py-2 text-sm text-red-700 backdrop-blur-xl">
      {flidaError}
    </div>
  );

  // Кнопка Флида ID: запускает Web SDK (public-клиент, секрета нет) прямо из клика.
  const flidaButton = (label: string) => (
    <button type="button" onClick={flidaSignIn} disabled={flidaBusy} className={flidaBtn}>
      {flidaLogo}
      <span>{flidaBusy ? 'Открываем Флида ID…' : label}</span>
    </button>
  );

  return (
    <section
      className="relative min-h-screen bg-cover bg-center"
      style={{ backgroundImage: "url('/city.png')" }}
    >
      {/* Лёгкая вуаль, чтобы стекло читалось и в светлой, и в тёмной теме */}
      <div className="absolute inset-0 bg-gradient-to-b from-white/30 via-white/10 to-white/40 dark:from-black/60 dark:via-black/40 dark:to-black/70" />

      <div className="container relative mx-auto flex min-h-screen flex-col items-center justify-center px-6 py-6">
        <div className="mb-3 w-full max-w-md">
          <Link
            href="/"
            className="inline-block transform-gpu rounded-full border border-white/60 bg-white/40 px-4 py-1.5 text-sm font-medium text-gray-700 backdrop-blur-xl transition-all duration-200 ease-out hover:scale-[1.05] hover:bg-white/60 active:scale-[0.98] motion-reduce:transform-none motion-reduce:transition-none dark:border-white/20 dark:bg-white/10 dark:text-gray-200 dark:hover:bg-white/20"
          >
            ← На главную
          </Link>
        </div>

        {mode === 'signin' ? (
          <div className={cardCls}>
            <div className="mx-auto flex justify-center">
              <PulseLogo size="lg" className="scale-150 my-2" />
            </div>

            <div className="mt-4 flex rounded-full border border-white/60 bg-white/40 p-1 backdrop-blur-xl dark:border-white/20 dark:bg-white/10">
              {tab('signin', 'Вход')}
              {tab('signup', 'Регистрация')}
            </div>

            <p className="mt-2 text-center text-lg text-gray-600 dark:text-gray-200">С возвращением!</p>

            {flidaButton('Войти через Флида ID')}

            {flidaErrorBox}

            {divider('или войдите по почте')}

            <form onSubmit={submitSignin}>
              <div className="mt-3">
                <label className={LABEL_CLS} htmlFor="LoggingEmailAddress">
                  Электронная почта
                </label>
                <input
                    id="LoggingEmailAddress"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    type="email"
                    placeholder="ivan@example.com"
                    className={INPUT_CLS}
                  />
              </div>

              <div className="mt-3">
                <label className={LABEL_CLS} htmlFor="loggingPassword">
                  Пароль
                </label>
                <div className="relative">
                  <input
                    id="loggingPassword"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    type={showSigninPw ? 'text' : 'password'}
                    placeholder="Введите пароль"
                    className={INPUT_PW_CLS}
                  />
                  {pwToggle(showSigninPw, setShowSigninPw)}
                </div>
              </div>

              {errBox}

              <div className="mt-4">
                <button disabled={busy} className={submitBtn}>
                  {busy ? '…' : 'Войти'}
                </button>
              </div>
            </form>
          </div>
        ) : (
          <div className={cardCls}>
            <div className="mx-auto flex justify-center">
              <PulseLogo size="lg" className="scale-150 my-2" />
            </div>

            <div className="mt-4 flex rounded-full border border-white/60 bg-white/40 p-1 backdrop-blur-xl dark:border-white/20 dark:bg-white/10">
              {tab('signin', 'Вход')}
              {tab('signup', 'Регистрация')}
            </div>

            {flidaButton('Зарегистрироваться через Флида ID')}

            {flidaErrorBox}

            {divider('или по почте')}

            <form onSubmit={submitSignup}>
              <div className="mt-3">
                <label className={LABEL_CLS} htmlFor="SignupEmailAddress">
                  Электронная почта
                </label>
                <input
                    id="SignupEmailAddress"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="ivan@example.com"
                    className={INPUT_CLS}
                  />
              </div>

              <div className="mt-3">
                <label className={LABEL_CLS} htmlFor="signupPassword">
                  Пароль
                </label>
                <div className="relative">
                  <input
                    id="signupPassword"
                    type={showSignupPw ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    placeholder="Минимум 6 символов"
                    className={INPUT_PW_CLS}
                  />
                  {pwToggle(showSignupPw, setShowSignupPw)}
                </div>
              </div>

              <div className="mt-3">
                <label className={LABEL_CLS} htmlFor="signupConfirmPassword">
                  Подтверждение пароля
                </label>
                <div className="relative">
                  <input
                    id="signupConfirmPassword"
                    type={showConfirmPw ? 'text' : 'password'}
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    required
                    placeholder="Повторите пароль"
                    className={INPUT_PW_CLS}
                  />
                  {pwToggle(showConfirmPw, setShowConfirmPw)}
                </div>
              </div>

              {errBox}

              <div className="mt-4">
                <button disabled={busy} className={submitBtn}>
                  {busy ? '…' : 'Зарегистрироваться'}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </section>
  );
}
