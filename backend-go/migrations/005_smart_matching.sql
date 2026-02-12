-- Smart Matching Enhancement Migration
-- Adds fields for intelligent program-student matching

-- 1. Add competitive_factor to programs
ALTER TABLE programs
ADD COLUMN IF NOT EXISTS competitive_factor DECIMAL(3,1) DEFAULT 1.0;

-- 2. Add eligible_citizenship_codes to scholarships (for country-specific scholarships)
ALTER TABLE scholarships
ADD COLUMN IF NOT EXISTS eligible_citizenship_codes VARCHAR(255) DEFAULT NULL;

-- 3. Ensure admission_stats is populated (for acceptance_rate calculation)
CREATE INDEX IF NOT EXISTS idx_admission_stats_program_year 
ON admission_stats(program_id, year DESC);

-- 4. Set competitive_factor based on acceptance_rate
-- High competition (< 10% acceptance rate): 1.4
-- Medium competition (10-20%): 1.2
-- Low competition (20-40%): 1.0
-- Very low competition (> 40%): 0.8
UPDATE programs p
SET competitive_factor = CASE
  WHEN (SELECT COALESCE(acceptance_rate::numeric, 50) 
        FROM admission_stats 
        WHERE program_id = p.id 
        ORDER BY year DESC LIMIT 1) < 10 THEN 1.4
  WHEN (SELECT COALESCE(acceptance_rate::numeric, 50) 
        FROM admission_stats 
        WHERE program_id = p.id 
        ORDER BY year DESC LIMIT 1) < 20 THEN 1.2
  WHEN (SELECT COALESCE(acceptance_rate::numeric, 50) 
        FROM admission_stats 
        WHERE program_id = p.id 
        ORDER BY year DESC LIMIT 1) < 40 THEN 1.0
  ELSE 0.8
END
WHERE competitive_factor = 1.0;

-- 5. Add index for smart search queries
CREATE INDEX IF NOT EXISTS idx_programs_university_fields 
ON programs(university_id, field, degree_level, language);

CREATE INDEX IF NOT EXISTS idx_scholarships_program_citizenship 
ON scholarships(program_id, eligible_citizenship_codes);

-- 6. Create table for tracking matching history (optional, for analytics)
CREATE TABLE IF NOT EXISTS match_history (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  program_id INTEGER REFERENCES programs(id) ON DELETE CASCADE,
  match_score INTEGER,
  category VARCHAR(20),
  breakdown JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_match_history_user ON match_history(user_id);
CREATE INDEX IF NOT EXISTS idx_match_history_program ON match_history(program_id);
CREATE INDEX IF NOT EXISTS idx_match_history_date ON match_history(created_at DESC);

-- 7. Add profile enrichment fields (for better matching)
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS citizenship_code VARCHAR(2) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS graduation_year INTEGER DEFAULT NULL,
ADD COLUMN IF NOT EXISTS achievements_count INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_profiles_citizenship ON profiles(citizenship_code);
