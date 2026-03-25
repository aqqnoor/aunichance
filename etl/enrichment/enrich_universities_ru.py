import csv
import os
import sys
from typing import Optional

import psycopg2


def nullable_str(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    value = value.strip()
    return value if value else None


def nullable_int(value: Optional[str]) -> Optional[int]:
    value = nullable_str(value)
    if value is None:
        return None
    return int(value)


def nullable_float(value: Optional[str]) -> Optional[float]:
    value = nullable_str(value)
    if value is None:
        return None
    return float(value)


def main():
    if len(sys.argv) < 2:
        print("Usage: python etl/enrichment/enrich_universities_ru.py <csv_path>")
        sys.exit(1)

    csv_path = sys.argv[1]
    database_url = os.getenv("DATABASE_URL")

    if not database_url:
        print("ERROR: DATABASE_URL is not set")
        sys.exit(1)

    conn = psycopg2.connect(database_url)
    conn.autocommit = False

    updated = 0
    skipped = 0

    try:
        with open(csv_path, "r", encoding="utf-8", newline="") as f:
            reader = csv.DictReader(f)

            with conn.cursor() as cur:
                for row in reader:
                    university_id = nullable_str(row.get("id"))
                    if not university_id:
                        skipped += 1
                        continue

                    cur.execute(
                        """
                        UPDATE universities
                        SET
                            official_website = COALESCE(%s, official_website),
                            short_description = COALESCE(%s, short_description),
                            full_description = COALESCE(%s, full_description),
                            founded_year = COALESCE(%s, founded_year),
                            total_students = COALESCE(%s, total_students),
                            international_students_percent = COALESCE(%s, international_students_percent),
                            tuition_min = COALESCE(%s, tuition_min),
                            tuition_max = COALESCE(%s, tuition_max),
                            tuition_currency = COALESCE(%s, tuition_currency),
                            admission_requirements_summary = COALESCE(%s, admission_requirements_summary),
                            campus_summary = COALESCE(%s, campus_summary),
                            career_outcomes_summary = COALESCE(%s, career_outcomes_summary),
                            last_verified_at = NOW()
                        WHERE id = %s
                        """,
                        (
                            nullable_str(row.get("official_website")),
                            nullable_str(row.get("short_description")),
                            nullable_str(row.get("full_description")),
                            nullable_int(row.get("founded_year")),
                            nullable_int(row.get("total_students")),
                            nullable_float(row.get("international_students_percent")),
                            nullable_float(row.get("tuition_min")),
                            nullable_float(row.get("tuition_max")),
                            nullable_str(row.get("tuition_currency")),
                            nullable_str(row.get("admission_requirements_summary")),
                            nullable_str(row.get("campus_summary")),
                            nullable_str(row.get("career_outcomes_summary")),
                            university_id,
                        ),
                    )

                    if cur.rowcount > 0:
                        updated += 1
                    else:
                        skipped += 1

        conn.commit()
        print(f"Updated: {updated}")
        print(f"Skipped: {skipped}")

    except Exception as e:
        conn.rollback()
        print(f"ERROR: {e}")
        raise
    finally:
        conn.close()


if __name__ == "__main__":
    main()