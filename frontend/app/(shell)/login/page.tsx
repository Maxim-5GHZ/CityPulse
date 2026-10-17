'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Mail, ArrowLeft, Loader2 } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { ApiError } from '@/lib/api';
import { getFlidaSdk, flidaErrorMessage, isAbortError } from '@/lib/flida';
import PulseLogo from '@/components/PulseLogo';
import PasswordInput from '@/components/auth/PasswordInput';
import FlidaButton from '@/components/auth/FlidaButton';

const INPUT_CLS =
  'block w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 pl-10 text-zinc-100 ' +
  'placeholder:text-zinc-500 outline-none backdrop-blur-md transition-colors ' +
  'focus:border-white/30 focus:bg-white/10 focus:ring-2 focus:ring-white/10';

const LABEL_CLS = 'block mb-1.5 ml-1 text-sm font-medium text-zinc-300';

const cardCls =
  'w-full max-w-md rounded-2xl border border-white/15 bg-white/5 px-6 py-8 ' +
  'shadow-2xl shadow-black/40 backdrop-blur-xl backdrop-saturate-150 md:px-8';

const submitBtn =
  'w-full rounded-xl bg-white/10 px-6 py-2.5 text-sm font-medium text-zinc-50 ' +
  'border border-white/15 backdrop-blur-md ' +
  'transition-colors hover:bg-white/15 active:bg-white/20 ' +
  'focus:outline-none focus:ring-2 focus:ring-white/20 ' +
  'disabled:cursor-not-allowed disabled:opacity-60';

const TABS: { id: 'signin' | 'signup'; label: string }[] = [
  { id: 'signin', label: 'Вход' },
  { id: 'signup', label: 'Регистрация' },
];

export default function LoginPage() {
  const { ready, token, login, register } = useAuth();
  const router = useRouter();

  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'signup' && password !== confirm) {
      setError('Пароли не совпадают');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (mode === 'signin') {
        await login(email.trim(), password);
      } else {
        await register(email.trim(), password);
      }
      router.replace('/workspace');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Ошибка сети');
    } finally {
      setBusy(false);
    }
  };

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

  const activeIndex = mode === 'signin' ? 0 : 1;

  const errBox = error && (
    <div className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-200 backdrop-blur-md">
      {error}
    </div>
  );

  const flidaErrorBox = flidaError && (
    <div className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-200 backdrop-blur-md">
      {flidaError}
    </div>
  );

  const divider = (label: string) => (
    <div className="flex items-center gap-3 my-4">
      <span className="flex-1 h-px bg-white/10" />
      <span className="text-xs tracking-wide uppercase text-zinc-400">{label}</span>
      <span className="flex-1 h-px bg-white/10" />
    </div>
  );

  return (
    <section className="relative min-h-screen">
      <div className="flex flex-col justify-center max-w-md min-h-screen px-6 py-10 mx-auto">
        <div className="mb-4">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-medium text-zinc-300 transition-colors hover:bg-white/5 hover:text-zinc-100"
          >
            <ArrowLeft className="w-4 h-4" />
            На главную
          </Link>
        </div>

        <div className={cardCls}>
          <div className="flex justify-center mb-6">
            <PulseLogo size="lg" />
          </div>

          <div className="relative grid grid-cols-2 p-1 mb-5 border rounded-xl border-white/10 bg-white/5 backdrop-blur-md">
            <div
              aria-hidden="true"
              className="absolute inset-y-1 left-1 w-[calc(50%-0.25rem)] rounded-lg bg-white/15 shadow-inner shadow-white/10 transition-transform duration-300 ease-out"
              style={{ transform: `translateX(${activeIndex * 100}%)` }}
            />
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  setMode(t.id);
                  setError(null);
                }}
                className={`relative z-10 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                  mode === t.id
                    ? 'text-zinc-50'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {mode === 'signin' && (
            <p className="mb-4 text-sm text-center text-zinc-400">
              С возвращением! Войдите в свой аккаунт.
            </p>
          )}

          <FlidaButton
            label={
              mode === 'signin'
                ? 'Войти через Флида ID'
                : 'Зарегистрироваться через Флида ID'
            }
            busy={flidaBusy}
            onClick={flidaSignIn}
          />

          {flidaErrorBox}

          {divider(mode === 'signin' ? 'или войдите по почте' : 'или по почте')}

          <form onSubmit={handleSubmit}>
            <div>
              <label
                className={LABEL_CLS}
                htmlFor={
                  mode === 'signin' ? 'LoggingEmailAddress' : 'SignupEmailAddress'
                }
              >
                Электронная почта
              </label>
              <div className="relative">
                <Mail className="absolute w-4 h-4 -translate-y-1/2 pointer-events-none left-3 top-1/2 text-zinc-500" />
                <input
                  id={
                    mode === 'signin' ? 'LoggingEmailAddress' : 'SignupEmailAddress'
                  }
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  type="email"
                  placeholder="ivan@example.com"
                  className={INPUT_CLS}
                />
              </div>
            </div>

            <div className="mt-4">
              <label
                className={LABEL_CLS}
                htmlFor={mode === 'signin' ? 'loggingPassword' : 'signupPassword'}
              >
                Пароль
              </label>
              <PasswordInput
                id={mode === 'signin' ? 'loggingPassword' : 'signupPassword'}
                value={password}
                onChange={setPassword}
                minLength={mode === 'signup' ? 6 : undefined}
                placeholder={
                  mode === 'signup' ? 'Минимум 6 символов' : 'Введите пароль'
                }
              />
            </div>

            <div
              aria-hidden={mode !== 'signup'}
              className={`overflow-hidden transition-[max-height,opacity] duration-300 ease-out ${
                mode === 'signup' ? 'max-h-24 opacity-100' : 'max-h-0 opacity-0'
              }`}
            >
              <div className="pt-4">
                <label
                  className={`block mb-1.5 ml-1 text-sm font-medium text-zinc-300 transition-transform duration-300 ease-out ${
                    mode === 'signup' ? 'translate-y-0' : 'translate-y-1'
                  }`}
                  htmlFor="signupConfirmPassword"
                >
                  Подтверждение пароля
                </label>
                <PasswordInput
                  id="signupConfirmPassword"
                  value={confirm}
                  onChange={setConfirm}
                  placeholder="Повторите пароль"
                  required={mode === 'signup'}
                />
              </div>
            </div>

            {errBox}

            <div className="mt-6">
              <button disabled={busy} className={submitBtn}>
                {busy ? (
                  <span className="inline-flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Подождите…
                  </span>
                ) : mode === 'signin' ? (
                  'Войти'
                ) : (
                  'Зарегистрироваться'
                )}
              </button>
            </div>
          </form>
        </div>

        <p className="mt-6 text-xs text-center text-zinc-500">
          Pulse · Городской конструктор 2040
        </p>
      </div>
    </section>
  );
}