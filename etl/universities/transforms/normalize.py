"""Normalisation utilities for universities ETL."""

from __future__ import annotations

import re
import uuid
from typing import Dict, List, Optional, Tuple


UUID_NAMESPACE = uuid.UUID("11111111-2222-3333-4444-555555555555")


def stable_university_id(name: str, country_code: str) -> str:
    """Generate stable UUID5 from university name + country code."""
    key = f"{country_code.strip().upper()}::{name.strip().lower()}"
    return str(uuid.uuid5(UUID_NAMESPACE, key))


def clean_text(value: Optional[str]) -> Optional[str]:
    """Return stripped text or None."""
    if value is None:
        return None
    value = str(value).strip()
    return value if value else None


def normalize_name(name: str) -> str:
    """Normalize university name."""
    name = clean_text(name) or ""
    name = re.sub(r"\s+", " ", name)
    return name.strip()


def merge_rows(rows: List[Dict[str, Optional[str]]]) -> List[Dict[str, Optional[str]]]:
    """Merge and deduplicate rows from multiple sources."""
    merged: Dict[Tuple[str, str], Dict[str, Optional[str]]] = {}

    for row in rows:
        name = normalize_name(row.get("name", ""))
        country_code = clean_text(row.get("country_code")) or ""
        if not name or not country_code:
            continue

        key = (country_code.upper(), name.lower())

        if key not in merged:
            merged[key] = {
                "id": stable_university_id(name, country_code),
                "name": name,
                "country_code": country_code.upper(),
                "city": clean_text(row.get("city")),
                "website": clean_text(row.get("website")),
                "qs_rank": row.get("qs_rank"),
                "the_rank": row.get("the_rank"),
            }
        else:
            # Scorecard is preferred for US city/website
            if row.get("source") == "college_scorecard":
                merged[key]["city"] = clean_text(row.get("city")) or merged[key]["city"]
                merged[key]["website"] = clean_text(row.get("website")) or merged[key]["website"]

    return list(merged.values())


__all__ = ["merge_rows", "stable_university_id"]