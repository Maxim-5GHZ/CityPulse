'use client';

import { useEffect, useRef } from 'react';

type Size = 'sm' | 'md' | 'lg';

const FONT_PX: Record<Size, number> = { sm: 20, md: 24, lg: 30 };
const FONT_FAMILY = "Inter, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

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
 * Название CityPulse на canvas: переливающийся градиент + пульсация свечения.
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
    const fontPx = FONT_PX[size];
    const pad = Math.ceil(fontPx * 1.1); // запас под свечение
    const font = `900 ${fontPx}px ${FONT_FAMILY}`;

    const setup = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      ctx.font = font;
      const w = Math.ceil(ctx.measureText(text).width);
      const h = Math.ceil(fontPx * 1.35);
      canvas.style.width = `${w + pad * 2}px`;
      canvas.style.height = `${h + pad * 2}px`;
      canvas.width = Math.ceil((w + pad * 2) * dpr);
      canvas.height = Math.ceil((h + pad * 2) * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      return { w, h };
    };

    let dims = setup();

    const draw = (t: number) => {
      const { w, h } = dims;
      const W = w + pad * 2;
      const H = h + pad * 2;
      ctx.clearRect(0, 0, W, H);
      const hue = (t * 45) % 360;
      const grad = ctx.createLinearGradient(pad, 0, pad + w, 0);
      grad.addColorStop(0, `hsl(${hue}, 90%, 60%)`);
      grad.addColorStop(0.5, `hsl(${(hue + 60) % 360}, 90%, 62%)`);
      grad.addColorStop(1, `hsl(${(hue + 120) % 360}, 90%, 60%)`);
      // «дыхание» свечения, период ~1.4 c
      const pulse = (Math.sin((t * Math.PI * 2) / 1.4) + 1) / 2;
      ctx.font = font;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowBlur = 6 + 20 * pulse;
      ctx.shadowColor = `hsla(${(hue + 60) % 360}, 95%, 65%, ${0.55 + 0.35 * pulse})`;
      ctx.globalAlpha = 0.9 + 0.1 * pulse;
      ctx.fillStyle = grad;
      ctx.fillText(text, pad + w / 2, pad + h / 2);
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
    };

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!animated || reduceMotion) {
      draw(0.6); // один статичный кадр
    } else {
      const start = performance.now();
      const loop = (now: number) => {
        if (disposed) return;
        draw((now - start) / 1000);
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    }

    // Веб-шрифт мог подгрузиться позже — перемерить и перерисовать.
    document.fonts?.ready.then(() => {
      if (disposed) return;
      dims = setup();
      if (!animated || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        draw(0.6);
      }
    });

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
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
