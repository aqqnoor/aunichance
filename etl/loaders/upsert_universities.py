import psycopg2
from psycopg2.extras import execute_batch
from config import DATABASE_URL

SQL = """
INSERT INTO universities (id, name, country_code, city, website, qs_rank, the_rank)
VALUES (%(id)s, %(name)s, %(country_code)s, %(city)s, %(website)s, %(qs_rank)s, %(the_rank)s)
ON CONFLICT (id) DO UPDATE
SET
  name = EXCLUDED.name,
  country_code = EXCLUDED.country_code,
  city = EXCLUDED.city,
  website = EXCLUDED.website,
  qs_rank = EXCLUDED.qs_rank,
  the_rank = EXCLUDED.the_rank
"""

def upsert_universities(rows: list[dict]) -> None:
    with psycopg2.connect(DATABASE_URL) as conn:
        with conn.cursor() as cur:
            execute_batch(cur, SQL, rows, page_size=200)
        conn.commit()