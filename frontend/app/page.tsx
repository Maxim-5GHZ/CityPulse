'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { ReactNode } from 'react';
import Link from 'next/link';
import QRCode from 'react-qr-code';
import { useAuth } from '@/lib/auth';
import PulseLogo from '@/components/PulseLogo';

const SITE_URL = 'https://hotcodeband.ru';
const GITHUB_URL = 'https://github.com/Maxim-5GHZ/CityPulse';

interface Slide {
  id: string;
  badge: string;
  title: string;
  subtitle: string;
  content: ReactNode;
}

// То же стекло, что было на QR-лендинге: hero и Контакты.
const cardCls =
  'w-full max-w-xl rounded-[32px] border border-white/60 bg-white/40 px-6 py-6 backdrop-blur-xl ' +
  'backdrop-saturate-150 md:px-8 ' +
  'shadow-[inset_1px_1px_2px_rgba(255,255,255,0.8),inset_-1px_-1px_2px_rgba(0,0,0,0.05),0_24px_60px_-16px_rgba(20,26,38,0.35)] ' +
  'dark:border-white/20 dark:bg-gray-900/40';

// Стеклянная пилюля для кнопок внутри слайдов (широкая, с min-w).
const glassPill =
  'inline-block min-w-40 transform-gpu rounded-full border border-white/60 bg-white/40 px-4 py-1.5 text-center text-sm font-medium text-gray-700 backdrop-blur-xl ' +
  'transition-all duration-200 ease-out hover:scale-[1.05] hover:bg-white/60 active:scale-[0.98] ' +
  'motion-reduce:transform-none motion-reduce:transition-none ' +
  'dark:border-white/20 dark:bg-white/10 dark:text-gray-200 dark:hover:bg-white/20';

// Компактная пилюля для хедера: без min-w, иначе кнопки огромные и разъезжаются на мобиле.
const glassPillSm =
  'inline-block transform-gpu rounded-full border border-white/60 bg-white/40 px-4 py-1.5 text-center text-sm font-medium text-gray-700 backdrop-blur-xl ' +
  'transition-all duration-200 ease-out hover:scale-[1.05] hover:bg-white/60 active:scale-[0.98] ' +
  'motion-reduce:transform-none motion-reduce:transition-none ' +
  'dark:border-white/20 dark:bg-white/10 dark:text-gray-200 dark:hover:bg-white/20';

// Тёмное стекло сабмита из /login: primary-кнопки deck.
const darkBtn =
  'inline-block min-w-40 transform-gpu rounded-full bg-[#141a26]/90 px-6 py-2.5 text-center text-sm font-medium tracking-wide text-white ' +
  'backdrop-blur-xl transition-all duration-200 ease-out hover:scale-[1.05] hover:bg-[#141a26] active:scale-[0.98] ' +
  'motion-reduce:transform-none motion-reduce:transition-none ' +
  'shadow-[inset_0_1px_1px_rgba(255,255,255,0.25),0_14px_30px_-10px_rgba(20,26,38,0.6)] ' +
  'focus:outline-none focus:ring-2 focus:ring-blue-300/60 focus-visible:scale-[1.05]';

// QR-ссылка обязана быть сплошной bg-white (иначе не сканируется): тени не трогать.
const qrLinkCls =
  'transform-gpu rounded-2xl border border-white/60 bg-white p-4 ' +
  'shadow-[inset_0_2px_4px_rgba(0,0,0,0.06),inset_0_-1px_2px_rgba(255,255,255,0.9),0_6px_18px_-8px_rgba(20,26,38,0.4)] ' +
  'transition-all duration-200 ease-out hover:scale-[1.05] active:scale-[0.98] ' +
  'motion-reduce:transform-none motion-reduce:transition-none';

// Общий QR-ряд hero и Контактов: два QR в ряд, чтобы не дублировать разметку.
function QrRow() {
  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      <figure className="flex flex-col items-center gap-2">
        <a href={SITE_URL} target="_blank" rel="noopener noreferrer" aria-label="Наш Сайт" className={qrLinkCls}>
          <QRCode value={SITE_URL} size={180} />
        </a>
        <figcaption className="text-sm font-medium text-gray-600 dark:text-gray-200">Наш Сайт</figcaption>
      </figure>
      <figure className="flex flex-col items-center gap-2">
        <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" aria-label="Наш GitHub" className={qrLinkCls}>
          <QRCode value={GITHUB_URL} size={180} />
        </a>
        <figcaption className="text-sm font-medium text-gray-600 dark:text-gray-200">Наш GitHub</figcaption>
      </figure>
    </div>
  );
}

export default function PresentationPage() {
  const { token } = useAuth();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const containerRef = useRef<HTMLElement>(null);
  const touchStartY = useRef<number>(0);
  const lastScrollTime = useRef<number>(0);

  const loginHref = token ? '/workspace' : '/login';
  const loginLabel = token ? 'В интерфейс' : 'Войти';

  // Всего слайдов — через ref, чтобы контент слайдов (объявлен ниже) мог
  // звать goToSlide без захардкоженного числа и без TDZ на totalSlides.
  const totalRef = useRef(1);

  const goToSlide = useCallback((index: number) => {
    if (isTransitioning) return;
    const target = Math.max(0, Math.min(index, totalRef.current - 1));
    if (target === currentSlide) return;
    setIsTransitioning(true);
    setCurrentSlide(target);
    setTimeout(() => {
      setIsTransitioning(false);
    }, 600);
  }, [currentSlide, isTransitioning]);

  const slides: Slide[] = [
    {
      id: 'hero',
      badge: 'О проекте',
      title: 'Пульс твоего города',
      subtitle:
        'CityPulse собирает жизнь города в одном месте: места, события и настроения.',
      content: (
        <div className={`${cardCls} flex flex-col items-center gap-5`}>
          <div className="mx-auto flex justify-center">
            <PulseLogo as="span" size="lg" className="scale-150 my-2 sm:scale-[2.25] sm:my-16" />
          </div>
          <QrRow />
          <div className="flex flex-col items-center gap-3 sm:flex-row">
            <Link href="/about" className={darkBtn}>
              Контакты
            </Link>
            <Link href={loginHref} className={glassPill}>
              {loginLabel}
            </Link>
          </div>

        </div>
      ),
    },
  ];

  const totalSlides = slides.length;
  const lastSlide = totalSlides - 1;

  useEffect(() => {
    totalRef.current = totalSlides;
  }, [totalSlides]);

  const nextSlide = useCallback(() => {
    goToSlide(currentSlide + 1);
  }, [currentSlide, goToSlide]);

  const prevSlide = useCallback(() => {
    goToSlide(currentSlide - 1);
  }, [currentSlide, goToSlide]);

  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      // Если контент слайда выше вьюпорта (зум), сначала даём домотать его
      // нативным скроллом — и только на краю переключаем слайд.
      const el = containerRef.current;
      if (el) {
        const canDown = el.scrollHeight - el.scrollTop - el.clientHeight > 4;
        const canUp = el.scrollTop > 4;
        if ((e.deltaY > 0 && canDown) || (e.deltaY < 0 && canUp)) return;
      }
      e.preventDefault();
      const now = Date.now();
      if (now - lastScrollTime.current < 700) return;
      lastScrollTime.current = now;

      if (e.deltaY > 25) {
        nextSlide();
      } else if (e.deltaY < -25) {
        prevSlide();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const tag = t?.tagName ?? '';
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      const onControl = !!t?.closest?.('button, a');
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight' || e.key === 'PageDown' || (e.key === ' ' && !onControl)) {
        e.preventDefault();
        nextSlide();
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        prevSlide();
      }
    };

    const handleTouchStart = (e: TouchEvent) => {
      touchStartY.current = e.touches[0].clientY;
    };

    const handleTouchEnd = (e: TouchEvent) => {
      const touchEndY = e.changedTouches[0].clientY;
      const diff = touchStartY.current - touchEndY;
      if (Math.abs(diff) > 50) {
        if (diff > 0) nextSlide();
        else prevSlide();
      }
    };

    window.addEventListener('wheel', handleWheel, { passive: false });
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('touchstart', handleTouchStart);
    window.addEventListener('touchend', handleTouchEnd);

    return () => {
      window.removeEventListener('wheel', handleWheel);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [nextSlide, prevSlide]);

  const current = slides[currentSlide];

  return (
    <section
      className="relative h-screen w-screen overflow-hidden bg-cover bg-center"
      style={{ backgroundImage: "url('/city.png')" }}
    >
      {/* Та же вуаль, что была на лендинге — стекло читается в обеих темах */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-b from-white/30 via-white/10 to-white/40 dark:from-black/60 dark:via-black/40 dark:to-black/70"
      />

      <header className="absolute inset-x-0 top-0 z-30 flex h-16 items-center justify-between gap-2 px-4 sm:px-10">
        <button
          type="button"
          onClick={() => goToSlide(0)}
          aria-label="К началу презентации"
          className="shrink-0 transition-all duration-200 ease-out hover:scale-[1.05] active:scale-[0.98] motion-reduce:transform-none motion-reduce:transition-none"
        >
          <PulseLogo as="span" size="lg" />
        </button>

        <div className="absolute left-1/2 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 items-center gap-2 lg:flex">
          {slides.map((s, idx) => (
            <button
              key={s.id}
              type="button"
              onClick={() => goToSlide(idx)}
              aria-label={`Слайд ${idx + 1}: ${s.title}`}
              aria-current={idx === currentSlide ? 'true' : undefined}
              title={`Слайд ${idx + 1}: ${s.title}`}
              className={`h-1.5 rounded-full transition-all duration-500 motion-reduce:transition-none ${
                idx === currentSlide
                  ? 'w-8 bg-gray-800 dark:bg-white'
                  : 'w-2 bg-gray-300 hover:bg-gray-400 dark:bg-white/40 dark:hover:bg-white/60'
              }`}
            />
          ))}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Link href="/about" className={glassPillSm}>
            Контакты
          </Link>
          <Link href={loginHref} className={glassPillSm}>
            {loginLabel}
          </Link>
        </div>
      </header>

      {/* Безопасное центрирование: без justify-center (иначе верх переполненного
          слайда уходит за шапку и недоступен), центрит m-auto на контенте. */}
      <main ref={containerRef} className="relative z-10 mx-auto flex h-full w-full max-w-7xl flex-col items-center overflow-y-auto px-6 pb-16 pt-20 [scrollbar-width:none] sm:px-12 [&::-webkit-scrollbar]:hidden">
        <div
          key={current.id}
          className="flex w-full m-auto flex-col items-center motion-safe:animate-fade-in"
        >
          <p className="shrink-0 mb-3 rounded-full border border-white/60 bg-white/40 px-3 py-1 text-xs uppercase text-gray-600 backdrop-blur-xl dark:border-white/20 dark:bg-white/10 dark:text-gray-200">
            {current.badge}
          </p>

          <h1 className="shrink-0 mb-3 max-w-4xl text-center text-2xl font-black leading-[1.15] tracking-tight text-gray-900 drop-shadow-[0_1px_12px_rgba(255,255,255,0.9)] sm:text-4xl lg:text-[40px] dark:text-gray-100 dark:drop-shadow-[0_1px_12px_rgba(0,0,0,0.9)]">
            {current.title}
          </h1>

          <p className="shrink-0 mb-6 max-w-3xl text-center text-sm font-medium leading-relaxed text-gray-700 sm:text-base dark:text-gray-100">
            {current.subtitle}
          </p>

          <div className="flex w-full shrink-0 justify-center">{current.content}</div>
        </div>
      </main>

      <footer className="absolute inset-x-0 bottom-0 z-30 flex h-14 items-center justify-between px-6 sm:px-10">
        <div className="flex items-center gap-2 text-sm font-mono text-gray-700 dark:text-gray-200">
          <span className="font-bold text-gray-900 dark:text-gray-100">{String(currentSlide + 1).padStart(2, '0')}</span>
          <span>/</span>
          <span>{String(totalSlides).padStart(2, '0')}</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={prevSlide}
            disabled={currentSlide === 0}
            aria-label="Предыдущий слайд"
            title="Предыдущий слайд"
            className="flex h-10 w-10 transform-gpu items-center justify-center rounded-full bg-[#141a26]/90 text-base text-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.25),0_14px_30px_-10px_rgba(20,26,38,0.6)] backdrop-blur-xl transition-all duration-200 ease-out hover:scale-[1.05] hover:bg-[#141a26] active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40 motion-reduce:transform-none motion-reduce:transition-none focus:outline-none focus:ring-2 focus:ring-blue-300/60"
          >
            <span aria-hidden="true">↑</span>
          </button>
          <button
            type="button"
            onClick={nextSlide}
            disabled={currentSlide === lastSlide}
            aria-label="Следующий слайд"
            title="Следующий слайд"
            className="flex h-10 w-10 transform-gpu items-center justify-center rounded-full bg-[#141a26]/90 text-base text-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.25),0_14px_30px_-10px_rgba(20,26,38,0.6)] backdrop-blur-xl transition-all duration-200 ease-out hover:scale-[1.05] hover:bg-[#141a26] active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40 motion-reduce:transform-none motion-reduce:transition-none focus:outline-none focus:ring-2 focus:ring-blue-300/60"
          >
            <span aria-hidden="true">↓</span>
          </button>
        </div>
      </footer>
    </section>
  );
}
