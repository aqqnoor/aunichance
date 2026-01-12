-- Additional indexes for advanced search
CREATE INDEX IF NOT EXISTS idx_programs_tuition ON programs(tuition_fee) WHERE tuition_fee IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_scholarships_type ON scholarships(type);
CREATE INDEX IF NOT EXISTS idx_scholarships_deadline ON scholarships(application_deadline) WHERE application_deadline IS NOT NULL;

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_programs_search ON programs(university_id, degree_level, field_of_study, language);
CREATE INDEX IF NOT EXISTS idx_universities_location ON universities(country_id, city, region);