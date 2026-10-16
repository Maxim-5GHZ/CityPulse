# AGENTS.md — CityPulse

Правила для агентов и людей. Все примеры — из текущего кода, ничего не выдумывать:
новые решения сверяй с `frontend/app/login/page.tsx` (эталон форм),
`frontend/app/page.tsx` (эталон лендинга) и
`frontend/components/PulseLogo.tsx` (эталон canvas/доступности).

## Стек и запуск

- Next.js 14 + Spring Boot 3 (Java 21) + Postgres 16 + JWT. Подробности — в `README.md`.
- Dev: `make dev` (фронт — http://localhost:3000, hot reload, композ рестартовать не надо).
- Фронт ходит в API только через same-origin `/backend/*` (прокси Next в dev, nginx в prod).
- Проверки фронта (из `frontend/`): `./node_modules/.bin/tsc --noEmit` и
  `./node_modules/.bin/next lint`. Обе должны быть чистыми.
- `npx tsc` без установленного `node_modules` врёт — только локальный компилятор.
- Если `next build` падает с `EACCES` на `.next` — это root'овый кеш из докера,
  лечится `sudo rm -rf frontend/.next`. Код тут ни при чём.

## Палитра

- База — серая шкала: фон `bg-gray-100` (`app/layout.tsx`), карточки белые,
  кнопки `bg-gray-800 hover:bg-gray-700`.
- Акцент — синий: табы/фокус `blue-500`, кнопки действий `bg-blue-600 hover:bg-blue-700`.
- Ошибки — `border-red-200 bg-red-50 text-red-700`.
- Логотип и canvas-декор — только slate + приглушённый стально-голубой.
  Неон, радужные градиенты, яркие тени — запрещены.

## Типографика и язык

- Шрифт: Inter, system-ui (см. `FONT_FAMILY` в `PulseLogo.tsx`).
- Бренд: `font-black tracking-tight`. Лейблы и инпуты: `text-sm font-medium`.
  Разделители: `text-xs uppercase text-gray-500`.
- Весь видимый UI — на русском. Бренд `CityPulse` вставляется только через
  `<PulseLogo size="sm"|"md"|"lg">`, хардкодить текстом нельзя.

## Компоненты и паттерны

- Карточки базовые: `rounded-lg border shadow-lg`.
  Исключение — `/` и `/login`, они стеклянные (см. Liquid Glass).
  Инпуты и кнопки базовые: `rounded-lg`, внутренние отступы `px-4 py-1.5` / `px-6 py-2.5`.
  На стеклянных экранах пилюли `rounded-full` (см. Liquid Glass).
- Адаптив mobile-first: `max-w-sm` → `lg:max-w-3xl/4xl`, декоративные колонки
  `hidden lg:block lg:w-1/2`. Карточка обязана влезать в экран без скролла на десктопе.
- Общие компоненты — в `frontend/components/`, импорт через алиас `@/`.
  Статика — только в `frontend/public/` (Next не раздаёт файлы из других мест).
- `content` в `frontend/tailwind.config.js` покрывает `app/`, `lib/`, `components/`.
  Новую папку с классами — дописать туда, иначе утилиты не сгенерируются
  (уже ловили невидимый `sr-only` и дубль логотипа).
- Кнопка входа через Флида ID — `<button>` со стилем `flidaBtn`, запускает
  Web SDK (`frontend/lib/flida.ts`, public-клиент без секрета, `fedcm: []`,
  `mode: 'redirect'`) прямо из клика; callback принимает `/flida/finish` через
  `autoAuthorization` и меняет Flida `access_token` на наш JWT через
  `POST /backend/auth/flida`. Глагол зависит от режима:
  «Войти…» / «Зарегистрироваться…».
- Ошибка Флиды (`flidaError` → `flidaErrorBox`, текст из `flidaErrorMessage()` по
  коду `FlidaError`) живёт максимум 3 секунды:
  гаснет по `setTimeout(3000)` и чистит URL через `history.replaceState`,
  чтобы не возвращаться при обновлении.
- Хедер приватных экранов — `frontend/components/AppHeader.tsx` (сейчас только
  `/workspace`): `sticky top-3 z-40`, плавающая стеклянная пилюля `rounded-full`
  на всю ширину экрана — то же мутное стекло, что у карточек:
  `border-white/60 bg-white/40 backdrop-blur-xl backdrop-saturate-150`
  (`dark:border-white/20 dark:bg-gray-900/40`) + объёмные inset-тени карточки.
  Слева `Link` с `<PulseLogo as="span" size="lg">`, справа кнопка
  аккаунта (аватар-инициал + email + шеврон) с меню `role="menu"` (тоже стекло:
  `rounded-2xl bg-white/70 backdrop-blur-xl`, `dark:bg-gray-900/70`):
  шапка-подпись «Аккаунт» + email + «Выйти». Открытое меню кладёт под себя
  диммированную шторку на весь экран (`fixed inset-0 z-30`,
  `bg-[#141a26]/30 backdrop-blur-[2px]`, `dark:bg-black/50`, клик закрывает меню).
  На мобиле меню — шторка справа во всю высоту (`fixed inset-y-0 right-0`,
  `md:hidden`, `role="dialog"`, скругление `rounded-l-[32px]`, крестик,
  выезд `motion-safe:animate-sheet-right`, скролл страницы лочится); на десктопе —
  дропдаун у кнопки (`hidden md:block`). Кейфреймы `sheet-up`/`sheet-right`/`fade-in` — в
  `tailwind.config.js`. Закрытие по клику вне и `Escape`
  (слушатели чистятся), фокус возвращается на кнопку. В пунктах меню scale нет —
  только `hover:bg` (иначе дёргается список).
- Навигация хедера — константа `NAV_ITEMS` в `AppHeader.tsx`: на десктопе ссылки
  идут в ряд по центру пилюли (`hidden md:flex`, стеклянные пилюли как «Войти»
  на `/`), на мобиле те же ссылки уезжают в шторку снизу.
  Новую кнопку добавлять в `NAV_ITEMS` — она появится в обоих местах сама.

## Liquid Glass — экраны с фото-фоном (`/`, `/login`, `/workspace`)

- Действует на `/`, `/login` и `/workspace` (каркас: приветствие + сетка скелетонов,
  без контента): поверх базовых правил. Остальной UI — по разделу выше.
- Фон общий: `relative.min-h-screen.bg-cover.bg-center` со
  `style={{ backgroundImage: "url('/city.png')" }}` (`/city.png` лежит в `frontend/public/`,
  Next раздаёт только оттуда). На `/workspace` фон натянут на всю страницу,
  включая хедер, чтобы над стеклянной пилюлей не оставалось серой полосы body. Поверх — вуаль для читаемости стекла:
  `absolute inset-0 bg-gradient-to-b from-white/30 via-white/10 to-white/40`
  (`dark:from-black/60 dark:via-black/40 dark:to-black/70`).
- Карточка общая — стекло (`cardCls` в обоих файлах):
  `rounded-[32px]`, `bg-white/40` (`dark:bg-gray-900/40`),
  `backdrop-blur-xl backdrop-saturate-150`, `border-white/60`,
  объём: `inset 1px 1px 2px rgba(255,255,255,0.8)` +
  `inset -1px -1px 2px rgba(0,0,0,0.05)` + мягкая внешняя тень.
  Ширина разная: `/login` — `max-w-md`, `/` — `max-w-xl` (шире под два QR в ряд),
  `/workspace` — `max-w-4xl` (каркас под сетку виджетов `sm:grid-cols-2 lg:grid-cols-3`).
- Шапка-ссылка («Войти» на `/`, «← На главную» на `/login`) — стеклянная пилюля:
  `rounded-full border-white/60 bg-white/40 px-4 py-1.5 backdrop-blur-xl hover:bg-white/60`
  (`dark:border-white/20 dark:bg-white/10`). На `/` кроме неё в шапке ничего нет.
- Логотип: `<PulseLogo as="h1" size="lg" className="scale-150 my-2">` в обёртке
  `mx-auto flex justify-center`.
- Специфика `/login`: табы — сегментированный контрол (`rounded-full bg-white/40 p-1`,
  активный таб — выпуклая пилюля `rounded-full bg-white shadow`); инпуты и кнопка
  Флиды — пилюли `rounded-full` с линзой (`inset 0 2px 4px rgba(0,0,0,0.06)` +
  `inset 0 -1px 2px rgba(255,255,255,0.9)`, `border-white/60`); отправка — тёмное
  стекло `bg-[#141a26]/90 rounded-full` с бликом
  `inset 0 1px 1px rgba(255,255,255,0.25)`; ошибки —
  `border-red-200/70 bg-red-50/80`; разделитель — `w-1/5 border-b border-white/70` +
  `text-xs uppercase text-gray-500`.
- Специфика `/`: QR-ряд `flex-col sm:flex-row`, QR-ссылка обязана быть сплошной
  `bg-white` (иначе не сканируется): `rounded-2xl border-white/60 p-4` + линза-тени;
  подписи — `text-sm font-medium text-gray-600` (`dark:text-gray-200`). QR — `size={180}`
  через `react-qr-code`, URL — константы `SITE_URL`/`GITHUB_URL` вверху `page.tsx`.
- Интерактив общий: всё кликабельное — `transition-all duration-200 ease-out
  hover:scale-[1.05] active:scale-[0.98]` (+ `transform-gpu` на стекле,
  `motion-reduce:transform-none motion-reduce:transition-none`); глазик —
  `hover:scale-110`; инпуты — деликатнее `hover:scale-[1.02] focus:scale-[1.02]`
  (во всю ширину, иначе упрутся в края); `bg-white` у QR и тени при этом не трогать.

## Тёмная тема и доступность (обязательно)

- Стратегия `media` (ключа `darkMode` в конфиге нет): каждая поверхность и текст
  дублируются `dark:`-вариантом. Canvas-текст — через
  `matchMedia('(prefers-color-scheme: dark)')` с подпиской на смену.
- Canvas-декор дублируется скрытым текстом: `role="img"` + `aria-label` + `.sr-only`.
- Анимации гаснут при `prefers-reduced-motion` (один статичный кадр) и умеют
  полностью отключаться пропсом `animated={false}`.
- rAF-циклы и подписки всегда чистятся при размонтировании.
- PulseLogo — суперсемплинг ×2: бэкстор `min(devicePixelRatio * 2, 6)` при той же
  CSS-геометрии, иначе текст мылит.
