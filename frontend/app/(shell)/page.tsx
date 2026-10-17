'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { ReactNode } from 'react';
import Link from 'next/link';
import QRCode from 'react-qr-code';
import {
  ChevronUp,
  ChevronDown,
  Mail,
  LogIn,
  LayoutDashboard,
} from 'lucide-react';
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

// Стекло в стиле логина: белая плёнка + blur + тонкая светлая рамка.
const cardCls =
  'w-full max-w-xl rounded-2xl border border-white/15 bg-white/5 px-6 py-6 ' +
  'backdrop-blur-xl backdrop-saturate-150 md:px-8 ' +
  'shadow-2xl shadow-black/40';

const glassPill =
  'inline-flex min-w-40 items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-2 ' +
  'text-sm font-medium text-zinc-100 backdrop-blur-md ' +
  'transition-colors hover:bg-white/10 active:bg-white/15 ' +
  'focus:outline-none focus:ring-2 focus:ring-white/20';

const glassPillSm =
  'inline-flex items-center justify-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-3 py-1.5 ' +
  'text-sm font-medium text-zinc-100 backdrop-blur-md ' +
  'transition-colors hover:bg-white/10 active:bg-white/15';

const darkBtn =
  'inline-flex min-w-40 items-center justify-center gap-2 rounded-xl bg-white/10 px-6 py-2.5 ' +
  'text-sm font-medium text-zinc-50 border border-white/15 backdrop-blur-md ' +
  'transition-colors hover:bg-white/15 active:bg-white/20 ' +
  'focus:outline-none focus:ring-2 focus:ring-white/20';

// QR-ссылка обязана быть сплошной bg-white (иначе не сканируется).
const qrLinkCls =
  'block rounded-2xl border border-white/20 bg-white p-4 shadow-2xl shadow-black/40 ' +
  'transition-transform duration-200 ease-out hover:scale-[1.03] active:scale-[0.99] ' +
  'motion-reduce:transform-none';

function QrRow() {
    return (
        <div className="flex flex-col items-center gap-4 sm:flex-row">
        <figure className="flex flex-col items-center gap-2">
            <a
            href={SITE_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Наш Сайт"
            className={qrLinkCls}
            >
            <QRCode value={SITE_URL} size={180} />
            </a>
            <figcaption className="text-sm font-medium text-zinc-300">
            Наш Сайт
            </figcaption>
        </figure>
        <figure className="flex flex-col items-center gap-2">
            <a
            href={GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Наш GitHub"
            className={qrLinkCls}
            >
            <QRCode value={GITHUB_URL} size={180} />
            </a>
            <figcaption className="text-sm font-medium text-zinc-300">
            Наш GitHub
            </figcaption>
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
    const LoginIcon = token ? LayoutDashboard : LogIn;

    const totalRef = useRef(1);

    const goToSlide = useCallback(
        (index: number) => {
        if (isTransitioning) return;
        const target = Math.max(0, Math.min(index, totalRef.current - 1));
        if (target === currentSlide) return;
        setIsTransitioning(true);
        setCurrentSlide(target);
        setTimeout(() => {
            setIsTransitioning(false);
        }, 600);
        },
        [currentSlide, isTransitioning],
    );

    const slides: Slide[] = [
        {
        id: 'hero',
        badge: 'КЕЙС 03: ОБНИНСК 2040',
        title: 'Конструктор города будущего',
        subtitle:
            'Интерактивный САПР и аудит пешеходной доступности на базе алгоритма Дейкстры и цифрового 3D-двойника района.',
        content: (
            <div className={`${cardCls} flex flex-col items-center gap-5`}>
            <div className="flex justify-center my-2 sm:my-8">
                <PulseLogo as="span" size="lg" className="sm:text-5xl" />
            </div>
            <QrRow />
            <div className="flex flex-col items-center gap-3 sm:flex-row">
                <Link href="/about" className={darkBtn}>
                <Mail className="w-4 h-4" />
                Контакты
                </Link>
                <Link href={loginHref} className={glassPill}>
                <LoginIcon className="w-4 h-4" />
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
        if (
            e.key === 'ArrowDown' ||
            e.key === 'ArrowRight' ||
            e.key === 'PageDown' ||
            (e.key === ' ' && !onControl)
        ) {
            e.preventDefault();
            nextSlide();
        } else if (
            e.key === 'ArrowUp' ||
            e.key === 'ArrowLeft' ||
            e.key === 'PageUp'
        ) {
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
        <section className="relative w-full h-screen overflow-hidden">
        <header className="absolute inset-x-0 top-0 z-30 flex items-center justify-between h-16 gap-2 px-4 sm:px-10">
            <button
            type="button"
            onClick={() => goToSlide(0)}
            aria-label="К началу презентации"
            className="transition-colors shrink-0 hover:opacity-90"
            >
            <PulseLogo as="span" size="lg" />
            </button>

            <div className="absolute items-center hidden gap-2 -translate-x-1/2 -translate-y-1/2 left-1/2 top-1/2 lg:flex">
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
                    ? 'w-8 bg-zinc-100'
                    : 'w-2 bg-white/30 hover:bg-white/50'
                }`}
                />
            ))}
            </div>

            <div className="flex items-center gap-2 shrink-0">
            <Link href="/about" className={glassPillSm}>
                <Mail className="h-3.5 w-3.5" />
                Контакты
            </Link>
            <Link href={loginHref} className={glassPillSm}>
                <LoginIcon className="h-3.5 w-3.5" />
                {loginLabel}
            </Link>
            </div>
        </header>

        <main
            ref={containerRef}
            className="relative z-10 mx-auto flex h-full w-full max-w-7xl flex-col items-center overflow-y-auto px-6 pb-16 pt-20 [scrollbar-width:none] sm:px-12 [&::-webkit-scrollbar]:hidden"
        >
            <div
            key={current.id}
            className="flex flex-col items-center w-full m-auto motion-safe:animate-fade-in"
            >
            <p className="px-3 py-1 mb-3 text-xs uppercase border rounded-full shrink-0 border-white/15 bg-white/5 text-zinc-300 backdrop-blur-md">
                {current.badge}
            </p>

            <h1 className="mb-3 max-w-4xl shrink-0 text-center text-2xl font-black leading-[1.15] tracking-tight text-zinc-50 drop-shadow-[0_2px_16px_rgba(0,0,0,0.6)] sm:text-4xl lg:text-[40px]">
                {current.title}
            </h1>

            <p className="max-w-3xl mb-6 text-sm font-medium leading-relaxed text-center shrink-0 text-zinc-300 sm:text-base">
                {current.subtitle}
            </p>

            <div className="flex justify-center w-full shrink-0">
                {current.content}
            </div>
            </div>
        </main>

        <footer className="absolute inset-x-0 bottom-0 z-30 flex items-center justify-between px-6 h-14 sm:px-10">
            <div className="flex items-center gap-2 font-mono text-sm text-zinc-300">
            <span className="font-bold text-zinc-100">
                {String(currentSlide + 1).padStart(2, '0')}
            </span>
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
                className="flex items-center justify-center w-10 h-10 transition-colors border rounded-xl border-white/15 bg-white/5 text-zinc-100 backdrop-blur-md hover:bg-white/10 active:bg-white/15 disabled:pointer-events-none disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-white/20"
            >
                <ChevronUp className="w-5 h-5" />
            </button>
            <button
                type="button"
                onClick={nextSlide}
                disabled={currentSlide === lastSlide}
                aria-label="Следующий слайд"
                title="Следующий слайд"
                className="flex items-center justify-center w-10 h-10 transition-colors border rounded-xl border-white/15 bg-white/5 text-zinc-100 backdrop-blur-md hover:bg-white/10 active:bg-white/15 disabled:pointer-events-none disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-white/20"
            >
                <ChevronDown className="w-5 h-5" />
            </button>
            </div>
        </footer>
        </section>
    );
}