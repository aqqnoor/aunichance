-- Standardize degree_level as ENUM
CREATE TYPE degree_level_enum AS ENUM ('Bachelor', 'Master', 'PhD', 'Certificate');

-- Add languages table for normalization
CREATE TABLE IF NOT EXISTS languages (
    id SERIAL PRIMARY KEY,
    code CHAR(2) UNIQUE NOT NULL, -- ISO 639-1 code (en, de, fr, etc.)
    name VARCHAR(100) NOT NULL,
    native_name VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert common languages
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

-- Add language_id to programs (keep language as text for backward compatibility during migration)
ALTER TABLE programs
    ADD COLUMN IF NOT EXISTS language_id INTEGER REFERENCES languages(id);

-- Update language_id based on existing language text
UPDATE programs p
SET language_id = l.id
FROM languages l
WHERE LOWER(p.language) = LOWER(l.code)
   OR LOWER(p.language) = LOWER(l.name);

-- Create index for language searches
CREATE INDEX IF NOT EXISTS idx_programs_language_id ON programs(language_id);

-- Add composite indexes for common search patterns
CREATE INDEX IF NOT EXISTS idx_programs_degree_field 
    ON programs(degree_level, field_of_study) 
    WHERE degree_level IS NOT NULL AND field_of_study IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_deadlines_program_date 
    ON deadlines(program_id, deadline_date) 
    WHERE deadline_date IS NOT NULL;

-- Add trigger for languages.updated_at
DO $$ BEGIN
  CREATE TRIGGER trg_languages_updated_at
  BEFORE UPDATE ON languages
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Note: We keep programs.language as text for now to avoid breaking existing data
-- In future migration, we can make language_id NOT NULL and remove language column