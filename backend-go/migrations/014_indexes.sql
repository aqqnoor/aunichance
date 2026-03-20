-- Safe indexes only for existing tables

-- Universities
CREATE INDEX IF NOT EXISTS idx_universities_country_code
ON universities(country_code);

CREATE INDEX IF NOT EXISTS idx_universities_city
ON universities(city);

-- Programs
CREATE INDEX IF NOT EXISTS idx_programs_university_id
ON programs(university_id);

CREATE INDEX IF NOT EXISTS idx_programs_degree_level
ON programs(degree_level);

CREATE INDEX IF NOT EXISTS idx_programs_language
ON programs(language);

-- Profiles
CREATE INDEX IF NOT EXISTS idx_profiles_user_id
ON profiles(user_id);

-- Smart match
CREATE INDEX IF NOT EXISTS idx_smart_match_results_user
ON smart_match_results(user_id);

CREATE INDEX IF NOT EXISTS idx_smart_match_results_score
ON smart_match_results(score);