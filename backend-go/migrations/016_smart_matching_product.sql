-- 016_smart_matching_product.sql
-- Additive schema for production Smart Matching and RU-ready content fields.

ALTER TABLE universities
  ADD COLUMN IF NOT EXISTS short_description_ru TEXT,
  ADD COLUMN IF NOT EXISTS description_ru TEXT,
  ADD COLUMN IF NOT EXISTS profile_completeness_score INT,
  ADD COLUMN IF NOT EXISTS cost_tier TEXT,
  ADD COLUMN IF NOT EXISTS admission_competitiveness_tier TEXT,
  ADD COLUMN IF NOT EXISTS country_priority_group TEXT,
  ADD COLUMN IF NOT EXISTS is_featured BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE programs
  ADD COLUMN IF NOT EXISTS title_ru TEXT,
  ADD COLUMN IF NOT EXISTS program_description_ru TEXT,
  ADD COLUMN IF NOT EXISTS career_paths_ru TEXT,
  ADD COLUMN IF NOT EXISTS field_normalized TEXT,
  ADD COLUMN IF NOT EXISTS study_language_normalized TEXT,
  ADD COLUMN IF NOT EXISTS selectivity_tier TEXT;

CREATE INDEX IF NOT EXISTS idx_universities_country_city ON universities(country_code, city);
CREATE INDEX IF NOT EXISTS idx_universities_region ON universities(region_or_state);
CREATE INDEX IF NOT EXISTS idx_universities_type ON universities(university_type);
CREATE INDEX IF NOT EXISTS idx_programs_study_language_normalized ON programs(study_language_normalized);
CREATE INDEX IF NOT EXISTS idx_programs_field_normalized ON programs(field_normalized);

-- Store Smart Matching profile payload as JSONB while preserving existing profiles table.
CREATE TABLE IF NOT EXISTS smart_matching_profiles (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  profile_payload JSONB NOT NULL,
  preferred_output_language TEXT NOT NULL DEFAULT 'ru',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_smart_matching_profiles_updated_at ON smart_matching_profiles(updated_at DESC);
