/**
 * Общие классы стеклянной пилюли хедера. Тёмное стекло в стиле страниц
 * /, /login, /workspace: полупрозрачная белая плёнка + backdrop-blur.
 */
export const HEADER_PILL_CLS =
  'mx-auto flex h-12 w-full items-center justify-between rounded-2xl ' +
  'border border-white/10 bg-white/5 py-2 pl-3 pr-2 ' +
  'backdrop-blur-md backdrop-saturate-150';

/**
 * Ссылка-логотип в пилюле: компактная обёртка, лёгкий фон на hover.
 */
export const HEADER_LOGO_LINK_CLS =
  'relative shrink-0 rounded-lg px-1 transition-colors hover:bg-white/5';