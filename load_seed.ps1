#!/usr/bin/env pwsh
# Load seed data into PostgreSQL

Write-Host "Loading seed data..." -ForegroundColor Cyan

$seedPath = "c:\Users\User\unichance\backend-go\seed"

# 1. Load universities
Write-Host "Loading universities..." -ForegroundColor Yellow
$uni_csv = Get-Content "$seedPath\universities.csv" -Raw
$uni_csv | docker exec -i unichance_db psql -U unichance -d unichance -c @"
COPY universities (id, name, country_code, city, website, qs_rank, the_rank, data_updated_at, created_at, updated_at) 
FROM STDIN WITH (FORMAT csv, HEADER);
"@ 2>&1 | Select-String -Pattern "COPY|ERROR" -ErrorAction SilentlyContinue
Write-Host "Universities loaded" -ForegroundColor Green

# 2. Load programs
Write-Host "Loading programs..." -ForegroundColor Yellow
$prog_csv = Get-Content "$seedPath\programs.csv" -Raw
$prog_csv | docker exec -i unichance_db psql -U unichance -d unichance -c @"
COPY programs (id, university_id, title, degree_level, field, language, tuition_amount, tuition_currency, has_scholarship, scholarship_type, scholarship_percent_min, scholarship_percent_max, description, data_source, data_updated_at, search_vector, created_at, updated_at) 
FROM STDIN WITH (FORMAT csv, HEADER);
"@ 2>&1 | Select-String -Pattern "COPY|ERROR" -ErrorAction SilentlyContinue
Write-Host "Programs loaded" -ForegroundColor Green

Write-Host "Seed data loaded successfully!" -ForegroundColor Green
