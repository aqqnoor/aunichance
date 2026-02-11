#!/bin/bash
# Apply database migrations to PostgreSQL

echo "Applying migrations to PostgreSQL..."

# Wait for DB to be ready
echo "Waiting for database..."
sleep 5

# Get all migration files in order
MIGRATIONS=(
  "001_init.sql"
  "002_profile_and_scores.sql" 
  "003_shortlists.sql"
  "004_sources_links_fetchlog.sql"
  "010_drop_shortlists.sql"
)

# Execute each migration
for migration in "${MIGRATIONS[@]}"; do
  echo "Applying $migration..."
  docker exec unichance_db psql -U unichance -d unichance -f "/migrations/$migration" 2>&1 | grep -v "NOTICE\|already exists"
  if [ $? -eq 0 ]; then
    echo "✓ $migration applied"
  fi
done

echo "✓ All migrations completed!"
