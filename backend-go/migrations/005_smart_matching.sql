-- Smart matching MVP migration aligned with current schema

-- 1. Add optional matching-related fields to programs
ALTER TABLE programs
ADD COLUMN IF NOT EXISTS min_gpa NUMERIC(3,2),
ADD COLUMN IF NOT EXISTS min_ielts NUMERIC(3,1),
ADD COLUMN IF NOT EXISTS acceptance_rate NUMERIC(5,2),
ADD COLUMN IF NOT EXISTS recommendation_text TEXT;

-- 2. Add optional matching-related fields to profiles
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS target_degree_level degree_level,
ADD COLUMN IF NOT EXISTS preferred_country_code VARCHAR(2),
ADD COLUMN IF NOT EXISTS intended_field TEXT;

-- 3. Optional saved matching results table
CREATE TABLE IF NOT EXISTS smart_match_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  program_id UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  score INT NOT NULL,
  category VARCHAR(20) NOT NULL,
  reasons TEXT[],
  recommendations TEXT[],
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_smart_match_results_user_id
ON smart_match_results(user_id);

CREATE INDEX IF NOT EXISTS idx_smart_match_results_program_id
ON smart_match_results(program_id);

CREATE INDEX IF NOT EXISTS idx_smart_match_results_score
ON smart_match_results(score);