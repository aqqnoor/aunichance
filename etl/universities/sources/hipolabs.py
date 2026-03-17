"""Adapter for the Hipolabs universities API."""

from __future__ import annotations

import requests
from typing import Dict, List, Optional

BASE_URL: str = "http://universities.hipolabs.com/search"

COUNTRY_MAP: Dict[str, str] = {
    "US": "United States",
    "DE": "Germany",
    "GB": "United Kingdom",
    "FR": "France",
    "NL": "Netherlands",
    "CA": "Canada",
    "AU": "Australia",
}


def fetch_hipolabs(country_code: str) -> List[Dict[str, Optional[str]]]:
    """Fetch universities from Hipolabs for a given country."""
    country_name = COUNTRY_MAP.get(country_code.upper())
    if not country_name:
        return []

    try:
        resp = requests.get(BASE_URL, params={"country": country_name}, timeout=30)
        resp.raise_for_status()
    except Exception:
        return []

    rows: List[Dict[str, Optional[str]]] = []
    try:
        data = resp.json()
    except Exception:
        return []

    for item in data:
        name = item.get("name") or ""
        website_list = item.get("web_pages") or []
        website = website_list[0] if website_list else None
        rows.append({
            "source": "hipolabs",
            "name": name.strip(),
            "country_code": country_code.upper(),
            "city": None,
            "website": website,
            "qs_rank": None,
            "the_rank": None,
        })

    return rows


__all__ = ["fetch_hipolabs"]