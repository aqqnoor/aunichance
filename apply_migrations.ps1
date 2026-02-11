#!/usr/bin/env pwsh
# Apply database migrations to PostgreSQL

Write-Host "Applying migrations to PostgreSQL..." -ForegroundColor Cyan

# Wait for DB to be ready
Write-Host "Waiting for database..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

# Get all migration files in order
$migrations = @(
  "001_init.sql",
  "002_profile_and_scores.sql",
  "003_shortlists.sql",
  "004_sources_links_fetchlog.sql",
  "010_drop_shortlists.sql"
)

$migrationsPath = "c:\Users\User\unichance\backend-go\migrations"

# Execute each migration
foreach ($migration in $migrations) {
  $filePath = Join-Path $migrationsPath $migration
  
  if (-not (Test-Path $filePath)) {
    Write-Host "Migration not found: $migration" -ForegroundColor Red
    continue
  }
  
  Write-Host "Applying $migration..." -ForegroundColor Yellow
  
  # Read the SQL file
  $sql = Get-Content $filePath -Raw
  
  # Execute via docker exec
  $result = $sql | docker exec -i unichance_db psql -U unichance -d unichance 2>&1
  
  # Show output
  if ($result -match "ERROR|error") {
    Write-Host "Error in $migration" -ForegroundColor Red
    Write-Host $result -ForegroundColor Red
  } else {
    Write-Host "OK: $migration applied" -ForegroundColor Green
  }
}

Write-Host "All migrations completed!" -ForegroundColor Green
Write-Host "Testing database..." -ForegroundColor Cyan

# Test query
$testResult = docker exec unichance_db psql -U unichance -d unichance -c "SELECT COUNT(*) as table_count FROM information_schema.tables WHERE table_schema = 'public';" 2>&1
Write-Host $testResult -ForegroundColor Green
