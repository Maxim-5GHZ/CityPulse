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
- Вход через **Флида ID**: кнопка на `/login` — обычная ссылка, весь OIDC-флоу живёт в Java
  (confidential-клиент, `client_secret` только в env бэкенда). Подробности — в разделе «Вход через Флида ID».

## Вход через Флида ID (как это работает)

Фронтендер, не переживай: на фронте никакой логики — кнопка-ссылка
и страница-приёмник `/flida/finish` (комменты прямо в коде). Всё остальное — бэкенд:

1. Клик → `GET /backend/auth/flida/login` → Java отвечает **302** на страницу Флиды
   (`client_id` + PKCE `S256` + `state`; пара хранится в памяти бэкенда 15 минут).
2. Юзер логинится у Флиды → та редиректит на зарегистрированный `redirect_uri`
   (`/flida/oauth2/callback?code&state`), который смотрит на фронт-origin,
   а обрабатывает бэкенд (dev: rewrite в `next.config.js`, prod: `location` в nginx).
3. Java меняет код на токены **секретом** (сервер-сервер), дёргает `userinfo`,
   находит юзера по `flida_sub` (иначе цепляет к тому же email, иначе создаёт без пароля —
   осознанное упрощение для хакатона) и выпускает **наш** JWT.
4. Успех → **302** на `/flida/finish#token=<наш JWT>` (фрагмент `#` не уходит в сеть
   и не пишется в логи); страница кладёт токен в `localStorage`, дальше всё как обычно.
   Ошибка → **302** на `/login?flida=error`.

Нюансы:

- `redirect_uri` в `.env` должен **побуквенно** совпадать с Redirect URL в консоли Флида ID.
- Локальный `make prod` ходит с origin `https://localhost` — он не зарегистрирован,
  поэтому кнопку Флиды там не жмём; боевой флоу живёт на `https://hotcodeband.ru`.
- Если Флида не отдаёт `email` (скопы в консоли) или путь authorize отличается от
  `/api/oidc/authorize` — правятся `FLIDA_*` в `.env`, код трогать не надо.
- Секрет из чата/переписки — перевыпусти в консоли при случае.

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
| `FLIDA_CLIENT_ID/SECRET` | — (взять в консоли Флида)             | только бэкенду! во фронт нельзя     |
| `FLIDA_AUTHORIZE/TOKEN/USERINFO_URI` | `https://id.flida.ru/api/oidc/...` | эндпоинты провайдера         |
| `FLIDA_DEV_REDIRECT_URI` | `http://localhost:3000/flida/oauth2/callback` | должен совпадать с консолью  |
| `FLIDA_DEV_FRONTEND_URL` | `http://localhost:3000`               | куда класть JWT после входа (dev)   |
| `FLIDA_PROD_REDIRECT_URI` | `https://hotcodeband.ru/flida/oauth2/callback` | то же для прода            |
| `FLIDA_PROD_FRONTEND_URL` | `https://hotcodeband.ru`              | куда класть JWT после входа (prod)  |

## Структура

```
Makefile                 # make dev / make prod / make down ...
.env / .env.example      # один env-файл на dev и prod
docker-compose.yml       # dev: postgres + backend + frontend (hot reload, без SSL)
docker-compose.prod.yml  # prod: те же + nginx с SSL (докладывается поверх base)
backend/                 # Spring Boot: web, JPA, security(JWT), flyway, postgres
  Dockerfile / Dockerfile.dev
  src/main/java/ru/citypulse/backend/
    controller/  AuthController, FlidaController, MeController, HealthController, GlobalExceptionHandler
    service/     AuthService, FlidaService, AdminBootstrap
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
