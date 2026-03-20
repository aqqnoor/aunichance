-- Updated_at triggers and search vectors for current schema

-- Generic updated_at trigger function
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Safe updated_at triggers only for existing tables
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN
    SELECT unnest(ARRAY[
      'universities',
      'programs',
      'users'
    ])
  LOOP
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

-- Universities search_vector
ALTER TABLE universities
ADD COLUMN IF NOT EXISTS search_vector tsvector;

UPDATE universities
SET search_vector =
  to_tsvector(
    'simple',
    coalesce(name, '') || ' ' ||
    coalesce(country_code, '') || ' ' ||
    coalesce(city, '') || ' ' ||
    coalesce(website, '')
  );

CREATE INDEX IF NOT EXISTS idx_universities_search_vector
ON universities USING gin(search_vector);

CREATE OR REPLACE FUNCTION update_universities_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector :=
    to_tsvector(
      'simple',
      coalesce(NEW.name, '') || ' ' ||
      coalesce(NEW.country_code, '') || ' ' ||
      coalesce(NEW.city, '') || ' ' ||
      coalesce(NEW.website, '')
    );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  CREATE TRIGGER trg_universities_search_vector
  BEFORE INSERT OR UPDATE ON universities
  FOR EACH ROW EXECUTE FUNCTION update_universities_search_vector();
EXCEPTION WHEN duplicate_object THEN NULL;
END
$$;

-- Programs search_vector
ALTER TABLE programs
ADD COLUMN IF NOT EXISTS search_vector tsvector;

UPDATE programs
SET search_vector =
  to_tsvector(
    'simple',
    coalesce(title, '') || ' ' ||
    coalesce(field, '') || ' ' ||
    coalesce(language, '') || ' ' ||
    coalesce(description, '')
  );

CREATE INDEX IF NOT EXISTS idx_programs_search_vector
ON programs USING gin(search_vector);

CREATE OR REPLACE FUNCTION update_programs_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector :=
    to_tsvector(
      'simple',
      coalesce(NEW.title, '') || ' ' ||
      coalesce(NEW.field, '') || ' ' ||
      coalesce(NEW.language, '') || ' ' ||
      coalesce(NEW.description, '')
    );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  CREATE TRIGGER trg_programs_search_vector
  BEFORE INSERT OR UPDATE ON programs
  FOR EACH ROW EXECUTE FUNCTION update_programs_search_vector();
EXCEPTION WHEN duplicate_object THEN NULL;
END
$$;