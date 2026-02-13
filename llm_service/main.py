# main.py
import os
import json
import logging
from datetime import datetime
from typing import List, Optional, Dict, Any

import asyncpg
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from openai import OpenAI
from dotenv import load_dotenv

# Импортируем промпты
from prompts.improvement import IMPROVEMENT_PROMPT
from prompts.deadlines import DEADLINES_PROMPT
from prompts.requirements import REQUIREMENTS_PROMPT

load_dotenv()

# ============ КОНФИГУРАЦИЯ ============
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
DATABASE_URL = os.getenv("DATABASE_URL")
ENVIRONMENT = os.getenv("ENVIRONMENT", "development")

# ============ ИНИЦИАЛИЗАЦИЯ ============
app = FastAPI(title="UniChance LLM Service", version="1.0.0")
client = OpenAI(api_key=OPENAI_API_KEY)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============ ЛОГГИРОВАНИЕ ============
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ============ PYDANTIC МОДЕЛИ ============
class UserProfile(BaseModel):
    gpa: Optional[float] = None
    ielts: Optional[float] = None
    toefl: Optional[int] = None
    sat: Optional[int] = None
    gre_verbal: Optional[int] = None
    gre_quant: Optional[int] = None
    experience_years: Optional[int] = 0
    has_portfolio: bool = False
    achievements: List[str] = []

class ImprovementRequest(BaseModel):
    program_id: str
    user_profile: UserProfile

class ImprovementTip(BaseModel):
    gap_type: str
    gap_value: float
    title: str
    description: str
    timeframe: str
    resources: List[str]

class PDFParseRequest(BaseModel):
    url: str
    program_id: Optional[str] = None
    university_id: Optional[str] = None

# ============ БАЗА ДАННЫХ ============
async def get_db_pool():
    return await asyncpg.create_pool(DATABASE_URL)

@app.on_event("startup")
async def startup():
    app.state.db_pool = await get_db_pool()
    logger.info("✅ Connected to database")

@app.on_event("shutdown")
async def shutdown():
    await app.state.db_pool.close()
    logger.info("🛑 Disconnected from database")

# ============ ОСНОВНЫЕ ЭНДПОИНТЫ ============

@app.get("/health")
async def health():
    """Проверка здоровья сервиса"""
    return {
        "status": "ok",
        "service": "llm-advisor",
        "environment": ENVIRONMENT,
        "timestamp": datetime.now().isoformat()
    }

@app.post("/api/llm/improvement-tips", response_model=List[ImprovementTip])
async def get_improvement_tips(request: ImprovementRequest):
    """
    Персонализированные советы для студента на основе его профиля и требований программы
    """
    try:
        # 1. Получаем данные программы из БД
        async with app.state.db_pool.acquire() as conn:
            program = await conn.fetchrow("""
                SELECT 
                    p.*,
                    u.name as university_name,
                    u.country_code,
                    u.city,
                    u.qs_rank
                FROM programs p
                JOIN universities u ON p.university_id = u.id
                WHERE p.id = $1
            """, request.program_id)
        
        if not program:
            raise HTTPException(status_code=404, detail="Program not found")
        
        # 2. Парсим требования (JSONB поле)
        requirements = program['requirements'] or {}
        req = requirements if isinstance(requirements, dict) else {}
        
        # 3. Форматируем промпт
        prompt = IMPROVEMENT_PROMPT.format(
            program_title=program['title'],
            university_name=program['university_name'],
            country=program['country_code'],
            degree_level=program['degree_level'],
            field=program['field'],
            requirements=json.dumps(req, indent=2, ensure_ascii=False),
            gpa=request.user_profile.gpa or 'не указано',
            req_gpa=req.get('gpa', {}).get('min', 'N/A'),
            ielts=request.user_profile.ielts or 'не указано',
            req_ielts=req.get('ielts', {}).get('min', 'N/A'),
            toefl=request.user_profile.toefl or 'не указано',
            req_toefl=req.get('toefl', {}).get('min', 'N/A'),
            sat=request.user_profile.sat or 'не указано',
            req_sat=req.get('sat', {}).get('min', 'N/A'),
            gre=request.user_profile.gre_verbal or 'не указано',
            req_gre=req.get('gre', {}).get('verbal', 'N/A'),
            experience=request.user_profile.experience_years or 0,
            req_experience=req.get('experience_years', 'N/A'),
            has_portfolio=request.user_profile.has_portfolio,
            req_portfolio=req.get('portfolio', False),
            achievements=', '.join(request.user_profile.achievements) if request.user_profile.achievements else 'нет'
        )
        
        logger.info(f"🎯 Generating tips for program {program['title']}")
        
        # 4. Вызов OpenAI
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system", 
                    "content": "Ты эксперт по поступлению в топ-вузы. Даешь только практичные советы с реальными сроками и бесплатными ресурсами. Отвечаешь строго в JSON."
                },
                {"role": "user", "content": prompt}
            ],
            temperature=0.7,
            response_format={"type": "json_object"}
        )
        
        # 5. Парсим ответ
        content = response.choices[0].message.content
        tips = json.loads(content)
        
        # 6. Сохраняем в БД
        for tip in tips:
            await conn.execute("""
                INSERT INTO improvement_tips 
                (program_id, gap_type, gap_value, tip_text, resources, created_at)
                VALUES ($1, $2, $3, $4, $5, NOW())
            """,
                request.program_id,
                tip.get('gap_type', 'general'),
                tip.get('gap_value', 0),
                tip.get('description', ''),
                json.dumps(tip.get('resources', []))
            )
        
        logger.info(f"✅ Generated {len(tips)} tips for program {program['title']}")
        return tips
        
    except Exception as e:
        logger.error(f"❌ Error generating tips: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/llm/parse-pdf")
async def parse_pdf(request: PDFParseRequest):
    """
    Извлечение требований из PDF файла (по URL)
    """
    try:
        # 1. Скачиваем PDF
        import httpx
        async with httpx.AsyncClient() as client:
            response = await client.get(request.url)
            if response.status_code != 200:
                raise HTTPException(status_code=400, detail="Failed to download PDF")
            
        # 2. Извлекаем текст
        import PyPDF2
        from io import BytesIO
        
        pdf_file = BytesIO(response.content)
        pdf_reader = PyPDF2.PdfReader(pdf_file)
        
        text = ""
        for page in pdf_reader.pages[:5]:  # Первые 5 страниц
            text += page.extract_text()
        
        # 3. Определяем тип парсинга
        if "admission" in request.url.lower() or "apply" in request.url.lower():
            prompt = REQUIREMENTS_PROMPT.format(text=text[:12000])
            parse_type = "requirements"
        elif "deadline" in request.url.lower() or "calendar" in request.url.lower():
            prompt = DEADLINES_PROMPT.format(text=text[:8000])
            parse_type = "deadlines"
        else:
            prompt = REQUIREMENTS_PROMPT.format(text=text[:10000])
            parse_type = "general"
        
        # 4. Вызов OpenAI
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system", 
                    "content": "Ты специалист по извлечению структурированных данных из PDF. Отвечаешь строго в JSON."
                },
                {"role": "user", "content": prompt}
            ],
            temperature=0.3,
            response_format={"type": "json_object"}
        )
        
        # 5. Парсим и возвращаем
        data = json.loads(response.choices[0].message.content)
        
        # 6. Если есть program_id, сразу сохраняем
        if request.program_id and parse_type == "requirements":
            async with app.state.db_pool.acquire() as conn:
                await conn.execute("""
                    UPDATE programs 
                    SET requirements = $1::jsonb,
                        last_updated = NOW(),
                        source = 'llm_pdf_parser'
                    WHERE id = $2
                """, json.dumps(data), request.program_id)
                logger.info(f"💾 Saved requirements for program {request.program_id}")
        
        return {
            "type": parse_type,
            "data": data,
            "source_url": request.url
        }
        
    except Exception as e:
        logger.error(f"❌ Error parsing PDF: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/llm/tips/{program_id}")
async def get_saved_tips(program_id: str):
    """
    Получить сохраненные советы для программы
    """
    try:
        async with app.state.db_pool.acquire() as conn:
            tips = await conn.fetch("""
                SELECT * FROM improvement_tips 
                WHERE program_id = $1 
                ORDER BY created_at DESC
                LIMIT 10
            """, program_id)
            
            return [
                {
                    "id": tip['id'],
                    "gap_type": tip['gap_type'],
                    "gap_value": tip['gap_value'],
                    "tip_text": tip['tip_text'],
                    "resources": json.loads(tip['resources']) if tip['resources'] else [],
                    "created_at": tip['created_at'].isoformat()
                }
                for tip in tips
            ]
    except Exception as e:
        logger.error(f"❌ Error fetching tips: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )
