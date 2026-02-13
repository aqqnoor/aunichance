package llm
package llm

const ParseProgramPrompt = `Ты — парсер образовательных программ.
Извлеки из HTML-кода страницы информацию о программе обучения.

URL: %s
Название программы (примерно): %s

HTML:
%s

Верни ТОЛЬКО JSON в таком формате:
{
    "title": "полное название программы",
    "degree_level": "bachelor/master/phd",
    "field": "направление (Computer Science, Business, etc)",
    "language": "EN/DE/FR",
    "tuition_amount": число (только цифры, без долларов и запятых),
    "tuition_currency": "USD/EUR",
    "has_scholarship": true/false,
    "scholarship_type": "merit/need/other" или null,
    "scholarship_percent_min": число или null,
    "scholarship_percent_max": число или null,
    "deadline": "YYYY-MM-DD" или null,
    "requirements": {
        "gpa": число или null,
        "ielts": число или null,
        "toefl": число или null,
        "gre": true/false,
        "portfolio": true/false,
        "experience_years": число или null
    },
    "description": "краткое описание (1-2 предложения)"
}

Если данных нет — ставь null или пустую строку.
Только JSON, без пояснений.`