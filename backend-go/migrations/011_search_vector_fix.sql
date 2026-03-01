-- 011_search_vector_fix.sql
-- Ensure search_vector columns, data and GIN indexes for universities/programs
-- using 'simple' text search configuration. This migration does not remove
-- legacy English FTS indexes but makes search_vector the primary search surface.

-- 1) Universities: search_vector + GIN index + backfill

ALTER TABLE universities
  ADD COLUMN IF NOT EXISTS search_vector tsvector;

UPDATE universities
SET search_vector = to_tsvector(
  'simple',
  coalesce(name, '') || ' ' ||
  coalesce(country_code, '') || ' ' ||
  coalesce(city, '')
);

CREATE INDEX IF NOT EXISTS idx_universities_search_vector
  ON universities USING GIN (search_vector);

-- 2) Programs: search_vector + GIN index + backfill

ALTER TABLE programs
  ADD COLUMN IF NOT EXISTS search_vector tsvector;

UPDATE programs p
SET search_vector = to_tsvector(
  'simple',
  coalesce(p.title, '') || ' ' ||
  coalesce(p.field, '') || ' ' ||
  coalesce(p.language, '') || ' ' ||
  coalesce(u.name, '') || ' ' ||
  coalesce(u.country_code, '') || ' ' ||
  coalesce(u.city, '')
)
FROM universities u
WHERE u.id = p.university_id;

CREATE INDEX IF NOT EXISTS idx_programs_search_vector
  ON programs USING GIN (search_vector);

-- 3) Triggers to keep search_vector in sync (universities)

CREATE OR REPLACE FUNCTION update_universities_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector := to_tsvector(
    'simple',
    coalesce(NEW.name, '') || ' ' ||
    coalesce(NEW.country_code, '') || ' ' ||
    coalesce(NEW.city, '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_universities_search_vector'
  ) THEN
    CREATE TRIGGER trg_universities_search_vector
    BEFORE INSERT OR UPDATE ON universities
    FOR EACH ROW EXECUTE FUNCTION update_universities_search_vector();
  END IF;
END
$$;

-- 4) Triggers to keep search_vector in sync (programs)

CREATE OR REPLACE FUNCTION update_programs_search_vector()
RETURNS TRIGGER AS $$
DECLARE
  uni_name TEXT;
  uni_country TEXT;
  uni_city TEXT;
BEGIN
  SELECT name, country_code, city
  INTO uni_name, uni_country, uni_city
  FROM universities
  WHERE id = NEW.university_id;

  NEW.search_vector := to_tsvector(
    'simple',
    coalesce(NEW.title, '') || ' ' ||
    coalesce(NEW.field, '') || ' ' ||
    coalesce(NEW.language, '') || ' ' ||
    coalesce(uni_name, '') || ' ' ||
    coalesce(uni_country, '') || ' ' ||
    coalesce(uni_city, '')
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_programs_search_vector'
  ) THEN
    CREATE TRIGGER trg_programs_search_vector
    BEFORE INSERT OR UPDATE OF title, field, language, university_id ON programs
    FOR EACH ROW EXECUTE FUNCTION update_programs_search_vector();
  END IF;
END
$$;

