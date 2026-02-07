# Инструкция по установке и запуску модуля поиска

## Предварительные требования

- Node.js 18+ и npm
- PostgreSQL 12+
- Git

## Шаг 1: Установка зависимостей

### Frontend
```bash
npm install
```

### Backend
```bash
cd backend
npm install
```

## Шаг 2: Настройка базы данных

1. Создайте базу данных PostgreSQL:
```bash
createdb unichance
```

2. Настройте переменные окружения в `backend/.env`:
```bash
cd backend
cp .env.example .env
# Отредактируйте .env и укажите ваши данные БД
```

3. Запустите миграции:
```bash
psql -d unichance -f ../database/migrations/001_initial_schema.sql
psql -d unichance -f ../database/migrations/002_add_search_indexes.sql
```

## Шаг 3: Настройка переменных окружения

В файле `backend/.env` укажите:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/unichance
DB_HOST=localhost
DB_PORT=5432
DB_NAME=unichance
DB_USER=your_user
DB_PASSWORD=your_password

PORT=3001
NODE_ENV=development

JWT_SECRET=your-secret-key-min-32-characters
JWT_EXPIRES_IN=7d

ENCRYPTION_KEY=your-32-character-encryption-key-here
```

### Настройки фронтенда (Vite)

Для настройки поведения health-check и автоповторов можно задать переменные окружения для Vite (файлы `.env`, `.env.local` в корне проекта):

```env
# URL backend (пример):
VITE_API_URL=http://localhost:3001

# Интервал автоповтора health-check в секундах (по умолчанию 10)
VITE_HEALTH_RETRY_INTERVAL=10

# Включить/отключить автоматический повтор (true/false). По умолчанию включено.
VITE_HEALTH_AUTO_RETRY=true

# Максимальное количество автоматических повторов (0 = неограниченно)
VITE_HEALTH_RETRY_MAX=0
```

Пример: чтобы попробовать повторять раз в 30 секунд и ограничить 5 попытками, добавьте:

```env
VITE_HEALTH_RETRY_INTERVAL=30
VITE_HEALTH_RETRY_MAX=5
```

**Важно**: `ENCRYPTION_KEY` должен быть минимум 32 символа для AES-256.

## Шаг 4: Запуск приложения

### В режиме разработки

**Терминал 1 - Backend:**
```bash
cd backend
npm run dev
```

**Терминал 2 - Frontend:**
```bash
npm run dev
```

### В продакшене

**Backend:**
```bash
cd backend
npm run build
npm start
```

**Frontend:**
```bash
npm run build
# Разверните dist/ на вашем веб-сервере
```

## Шаг 5: Импорт данных (опционально)

Для импорта данных из внешних источников:

```bash
cd etl
npm install
tsx import_qs_rankings.ts
tsx import_university_data.ts
```

**Примечание**: ETL скрипты требуют настройки API ключей в `.env` и соблюдения лицензионных ограничений источников данных.

## Проверка работы

1. Backend должен быть доступен на `http://localhost:3001`
2. Проверьте health check: `curl http://localhost:3001/health`
3. Frontend должен быть доступен на `http://localhost:5173`
4. Откройте `/search` для тестирования поиска

## Структура проекта

```
unichance/
├── backend/              # Backend API
│   ├── src/
│   │   ├── routes/      # API endpoints
│   │   ├── database/    # DB connection
│   │   ├── ml/          # ML модель
│   │   └── utils/       # Утилиты (шифрование)
│   └── package.json
├── database/            # Миграции БД
│   └── migrations/
├── etl/                 # ETL скрипты
│   ├── import_qs_rankings.ts
│   └── import_university_data.ts
├── src/                 # Frontend
│   ├── pages/
│   │   └── Search.tsx   # Страница поиска
│   └── ...
└── README_SEARCH_MODULE.md
```

## Решение проблем

### Ошибка подключения к БД
- Проверьте, что PostgreSQL запущен
- Убедитесь, что данные в `.env` корректны
- Проверьте права доступа пользователя БД

### Ошибки импорта
- Убедитесь, что миграции выполнены
- Проверьте логи в консоли

### CORS ошибки
- Убедитесь, что backend запущен на порту 3001
- Проверьте настройки CORS в `backend/src/index.ts`

## Дополнительная информация

См. `README_SEARCH_MODULE.md` для подробной документации модуля.