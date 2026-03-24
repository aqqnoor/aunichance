-- profiles
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  gpa NUMERIC,
  gpa_scale NUMERIC DEFAULT 4.0, -- 4.0/5.0 т.б.

  ielts NUMERIC,
  toefl INT,
  sat INT,

  budget_year NUMERIC,
  budget_currency tuition_currency, -- USD/EUR/KZT

  awards TEXT, -- қысқа тізім
  achievements_summary TEXT, -- қысқаша үзінді

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'profiles_user_unique'
    ) THEN
        ALTER TABLE profiles
        ADD CONSTRAINT profiles_user_unique UNIQUE (user_id);
    END IF;
END
$$;
-- scores history
CREATE TABLE IF NOT EXISTS scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  program_id UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,

  score INT NOT NULL CHECK (score >= 0 AND score <= 100),
  reasons JSONB NOT NULL DEFAULT '[]'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scores_profile ON scores(profile_id);
CREATE INDEX IF NOT EXISTS idx_scores_program ON scores(program_id);

-- updated_at trigger for profiles
DROP TRIGGER IF EXISTS trg_profiles_updated_at ON profiles;
CREATE TRIGGER trg_profiles_updated_at
BEFORE UPDATE ON profiles
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

