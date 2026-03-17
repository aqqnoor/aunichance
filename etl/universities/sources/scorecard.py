"""Adapter for the U.S. College Scorecard API."""

from __future__ import annotations

import requests
from typing import Dict, List, Optional

from universities.config import COLLEGE_SCORECARD_API_KEY


BASE_URL: str = "https://api.data.gov/ed/collegescorecard/v1/schools"

FIELDS: str = ",".join([
    "id",
    "school.name",
    "school.city",
    "school.school_url",
])


def _fetch_page(page: int = 0, per_page: int = 100) -> Dict[str, object]:
    """Fetch a single page from College Scorecard."""
    if not COLLEGE_SCORECARD_API_KEY:
        raise RuntimeError(
            "COLLEGE_SCORECARD_API_KEY is missing; set it in the .env to enable Scorecard ETL"
        )

    resp = requests.get(
        BASE_URL,
        params={
            "api_key": COLLEGE_SCORECARD_API_KEY,
            "fields": FIELDS,
            "page": page,
            "per_page": per_page,
        },
        timeout=30,
    )
    resp.raise_for_status()
    return resp.json()


def fetch_scorecard_all() -> List[Dict[str, Optional[str]]]:
    """Fetch all universities from the College Scorecard API."""
    rows: List[Dict[str, Optional[str]]] = []
    page = 0

    while True:
        try:
            data = _fetch_page(page=page, per_page=100)
        except Exception:
            break

        results = data.get("results", [])
        if not results:
            break

        for item in results:
            name = item.get("school.name") or ""
            rows.append({
                "source": "college_scorecard",
                "name": name.strip(),
                "country_code": "US",
                "city": item.get("school.city"),
                "website": item.get("school.school_url"),
                "qs_rank": None,
                "the_rank": None,
            })

        page += 1

    return rows


__all__ = ["fetch_scorecard_all"]