import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "")
COLLEGE_SCORECARD_API_KEY = os.getenv("COLLEGE_SCORECARD_API_KEY", "")
ETL_COUNTRIES = [c.strip().upper() for c in os.getenv("ETL_COUNTRIES", "US,DE,GB,FR").split(",")]