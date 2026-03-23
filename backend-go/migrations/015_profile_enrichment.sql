-- 015_profile_enrichment.sql
-- Safe, additive enrichment columns for richer university/program profiles.

-- Universities: identity and profile depth
ALTER TABLE universities ADD COLUMN IF NOT EXISTS slug TEXT;
ALTER TABLE universities ADD COLUMN IF NOT EXISTS country_name TEXT;
ALTER TABLE universities ADD COLUMN IF NOT EXISTS region_or_state TEXT;
ALTER TABLE universities ADD COLUMN IF NOT EXISTS official_website TEXT;
ALTER TABLE universities ADD COLUMN IF NOT EXISTS short_description TEXT;
ALTER TABLE universities ADD COLUMN IF NOT EXISTS full_description TEXT;
ALTER TABLE universities ADD COLUMN IF NOT EXISTS founded_year INT;
ALTER TABLE universities ADD COLUMN IF NOT EXISTS university_type TEXT;
ALTER TABLE universities ADD COLUMN IF NOT EXISTS campus_type TEXT;
ALTER TABLE universities ADD COLUMN IF NOT EXISTS main_language TEXT;
ALTER TABLE universities ADD COLUMN IF NOT EXISTS study_languages TEXT[];
ALTER TABLE universities ADD COLUMN IF NOT EXISTS total_students INT;
ALTER TABLE universities ADD COLUMN IF NOT EXISTS international_students INT;
ALTER TABLE universities ADD COLUMN IF NOT EXISTS international_students_percent NUMERIC(5,2);
ALTER TABLE universities ADD COLUMN IF NOT EXISTS female_percent NUMERIC(5,2);
ALTER TABLE universities ADD COLUMN IF NOT EXISTS popular_fields TEXT[];
ALTER TABLE universities ADD COLUMN IF NOT EXISTS research_strengths TEXT[];
ALTER TABLE universities ADD COLUMN IF NOT EXISTS tuition_min NUMERIC(12,2);
ALTER TABLE universities ADD COLUMN IF NOT EXISTS tuition_max NUMERIC(12,2);
ALTER TABLE universities ADD COLUMN IF NOT EXISTS tuition_currency TEXT;
ALTER TABLE universities ADD COLUMN IF NOT EXISTS semester_fee NUMERIC(12,2);
ALTER TABLE universities ADD COLUMN IF NOT EXISTS living_cost_estimate NUMERIC(12,2);
ALTER TABLE universities ADD COLUMN IF NOT EXISTS financial_support_available BOOLEAN;
ALTER TABLE universities ADD COLUMN IF NOT EXISTS scholarship_info TEXT;
ALTER TABLE universities ADD COLUMN IF NOT EXISTS bachelor_available BOOLEAN;
ALTER TABLE universities ADD COLUMN IF NOT EXISTS master_available BOOLEAN;
ALTER TABLE universities ADD COLUMN IF NOT EXISTS phd_available BOOLEAN;
ALTER TABLE universities ADD COLUMN IF NOT EXISTS admission_requirements_summary TEXT;
ALTER TABLE universities ADD COLUMN IF NOT EXISTS min_language_requirements TEXT;
ALTER TABLE universities ADD COLUMN IF NOT EXISTS application_period TEXT;
ALTER TABLE universities ADD COLUMN IF NOT EXISTS acceptance_rate_estimate NUMERIC(5,2);
ALTER TABLE universities ADD COLUMN IF NOT EXISTS campus_summary TEXT;
ALTER TABLE universities ADD COLUMN IF NOT EXISTS career_outcomes_summary TEXT;
ALTER TABLE universities ADD COLUMN IF NOT EXISTS notable_alumni_or_industry_links TEXT;
ALTER TABLE universities ADD COLUMN IF NOT EXISTS data_source TEXT;
ALTER TABLE universities ADD COLUMN IF NOT EXISTS data_source_url TEXT;
ALTER TABLE universities ADD COLUMN IF NOT EXISTS last_verified_at TIMESTAMPTZ;

ALTER TABLE universities
  DROP CONSTRAINT IF EXISTS chk_universities_founded_year;
ALTER TABLE universities
  ADD CONSTRAINT chk_universities_founded_year
  CHECK (founded_year IS NULL OR (founded_year >= 1000 AND founded_year <= EXTRACT(YEAR FROM NOW())::INT));

ALTER TABLE universities
  DROP CONSTRAINT IF EXISTS chk_universities_international_students_percent;
ALTER TABLE universities
  ADD CONSTRAINT chk_universities_international_students_percent
  CHECK (international_students_percent IS NULL OR (international_students_percent >= 0 AND international_students_percent <= 100));

ALTER TABLE universities
  DROP CONSTRAINT IF EXISTS chk_universities_female_percent;
ALTER TABLE universities
  ADD CONSTRAINT chk_universities_female_percent
  CHECK (female_percent IS NULL OR (female_percent >= 0 AND female_percent <= 100));

ALTER TABLE universities
  DROP CONSTRAINT IF EXISTS chk_universities_acceptance_rate_estimate;
ALTER TABLE universities
  ADD CONSTRAINT chk_universities_acceptance_rate_estimate
  CHECK (acceptance_rate_estimate IS NULL OR (acceptance_rate_estimate >= 0 AND acceptance_rate_estimate <= 100));

CREATE INDEX IF NOT EXISTS idx_universities_slug ON universities(slug);
CREATE INDEX IF NOT EXISTS idx_universities_region_or_state ON universities(region_or_state);
CREATE INDEX IF NOT EXISTS idx_universities_country_name ON universities(country_name);
CREATE INDEX IF NOT EXISTS idx_universities_university_type ON universities(university_type);

-- Programs: richer metadata for product and future AI scoring
ALTER TABLE programs ADD COLUMN IF NOT EXISTS slug TEXT;
ALTER TABLE programs ADD COLUMN IF NOT EXISTS subfield TEXT;
ALTER TABLE programs ADD COLUMN IF NOT EXISTS study_language TEXT;
ALTER TABLE programs ADD COLUMN IF NOT EXISTS duration_months INT;
ALTER TABLE programs ADD COLUMN IF NOT EXISTS mode_of_study TEXT;
ALTER TABLE programs ADD COLUMN IF NOT EXISTS attendance_type TEXT;
ALTER TABLE programs ADD COLUMN IF NOT EXISTS scholarship_available BOOLEAN;
ALTER TABLE programs ADD COLUMN IF NOT EXISTS program_description TEXT;
ALTER TABLE programs ADD COLUMN IF NOT EXISTS career_paths TEXT;
ALTER TABLE programs ADD COLUMN IF NOT EXISTS admission_notes TEXT;
ALTER TABLE programs ADD COLUMN IF NOT EXISTS official_program_url TEXT;
ALTER TABLE programs ADD COLUMN IF NOT EXISTS data_source_url TEXT;

ALTER TABLE programs
  DROP CONSTRAINT IF EXISTS chk_programs_duration_months;
ALTER TABLE programs
  ADD CONSTRAINT chk_programs_duration_months
  CHECK (duration_months IS NULL OR (duration_months >= 1 AND duration_months <= 120));

CREATE INDEX IF NOT EXISTS idx_programs_slug ON programs(slug);
CREATE INDEX IF NOT EXISTS idx_programs_subfield ON programs(subfield);
CREATE INDEX IF NOT EXISTS idx_programs_study_language ON programs(study_language);
