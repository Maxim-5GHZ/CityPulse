# CityPulse — хакатон-скелет

Минимум, с которого начинают кодить, а не чинить сборку:
**Next.js 14 + Spring Boot 3 (Java 21) + Postgres 16 + JWT-авторизация.**
Бэкенд реально коннектится к БД (проверка — `GET /api/db`).

## Быстрый старт

Требования: Docker + Docker Compose v2 + make.

```bash
cp .env.example .env   # один раз; дефолты уже рабочие
```

### Dev — без SSL, с hot reload

```bash
make dev
```

| Что            | Куда идти                                  |
|----------------|---------------------------------------------|
| Фронт          | http://localhost:3000                       |
| Бэкенд health  | http://localhost:8080/api/health            |
| Бэкенд БД      | http://localhost:8080/api/db                |
| Postgres       | localhost:5432 (логин/пароль из `.env`)    |

Остановка — `Ctrl+C`, фоновый разбор — `make down`.

**Hot reloaddevelopers:** правишь `frontend/**.tsx` — страница обновляется сама (Next dev);
сохраняешь `backend/src/**.java` — devtools перезапускает контекст за ~10 сек
(в логах бэкенда видно `RestartedMainClassLoader`). Композ рестартовать не надо.

### Prod — с SSL через nginx

```bash
make prod
```

Открыть https://localhost (порт из `HTTPS_PORT`).
Серт самоподписанный (генерируется сам при первом `make prod` через
`./nginx/gen-certs.sh`) — браузер ругнётся, это нормально, жми «продолжить».
HTTP на 80-м порту редиректит на HTTPS. Остановка — `make down-prod`.

## Что умеет скелет из коробки

- `GET /api/health` — жив ли бэкенд (публичный).
- `GET /api/db` — `SELECT 1` + версия Postgres, т.е. живой коннект к БД (публичный).
- `POST /api/auth/register` `{email, password}` → `{token}` — регистрация.
- `POST /api/auth/login` `{email, password}` → `{token}` — логин.
- `GET /api/me` — пример защищённого эндпоинта (только с `Authorization: Bearer <JWT>`).
- Без токена защищённые ручки отдают **401**, с токеном без прав — **403**.
- На старте сидится админ из `APP_ADMIN_EMAIL` / `APP_ADMIN_PASSWORD` (дефолт в `.env.example`).
- Фронт: главная показывает статус бэкенда/БД + вход/регистрация на `/login`, токен в `localStorage`.
  Браузер ходит в API через same-origin `/backend/*` (прокси Next в dev, nginx в prod) — CORS не нужен.
- Вход через **Флида ID (Web SDK, public-клиент без секрета)**: кнопка на `/login`
  запускает `sdk.authorize()` в redirect-режиме, callback принимает `/flida/finish`
  через `autoAuthorization`, фронт меняет Flida `access_token` на наш JWT через
  `POST /api/auth/flida` (бэкенд перепроверяет
  токен через `userinfo` сервер-сервер). Подробности — в разделе «Вход через Флида ID».

## Вход через Флида ID (как это работает)

Схема — Web SDK (public-клиент, секрета нет вообще, `scope` не передаём — он из настроек
проекта в консоли). `client_id` публичный, живёт в `NEXT_PUBLIC_FLIDA_CLIENT_ID`:

1. Клик по кнопке на `/login` → `sdk.authorize()` (redirect, `fedcm: []`) → браузер
   уходит на страницу Флиды (state/PKCE `S256` генерит и хранит сам SDK).
2. Юзер логинится у Флиды → та редиректит на зарегистрированный `redirectUri`
   (`<origin>/flida/finish?code&state`) — обычная страница Next, SDK в ней через
   `autoAuthorization` проверяет транзакцию из `sessionStorage` и сам меняет код
   на токены (`POST /api/oidc/token` с `client_id` без секрета).
3. Фронт шлёт Flida `access_token` на `POST /api/auth/flida` → Java идёт в `userinfo`
   с `Bearer` сервер-сервер, находит юзера по `flida_sub` (иначе цепляет к тому же
   email, иначе создаёт без пароля) и выпускает **наш** JWT.
4. Страница кладёт наш JWT в `localStorage` (тот же `AuthContext`, что email-вход),
   чистит `?code&state` через `history.replaceState` и уводит на `/workspace`.
   Ошибка (`FlidaError` или 400 от нашей ручки) — плашка на 3 секунды.

Нюансы:

- `redirectUri` (`origin + /flida/finish`) должен **побуквенно** совпадать с Redirect URL
  в консоли Флида ID (раздел **Платформы | Web**): зарегистрируй
  `http://localhost:3000/flida/finish` (dev) и боевой origin (prod).
- Локальный `make prod` ходит с origin `https://localhost` — он не зарегистрирован,
  поэтому кнопку Флиды там не жмём; боевой флоу живёт на боевом домене.
- `NEXT_PUBLIC_*` запекается в `next build` — в prod `client_id` пробрасывается через
  `args` фронта (см. `docker-compose.prod.yml` + `Dockerfile.prod`).
- FedCM выключен (`fedcm: []`); включается вторым заходом через `['active','passive']`
  + `autoAuthorization` на `/login`.

## Переменные окружения (один `.env` на всё)

| Переменная          | Дефолт                                   | Зачем                              |
|---------------------|------------------------------------------|------------------------------------|
| `POSTGRES_DB/USER/PASSWORD` | `citypulse`                  | база и юзер                        |
| `POSTGRES_PORT`     | `5432`                                   | порт PG наружу                      |
| `BACKEND_PORT`      | `8080`                                   | порт API наружу (dev)               |
| `FRONTEND_PORT`     | `3000`                                   | порт фронта наружу (dev)            |
| `HTTP_PORT/HTTPS_PORT` | `80` / `443`                          | порты nginx (prod)                  |
| `JWT_SECRET`        | `change-me-...` (**смени!**)             | подпись JWT, минимум 32 символа     |
| `APP_ADMIN_EMAIL`   | `admin@citypulse.local`                  | сид админа (пусто = не создавать)   |
| `APP_ADMIN_PASSWORD`| `admin`                                  | пароль сид-админа                   |
| `FLIDA_USERINFO_URI` | `https://id.flida.ru/api/oidc/...` | бэкенд проверяет Flida access_token |
| `NEXT_PUBLIC_FLIDA_CLIENT_ID` | — (взять в консоли Флида) | публичный client_id для Web SDK во фронт |

## Структура

```
Makefile                 # make dev / make prod / make down ...
.env / .env.example      # один env-файл на dev и prod
docker-compose.yml       # dev: postgres + backend + frontend (hot reload, без SSL)
docker-compose.prod.yml  # prod: те же + nginx с SSL (докладывается поверх base)
backend/                 # Spring Boot: web, JPA, security(JWT), flyway, postgres
  Dockerfile / Dockerfile.dev
  src/main/java/ru/citypulse/backend/
    controller/  AuthController, MeController, HealthController, GlobalExceptionHandler
    service/     AuthService (включая обмен Flida access_token на наш JWT), AdminBootstrap
    security/    JwtService, JwtAuthFilter + config/SecurityConfig, config/FlidaProps
    domain/      User   repository/ UserRepository
  src/main/resources/{application.yml,db/migration/V1__users.sql,db/migration/V2__flida.sql}
frontend/                # Next.js: app/(page,login,flida/finish) + lib(api,auth)
  Dockerfile.dev / Dockerfile.prod
nginx/                   # только prod: nginx.conf + gen-certs.sh (серты в .gitignore)
```

## Как развивать

- **Новая таблица** — файл `backend/src/main/resources/db/migration/V2__что-то.sql`
  (Flyway применит сам при старте; `ddl-auto: validate`, сущностям нужны `@Entity`).
- **Новый эндпоинт** — класс в `controller/`; публичный — добавь путь в `SecurityConfig`,
  админский — клади под `/api/admin/**` (там уже `hasRole("ADMIN")`).
- **Новая страница** — файл в `frontend/app/имя/page.tsx`; запросы к API — через функции из `frontend/lib/api.ts`
  (пути вида `/auth/login` — префикс `/backend` подставится сам).

## Полезное

```bash
make logs        # логи dev-стенда
make logs-prod   # логи prod-стенда
make clean       # снести всё подчистую (контейнеры, volumes — БАЗА ПОТРЕТСЯ, образы, кэши сборки)
```

### Если что-то пошло не так

- **Порт занят** — поменяй `*_PORT` в `.env`.
- **Бэкенд не стартует** — `docker compose logs backend`; частая причина: Postgres ещё поднимается
  (бэкенд ждёт `service_healthy`, просто подожди).
- **Браузер в prod ругается на серт** — так и должно быть (самоподпись), жми «продолжить» / `Advanced → Proceed`.
  Настоящий серт — положи свои файлы в `nginx/certs/citypulse.crt|key` под теми же именами.
- **С нуля не собирается** — `make clean` и заново `make dev` / `make prod`.
- **JWT_SECRET короткий** — работать будет (добивается до 32 байт), но для хакатона сойдёт, для прода — смени.
