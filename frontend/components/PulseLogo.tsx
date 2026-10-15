'use client';

import { useEffect, useRef } from 'react';

type Size = 'sm' | 'md' | 'lg';

const FONT_PX: Record<Size, number> = { sm: 20, md: 24, lg: 30 };
const FONT_FAMILY = "Inter, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

// Сдержанная палитра: база букв + акцент пика пульса (rgb-триплеты).
const LIGHT_BASE: [number, number, number] = [30, 41, 59]; // slate-800
const LIGHT_PEAK: [number, number, number] = [71, 100, 140]; // приглушённый стальной синий
const DARK_BASE: [number, number, number] = [241, 245, 249]; // slate-100
const DARK_PEAK: [number, number, number] = [255, 255, 255]; // чистый белый

const CYCLE = 2.6; // период пробега волны, секунды
// Треугольный «удар» шириной в 3 буквы: пик = 1, соседи = 0.5, дальше = 0.
const bump = (d: number) => Math.max(0, 1 - Math.abs(d) / 2);

interface PulseLogoProps {
  /** sm ≈ text-xl, md — средний, lg ≈ text-3xl */
  size?: Size;
  text?: string;
  /** h1 — для главных заголовков страниц, span — для встраивания */
  as?: 'h1' | 'span';
  animated?: boolean;
  className?: string;
}

/**
 * Название CityPulse на canvas: волна пульса пробегает по буквам слева
 * направо в спокойных slate-тонах. Без радуги и неона.
 * Текст продублирован скрытым span'ом — читается скринридерами и копируется.
 */
export default function PulseLogo({
  size = 'md',
  text = 'CityPulse',
  as = 'span',
  animated = true,
  className = '',
}: PulseLogoProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf = 0;
    let disposed = false;
    const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');
    let isDark = darkQuery.matches;
    const fontPx = FONT_PX[size];
    const pad = Math.ceil(fontPx * 1.1); // запас под свечение и рост букв
    const font = `900 ${fontPx}px ${FONT_FAMILY}`;
    const chars = text.split('');

    // Высокое разрешение: бэкстор в 2× от DPR (до 6×) — та же CSS-геометрия, чётче текст.
    const setup = () => {
      const dpr = Math.min((window.devicePixelRatio || 1) * 2, 6);
      ctx.font = font;
      const starts: number[] = [0];
      for (let i = 1; i <= chars.length; i++) {
        starts.push(ctx.measureText(text.slice(0, i)).width);
      }
      const w = Math.ceil(starts[chars.length]);
      const h = Math.ceil(fontPx * 1.35);
      canvas.style.width = `${w + pad * 2}px`;
      canvas.style.height = `${h + pad * 2}px`;
      canvas.width = Math.ceil((w + pad * 2) * dpr);
      canvas.height = Math.ceil((h + pad * 2) * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      return { starts, h };
    };

    let dims = setup();
    const midY = () => pad + dims.h / 2;

    const drawLetter = (ch: string, x: number, adv: number, intensity: number) => {
      const [br, bg, bb] = isDark ? DARK_BASE : LIGHT_BASE;
      const [pr, pg, pb] = isDark ? DARK_PEAK : LIGHT_PEAK;
      const k = Math.max(0, Math.min(1, intensity));
      const r = Math.round(br + (pr - br) * k);
      const g = Math.round(bg + (pg - bg) * k);
      const b = Math.round(bb + (pb - bb) * k);
      const s = 1 + 0.05 * k;
      ctx.save();
      ctx.translate(pad + x + adv / 2, midY() - fontPx * 0.12 * k);
      ctx.scale(s, s);
      ctx.globalAlpha = 0.72 + 0.28 * k;
      ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
      ctx.shadowBlur = 12 * k;
      ctx.shadowColor = `rgba(100, 130, 180, ${0.5 * k})`;
      ctx.fillText(ch, -adv / 2, 0);
      ctx.restore();
    };

    const draw = (t: number, wave: boolean) => {
      const { starts, h } = dims;
      ctx.clearRect(0, 0, starts[chars.length] + pad * 2, h + pad * 2);
      ctx.font = font;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      // Пик волны идёт от -1 до n (за края), затем пауза до конца цикла.
      const pos = wave ? ((t % CYCLE) / CYCLE) * (chars.length + 2) - 1 : -Infinity;
      for (let i = 0; i < chars.length; i++) {
        const intensity = wave ? bump(pos - i) : 0;
        drawLetter(chars[i], starts[i], starts[i + 1] - starts[i], intensity);
      }
    };

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const wave = animated && !reduceMotion;
    if (!wave) {
      draw(0, false); // один статичный кадр
    } else {
      const start = performance.now();
      const loop = (now: number) => {
        if (disposed) return;
        draw((now - start) / 1000, true);
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    }

    const onTheme = () => {
      if (disposed) return;
      isDark = darkQuery.matches;
      if (!wave) draw(0, false);
    };
    darkQuery.addEventListener('change', onTheme);

    // Веб-шрифт мог подгрузиться позже — перемерить и перерисовать.
    document.fonts?.ready.then(() => {
      if (disposed) return;
      dims = setup();
      if (!wave) draw(0, false);
    });

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      darkQuery.removeEventListener('change', onTheme);
    };
  }, [size, text, animated]);

  const Tag = as;

  return (
    <Tag role="img" aria-label={text} className={`inline-block leading-none ${className}`}>
      <canvas ref={canvasRef} aria-hidden="true" className="block" />
      <span className="sr-only">{text}</span>
    </Tag>
  );
}
