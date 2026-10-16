/**
 * Общие классы стеклянной пилюли хедера (Liquid Glass — как карточки
 * на `/`, `/login`, `/workspace`): мутное стекло с объёмными inset-тенями.
 * Пилюля тянется на всю ширину экрана (минус боковые отступы враппера).
 */
export const HEADER_PILL_CLS =
  'mx-auto flex h-12 w-full transform-gpu items-center justify-between rounded-full ' +
  'border border-white/60 bg-white/40 py-2 pl-2 pr-1 ' +
  'backdrop-blur-xl backdrop-saturate-150 transition-all duration-200 ease-out ' +
  'motion-reduce:transform-none motion-reduce:transition-none sm:pl-2 sm:pr-1 ' +
  'dark:border-white/20 dark:bg-gray-900/40 ' +
  'shadow-[inset_1px_1px_2px_rgba(255,255,255,0.8),inset_-1px_-1px_2px_rgba(0,0,0,0.05),0_24px_60px_-16px_rgba(20,26,38,0.35)]';

/**
 * Ссылка-логотип в пилюле: `-ml-4` съедает прозрачный запас canvas'а
 * (там отступ под свечение), `top-[3px]` оптически центрит глифы по высоте.
 */
export const HEADER_LOGO_LINK_CLS =
  'relative -ml-4 top-[3px] shrink-0 rounded-lg transition-all duration-200 ease-out ' +
  'hover:scale-[1.05] active:scale-[0.98] motion-reduce:transform-none motion-reduce:transition-none';
