-- 014_indexes.sql
-- Add pragmatic indexes for real search queries (MVP).

-- 1) Composite index for common program filters:
--    (degree_level, field) — adjusted for current Go schema.
CREATE INDEX IF NOT EXISTS idx_programs_degree_field_v2
  ON programs(degree_level, field);

-- 2) Composite index for deadlines by program and date.
CREATE INDEX IF NOT EXISTS idx_deadlines_program_date_v2
  ON deadlines(program_id, deadline_date);

