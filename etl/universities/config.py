"""Configuration values for the universities ETL.

This module loads environment variables defined in ``.env`` (or
``.env.example``) and exposes constants used throughout the ETL. When
running locally you should copy ``.env.example`` to ``.env`` and
provide values for the API key and database connection string.
"""

from __future__ import annotations

import os
from dotenv import load_dotenv


# Load variables from a .env file if present. This call silently
# ignores missing files so running without a .env is still valid.
load_dotenv()


# API key for the U.S. College Scorecard API.
COLLEGE_SCORECARD_API_KEY: str = os.getenv("COLLEGE_SCORECARD_API_KEY", "").strip()

# List of ISO country codes to fetch.
_countries = os.getenv("ETL_COUNTRIES", "US,DE,GB,FR,NL").split(",")
ETL_COUNTRIES: list[str] = [c.strip().upper() for c in _countries if c.strip()]

# Output file
OUT_DIR: str = "out"
OUT_FILE: str = os.path.join(OUT_DIR, "universities.csv")


__all__ = [
    "COLLEGE_SCORECARD_API_KEY",
    "ETL_COUNTRIES",
    "OUT_DIR",
    "OUT_FILE",
]