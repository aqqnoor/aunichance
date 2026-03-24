CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- users
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- universities
CREATE TABLE IF NOT EXISTS universities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  country_code TEXT NOT NULL,
  city TEXT,
  website TEXT,
  qs_rank INT,
  the_rank INT,
  data_updated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- programs
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_type
        WHERE typname = 'degree_level'
    ) THEN
        CREATE TYPE degree_level AS ENUM ('bachelor', 'master', 'phd');
    END IF;
END
$$;
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_type
        WHERE typname = 'tuition_currency'
    ) THEN
        CREATE TYPE tuition_currency AS ENUM ('USD', 'EUR', 'GBP', 'KZT');
    END IF;
END
$$;
CREATE TABLE IF NOT EXISTS programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id UUID NOT NULL REFERENCES universities(id) ON DELETE CASCADE,

  title TEXT NOT NULL,
  degree_level degree_level NOT NULL,
  field TEXT NOT NULL,
  language TEXT NOT NULL,

  tuition_amount NUMERIC,
  tuition_currency tuition_currency,
  has_scholarship BOOLEAN NOT NULL DEFAULT false,
  scholarship_type TEXT,
  scholarship_percent_min INT,
  scholarship_percent_max INT,

  description TEXT,
  data_source TEXT,
  data_updated_at TIMESTAMPTZ,

  search_vector TSVECTOR NOT NULL DEFAULT ''::tsvector,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- requirements (optional for Sprint 1, used later)
CREATE TABLE IF NOT EXISTS requirements (
  program_id UUID PRIMARY KEY REFERENCES programs(id) ON DELETE CASCADE,
  min_gpa NUMERIC,
  min_ielts NUMERIC,
  min_toefl INT,
  min_sat INT,
  notes TEXT
);

-- indexes
CREATE INDEX IF NOT EXISTS idx_universities_country ON universities(country_code);
CREATE INDEX IF NOT EXISTS idx_programs_level ON programs(degree_level);
CREATE INDEX IF NOT EXISTS idx_programs_currency ON programs(tuition_currency);
CREATE INDEX IF NOT EXISTS idx_programs_scholarship ON programs(has_scholarship);

CREATE INDEX IF NOT EXISTS idx_programs_search_vector ON programs USING GIN(search_vector);

-- triggers: updated_at
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_universities_updated_at ON universities;
CREATE TRIGGER trg_universities_updated_at
BEFORE UPDATE ON universities
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_programs_updated_at ON programs;
CREATE TRIGGER trg_programs_updated_at
BEFORE UPDATE ON programs
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- search_vector updater (simple config)
CREATE OR REPLACE FUNCTION update_programs_search_vector() RETURNS TRIGGER AS $$
DECLARE
  uni_name TEXT;
  uni_country TEXT;
  uni_city TEXT;
BEGIN
  SELECT name, country_code, city INTO uni_name, uni_country, uni_city
  FROM universities WHERE id = NEW.university_id;

  NEW.search_vector :=
    to_tsvector('simple',
      coalesce(NEW.title,'') || ' ' ||
      coalesce(NEW.field,'') || ' ' ||
      coalesce(NEW.language,'') || ' ' ||
      coalesce(uni_name,'') || ' ' ||
      coalesce(uni_country,'') || ' ' ||
      coalesce(uni_city,'')
    );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_programs_search_vector ON programs;
CREATE TRIGGER trg_programs_search_vector
BEFORE INSERT OR UPDATE OF title, field, language, university_id ON programs
FOR EACH ROW EXECUTE FUNCTION update_programs_search_vector();
