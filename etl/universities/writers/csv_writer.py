"""CSV writer for university data."""

from __future__ import annotations

import csv
import os
from typing import Dict, Iterable, Optional


HEADER = ["id", "name", "country_code", "city", "website", "qs_rank", "the_rank"]


def write_universities_csv(rows: Iterable[Dict[str, Optional[str]]], path: str) -> None:
    """Write normalized universities into CSV."""
    os.makedirs(os.path.dirname(path), exist_ok=True)

    with open(path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=HEADER)
        writer.writeheader()

        for row in rows:
            writer.writerow({
                "id": row["id"],
                "name": row["name"],
                "country_code": row["country_code"],
                "city": row.get("city") or "",
                "website": row.get("website") or "",
                "qs_rank": row.get("qs_rank") if row.get("qs_rank") is not None else "",
                "the_rank": row.get("the_rank") if row.get("the_rank") is not None else "",
            })