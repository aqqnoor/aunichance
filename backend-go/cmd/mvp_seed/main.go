package main

import (
	"context"
	"encoding/csv"
	"errors"
	"fmt"
	"io"
	"log"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/joho/godotenv"
)

type UniversityRow struct {
	ID          uuid.UUID
	Name        string
	CountryCode string
	City        string
	Website     string
	QSRank      *int
	THERank     *int
}

type ProgramTemplate struct {
	Key              string
	Title            string
	DegreeLevel      string
	Field            string
	Language         string
	ScholarshipType  string
	ScholarshipMin   *int
	ScholarshipMax   *int
	TuitionMult      float64
	DescriptionIntro string
}

var (
	uniNamespace  = uuid.MustParse("8f9ad74c-b715-42ce-9f98-744820f8db6d")
	progNamespace = uuid.MustParse("a6f9db95-020c-4744-a66f-7d87f1ab483c")
)

func main() {
	_ = godotenv.Load(".env")
	_ = godotenv.Load("backend-go/.env")

	dbURL := strings.TrimSpace(os.Getenv("DATABASE_URL"))
	if dbURL == "" {
		log.Fatal("DATABASE_URL is required")
	}

	csvPath := strings.TrimSpace(os.Getenv("MVP_UNIVERSITIES_CSV"))
	if csvPath == "" {
		csvPath = "etl/out/universities.csv"
	}

	resolvedCSV, err := resolvePath(csvPath)
	if err != nil {
		log.Fatalf("cannot find universities csv: %v", err)
	}

	ctx := context.Background()
	pool, err := pgxpool.New(ctx, dbURL)
	if err != nil {
		log.Fatalf("db connect failed: %v", err)
	}
	defer pool.Close()

	universities, err := readUniversitiesCSV(resolvedCSV)
	if err != nil {
		log.Fatalf("cannot read csv: %v", err)
	}

	if len(universities) == 0 {
		log.Fatal("no universities loaded from csv")
	}

	now := time.Now().UTC()
	sourceID, sourceEnabled := ensureSource(ctx, pool, now)

	upUni, err := upsertUniversities(ctx, pool, universities, now)
	if err != nil {
		log.Fatalf("upsert universities failed: %v", err)
	}

	upProg, err := upsertPrograms(ctx, pool, universities, now)
	if err != nil {
		log.Fatalf("upsert programs failed: %v", err)
	}

	upLinks := 0
	if sourceEnabled {
		upLinks, _ = upsertUniversityLinks(ctx, pool, universities, sourceID, now)
		_ = insertFetchLog(ctx, pool, sourceID, now, len(universities), upUni, upProg, upLinks)
	}

	log.Printf("MVP seed completed: universities=%d programs=%d links=%d source=%v csv=%s", upUni, upProg, upLinks, sourceEnabled, resolvedCSV)
}

func resolvePath(path string) (string, error) {
	candidates := []string{path}
	if !filepath.IsAbs(path) {
		candidates = append(candidates,
			filepath.Join("backend-go", path),
			filepath.Join("..", path),
			filepath.Join("..", "..", path),
		)
	}
	for _, c := range candidates {
		if _, err := os.Stat(c); err == nil {
			abs, err := filepath.Abs(c)
			if err == nil {
				return abs, nil
			}
			return c, nil
		}
	}
	return "", fmt.Errorf("file not found: %s", path)
}

func readUniversitiesCSV(path string) ([]UniversityRow, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer f.Close()

	r := csv.NewReader(f)
	r.FieldsPerRecord = -1

	header, err := r.Read()
	if err != nil {
		return nil, err
	}
	if len(header) < 7 {
		return nil, fmt.Errorf("unexpected header columns: %v", header)
	}

	rows := make([]UniversityRow, 0, 1024)
	for {
		rec, err := r.Read()
		if errors.Is(err, io.EOF) {
			break
		}
		if err != nil {
			return nil, err
		}
		if len(rec) < 7 {
			continue
		}

		name := strings.TrimSpace(rec[1])
		country := strings.ToUpper(strings.TrimSpace(rec[2]))
		if name == "" || len(country) != 2 {
			continue
		}

		uniID := parseOrBuildUUID(strings.TrimSpace(rec[0]), uniNamespace, name+"|"+country)
		rows = append(rows, UniversityRow{
			ID:          uniID,
			Name:        name,
			CountryCode: country,
			City:        strings.TrimSpace(rec[3]),
			Website:     strings.TrimSpace(rec[4]),
			QSRank:      parseIntPtr(rec[5]),
			THERank:     parseIntPtr(rec[6]),
		})
	}
	return rows, nil
}

func parseOrBuildUUID(raw string, ns uuid.UUID, fallbackKey string) uuid.UUID {
	if raw != "" {
		if parsed, err := uuid.Parse(raw); err == nil {
			return parsed
		}
	}
	return uuid.NewSHA1(ns, []byte(strings.ToLower(fallbackKey)))
}

func parseIntPtr(s string) *int {
	s = strings.TrimSpace(s)
	if s == "" {
		return nil
	}
	v, err := strconv.Atoi(s)
	if err != nil {
		return nil
	}
	return &v
}

func ensureSource(ctx context.Context, pool *pgxpool.Pool, now time.Time) (string, bool) {
	var sourceID string
	err := pool.QueryRow(ctx, `
		INSERT INTO sources (
			code, name, kind, base_url, docs_url, license, reliability, is_active, last_fetched_at
		) VALUES (
			'mvp_seed',
			'MVP Seed Generator',
			'dataset',
			'https://github.com/',
			'https://github.com/',
			'Internal',
			3,
			TRUE,
			$1
		)
		ON CONFLICT (code) DO UPDATE SET
			name = EXCLUDED.name,
			kind = EXCLUDED.kind,
			base_url = EXCLUDED.base_url,
			docs_url = EXCLUDED.docs_url,
			license = EXCLUDED.license,
			reliability = EXCLUDED.reliability,
			is_active = EXCLUDED.is_active,
			last_fetched_at = EXCLUDED.last_fetched_at,
			updated_at = NOW()
		RETURNING id
	`, now).Scan(&sourceID)
	if err != nil {
		log.Printf("sources table is not available, continue without sources/fetch_log: %v", err)
		return "", false
	}
	return sourceID, true
}

func upsertUniversities(ctx context.Context, pool *pgxpool.Pool, universities []UniversityRow, now time.Time) (int, error) {
	count := 0
	for _, u := range universities {
		_, err := pool.Exec(ctx, `
			INSERT INTO universities (
				id, name, country_code, city, website, qs_rank, the_rank, data_updated_at
			) VALUES (
				$1, $2, $3, NULLIF($4,''), NULLIF($5,''), $6, $7, $8
			)
			ON CONFLICT (id) DO UPDATE SET
				name = EXCLUDED.name,
				country_code = EXCLUDED.country_code,
				city = EXCLUDED.city,
				website = EXCLUDED.website,
				qs_rank = EXCLUDED.qs_rank,
				the_rank = EXCLUDED.the_rank,
				data_updated_at = EXCLUDED.data_updated_at
		`, u.ID.String(), u.Name, u.CountryCode, u.City, u.Website, u.QSRank, u.THERank, now)
		if err != nil {
			return count, fmt.Errorf("university upsert failed (%s): %w", u.Name, err)
		}
		count++
	}
	return count, nil
}

func upsertPrograms(ctx context.Context, pool *pgxpool.Pool, universities []UniversityRow, now time.Time) (int, error) {
	templates := []ProgramTemplate{
		{
			Key:              "cs-bachelor",
			Title:            "Computer Science",
			DegreeLevel:      "bachelor",
			Field:            "Computer Science",
			Language:         "English",
			ScholarshipType:  "merit",
			ScholarshipMin:   intPtr(10),
			ScholarshipMax:   intPtr(40),
			TuitionMult:      1.00,
			DescriptionIntro: "Foundational program with software engineering, algorithms, and systems coursework.",
		},
		{
			Key:              "data-master",
			Title:            "Data Science",
			DegreeLevel:      "master",
			Field:            "Data Science",
			Language:         "English",
			ScholarshipType:  "need-based",
			ScholarshipMin:   intPtr(15),
			ScholarshipMax:   intPtr(50),
			TuitionMult:      1.35,
			DescriptionIntro: "Applied analytics track covering machine learning, statistics, and production data systems.",
		},
	}

	count := 0
	for _, u := range universities {
		baseTuition, currency := tuitionByCountry(u.CountryCode)
		hasScholarship := scholarshipByCountry(u.CountryCode)

		for _, tpl := range templates {
			progID := uuid.NewSHA1(progNamespace, []byte(strings.ToLower(u.ID.String()+"|"+tpl.Key)))
			tuition := round2(baseTuition * tpl.TuitionMult)
			description := fmt.Sprintf("%s Students study at %s with international admissions support and career-focused electives.", tpl.DescriptionIntro, u.Name)

			_, err := pool.Exec(ctx, `
				INSERT INTO programs (
					id, university_id, title, degree_level, field, language,
					tuition_amount, tuition_currency, has_scholarship,
					scholarship_type, scholarship_percent_min, scholarship_percent_max,
					description, data_source, data_updated_at
				) VALUES (
					$1, $2, $3, $4::degree_level, $5, $6,
					$7, $8::tuition_currency, $9,
					$10, $11, $12,
					$13, 'mvp_seed', $14
				)
				ON CONFLICT (id) DO UPDATE SET
					title = EXCLUDED.title,
					degree_level = EXCLUDED.degree_level,
					field = EXCLUDED.field,
					language = EXCLUDED.language,
					tuition_amount = EXCLUDED.tuition_amount,
					tuition_currency = EXCLUDED.tuition_currency,
					has_scholarship = EXCLUDED.has_scholarship,
					scholarship_type = EXCLUDED.scholarship_type,
					scholarship_percent_min = EXCLUDED.scholarship_percent_min,
					scholarship_percent_max = EXCLUDED.scholarship_percent_max,
					description = EXCLUDED.description,
					data_source = EXCLUDED.data_source,
					data_updated_at = EXCLUDED.data_updated_at
			`, progID.String(), u.ID.String(), tpl.Title, tpl.DegreeLevel, tpl.Field, tpl.Language, tuition, currency, hasScholarship, tpl.ScholarshipType, tpl.ScholarshipMin, tpl.ScholarshipMax, description, now)
			if err != nil {
				return count, fmt.Errorf("program upsert failed (uni=%s tpl=%s): %w", u.Name, tpl.Key, err)
			}
			count++
		}
	}

	return count, nil
}

func upsertUniversityLinks(ctx context.Context, pool *pgxpool.Pool, universities []UniversityRow, sourceID string, now time.Time) (int, error) {
	count := 0
	for _, u := range universities {
		if strings.TrimSpace(u.Website) == "" {
			continue
		}

		_, err := pool.Exec(ctx, `
			INSERT INTO university_links (
				university_id, source_id, link_type, url, title, is_official, priority, last_verified_at
			) VALUES (
				$1, $2, 'website', $3, 'Official website', TRUE, 10, $4
			)
			ON CONFLICT (university_id, link_type, url) DO UPDATE SET
				source_id = EXCLUDED.source_id,
				title = EXCLUDED.title,
				is_official = EXCLUDED.is_official,
				priority = EXCLUDED.priority,
				last_verified_at = EXCLUDED.last_verified_at,
				updated_at = NOW()
		`, u.ID.String(), sourceID, strings.TrimSpace(u.Website), now)
		if err != nil {
			return count, err
		}
		count++
	}
	return count, nil
}

func insertFetchLog(ctx context.Context, pool *pgxpool.Pool, sourceID string, now time.Time, fetchedCount, insertedUniversities, insertedPrograms, insertedLinks int) error {
	_, err := pool.Exec(ctx, `
		INSERT INTO fetch_log (
			source_id, job_name, started_at, finished_at, status,
			fetched_count, inserted_count, updated_count, skipped_count, request_meta
		) VALUES (
			$1, 'mvp_seed', $2, NOW(), 'success',
			$3, $4, $5, 0,
			jsonb_build_object(
				'universities_upserted', $4,
				'programs_upserted', $5,
				'links_upserted', $6,
				'run_at', $7
			)
		)
	`, sourceID, now, fetchedCount, insertedUniversities, insertedPrograms, insertedLinks, now.Format(time.RFC3339))
	if err != nil {
		log.Printf("fetch_log insert failed: %v", err)
	}
	return nil
}

func tuitionByCountry(countryCode string) (float64, string) {
	countryCode = strings.ToUpper(strings.TrimSpace(countryCode))
	switch countryCode {
	case "DE", "FR", "IT", "ES", "NL", "AT", "BE", "SE", "NO", "FI", "DK", "IE", "CH", "PT", "PL", "CZ", "HU", "RO", "GR":
		return 12000, "EUR"
	case "KZ":
		return 4200000, "KZT"
	default:
		return 26000, "USD"
	}
}

func scholarshipByCountry(countryCode string) bool {
	countryCode = strings.ToUpper(strings.TrimSpace(countryCode))
	switch countryCode {
	case "US", "CA", "GB", "AU", "DE", "NL", "SE", "CH", "KZ":
		return true
	default:
		return false
	}
}

func round2(v float64) float64 {
	return float64(int(v*100+0.5)) / 100
}

func intPtr(v int) *int {
	return &v
}
