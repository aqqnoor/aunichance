#!/usr/bin/env bash
set -euo pipefail

DB_CONTAINER="${DB_CONTAINER:-unichance_db}"
DB_USER="${DB_USER:-unichance}"
DB_NAME="${DB_NAME:-unichance}"

echo "[1/2] Applying additive migration 015_profile_enrichment.sql"
cat backend-go/migrations/015_profile_enrichment.sql | docker exec -i "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1

echo "[2/2] Running enrichment script enrich_profiles.sql"
cat scripts/enrich_profiles.sql | docker exec -i "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1

echo "Enrichment completed"
