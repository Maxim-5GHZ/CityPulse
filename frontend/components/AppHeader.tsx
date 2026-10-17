'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import PulseLogo from '@/components/PulseLogo';
import { HEADER_LOGO_LINK_CLS, HEADER_PILL_CLS } from '@/components/headerStyle';

/**
 * Навигация хедера: на десктопе — в ряд по центру (`hidden md:flex`),
 * на мобиле те же ссылки уезжают в шторку снизу.
 * Новую кнопку добавлять сюда — она появится в обоих местах сама.
 */
const NAV_ITEMS: { href: string; label: string }[] = [];

/** Пункт шторки/меню: общий интерактив — как всё кликабельное. */
const MENU_ITEM_CLS =
  'flex w-full transform-gpu items-center rounded-xl px-3 py-2 text-left text-sm font-medium ' +
  'text-gray-700 transition-all duration-200 ease-out hover:scale-[1.05] hover:bg-white/60 active:scale-[0.98] active:bg-white/80 ' +
  'motion-reduce:transform-none motion-reduce:transition-none dark:text-gray-200 dark:hover:bg-white/10';

const DIVIDER_CLS = 'my-1 border-t border-white/70 dark:border-white/20';

/**
 * Липкий хедер рабочей области: слева бренд, справа аккаунт с меню (email + выход).
 * Liquid Glass как карточки на `/`, `/login`, `/workspace`: плавающая скруглённая
 * пилюля (`rounded-full`) — мутное стекло с объёмными inset-тенями.
 * Открытое меню кладёт под себя диммированную шторку на весь экран (`fixed inset-0`,
 * `z-30` под хедером): клик в любое место закрывает меню. На мобиле меню —
 * шторка справа во всю высоту (крестик, выезд `motion-safe:animate-sheet-right`,
 * скролл страницы лочится); на десктопе — дропдаун у кнопки.
 */
export default function AppHeader() {
  const { email, role, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement | null>(null);

  // Шторка-подложка сама ловит клики вне меню, здесь только Escape.
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
  }, [open ]);

  // На мобиле открытая шторка лочит скролл страницы.
  useEffect(() => {
    if (!open) return;
    if (!window.matchMedia('(max-width: 767px)').matches) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open ]);

  const close = () => setOpen(false);

  const handleLogout = () => {
    setOpen(false);
    logout();
    router.replace('/login');
  };

  const initial = (email?.trim()?.[0] ?? '•').toUpperCase();

  // Ссылки навигации внутри шторки (мобила): ведут дальше и закрывают её.
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
      <p className="text-xs uppercase text-gray-500 dark:text-gray-400 px-3 pt-2">
        Аккаунт
      </p>
      {email && (
        <p className="truncate px-3 py-1 text-sm font-medium text-gray-700 dark:text-gray-200">
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
          className="fixed inset-0 z-30 bg-[#141a26]/30 backdrop-blur-[2px] motion-safe:animate-fade-in dark:bg-black/50"
        />
      )}
      <header className="sticky top-3 z-40 bg-transparent px-4 sm:px-6">
        <div className={HEADER_PILL_CLS}>
          <Link
            href="/workspace"
            aria-label="Пульс Города — рабочая область"
            className={HEADER_LOGO_LINK_CLS}
          >
            {/* md: русское название шире, lg вытеснял бы кнопку аккаунта на мобиле */}
            <PulseLogo as="span" size="md" />
          </Link>

          {/* Десктоп-навигация: стеклянные пилюли, как «Войти» на лендинге */}
          {NAV_ITEMS.length > 0 && (
          <nav aria-label="Основная навигация" className="hidden min-w-0 flex-1 items-center justify-center gap-2 px-4 md:flex">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={pathname === item.href ? 'page' : undefined}
                className="shrink-0 transform-gpu rounded-full border border-white/60 bg-white/40 px-4 py-1.5 text-sm font-medium text-gray-700 backdrop-blur-xl transition-all duration-200 ease-out hover:scale-[1.05] hover:bg-white/60 active:scale-[0.98] motion-reduce:transform-none motion-reduce:transition-none dark:border-white/20 dark:bg-white/10 dark:text-gray-200 dark:hover:bg-white/20"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          )}

          <div className="relative shrink-0">
            <button
              ref={btnRef}
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-haspopup="menu"
              aria-expanded={open}
              aria-label={email ? `Аккаунт: ${email}` : 'Аккаунт'}
              className="flex items-center gap-2 rounded-full px-2 py-1.5 text-sm font-medium text-gray-700 backdrop-blur-xl transition-all duration-200 ease-out hover:scale-[1.05] hover:bg-white/60 active:scale-[0.98] motion-reduce:transform-none motion-reduce:transition-none dark:text-gray-200 dark:hover:bg-white/20"
            >
              <span
                aria-hidden="true"
                className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-800 text-sm font-medium text-white dark:bg-gray-700"
              >
                {initial}
              </span>
              {email && (
                <span className="hidden max-w-36 truncate sm:block">{email}</span>
              )}
              <svg
                aria-hidden="true"
                width="12"
                height="12"
                viewBox="0 0 12 12"
                className={`shrink-0 transition-transform duration-200 ease-out motion-reduce:transition-none ${open ? 'rotate-180' : ''}`}
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
                className="absolute right-0 top-full mt-2 hidden w-56 origin-top-right rounded-2xl border border-white/60 bg-white/70 p-1.5 shadow-[inset_1px_1px_2px_rgba(255,255,255,0.8),inset_-1px_-1px_2px_rgba(0,0,0,0.05),0_24px_60px_-16px_rgba(20,26,38,0.35)] backdrop-blur-xl backdrop-saturate-150 transition-all duration-150 ease-out motion-reduce:transition-none md:block dark:border-white/20 dark:bg-gray-900/70"
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

      {/* Мобила: шторка справа во всю высоту */}
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Меню аккаунта"
          className="fixed inset-y-0 right-0 z-40 w-72 max-w-[85vw] md:hidden"
        >
          <div className="flex h-full flex-col overflow-y-auto rounded-l-[32px] border border-r-0 border-white/60 bg-white/70 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(0.5rem,env(safe-area-inset-top))] shadow-[inset_1px_1px_2px_rgba(255,255,255,0.8),-18px_0_50px_-20px_rgba(20,26,38,0.5)] backdrop-blur-xl backdrop-saturate-150 motion-safe:animate-sheet-right dark:border-white/20 dark:bg-gray-900/70">
            <div className="flex items-center justify-between py-1">
              <p className="px-3 text-xs uppercase text-gray-500 dark:text-gray-400">
                Аккаунт
              </p>
              <button
                type="button"
                onClick={close}
                aria-label="Закрыть меню"
                className="rounded-full p-2 text-gray-500 transition-all duration-200 ease-out hover:scale-110 hover:bg-white/60 hover:text-gray-800 active:scale-95 motion-reduce:transform-none motion-reduce:transition-none dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-gray-100"
              >
                <svg
                  aria-hidden="true"
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                >
                  <path d="M4 4l8 8M12 4l-8 8" />
                </svg>
              </button>
            </div>
            {email && (
              <p className="truncate px-3 pb-1 text-sm font-medium text-gray-700 dark:text-gray-200">
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
