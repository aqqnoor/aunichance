-- 013_languages.sql
-- Normalize program languages for search/filtering (MVP).

-- 1) Languages reference table (id/code/name).
CREATE TABLE IF NOT EXISTS languages (
  id SERIAL PRIMARY KEY,
  code CHAR(2) UNIQUE NOT NULL,        -- ISO 639-1 (en, de, fr, etc.)
  name VARCHAR(100) NOT NULL,
  native_name VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2) Seed common languages (idempotent).
INSERT INTO languages (code, name, native_name) VALUES
  ('en', 'English', 'English'),
  ('de', 'German', 'Deutsch'),
  ('fr', 'French', 'Français'),
  ('es', 'Spanish', 'Español'),
  ('it', 'Italian', 'Italiano'),
  ('pt', 'Portuguese', 'Português'),
  ('ru', 'Russian', 'Русский'),
  ('zh', 'Chinese', '中文'),
  ('ja', 'Japanese', '日本語'),
  ('ko', 'Korean', '한국어')
ON CONFLICT (code) DO NOTHING;

-- 3) Add normalized language_code column to programs (MVP variant).
ALTER TABLE programs
  ADD COLUMN IF NOT EXISTS language_code CHAR(2);

-- 4) Best-effort backfill of language_code from existing text column.
UPDATE programs
SET language_code = CASE
  WHEN LOWER(language) IN ('english', 'en') THEN 'en'
  WHEN LOWER(language) IN ('german', 'de', 'deutsch') THEN 'de'
  WHEN LOWER(language) IN ('french', 'fr', 'français', 'francais') THEN 'fr'
  WHEN LOWER(language) IN ('spanish', 'es', 'español', 'espanol') THEN 'es'
  WHEN LOWER(language) IN ('italian', 'it', 'italiano') THEN 'it'
  WHEN LOWER(language) IN ('portuguese', 'pt', 'português', 'portugues') THEN 'pt'
  WHEN LOWER(language) IN ('russian', 'ru', 'русский') THEN 'ru'
  WHEN LOWER(language) IN ('chinese', 'zh', '中文') THEN 'zh'
  WHEN LOWER(language) IN ('japanese', 'ja', '日本語') THEN 'ja'
  WHEN LOWER(language) IN ('korean', 'ko', '한국어') THEN 'ko'
  ELSE language_code
END
WHERE language IS NOT NULL AND language_code IS NULL;

-- 5) Optional foreign-key link from programs.language_code to languages.code (if desired later).
-- For MVP we keep it nullable and without FK to avoid breaking imports.

-- 6) Basic index for language-based filtering.
CREATE INDEX IF NOT EXISTS idx_programs_language_code
  ON programs(language_code);

