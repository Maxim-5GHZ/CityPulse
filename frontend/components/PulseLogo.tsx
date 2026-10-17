'use client';

type Size = 'sm' | 'md' | 'lg';

const SIZE_CLS: Record<Size, string> = {
  sm: 'text-xl',
  md: 'text-2xl',
  lg: 'text-3xl',
};

interface PulseLogoProps {
  /** sm ≈ text-xl, md — средний, lg ≈ text-3xl */
  size?: Size;
  text?: string;
  /** h1 — для главных заголовков страниц, span — для встраивания */
  as?: 'h1' | 'span';
  /** @deprecated оставлен для совместимости; анимация убрана */
  animated?: boolean;
  className?: string;
}


export default function PulseLogo({
  size = 'md',
  text = 'CityPulse',
  as = 'span',
  className = '',
}: PulseLogoProps) {
  const Tag = as;
  return (
    <Tag
      role="img"
      aria-label={text}
      className={`inline-block font-black leading-none tracking-tight text-gray-900 dark:text-gray-100 ${SIZE_CLS[size]} ${className}`}
    >
      {text}
    </Tag>
  );
}