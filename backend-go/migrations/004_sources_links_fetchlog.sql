-- 004_sources_links_fetchlog.sql
-- Purpose:
-- 1) sources: дерек қайдан келгенін сақтау (API/dataset/site)
-- 2) university_links: университеттің ресми/негізгі линктері (website, admissions, scholarships)
-- 3) fetch_log: ingestion job-тардың run тарихы, статус, қате, қанша жазба жаңарды

BEGIN;

-- 0) Extensions (UUID generation, optional but recommended)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1) sources
-- Бір source = бір API/dataset/site (мысалы: "College Scorecard", "ETER", "OpenAlex")
CREATE TABLE IF NOT EXISTS sources (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code            TEXT NOT NULL UNIQUE,       -- short id: "scorecard", "eter", "openalex"
  name            TEXT NOT NULL,              -- display name
  kind            TEXT NOT NULL,              -- "api" | "dataset" | "scrape"
  base_url        TEXT,                       -- base endpoint or landing page
  docs_url        TEXT,                       -- documentation link
  license         TEXT,                       -- e.g. "Public domain", "CC BY", etc.
  reliability     SMALLINT NOT NULL DEFAULT 3 CHECK (reliability BETWEEN 1 AND 5),
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,

  -- ingestion scheduling metadata (optional)
  refresh_interval_hours INT CHECK (refresh_interval_hours IS NULL OR refresh_interval_hours > 0),
  last_fetched_at TIMESTAMPTZ,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sources_kind ON sources(kind);
CREATE INDEX IF NOT EXISTS idx_sources_active ON sources(is_active);

-- updated_at trigger (if сенде 001_init.sql ішінде жалпы update trigger бар болса, бұны қоспауға болады)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'set_updated_at'
  ) THEN
    CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $fn$
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    $fn$ LANGUAGE plpgsql;
  END IF;
END $$;

DROP TRIGGER IF EXISTS trg_sources_updated_at ON sources;
CREATE TRIGGER trg_sources_updated_at
BEFORE UPDATE ON sources
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 2) university_links
-- Университеттің “дұрыс” линктері: official, admissions, scholarships, etc.
-- Бір университетке әртүрлі source-тан линк келуі мүмкін, сондықтан source_id + priority қосамыз.
CREATE TABLE IF NOT EXISTS university_links (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id   UUID NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
  source_id       UUID REFERENCES sources(id) ON DELETE SET NULL,

  -- link type: "website" | "admissions" | "scholarships" | "financial_aid" | "apply" | "contact"
  link_type       TEXT NOT NULL,
  url             TEXT NOT NULL,

  -- metadata
  title           TEXT,                       -- optional label
  is_official     BOOLEAN NOT NULL DEFAULT TRUE,
  priority        SMALLINT NOT NULL DEFAULT 10 CHECK (priority BETWEEN 1 AND 100),

  last_verified_at TIMESTAMPTZ,               -- қашан тексерілді/last fetch
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Бір университетте бір типке бірдей URL қайталанбауы үшін
  CONSTRAINT uq_university_links UNIQUE (university_id, link_type, url)
);

CREATE INDEX IF NOT EXISTS idx_university_links_university ON university_links(university_id);
CREATE INDEX IF NOT EXISTS idx_university_links_type ON university_links(link_type);
CREATE INDEX IF NOT EXISTS idx_university_links_source ON university_links(source_id);

DROP TRIGGER IF EXISTS trg_university_links_updated_at ON university_links;
CREATE TRIGGER trg_university_links_updated_at
BEFORE UPDATE ON university_links
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 3) fetch_log
-- ETL job-тардың әр run-ы: status, қанша кірді/жаңарды, error summary.
CREATE TABLE IF NOT EXISTS fetch_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id       UUID NOT NULL REFERENCES sources(id) ON DELETE CASCADE,

  job_name        TEXT NOT NULL,              -- e.g. "scorecard_import", "eter_import"
  started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at     TIMESTAMPTZ,

  status          TEXT NOT NULL DEFAULT 'running', -- "running" | "success" | "failed"
  http_status     INT,                        -- егер API болса
  error_message   TEXT,                       -- қысқа error
  error_details   TEXT,                       -- ұзын trace/response
  fetched_count   INT NOT NULL DEFAULT 0,
  inserted_count  INT NOT NULL DEFAULT 0,
  updated_count   INT NOT NULL DEFAULT 0,
  skipped_count   INT NOT NULL DEFAULT 0,

  -- optional: request/params snapshot
  request_meta    JSONB,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fetch_log_source ON fetch_log(source_id);
CREATE INDEX IF NOT EXISTS idx_fetch_log_job ON fetch_log(job_name);
CREATE INDEX IF NOT EXISTS idx_fetch_log_status ON fetch_log(status);
CREATE INDEX IF NOT EXISTS idx_fetch_log_started ON fetch_log(started_at);

-- Simple status check constraint
ALTER TABLE fetch_log
  DROP CONSTRAINT IF EXISTS chk_fetch_log_status;
ALTER TABLE fetch_log
  ADD CONSTRAINT chk_fetch_log_status CHECK (status IN ('running','success','failed'));

COMMIT;
