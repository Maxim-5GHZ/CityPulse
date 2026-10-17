'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { ReactNode } from 'react';
import Link from 'next/link';
import QRCode from 'react-qr-code';
import { useAuth } from '@/lib/auth';
import PulseLogo from '@/components/PulseLogo';
import CadComparisonSimulator from '@/components/pitch/CadComparisonSimulator';
import NetworkGraphSimulator from '@/components/pitch/NetworkGraphSimulator';
import UrbanJourneyStaircase from '@/components/pitch/UrbanJourneyStaircase';
import AudienceSimulator from '@/components/pitch/AudienceSimulator';
import RoiSimulator from '@/components/pitch/RoiSimulator';

const SITE_URL = 'https://hotcodeband.ru';
const GITHUB_URL = 'https://github.com/Maxim-5GHZ/CityPulse';

const cardCls =
  'w-full max-w-xl rounded-[32px] border border-white/60 bg-white/50 px-6 py-6 backdrop-blur-2xl ' +
  'backdrop-saturate-200 md:px-8 ' +
  'shadow-[inset_1px_1px_2px_rgba(255,255,255,0.9),inset_-1px_-1px_2px_rgba(0,0,0,0.05),0_24px_60px_-16px_rgba(20,26,38,0.35)] ' +
  'dark:border-white/20 dark:bg-gray-900/60';

const glassPill =
  'inline-block min-w-40 transform-gpu rounded-full border border-gray-400/50 bg-white/70 px-4 py-1.5 text-center text-sm font-bold text-gray-800 shadow-sm backdrop-blur-xl ' +
  'transition-all duration-200 ease-out hover:scale-[1.05] hover:bg-white/90 active:scale-[0.98] ' +
  'motion-reduce:transform-none motion-reduce:transition-none ' +
  'dark:border-white/20 dark:bg-white/20 dark:text-gray-100 dark:hover:bg-white/30';

const glassPillSm =
  'inline-block transform-gpu rounded-full border border-gray-400/50 bg-white/70 px-4 py-1.5 text-center text-sm font-bold text-gray-800 shadow-sm backdrop-blur-xl ' +
  'transition-all duration-200 ease-out hover:scale-[1.05] hover:bg-white/90 active:scale-[0.98] ' +
  'motion-reduce:transform-none motion-reduce:transition-none ' +
  'dark:border-white/20 dark:bg-white/20 dark:text-gray-100 dark:hover:bg-white/30';

const darkBtn =
  'inline-block min-w-40 transform-gpu rounded-full bg-[#141a26]/90 px-6 py-2.5 text-center text-sm font-bold tracking-wide text-white ' +
  'backdrop-blur-xl transition-all duration-200 ease-out hover:scale-[1.05] hover:bg-[#141a26] active:scale-[0.98] ' +
  'motion-reduce:transform-none motion-reduce:transition-none ' +
  'shadow-[inset_0_1px_1px_rgba(255,255,255,0.25),0_14px_30px_-10px_rgba(20,26,38,0.6)] ' +
  'focus:outline-none focus:ring-2 focus:ring-blue-300/60 focus-visible:scale-[1.05]';

const qrLinkCls =
  'transform-gpu rounded-2xl border border-white/60 bg-white p-4 ' +
  'shadow-[inset_0_2px_4px_rgba(0,0,0,0.06),inset_0_-1px_2px_rgba(255,255,255,0.9),0_6px_18px_-8px_rgba(20,26,38,0.4)] ' +
  'transition-all duration-200 ease-out hover:scale-[1.05] active:scale-[0.98] ' +
  'motion-reduce:transform-none motion-reduce:transition-none';

function QrRow() {
  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      
      <figure className="flex flex-col items-center gap-2">
        <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" aria-label="Наш GitHub" className={qrLinkCls}>
          <QRCode value={GITHUB_URL} size={180} />
        </a>
        <figcaption className="text-sm font-bold text-gray-800 dark:text-gray-100">Наш GitHub</figcaption>
      </figure>
    </div>
  );
}

interface Slide {
  id: string;
  badge: string;
  title: string;
  subtitle: string;
  content: ReactNode;
}

export default function PresentationPage() {
  const { token } = useAuth();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const containerRef = useRef<HTMLElement>(null);
  const touchStartY = useRef<number>(0);
  const lastScrollTime = useRef<number>(0);
  const sectionRef = useRef<HTMLElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);

  const loginHref = token ? '/workspace' : '/login';
  const loginLabel = token ? 'В интерфейс' : 'Войти';
  const totalRef = useRef(6);

  const goToSlide = useCallback((index: number) => {
    if (isTransitioning) return;
    const target = Math.max(0, Math.min(index, totalRef.current - 1));
    if (target === currentSlide) return;
    setIsTransitioning(true);
    setCurrentSlide(target);
    setTimeout(() => { setIsTransitioning(false); }, 600);
  }, [currentSlide, isTransitioning]);

  const slides: Slide[] = [
    {
      id: 'hero',
      badge: 'КЕЙС 03: ОБНИНСК 2040',
      title: 'Конструктор жилой инфраструктуры',
      subtitle:
        'Аналитика градостроительных и архитектурных решений',
      content: (
        <div className={`${cardCls} relative flex flex-col items-center gap-4 overflow-hidden`}>
          <div aria-hidden="true" className="pointer-events-none absolute inset-x-8 top-0 h-px bg-white/80 dark:bg-white/20" />
          <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-[radial-gradient(80%_100%_at_50%_0%,rgba(255,255,255,0.35),transparent)] dark:bg-[radial-gradient(80%_100%_at_50%_0%,rgba(148,163,184,0.15),transparent)]" />
          <div className="mx-auto flex w-full justify-center">
            <PulseLogo as="span" size="lg" className="scale-110 my-2 sm:scale-[1.4] sm:my-4" />
          </div>
          <QrRow />
          <div className="flex flex-col items-center gap-3 sm:flex-row mt-2">
            <Link href="/about" className={darkBtn}>Контакты</Link>
            <Link href={loginHref} className={glassPill}>{loginLabel}</Link>
          </div>
        </div>
      ),
    },
    {
      id: 'comparison',
      badge: 'Доступность инфраструктуры',
      title: 'Сложные ГИС против «Пульса Города»',
      subtitle:
        'Конструктор ускоряет аналитику: больше гипотез за то же время.',
      content: <CadComparisonSimulator />,
    },
    {
      id: 'network',
      badge: 'Скрытая математика',
      title: 'От графа УДС к «народным тропам» в 3D',
      subtitle:
        'Дейкстра в основе: потоки, зебры, «народные тропы».',
      content: <NetworkGraphSimulator />,
    },
    {
      id: 'journey',
      badge: 'Жизненный цикл мастер-плана',
      title: 'Как платформа предотвращает градостроительные ошибки',
      subtitle:
        'Ошибка вначале — дороже с каждым этапом',
      content: <UrbanJourneyStaircase />,
    },
    {
      id: 'audience',
      badge: 'Кому нужен «Пульс Города»',
      title: 'Один инструмент для разных специалистов',
      subtitle:
        'Наброски схем на лету. Без тяжёлых симуляторов.',
      content: <AudienceSimulator />,
    },
    {
      id: 'roi',
      badge: 'Экономика решения',
      title: 'Окупаемость при первом же эскизе',
      subtitle:
        'Цена неверной гипотезы >> проверка за секунды.',
      content: <RoiSimulator loginHref={loginHref} />,
    },
  ];

  const totalSlides = slides.length;
  const lastSlide = totalSlides - 1;

  useEffect(() => { totalRef.current = totalSlides; }, [totalSlides]);

  const nextSlide = useCallback(() => { goToSlide(currentSlide + 1); }, [currentSlide, goToSlide]);
  const prevSlide = useCallback(() => { goToSlide(currentSlide - 1); }, [currentSlide, goToSlide]);

  // Лёгкий параллакс фона и светового пятна за мышью (без кейфреймов, rAF + cleanup).
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const el = sectionRef.current;
    if (!el) return;
    let raf = 0;
    const onMove = (e: MouseEvent) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const nx = e.clientX / window.innerWidth - 0.5;
        const ny = e.clientY / window.innerHeight - 0.5;
        el.style.backgroundPosition = `${50 + nx * 4}% ${50 + ny * 4}%`;
        if (glowRef.current) {
          glowRef.current.style.transform = `translate3d(${nx * 14}px, ${ny * 10}px, 0)`;
        }
      });
    };
    window.addEventListener('mousemove', onMove, { passive: true });
    return () => {
      window.removeEventListener('mousemove', onMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
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
      if (e.deltaY > 25) nextSlide();
      else if (e.deltaY < -25) prevSlide();
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
      const dy = touchStartY.current - e.changedTouches[0].clientY;
      if (Math.abs(dy) < 50) return;
      if (dy > 0) nextSlide();
      else prevSlide();
    };

    window.addEventListener('wheel', handleWheel, { passive: false });
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });
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
      ref={sectionRef}
      className="relative h-screen w-screen overflow-hidden bg-cover bg-center"
      style={{ backgroundImage: "url('/city.png')" }}
    >
      {/* Ослабленная вуаль — фото дышит, стекло читается */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-b from-white/60 via-white/40 to-white/70 dark:from-black/80 dark:via-black/70 dark:to-black/90 z-0"
      />
      {/* Мягкое световое пятно сверху (белое/слейт, не неон) */}
      <div
        ref={glowRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(60%_50%_at_50%_0%,rgba(255,255,255,0.5),transparent)] dark:bg-[radial-gradient(60%_50%_at_50%_0%,rgba(148,163,184,0.15),transparent)] will-change-transform"
      />
      {/* Архитектурная сетка — чуть заметнее, цвет задан через currentColor */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-0 text-slate-800 opacity-[0.06] mix-blend-multiply dark:text-white dark:opacity-[0.08] dark:mix-blend-screen"
        style={{ backgroundImage: 'radial-gradient(currentColor 1px, transparent 1px)', backgroundSize: '24px 24px' }}
      />

      <header className="absolute inset-x-0 top-0 z-30 flex h-16 items-center justify-between gap-2 px-4 sm:px-10">
        <button
          type="button"
          onClick={() => goToSlide(0)}
          aria-label="К началу презентации"
          title="К началу презентации"
          className="shrink-0 transition-all duration-200 ease-out hover:scale-[1.05] active:scale-[0.98]"
        >
          <PulseLogo as="span" size="lg" />
        </button>

        {/* Телеметрические штрихи с живым пульсом активного */}
        <div className="absolute left-1/2 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 items-center gap-1.5 lg:flex">
          {slides.map((s, idx) => (
            <button
              key={s.id}
              type="button"
              onClick={() => goToSlide(idx)}
              aria-label={`Слайд ${idx + 1}: ${s.title}`}
              aria-current={idx === currentSlide ? 'true' : undefined}
              title={`Слайд ${idx + 1}: ${s.title}`}
              className={`h-[4px] rounded-full transition-all duration-500 ease-out ${
                idx === currentSlide
                  ? 'w-12 bg-blue-600 shadow-[0_0_12px_rgba(37,99,235,0.35)] motion-safe:animate-pulse dark:bg-blue-500'
                  : 'w-6 bg-gray-400/50 hover:bg-gray-600 dark:bg-white/30 dark:hover:bg-white/70'
              }`}
            />
          ))}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Link href="/about" className={glassPillSm}>Контакты</Link>
          <Link href={loginHref} className={glassPillSm}>{loginLabel}</Link>
        </div>
      </header>

      <main ref={containerRef} className="relative z-10 mx-auto flex h-full w-full max-w-7xl flex-col items-center overflow-y-auto px-6 pb-14 pt-20 [scrollbar-width:none] sm:px-12 [&::-webkit-scrollbar]:hidden">
        {/* Смена слайда — fade-in, каскад внутри — sheet-up (оба уже есть в конфиге) */}
        <div key={current.id} className="flex w-full m-auto flex-col items-center motion-safe:animate-fade-in">

          <p className="mb-3 inline-flex shrink-0 items-center gap-2 rounded-full border border-gray-400/30 bg-white/60 px-4 py-1.5 font-mono text-[11px] font-bold uppercase tracking-wider text-gray-800 backdrop-blur-xl dark:border-white/20 dark:bg-black/40 dark:text-gray-300 motion-safe:animate-sheet-up [animation-fill-mode:both]">
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-blue-600 motion-safe:animate-pulse dark:bg-blue-500" />
            {current.badge}
          </p>

          <h1 className="mb-3 max-w-5xl shrink-0 text-center text-2xl font-black leading-[1.15] tracking-tight sm:text-4xl lg:text-[44px] motion-safe:animate-sheet-up [animation-delay:80ms] [animation-fill-mode:both]">
            {/* Приглушённый стальной металлик: тёмный верх для контраста на небе, светлый низ для объёма */}
            <span className="bg-gradient-to-b from-gray-900 via-gray-700 to-gray-600 bg-clip-text text-transparent drop-shadow-[0_2px_16px_rgba(255,255,255,0.9)] dark:from-gray-100 dark:via-gray-300 dark:to-gray-400 dark:drop-shadow-[0_2px_16px_rgba(0,0,0,0.8)]">
              {current.title}
            </span>
          </h1>

          <div className="relative mb-6 max-w-2xl shrink-0 overflow-hidden rounded-2xl border border-white/40 bg-white/40 px-5 py-2.5 text-center text-base font-medium leading-snug text-gray-800 shadow-sm backdrop-blur-md sm:text-lg dark:border-white/10 dark:bg-black/40 dark:text-gray-200 motion-safe:animate-sheet-up [animation-delay:160ms] [animation-fill-mode:both]">
            <div aria-hidden="true" className="pointer-events-none absolute inset-x-8 top-0 h-px bg-white/80 dark:bg-white/20" />
            {current.subtitle}
          </div>

          <div className="flex w-full shrink-0 justify-center motion-safe:animate-sheet-up [animation-delay:240ms] [animation-fill-mode:both]">
            {current.content}
          </div>
        </div>
      </main>

      <footer className="absolute inset-x-0 bottom-0 z-30 flex h-14 items-center justify-between px-6 sm:px-10">
        <div className="flex items-center gap-2 text-sm font-mono text-gray-700 dark:text-gray-300">
          <span className="font-bold text-gray-900 dark:text-white">{String(currentSlide + 1).padStart(2, '0')}</span>
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
            className="flex h-10 w-10 transform-gpu items-center justify-center rounded-full bg-[#141a26]/90 text-base text-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.25),0_14px_30px_-10px_rgba(20,26,38,0.6)] backdrop-blur-xl transition-all duration-200 ease-out hover:scale-[1.05] hover:bg-[#141a26] active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none"
          >
            ↑
          </button>
          <button
            type="button"
            onClick={nextSlide}
            disabled={currentSlide === lastSlide}
            aria-label="Следующий слайд"
            title="Следующий слайд"
            className="flex h-10 w-10 transform-gpu items-center justify-center rounded-full bg-[#141a26]/90 text-base text-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.25),0_14px_30px_-10px_rgba(20,26,38,0.6)] backdrop-blur-xl transition-all duration-200 ease-out hover:scale-[1.05] hover:bg-[#141a26] active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none"
          >
            ↓
          </button>
        </div>
      </footer>
    </section>
  );
}
