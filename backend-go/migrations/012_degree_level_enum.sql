-- 012_degree_level_enum.sql
-- Standardize degree_level as ENUM without breaking existing data.

-- 1) Create unified ENUM type if it does not exist (for legacy VARCHAR schema).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'degree_level_enum') THEN
    CREATE TYPE degree_level_enum AS ENUM ('Bachelor', 'Master', 'PhD', 'Certificate');
  END IF;
END
$$;

-- 2) If programs.degree_level is still VARCHAR/TEXT, migrate it to degree_level_enum.
DO $$
DECLARE
  col_type TEXT;
BEGIN
  SELECT data_type
  INTO col_type
  FROM information_schema.columns
  WHERE table_name = 'programs' AND column_name = 'degree_level';

  IF col_type IN ('character varying', 'text') THEN
    -- Add new ENUM column for degree level
    ALTER TABLE programs
      ADD COLUMN IF NOT EXISTS degree_level_new degree_level_enum;

    -- Map string values to ENUM values; keep unknowns as NULL
    UPDATE programs
    SET degree_level_new = CASE
      WHEN LOWER(degree_level) IN ('bachelor', 'undergraduate', 'bsc', 'ba') THEN 'Bachelor'::degree_level_enum
      WHEN LOWER(degree_level) IN ('master', 'msc', 'ma') THEN 'Master'::degree_level_enum
      WHEN LOWER(degree_level) IN ('phd', 'doctorate', 'doctoral') THEN 'PhD'::degree_level_enum
      WHEN LOWER(degree_level) IN ('certificate', 'diploma') THEN 'Certificate'::degree_level_enum
      ELSE NULL
    END;

    -- Preserve old data for safety
    ALTER TABLE programs
      RENAME COLUMN degree_level TO degree_level_old;

    ALTER TABLE programs
      RENAME COLUMN degree_level_new TO degree_level;
  END IF;
END
$$;

-- 3) If we are already on ENUM type "degree_level" (Go schema), extend it with new values.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'degree_level') THEN
    -- Safe: IF NOT EXISTS protects from repeated runs.
    ALTER TYPE degree_level ADD VALUE IF NOT EXISTS 'bachelor';
    ALTER TYPE degree_level ADD VALUE IF NOT EXISTS 'master';
    ALTER TYPE degree_level ADD VALUE IF NOT EXISTS 'phd';
    ALTER TYPE degree_level ADD VALUE IF NOT EXISTS 'certificate';
  END IF;
END
$$;

