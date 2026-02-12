-- Updated_at triggers and search vectors for better FTS (simple config)

-- Generic updated_at trigger function
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Helper to create trigger safely
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'countries',
    'universities',
    'programs',
    'requirements',
    'scholarships',
    'deadlines',
    'admission_stats',
    'users',
    'applications',
    'reviews'
  ]) LOOP
    EXECUTE format($f$
      DO $d$
      BEGIN
        CREATE TRIGGER trg_%I_updated_at
        BEFORE UPDATE ON %I
        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
      EXCEPTION WHEN duplicate_object THEN NULL;
      END
      $d$;
    $f$, tbl, tbl);
  END LOOP;
END
$$;

-- Enforce country on universities
ALTER TABLE universities
  ALTER COLUMN country_id SET NOT NULL;

-- Search vectors with 'simple' config for Cyrillic-friendly search
ALTER TABLE universities
  ADD COLUMN IF NOT EXISTS search_vector tsvector;

UPDATE universities
SET search_vector = to_tsvector('simple', coalesce(name,'') || ' ' || coalesce(city,'') || ' ' || coalesce(description,''));

CREATE INDEX IF NOT EXISTS idx_universities_search_vector
  ON universities USING gin(search_vector);

ALTER TABLE programs
  ADD COLUMN IF NOT EXISTS search_vector tsvector;

UPDATE programs
SET search_vector = to_tsvector('simple', coalesce(name,'') || ' ' || coalesce(field_of_study,'') || ' ' || coalesce(description,''));

CREATE INDEX IF NOT EXISTS idx_programs_search_vector
  ON programs USING gin(search_vector);

-- Triggers to keep search_vector in sync
CREATE OR REPLACE FUNCTION update_universities_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector := to_tsvector('simple', coalesce(NEW.name,'') || ' ' || coalesce(NEW.city,'') || ' ' || coalesce(NEW.description,''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  CREATE TRIGGER trg_universities_search_vector
  BEFORE INSERT OR UPDATE ON universities
  FOR EACH ROW EXECUTE FUNCTION update_universities_search_vector();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE OR REPLACE FUNCTION update_programs_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector := to_tsvector('simple', coalesce(NEW.name,'') || ' ' || coalesce(NEW.field_of_study,'') || ' ' || coalesce(NEW.description,''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  CREATE TRIGGER trg_programs_search_vector
  BEFORE INSERT OR UPDATE ON programs
  FOR EACH ROW EXECUTE FUNCTION update_programs_search_vector();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
