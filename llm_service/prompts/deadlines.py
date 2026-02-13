# prompts/deadlines.py
DEADLINES_PROMPT = """
Извлеки из текста ВСЕ даты, связанные с поступлением.

Текст:
{text}

Найди:
1. Дедлайн подачи заявок (Regular deadline)
2. Early decision / Early action (если есть)
3. Дедлайны стипендий (если есть)
4. Даты экзаменов (если упоминаются)

Ответ верни в JSON:
[
  {{
    "deadline_type": "regular/early/scholarship/exam",
    "date": "YYYY-MM-DD",
    "description": "оригинальный текст из источника",
    "is_recurring": true/false
  }}
]

Только JSON, без пояснений.
"""
