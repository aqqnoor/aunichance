## Архитектура UniChance (MVP)

### 1. Общий обзор

UniChance — веб‑платформа для подбора зарубежных программ обучения и оценки шансов поступления.

Технологический стек:

- **Frontend**: React + TypeScript (SPA);
- **Backend**: Go + Echo;
- **База данных**: PostgreSQL (pgxpool).

---

### 2. Backend‑слои

- **HTTP‑слой** (`backend-go/internal/http/router.go`):
  - настройка Echo, CORS, логирование, recover;
  - маршрутизация эндпоинтов `/auth/*`, `/profile/*`, `/programs*`, `/universities*`;
  - rate limiting для `/auth/*` и `/programs*`;
  - централизованный JSON error handler.

- **Handlers**:
  - `internal/auth/handler.go` — регистрация, логин, `auth/me`;
  - `internal/profile/handler.go` — CRUD профиля абитуриента и `/score`;
  - `internal/programs/handler.go` — поиск программ и smart‑matching;
  - `internal/universities/handler.go` — просмотр университетов.

- **Services / Repos**:
  - `internal/auth/service.go` — работа с пользователями, JWT;
  - `internal/profile/repo.go` — профили и история скоринга;
  - `internal/programs/repo.go` — поиск и выборка программ;
  - `internal/universities/repo.go` — выборка университетов и связанных ссылок.

- **Scoring**:
  - `internal/scoring/scoring.go` — heuristic скоринг по профилю + требованиям;
  - `internal/scoring/matcher.go` — расширенный smart‑matching (program context).

---

### 3. База данных и миграции

Миграции расположены в `backend-go/migrations/` и выполняются последовательно:

- `001_init.sql` — базовые таблицы `users`, `universities`, `programs`, `requirements`, типы ENUM, триггеры `updated_at`, `search_vector` для программ;
- `002_profile_and_scores.sql` — профили (`profiles`) и история скоринга (`scores`);
- `003_updated_at_and_search_vector.sql` и `011_search_vector_fix.sql` — унификация обновления `updated_at` и `search_vector` для университетов и программ на конфигурации `simple`;
- `004_sources_links_fetchlog.sql` — источники данных, ссылки университетов и лог ETL (`sources`, `university_links`, `fetch_log`);
- `005_smart_matching.sql` — поля для smart‑matching (конкурентность, история поступлений);
- `012_degree_level_enum.sql` — стандартизация `degree_level` через ENUM (без потери данных в legacy‑схеме);
- `013_languages.sql` — нормализация языков (таблица `languages`, колонка `programs.language_code`);
- `014_indexes.sql` — индексы под реальные запросы (`degree_level + field`, `deadlines`).

Ключевые таблицы:

- `users` — учетные записи;
- `profiles` — академический профиль абитуриента;
- `universities` — университеты;
- `programs` — программы (связаны с университетами);
- `requirements` — минимальные требования программ;
- `deadlines`, `scholarships`, `admission_stats` — дедлайны, стипендии, статистика приема;
- `scores` — история оценок шансов;
- `sources`, `university_links`, `fetch_log` — инфраструктура ETL.

---

### 4. Поиск (Search)

Реализация:

- `internal/programs/repo.go` — метод `Repo.List`:
  - основной фильтр: `programs.search_vector @@ plainto_tsquery('simple', $q)`;
  - сортировка по `ts_rank` (релевантность), затем QS/THE, затем `title`;
  - идентичные фильтры для `COUNT(*)` и списка `items` (корректная пагинация);
  - опциональный fallback ILIKE по названию программы/направлению/университету (`UseILikeFallback`).

Миграции:

- `001_init.sql`, `003_updated_at_and_search_vector.sql`, `011_search_vector_fix.sql` — создание и поддержание `search_vector` для `programs` и `universities`, триггеры и GIN‑индексы.

---

### 5. Chance scoring

Модуль `internal/scoring`:

- **Интерфейс**:  
  `type Scorer interface { Compute(Profile, Requirements) Result }`
- **Реализация по умолчанию**:  
  `HeuristicScorer` (rule‑based, объяснимый, без логарифмов, устойчивый к отсутствию данных).
- **Функция‑обёртка**:  
  `Compute(...)` вызывает `HeuristicScorer` для сохранения обратной совместимости.

Интеграция:

- `profile.Handler` принимает `Scorer` через DI;
- `/score` зависит от интерфейса, а не от конкретной реализации — это позволяет заменить heuristic‑скористор на ML‑модель без изменения API.

Принцип работы:

- итоговый балл `0–100`;
- компоненты: GPA, язык, стандартизированные тесты, достижения;
- категория: `reach` / `target` / `safety`;
- формируется `breakdown` и список текстовых причин (`reasons`).

Отсутствие данных:

- отсутствие показателя не наказывает напрямую (компонент не учитывается);
- в `reasons` добавляется сообщение о сниженной точности.

---

### 6. Что можно расширять / что нельзя ломать

**Стабильные контракты (не ломать):**

- Формат ответов основных эндпоинтов:
  - `/auth/register`, `/auth/login`, `/auth/me`;
  - `/profile/me` (GET/POST);
  - `/programs` (список с `page/limit/total/items`);
  - `/universities/:id`;
  - `/score`.
- Структура DTO в JSON‑ответах (поля, типы, названия).
- Существующие миграции — новые изменения должны добавляться только новыми файлами.

**Можно и нужно расширять:**

- добавлять новые поля в таблицах (через миграции);
- вводить дополнительные индексы;
- добавлять новые эндпоинты и параметры фильтрации;
- подключать ML‑модели на место heuristic‑скоринга через реализацию интерфейса `Scorer`;
- развивать ETL‑слой, источники данных, формат CSV/ingestion‑команды.

