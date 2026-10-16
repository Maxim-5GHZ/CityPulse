# ЗАДАЧА ДЛЯ БЭКЕНД-АГЕНТА: Модуль сохранения проектов симулятора (CityPulse Projects)

## Контекст проекта
- Стек: Spring Boot 3, Java 21, PostgreSQL 16, Spring Security + JWT.
- API префикс контроллеров: `/api/*` (на фронтенде проксируется через `/backend/*`).
- Все ошибки возвращаются в едином формате `{ "message": "...", "fieldErrors": {...} }` через `GlobalExceptionHandler`.
- Авторизация: `Authorization: Bearer <JWT>`, в токене `sub` — это email пользователя.

---

## 1. База данных (DDL / Миграция)
Создать таблицу `projects` (Flyway-миграция `V4__projects.sql` —
V3 занята в истории dev-БД миграцией `scenarios` от параллельной задачи,
дублировать версию нельзя):

```sql
CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    data TEXT NOT NULL, -- JSON-строка со сценарием (ноды, рёбра, дома, объекты)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);
```

---

## 2. Сущность JPA (`entity/Project.java`)
- Поля:
  - `UUID id` (генерируется автоматически)
  - `User user` (связь `@ManyToOne(fetch = FetchType.LAZY)`, `user_id`)
  - `String name` (not null, длина до 255)
  - `String description` (nullable)
  - `String data` (not null, `@Column(columnDefinition = "TEXT")`)
  - `OffsetDateTime createdAt` (not null, заполняется при создании)
  - `OffsetDateTime updatedAt` (not null, обновляется при изменении)

---

## 3. Репозиторий (`repository/ProjectRepository.java`)
- `List<Project> findAllByUserIdOrderByUpdatedAtDesc(UUID userId);`
- `Optional<Project> findByIdAndUserId(UUID id, UUID userId);`

---

## 4. DTO (`dto/project/`)
1. `ProjectSummaryResponse`: `id`, `name`, `description`, `createdAt`, `updatedAt`.
2. `ProjectDetailResponse`: `id`, `name`, `description`, `data`, `createdAt`, `updatedAt`.
3. `SaveProjectRequest`:
   - `@NotBlank(message = "Название проекта обязательно") String name`
   - `String description`
   - `@NotBlank(message = "Данные проекта не могут быть пустыми") String data`

---

## 5. Контроллер (`controller/ProjectController.java`)
Маппинг: `@RestController @RequestMapping("/api/projects")`
Все ручки требуют аутентификации (текущий пользователь определяется по email из JWT):

1. **`GET /api/projects`**
   - Возвращает `List<ProjectSummaryResponse>` пользователя, отсортированный по дате обновления (новые сверху).
2. **`GET /api/projects/{id}`**
   - Возвращает `ProjectDetailResponse`. Если проект не найден или принадлежит другому пользователю — 404 с сообщением «Проект не найден».
3. **`POST /api/projects`**
   - Принимает `@Valid @RequestBody SaveProjectRequest`.
   - Создаёт проект для текущего пользователя, возвращает `ProjectDetailResponse` (HTTP 201 Created).
4. **`PUT /api/projects/{id}`**
   - Принимает `@Valid @RequestBody SaveProjectRequest`.
   - Обновляет имя, описание, `data` и `updatedAt`. Если проект не найден/чужой — 404.
   - Возвращает обновлённый `ProjectDetailResponse`.
5. **`DELETE /api/projects/{id}`**
   - Удаляет проект пользователя. Если не найден — 404. Возвращает `{ "status": "deleted", "id": "..." }`.

---

## 6. Требования к качеству
- Никаких заглушек. Код должен компилироваться (`mvn test-compile`).
- Доступ только к проектам авторизованного пользователя (чужие проекты редактировать/читать нельзя).
- Сообщения об ошибках на русском языке.

## Статус
Реализовано: `V4__projects.sql`, `domain/Project.java`,
`repository/ProjectRepository.java`, `dto/project/*`, `controller/ProjectController.java`.
Фронт: `frontend/lib/projectApi.ts`, конструктор в `workspace/page.tsx` +
`components/city/DistrictMap.tsx` / `DistrictMap3D.tsx`.

## Инцидент 2026-10-16 (решено)
Dev-БД уже содержала применённую миграцию `V3__scenarios` (файл в репо
отсутствует, таблица `scenarios` осталась на месте — её не трогали).
Поэтому: наша миграция уехала на `V4__projects.sql`, а осиротевшая запись
`version='3'` удалена из `flyway_schema_history` (эквивалент `flyway repair`).
Плюс вычищен stale `target/classes` из volume `citypulse_maven-target`,
где лежал призрак `V3__scenarios.sql`. После этого бэкенд стартует чисто:
`GET /api/health` → 200, `GET /api/projects` без токена → 401.
