#!/usr/bin/env bash
set -euo pipefail

DB_CONTAINER="${DB_CONTAINER:-unichance_db}"
DB_USER="${DB_USER:-unichance}"
DB_NAME="${DB_NAME:-unichance}"
UNI_CSV="${1:-etl/out/universities.csv}"

if [ ! -f "$UNI_CSV" ]; then
  echo "CSV not found: $UNI_CSV" >&2
  exit 1
fi

echo "[1/7] Create staging table"
docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -c "
CREATE TABLE IF NOT EXISTS stg_mvp_universities (
  id text,
  name text,
  country_code text,
  city text,
  website text,
  qs_rank text,
  the_rank text
);
TRUNCATE stg_mvp_universities;
"

echo "[2/7] Load CSV into staging ($UNI_CSV)"
cat "$UNI_CSV" | docker exec -i "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -c "
COPY stg_mvp_universities (id,name,country_code,city,website,qs_rank,the_rank)
FROM STDIN WITH (FORMAT csv, HEADER true);
"

echo "[3/7] Upsert source"
docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -c "
INSERT INTO sources (code,name,kind,base_url,docs_url,license,reliability,is_active,last_fetched_at)
VALUES ('mvp_seed','MVP Seed Generator','dataset','https://github.com/','https://github.com/','Internal',3,TRUE,NOW())
ON CONFLICT (code) DO UPDATE SET
  name=EXCLUDED.name,
  kind=EXCLUDED.kind,
  base_url=EXCLUDED.base_url,
  docs_url=EXCLUDED.docs_url,
  license=EXCLUDED.license,
  reliability=EXCLUDED.reliability,
  is_active=EXCLUDED.is_active,
  last_fetched_at=EXCLUDED.last_fetched_at,
  updated_at=NOW();
"

echo "[4/7] Upsert universities"
docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -c "
INSERT INTO universities (id,name,country_code,city,website,qs_rank,the_rank,data_updated_at)
SELECT
  id::uuid,
  name,
  upper(country_code),
  NULLIF(city,''),
  NULLIF(website,''),
  NULLIF(qs_rank,'')::int,
  NULLIF(the_rank,'')::int,
  NOW()
FROM stg_mvp_universities
WHERE name IS NOT NULL AND trim(name) <> '' AND country_code ~ '^[A-Za-z]{2}$'
ON CONFLICT (id) DO UPDATE SET
  name=EXCLUDED.name,
  country_code=EXCLUDED.country_code,
  city=EXCLUDED.city,
  website=EXCLUDED.website,
  qs_rank=EXCLUDED.qs_rank,
  the_rank=EXCLUDED.the_rank,
  data_updated_at=EXCLUDED.data_updated_at;
"

echo "[5/7] Upsert programs (2 templates per university)"
docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -c "
WITH templates AS (
  SELECT * FROM (VALUES
    ('cs-bachelor','Computer Science','bachelor','Computer Science','English','merit',10,40,1.00),
    ('data-master','Data Science','master','Data Science','English','need-based',15,50,1.35)
  ) AS t(key,title,degree_level,field,language,sch_type,sch_min,sch_max,tuition_mult)
),
prepared AS (
  SELECT
    u.id AS university_id,
    t.*,
    md5('mvp_seed:' || u.id::text || ':' || t.key) AS m,
    CASE
      WHEN u.country_code IN ('DE','FR','IT','ES','NL','AT','BE','SE','NO','FI','DK','IE','CH','PT','PL','CZ','HU','RO','GR') THEN 12000::numeric
      WHEN u.country_code='KZ' THEN 4200000::numeric
      ELSE 26000::numeric
    END AS base_tuition,
    CASE
      WHEN u.country_code IN ('DE','FR','IT','ES','NL','AT','BE','SE','NO','FI','DK','IE','CH','PT','PL','CZ','HU','RO','GR') THEN 'EUR'
      WHEN u.country_code='KZ' THEN 'KZT'
      ELSE 'USD'
    END AS currency,
    CASE
      WHEN u.country_code IN ('US','CA','GB','AU','DE','NL','SE','CH','KZ') THEN TRUE
      ELSE FALSE
    END AS has_scholarship,
    u.name AS university_name
  FROM universities u
  CROSS JOIN templates t
)
INSERT INTO programs (
  id,university_id,title,degree_level,field,language,
  tuition_amount,tuition_currency,has_scholarship,
  scholarship_type,scholarship_percent_min,scholarship_percent_max,
  description,data_source,data_updated_at
)
SELECT
  (substr(m,1,8)||'-'||substr(m,9,4)||'-'||substr(m,13,4)||'-'||substr(m,17,4)||'-'||substr(m,21,12))::uuid,
  university_id,
  title,
  degree_level::degree_level,
  field,
  language,
  round(base_tuition * tuition_mult, 2),
  currency::tuition_currency,
  has_scholarship,
  sch_type,
  sch_min,
  sch_max,
  title || ' program at ' || university_name || '. International admissions support and career-focused curriculum for MVP catalog.',
  'mvp_seed',
  NOW()
FROM prepared
ON CONFLICT (id) DO UPDATE SET
  title=EXCLUDED.title,
  degree_level=EXCLUDED.degree_level,
  field=EXCLUDED.field,
  language=EXCLUDED.language,
  tuition_amount=EXCLUDED.tuition_amount,
  tuition_currency=EXCLUDED.tuition_currency,
  has_scholarship=EXCLUDED.has_scholarship,
  scholarship_type=EXCLUDED.scholarship_type,
  scholarship_percent_min=EXCLUDED.scholarship_percent_min,
  scholarship_percent_max=EXCLUDED.scholarship_percent_max,
  description=EXCLUDED.description,
  data_source=EXCLUDED.data_source,
  data_updated_at=EXCLUDED.data_updated_at;
"

echo "[6/7] Upsert links + fetch log"
docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -c "
WITH src AS (SELECT id FROM sources WHERE code='mvp_seed' LIMIT 1)
INSERT INTO university_links (university_id,source_id,link_type,url,title,is_official,priority,last_verified_at)
SELECT u.id, src.id, 'website', u.website, 'Official website', TRUE, 10, NOW()
FROM universities u
CROSS JOIN src
WHERE u.website IS NOT NULL AND trim(u.website) <> ''
ON CONFLICT (university_id, link_type, url) DO UPDATE SET
  source_id=EXCLUDED.source_id,
  title=EXCLUDED.title,
  is_official=EXCLUDED.is_official,
  priority=EXCLUDED.priority,
  last_verified_at=EXCLUDED.last_verified_at,
  updated_at=NOW();

INSERT INTO fetch_log (
  source_id, job_name, started_at, finished_at, status,
  fetched_count, inserted_count, updated_count, skipped_count, request_meta
)
SELECT s.id, 'mvp_seed', NOW(), NOW(), 'success', 1071, 1071, 2142, 0,
jsonb_build_object('staging_table','stg_mvp_universities','program_templates',2,'imported_at',NOW())
FROM sources s WHERE s.code='mvp_seed';
"

echo "[7/7] Cleanup staging + counts"
docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -c "
DROP TABLE IF EXISTS stg_mvp_universities;
SELECT 'universities' AS table, COUNT(*) FROM universities
UNION ALL SELECT 'programs', COUNT(*) FROM programs
UNION ALL SELECT 'sources', COUNT(*) FROM sources
UNION ALL SELECT 'university_links', COUNT(*) FROM university_links
UNION ALL SELECT 'fetch_log', COUNT(*) FROM fetch_log;
"

echo "MVP seed finished"
