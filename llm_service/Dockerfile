FROM python:3.11-slim

WORKDIR /app

# Установка зависимостей
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Копирование кода
COPY . .

# Создание непривилегированного пользователя
RUN useradd -m -u 1000 appuser && chown -R appuser:appuser /app
USER appuser

# Запуск
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]

  llm_parser:
    build:
      context: ./llm_service
      dockerfile: Dockerfile
    container_name: unichance_llm
    ports:
      - "8000:8000"
    environment:
      DATABASE_URL: postgresql://unichance:unichance@postgres:5432/unichance?sslmode=disable
      OPENAI_API_KEY: ${OPENAI_API_KEY}
    env_file:
      - .env
    depends_on:
      - postgres
    volumes:
      - ./llm_service:/app
    networks:
      - unichance_net
    restart: unless-stopped