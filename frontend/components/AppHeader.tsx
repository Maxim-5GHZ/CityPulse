'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { X } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import PulseLogo from '@/components/PulseLogo';

/**
 * Навигация хедера: на десктопе — в ряд по центру, на мобиле — шторка справа.
 * Новую кнопку добавлять сюда — она появится в обоих местах сама.
 */
const NAV_ITEMS: { href: string; label: string }[] = [];

const MENU_ITEM_CLS =
  'flex w-full items-center rounded-lg px-3 py-2 text-left text-sm font-medium ' +
  'text-zinc-300 transition-colors hover:bg-white/5 hover:text-zinc-100';

const DIVIDER_CLS = 'my-1 border-t border-white/10';

export default function AppHeader() {
  const { email, role, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement | null>(null);

  // Escape закрывает меню.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        btnRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // На мобиле открытая шторка лочит скролл страницы.
  useEffect(() => {
    if (!open) return;
    if (!window.matchMedia('(max-width: 767px)').matches) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const close = () => setOpen(false);

  const handleLogout = () => {
    setOpen(false);
    logout();
    router.replace('/login');
  };

  const initial = (email?.trim()?.[0] ?? '•').toUpperCase();

  const sheetNav = NAV_ITEMS.map((item) => (
    <Link
      key={item.href}
      href={item.href}
      role="menuitem"
      aria-current={pathname === item.href ? 'page' : undefined}
      onClick={close}
      className={MENU_ITEM_CLS}
    >
      {item.label}
    </Link>
  ));

  const accountBlock = (
    <>
      <p className="px-3 pt-2 text-xs tracking-wide uppercase text-zinc-500">
        Аккаунт
      </p>
      {email && (
        <p className="px-3 py-1 text-sm font-medium truncate text-zinc-200">
          {email}
        </p>
      )}
    </>
  );

  return (
    <>
      {open && (
        <div
          aria-hidden="true"
          onClick={close}
          className="fixed inset-0 z-30 bg-black/40 backdrop-blur-[2px]"
        />
      )}

      {/* Плоский фулл-вайд хедер: без закруглений, с тонким бордером снизу
          и полупрозрачной плёнкой + blur. Контент внутри ограничен max-w. */}
      <header className="sticky top-0 z-40 border-b border-white/10 bg-zinc-950/60 backdrop-blur-xl backdrop-saturate-150">
        <div className="mx-auto flex h-14 w-full max-w-[1500px] items-center gap-4 px-4 sm:px-6">
          <Link
            href="/workspace"
            aria-label="CityPulse — рабочая область"
            className="relative px-1 transition-colors rounded-lg shrink-0 hover:bg-white/5"
          >
            <PulseLogo as="span" size="lg" />
          </Link>

          {NAV_ITEMS.length > 0 && (
            <nav
              aria-label="Основная навигация"
              className="items-center flex-1 hidden min-w-0 gap-1 md:flex"
            >
              {NAV_ITEMS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={pathname === item.href ? 'page' : undefined}
                  className="shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium text-zinc-300 transition-colors hover:bg-white/5 hover:text-zinc-100"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          )}

          {/* Свободное место, чтобы аккаунт всегда уезжал вправо,
              даже если NAV_ITEMS пуст. */}
          <div className="flex-1" />

          <div className="relative shrink-0">
            <button
              ref={btnRef}
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-haspopup="menu"
              aria-expanded={open}
              aria-label={email ? `Аккаунт: ${email}` : 'Аккаунт'}
              className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium text-zinc-200 transition-colors hover:bg-white/5"
            >
              <span
                aria-hidden="true"
                className="flex items-center justify-center w-8 h-8 text-sm font-medium border rounded-full border-white/10 bg-white/10 text-zinc-100"
              >
                {initial}
              </span>
              {email && (
                <span className="hidden truncate max-w-36 sm:block">{email}</span>
              )}
              <svg
                aria-hidden="true"
                width="12"
                height="12"
                viewBox="0 0 12 12"
                className={`shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
              >
                <path
                  d="M2.5 4.5 6 8l3.5-3.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>

            {/* Десктоп: дропдаун у кнопки */}
            {open && (
              <div
                role="menu"
                aria-label="Меню аккаунта"
                className="absolute right-0 top-full mt-2 hidden w-56 origin-top-right rounded-xl border border-white/10 bg-zinc-900/95 p-1.5 shadow-2xl shadow-black/50 backdrop-blur-md md:block"
              >
                {accountBlock}
                {role === 'ADMIN' && (
                  <Link href="/admin" role="menuitem" onClick={close} className={MENU_ITEM_CLS}>
                    Админка
                  </Link>
                )}
                <div className={DIVIDER_CLS} />
                <button
                  // eslint-disable-next-line jsx-a11y/no-autofocus
                  autoFocus
                  type="button"
                  role="menuitem"
                  onClick={handleLogout}
                  className={MENU_ITEM_CLS}
                >
                  Выйти
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Мобила: шторка справа */}
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Меню аккаунта"
          className="fixed inset-y-0 right-0 z-40 w-72 max-w-[85vw] md:hidden"
        >
          <div className="flex h-full flex-col overflow-y-auto rounded-l-2xl border border-r-0 border-white/10 bg-zinc-900/95 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(0.5rem,env(safe-area-inset-top))] shadow-2xl shadow-black/50 backdrop-blur-md">
            <div className="flex items-center justify-between py-1">
              <p className="px-3 text-xs tracking-wide uppercase text-zinc-500">
                Аккаунт
              </p>
              <button
                type="button"
                onClick={close}
                aria-label="Закрыть меню"
                className="p-2 transition-colors rounded-lg text-zinc-400 hover:bg-white/5 hover:text-zinc-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {email && (
              <p className="px-3 pb-1 text-sm font-medium truncate text-zinc-200">
                {email}
              </p>
            )}
            <div className={DIVIDER_CLS} />
            {role === 'ADMIN' && (
              <Link href="/admin" role="menuitem" onClick={close} className={MENU_ITEM_CLS}>
                Админка
              </Link>
            )}
            {NAV_ITEMS.length > 0 && (
              <>
                {sheetNav}
                <div className={DIVIDER_CLS} />
              </>
            )}
            <button
              type="button"
              role="menuitem"
              onClick={handleLogout}
              className={`${MENU_ITEM_CLS} mt-auto`}
            >
              Выйти
            </button>
          </div>
        </div>
      )}
    </>
  );
}