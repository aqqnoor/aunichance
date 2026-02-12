-- Additional indexes for advanced search
/*CREATE INDEX IF NOT EXISTS idx_programs_tuition ON programs(tuition_fee) WHERE tuition_fee IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_scholarships_type ON scholarships(type);
CREATE INDEX IF NOT EXISTS idx_scholarships_deadline ON scholarships(application_deadline) WHERE application_deadline IS NOT NULL;

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_programs_search ON programs(university_id, degree_level, field_of_study, language);
CREATE INDEX IF NOT EXISTS idx_universities_location ON universities(country_id, city, region);

-- Добавление колонок search_vector
ALTER TABLE programs ADD COLUMN IF NOT EXISTS search_vector tsvector;
ALTER TABLE universities ADD COLUMN IF NOT EXISTS search_vector tsvector;*/

-- Заполнение (пример)
UPDATE programs
SET search_vector =
    setweight(to_tsvector('simple', coalesce(name,'')), 'A') ||
    setweight(to_tsvector('simple', coalesce(field_of_study,'')), 'B') ||
    setweight(to_tsvector('simple', coalesce(description,'')), 'C');

UPDATE universities
SET search_vector =
    setweight(to_tsvector('simple', coalesce(name,'')), 'A') ||
    setweight(to_tsvector('simple', coalesce(country,'')), 'B') ||
    setweight(to_tsvector('simple', coalesce(city,'')), 'C');

-- GIN индексы
CREATE INDEX IF NOT EXISTS idx_programs_search_vector
  ON programs USING GIN (search_vector);
CREATE INDEX IF NOT EXISTS idx_universities_search_vector
  ON universities USING GIN (search_vector);
