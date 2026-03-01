# Модуль поиска UniChance (Go + Postgres)

## Обзор

Модуль поиска университетов и программ реализован на стеке **Go + Echo + PostgreSQL (pgx)** и предоставляет:

- полнотекстовый поиск по `search_vector` с конфигурацией `simple`;
- фильтрацию по странам, уровням программ, направлениям, языку и стоимости;
- стабильную пагинацию с подсчётом `total`;
- интеграцию с heuristic-скорингом шансов поступления.

Основной HTTP-эндпоинт поиска — `GET /programs` (и алиас `GET /programs/search`).

---

## Архитектура backend

- **Язык**: Go
- **Web‑фреймворк**: Echo
- **Доступ к БД**: `pgxpool` (PostgreSQL)
- **Аутентификация**: JWT (эндпоинты `/auth/*`)
- **Слои**:
  - handlers (`internal/programs/handler.go`);
  - репозитории (`internal/programs/repo.go`);
  - миграции (`backend-go/migrations/*.sql`).

---

## Структура поискового индекса (`search_vector`)

### Таблица `programs`

Колонка:

- `search_vector tsvector` — основной FTS‑индекс.

Формирование (миграции `011_search_vector_fix.sql` и `001_init.sql`):

- используется конфигурация `simple`, дружественная к кириллице;
- вектор собирается из полей:
  - `title` (название программы),
  - `field` (направление подготовки),
  - `language` (язык обучения),
  - `university.name`,
  - `university.country_code`,
  - `university.city`.

Пример пересборки:

```sql
UPDATE programs p
SET search_vector = to_tsvector(
  'simple',
  coalesce(p.title, '') || ' ' ||
  coalesce(p.field, '') || ' ' ||
  coalesce(p.language, '') || ' ' ||
  coalesce(u.name, '') || ' ' ||
  coalesce(u.country_code, '') || ' ' ||
  coalesce(u.city, '')
)
FROM universities u
WHERE u.id = p.university_id;
```

Индекс:

```sql
CREATE INDEX IF NOT EXISTS idx_programs_search_vector
  ON programs USING GIN (search_vector);
```

Поддержание актуальности:

- триггер `trg_programs_search_vector` и функция `update_programs_search_vector()` автоматически обновляют `search_vector` при `INSERT/UPDATE`.

### Таблица `universities`

Аналогично:

- `search_vector tsvector` собирается из `name`, `country_code`, `city`;
- GIN‑индекс `idx_universities_search_vector`;
- триггер `trg_universities_search_vector`.

---

## Фильтры и параметры `/programs`

Эндпоинт:  
`GET /programs` (и `GET /programs/search`)

Параметры (отражают структуру `ListParams`):

- `q` — поисковый запрос (FTS по `search_vector`, `plainto_tsquery('simple', q)`);
- `countries` — CSV‑список кодов стран (например, `US,GB,DE`);
- `levels` — CSV‑список уровней программ;
- `fields` — CSV‑список направлений;
- `currency` — код валюты обучения (например, `USD`, `EUR`, `KZT`);
- `min_tuition` — минимальная стоимость обучения;
- `max_tuition` — максимальная стоимость обучения;
- `scholarship` — `true/false`, только программы со стипендией;
- `sort` — сортировка:
  - `relevance` (по умолчанию при наличии `q`);
  - `tuition_asc` / `tuition_desc`;
  - `qs` / `the`;
- `page` — номер страницы (по умолчанию `1`);
- `limit` — размер страницы (по умолчанию `20`, максимум `50`).

Ответ:

```json
{
  "page": 1,
  "limit": 20,
  "total": 123,
  "items": [
    {
      "id": "...",
      "title": "...",
      "degree_level": "master",
      "field": "Computer Science",
      "language": "English",
      "tuition_amount": 20000,
      "tuition_currency": "USD",
      "has_scholarship": true,
      "university_name": "...",
      "country_code": "US",
      "city": "Boston",
      "qs_rank": 50,
      "the_rank": 80
    }
  ]
}
```

`total` всегда считается теми же фильтрами, что и выборка `items`, что гарантирует корректную пагинацию.

---

## Пагинация и сортировка

- Пагинация реализована через `page` и `limit`:
  - `offset = (page - 1) * limit`;
  - `limit ∈ [1, 50]`, `page ≥ 1`.
- При пустом `q` сортировка по умолчанию:
  - `universities.qs_rank ASC NULLS LAST`,
  - затем `universities.the_rank`,
  - затем `programs.title`.
- При непустом `q` и `sort=relevance|""`:
  - первым идёт `ts_rank(programs.search_vector, plainto_tsquery('simple', $N)) DESC`,
  - затем QS/THE/title, как указано выше.

---

## FTS‑запрос и fallback ILIKE

Основной поиск:

```sql
programs.search_vector @@ plainto_tsquery('simple', $q)
```

Сортировка по релевантности:

```sql
ORDER BY ts_rank(programs.search_vector, plainto_tsquery('simple', $q)) DESC, ...
```

Все параметры запроса передаются в PostgreSQL параметризованно, без конкатенации пользовательских строк.

Дополнительно в `ListParams` предусмотрен флаг `UseILikeFallback` (по умолчанию `false`), который включает расширенный поиск через `ILIKE` по:

- `programs.title`,
- `programs.field`,
- `universities.name`.

Это позволяет мягко расширять выдачу в случаях, когда FTS даёт мало результатов.

---

## Индексы под реальные запросы

Ключевые индексы:

- `idx_programs_search_vector` — GIN по `programs.search_vector`;
- `idx_universities_search_vector` — GIN по `universities.search_vector`;
- `idx_programs_degree_field_v2` — B‑tree по `(degree_level, field)` для комбинаций фильтров;
- `idx_deadlines_program_date_v2` — B‑tree по `(program_id, deadline_date)` для дедлайнов;
- `idx_programs_language_code` — по `language_code` (нормализованный ISO‑код языка).

---

## Связь с скорингом шансов

Хэндлеры программ и профиля интегрированы с модулем `internal/scoring`:

- интерфейс `Scorer` и реализация `HeuristicScorer`;
- HTTP‑слой зависит от интерфейса, поэтому реализация может быть заменена на ML‑модель без изменения API (`/score`).

Важно: текущий скоринг является **эвристическим** и не гарантирует поступление, а служит инструментом поддержки принятия решений.
