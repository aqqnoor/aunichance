"""Entry point for universities ETL."""

from __future__ import annotations

from typing import List

from universities.config import ETL_COUNTRIES, OUT_FILE, COLLEGE_SCORECARD_API_KEY
from universities.sources.hipolabs import fetch_hipolabs
from universities.sources.scorecard import fetch_scorecard_all
from universities.transforms.normalize import merge_rows
from universities.writers.csv_writer import write_universities_csv


def main() -> None:
    """Run ETL pipeline."""
    all_rows: List[dict] = []

    # Hipolabs
    for country in ETL_COUNTRIES:
        print(f"[hipolabs] loading {country}")
        rows = fetch_hipolabs(country)
        print(f"  -> {len(rows)} rows")
        all_rows.extend(rows)

    # College Scorecard for US
    if "US" in ETL_COUNTRIES and COLLEGE_SCORECARD_API_KEY:
        print("[scorecard] loading US")
        scorecard_rows = fetch_scorecard_all()
        print(f"  -> {len(scorecard_rows)} rows")
        all_rows.extend(scorecard_rows)
    elif "US" in ETL_COUNTRIES:
        print("[scorecard] skipped: API key not provided")

    universities = merge_rows(all_rows)
    universities.sort(key=lambda x: (x["country_code"], x["name"]))

    write_universities_csv(universities, OUT_FILE)

    print(f"\nDone. universities.csv written to {OUT_FILE}")
    print(f"Total unique universities: {len(universities)}")


if __name__ == "__main__":
    main()