# AGENTS.md — CityPulse

Правила для агентов и людей. Все примеры — из текущего кода, ничего не выдумывать:
новые решения сверяй с `frontend/app/login/page.tsx` (эталон форм),
`frontend/app/page.tsx` (эталон deck-презентации для жюри) и
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
  (слушатели чистятся), фокус возвращается на кнопку. Пункты меню — общий
  интерактив (`hover:scale-[1.05] active:scale-[0.98]`), как всё кликабельное.
- Навигация хедера — константа `NAV_ITEMS` в `AppHeader.tsx`: на десктопе ссылки
  идут в ряд по центру пилюли (`hidden md:flex`, стеклянные пилюли как «Войти»
  на `/`), на мобиле те же ссылки уезжают в шторку снизу.
  Новую кнопку добавлять в `NAV_ITEMS` — она появится в обоих местах сама.
- Админка `/admin` — обычный Tailwind, как вся юзерская часть (MUI вырезан:
  тянул ~60 пакетов и вечную сборку). UI-китов нет вообще. CRUD-шаблон: бэк —
  `controller/admin/AdminUserController.java`, фронт — `components/admin/EntityTable.tsx`.
- Секреты админа только из ENV (`APP_ADMIN_EMAIL`/`APP_ADMIN_PASSWORD`), дефолтов нет:
  пусто = админ не создаётся. `.env` не коммитить (уже в `.gitignore`).
- Ошибки API единые: `{message, fieldErrors?}` (`dto/ErrorResponse.java`,
  `GlobalExceptionHandler`: 400/404/409/403/500, всё по-русски). Фронт показывает
  `message` как есть, `fieldErrors` подсвечивает поля (`ApiError.fieldErrors`).
- Realtime-заготовка: `SseHub` + `GET /api/events/stream?token=` (EventSource не умеет
  header — tradeoff зафиксирован), broadcast — `POST /api/events/admin/broadcast`
  (только ADMIN), фронт — `lib/useEvents.ts` (автореконнект с backoff).
- e2e на общей базе: правило «создал — удали» (`scripts/e2e.sh`, префикс `e2e-`).
  Раз есть POST — обязан быть DELETE.

## Liquid Glass — экраны с фото-фоном (`/`, `/login`, `/workspace`, `/about`)

- Действует на `/` (deck, см. раздел Презентация), `/login`, `/workspace` (каркас:
  приветствие + сетка скелетонов, без контента) и `/about` (контакты + разработчики):
  поверх базовых правил. Остальной UI — по разделу выше.
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
  Ширина разная: `/login` — `max-w-md`, слайд `/` и карточка `/about` — `max-w-xl`
  (шире под два QR в ряд),
  `/workspace` — `max-w-4xl` (каркас под сетку виджетов `sm:grid-cols-2 lg:grid-cols-3`).
- Шапка-ссылка («Войти» на `/`, «← На главную» на `/login` и `/about`) — стеклянная пилюля:
  `rounded-full border-white/60 bg-white/40 px-4 py-1.5 backdrop-blur-xl hover:bg-white/60`
  (`dark:border-white/20 dark:bg-white/10`). На `/` в шапке слева
  `<PulseLogo as="span" size="lg">` (клик — к началу deck), справа две такие пилюли:
  `Контакты` (Link → `/about`) + `Войти` / `В интерфейс`.
- Логотип: `<PulseLogo as="span" size="lg" className="scale-150 my-2">` в обёртке
  `mx-auto flex justify-center` (h1 — заголовок страницы/слайда, не лого).
- Специфика `/login`: табы — сегментированный контрол (`rounded-full bg-white/40 p-1`,
  активный таб — выпуклая пилюля `rounded-full bg-white shadow`); инпуты и кнопка
  Флиды — пилюли `rounded-full` с линзой (`inset 0 2px 4px rgba(0,0,0,0.06)` +
  `inset 0 -1px 2px rgba(255,255,255,0.9)`, `border-white/60`); отправка — тёмное
  стекло `bg-[#141a26]/90 rounded-full` с бликом
  `inset 0 1px 1px rgba(255,255,255,0.25)`; ошибки —
  `border-red-200/70 bg-red-50/80`; разделитель — `w-1/5 border-b border-white/70` +
  `text-xs uppercase text-gray-500`.
- Специфика `/` и `/about`: QR-ряд `flex-col sm:flex-row`, QR-ссылка обязана быть сплошной
  `bg-white` (иначе не сканируется): `rounded-2xl border-white/60 p-4` + линза-тени;
  подписи — `text-sm font-medium text-gray-600` (`dark:text-gray-200`). QR — `size={180}`
  через `react-qr-code`, URL — константы `SITE_URL`/`GITHUB_URL` вверху файла
  (на `/` — инлайн-компонент `QrRow` в `page.tsx`, на `/about` — та же разметка).
- Интерактив общий: всё кликабельное — `transition-all duration-200 ease-out
  hover:scale-[1.05] active:scale-[0.98]` (+ `transform-gpu` на стекле,
  `motion-reduce:transform-none motion-reduce:transition-none`); глазик —
  `hover:scale-110`; инпуты — деликатнее `hover:scale-[1.02] focus:scale-[1.02]`
  (во всю ширину, иначе упрутся в края); `bg-white` у QR и тени при этом не трогать.

## Презентация `/` — deck для жюри (до регистрации)

- Живёт в одном `frontend/app/page.tsx` (~250 строк), новых зависимостей и правок
  `tailwind.config.js` нет (`app/**/*` уже покрыт `content`). Пока только hero;
  середину докинем позже (пустые заглушки не показывать жюри), Контакты — отдельная
  страница `/about` (QR + ссылки + заглушка «Разработчики»),
  интерактивы — в `frontend/components/pitch/` (фильтр, лесенка, табы, ROI).
- Модель: `interface Slide { id, badge, title, subtitle, content }`, массив `slides`,
  состояние `currentSlide + isTransitioning` (600мс). Навигация —
  `goToSlide/next/prev` (`useCallback`, цель клемпится в `goToSlide`, переход
  блокируется флагом `isTransitioning`): wheel с проверкой `scrollHeight` (при зуме
  сначала домотать контент, `preventDefault` + троттл 700мс), `keydown`
  (стрелки/PageUp/PageDown/Space, игнор `INPUT/TEXTAREA/SELECT`, Space игнорить на
  `button/a`), тач-свайп `>50px`. Все слушатели
  (`wheel/keydown/touchstart/touchend`) чистятся в cleanup.
- Каркас слайда — стекло с `/`: `h-screen w-screen overflow-hidden bg-cover bg-center` +
  `url('/city.png')` + та же вуаль (`from-white/30 via-white/10 to-white/40`,
  `dark:from-black/60 dark:via-black/40 dark:to-black/70`). Тело —
  `overflow-y-auto` со скрытым скроллбаром (`[scrollbar-width:none]
  [&::-webkit-scrollbar]:hidden`, класса `no-scrollbar` в проекте нет — не
  использовать). Центрирование через `m-auto` на контенте, не `justify-center`
  (иначе верх переполненного слайда уйдёт под шапку). Смена слайда — только
  существующий `motion-safe:animate-fade-in` (`fade-in` в конфиге);
  `animate-fadeIn`/`animate-ping` запрещены — их нет в конфиге.
- Хедер `/`: `justify-between` — слева кнопка с `<PulseLogo as="span" size="lg">`
  (к началу deck, `aria-label`), центр — дотсы (`hidden lg:flex`, активный
  `w-8 bg-gray-800 dark:bg-white`, остальные `w-2 bg-gray-300`, каждому
  `aria-label="Слайд N"` + `aria-current` + `title`), справа две стеклянные пилюли
  (`glassPillSm` без `min-w` — компактные, иначе разъедутся на мобиле):
  `Контакты` (Link → `/about`) + `Войти` / `В интерфейс`
  (`useAuth().token`, только существующие `/login`/`/workspace`). Футер: счётчик
  `01/NN` (`font-mono`) + `↑/↓` (`w-10 h-10 rounded-full` на тёмном стекле сабмита,
  `aria-label`+`title`, `disabled:opacity-40 disabled:pointer-events-none`).
- Слайд 1 (hero): карточка `cardCls` с `/` (`max-w-xl`), `<PulseLogo as="span"
  size="lg" className="scale-150 my-2 sm:scale-[2.25] sm:my-16">` в
  `mx-auto flex justify-center` (внутри
  слайда не `h1` — `h1` уже заголовок слайда; на десктопе лого в 1.5 раза крупнее
  базового, `sm:my-16` компенсирует разлёт CSS-скейла, иначе налезет на QR), бейдж-пилюля (`rounded-full
  border-white/60 bg-white/40`, `text-xs uppercase text-gray-600`,
  `dark:bg-white/10 dark:text-gray-200`), заголовок `font-black tracking-tight` с
  `drop-shadow` для читаемости поверх фото. Под лого — `QrRow`
  (инлайн-компонент в `page.tsx`, без дублирования): `flex-col sm:flex-row`, ссылка
  обязана быть сплошной `bg-white` (`qrLinkCls`, тени не трогать), QR `size={180}`,
  подписи `text-sm font-medium text-gray-600 dark:text-gray-200`. Кнопки: тёмное
  стекло сабмита `darkBtn` (`bg-[#141a26]/90 rounded-full`, «Контакты» → `/about`) +
  стеклянная «Войти» / «В интерфейс» (`useAuth().token` → `/login`/`/workspace`).
  Ссылки — только `Link`, переходы deck — только `<button>` (у `Link` нет
  `onClick`-перехода слайда).
- Контакты — отдельная страница `/about` (`frontend/app/about/page.tsx`): та же
  вуаль и карточка `max-w-xl`, сверху «← На главную», внутри `<PulseLogo as="span">`
  + `h1` «Контакты», тот же QR-блок (`size={180}`, `bg-white`), стеклянные пилюли
  `<a target="_blank" rel="noopener noreferrer">` на `GITHUB_URL`/`SITE_URL`,
  плашка «Разработчики» («Состав команды добавим позже») и `darkBtn`
  «Войти / Зарегистрироваться» → `/login`.
- Запреты deck: палитра `#101C4C/#ECF3FB/#E74040/#31A275` запрещена (база gray,
  акцент `blue-600`, плохо `border-red-200/70 bg-red-50/80 text-red-700`, хорошо —
  паттерн live-бейджа из `workspace/page.tsx`); `LogoMark`/`GovIcon`/…/`PipelineDiagram`/
  `homeForRole`/`roleOf`/`/inbox` не тащить — их нет в репо (`components/` — только
  `PulseLogo`, `AppHeader`; `lib/auth.tsx` — только `useAuth()` с `role`); бренд
  только через `<PulseLogo>`, текстом нельзя; каждой поверхности `dark:`-дубль;
  кликабельному — общий интерактив Liquid Glass.

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

## Кейс 03 — Конструктор «Обнинск 2040» (жёсткие ограничения, зафиксированы)

- Роут — `/workspace` (воркспейс и есть конструктор; `/workspace/constructor` —
  тот же экран для совместимости). Отдельного пункта в `NAV_ITEMS` нет —
  логотип хедера уже ведёт в `/workspace`. Страница `'use client'` +
  `dynamic(ssr:false)` для карт.
- Реальная геометрия — только OpenStreetMap (ODbL, без ключей).
  Запрещены: спутник/Sentinel-5P/OpenAQ в 3D, Cesium ion, Google Maps/Tiles 3D,
  GLTF/внешние меши, PostGIS, честный CFD/OpenFOAM, LLM в демо.
- Фрагмент «Центр»: bbox `55.0895,36.5980,55.0995,36.6180`,
  центр `55.0960,36.6100` (солнце + проекция). Кэш —
  `frontend/public/osm/obninsk-center.geojson` (коммитим, офлайн-демо).
  В углу карты и в «Как считаем» — `© OpenStreetMap`.
- Конвейер: Overpass QL `way/relation["building"](bbox); out geom;` →
  `scripts/osm-to-district.mjs` → GeoJSON → `lib/city/osm.ts` → `DistrictModel`.
  Прямого fetch к Overpass из браузера нет (правило `/backend/*`);
  live-импорт — только фазой B через `POST /api/osm/import` (бэк тянет server-server).
- Проекция: equirect вокруг центра
  `x=(lon-lon0)*111320*cos(lat0)`, `y=(lat-lat0)*110540`, сдвиг в `0..1000`.
  Упрощение `tolerance 1м`, дроп `<20 м²`, лимит `~300` коробок (2км/600 — нельзя без LOD).
- Высота: `height` → парс, иначе `levels*3.0`, иначе дефолт
  (`residential 15 / school 12 / retail 10 / garage 4 / church 18`).
  Крыша: `roof:shape flat|gable|hip`, иначе `flat` при `h>15`, `gable` при малом.
  Пресет: `levels<=5 panel5`, `>9 tower16`, `amenity=school shkola`,
  `shop=mall tc`, иначе `custom`.
- Граф P0 — синтетический поверх реальных коробок (12 узлов, 5 домов 80–240 жит.,
  остановка+парк+школа опц.): гарантирует M1/M2, до/после, `seed+hash`.
  Дороги `highway=footway|path` из OSM — только фоном в фазе 1, в Dijkstra не тащим.
  Dijkstra — свой `lib/city/graph.ts` (~30 строк), вес = длина, `closed` исключается.
- 3D — только процедурная геометрия (`three@0.16x`):
  `Box`/`Extrude(footprint,h)` + фасад `CanvasTexture 128x256` (сетка окон по `floors`)
  + крыши `flat` плита / `gable` призма / `hip` пирамида, `MeshStandardMaterial`.
  Палитра 3D — только slate + приглушённый стально-голубой, неон запрещён.
  Свет `DirectionalLight` из `suncalc(date,55.096,36.61)`, `shadowMap PCFSoft 1024`,
  `pixelRatio<=2`, земля `Plane receiveShadow`, здания `cast+receive`.
  Выбор — `Raycaster`, `% затенения` через `turf.intersect`.
- 2D — `ol@10` `VectorLayer`, подложка OSM приглушённая; канвас сплошной,
  стекло только в панелях. Тень 2D: `L=H/tan(alt)`, `dx=L*cos(az)`, `dy=L*sin(az)`.
  Ветер: поле 8×8, конус `L=2*H`, зелень `-30%`, подпись «эвристика, не OpenFOAM».
- Коробка влияет на метрики: рвёт ребра в радиусе 20м
  (`closed` или `length+=периметр/2`) → Dijkstra заново; +ветрозатон +тень.
- API/БД: сценарии — `V3__scenarios.sql` (`owner_id, name, graph JSONB`), CRUD
  `/api/scenarios`, дубли `/metrics/calculate /wind /shadow /conclusion` за JWT.
  Ошибки `{message, fieldErrors?}` по-русски, клиент — `lib/api.ts`.
- UI конструктора: русский, бренд только `<PulseLogo>`, панели-стекло
  `rounded-[32px] bg-white/40 dark:bg-gray-900/40`, пилюли `rounded-full`,
  каждой поверхности `dark:`-дубль, интерактив
  `hover:scale-[1.05] active:scale-[0.98] motion-reduce`, канвасу
  `role="img"+aria-label`, `OrbitControls`+`ResizeObserver`+rAF чистятся.
- Дисклеймеры в UI: «данные условные, не прогноз (п.11)», «не точный двойник (п.7)»,
  «ветер — эвристика». Срез при отставании: воды → спутник → ветер → тени → 3D,
  P0 неприкосновенен. Проверки `tsc --noEmit` + `next lint` — чистые.
