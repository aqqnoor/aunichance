# prompts/requirements.py
REQUIREMENTS_PROMPT = """
Извлеки требования для поступления из текста.

Текст:
{text}

Найди и структурируй:
- GPA (минимальный и recommended)
- IELTS/TOEFL (минимальный балл, иногда секции)
- SAT/ACT (если требуется)
- GRE/GMAT (для магистратуры)
- Опыт работы (годы)
- Портфолио (да/нет, что входит)
- Дополнительные требования (рекомендации, мотивационное письмо, CV)
- Стоимость обучения
- Стипендии (название, сумма, дедлайн)

Ответ верни в JSON:
{{
  "gpa": {{"min": 3.0, "recommended": 3.5, "scale": 4.0}},
  "ielts": {{"min": 6.5, "recommended": 7.0, "writing": 6.5}},
  "toefl": {{"min": 80, "recommended": 100}},
  "sat": {{"min": 1200, "recommended": 1400}},
  "gre": {{"verbal": 150, "quant": 160, "writing": 3.5}},
  "experience_years": 2,
  "portfolio": true,
  "requirements_list": ["recommendation_letters", "motivation_letter", "cv"],
  "tuition": 50000,
  "scholarships": [
    {{"name": "Dean's Scholarship", "amount": 20000, "deadline": "2026-01-15"}}
  ]
}}

Если данных нет — пропусти поле.
Только JSON.
"""
fastapi==0.115.0
uvicorn==0.30.0
openai==1.35.0
asyncpg==0.29.0
python-dotenv==1.0.0
pydantic==2.8.0
PyPDF2==3.0.0
httpx==0.27.0