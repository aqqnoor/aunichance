package main

import (
	"context"
	"encoding/csv"
	"fmt"
	"log"
	"os"

	"github.com/jackc/pgx/v5/pgxpool"
)

// Minimal ETL import for universities and programs from CSV files.
// This is an MVP skeleton and intentionally keeps logic simple and explicit.

func main() {
	if len(os.Args) < 4 {
		log.Fatalf("usage: %s DATABASE_URL universities.csv programs.csv", os.Args[0])
	}

	dbURL := os.Args[1]
	universitiesPath := os.Args[2]
	programsPath := os.Args[3]

	ctx := context.Background()
	pool, err := pgxpool.New(ctx, dbURL)
	if err != nil {
		log.Fatalf("cannot connect to db: %v", err)
	}
	defer pool.Close()

	if err := importUniversities(ctx, pool, universitiesPath); err != nil {
		log.Fatalf("import universities failed: %v", err)
	}
	if err := importPrograms(ctx, pool, programsPath); err != nil {
		log.Fatalf("import programs failed: %v", err)
	}

	log.Println("ETL import completed successfully")
}

func importUniversities(ctx context.Context, pool *pgxpool.Pool, path string) error {
	f, err := os.Open(path)
	if err != nil {
		return err
	}
	defer f.Close()

	r := csv.NewReader(f)
	r.Comma = ','
	r.ReuseRecord = true

	// Expected header:
	// id,name,country_code,city,website,qs_rank,the_rank
	header, err := r.Read()
	if err != nil {
		return fmt.Errorf("read header: %w", err)
	}
	log.Printf("universities header: %v", header)

	tx, err := pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	for {
		rec, err := r.Read()
		if err != nil {
			if err.Error() == "EOF" {
				break
			}
			return fmt.Errorf("read row: %w", err)
		}
		if len(rec) < 7 {
			continue
		}

		_, err = tx.Exec(ctx, `
			INSERT INTO universities (id, name, country_code, city, website, qs_rank, the_rank)
			VALUES ($1, $2, $3, $4, $5, NULLIF($6, '')::int, NULLIF($7, '')::int)
			ON CONFLICT (id) DO UPDATE SET
				name = EXCLUDED.name,
				country_code = EXCLUDED.country_code,
				city = EXCLUDED.city,
				website = EXCLUDED.website,
				qs_rank = EXCLUDED.qs_rank,
				the_rank = EXCLUDED.the_rank
		`,
			rec[0], rec[1], rec[2], rec[3], rec[4], rec[5], rec[6],
		)
		if err != nil {
			return fmt.Errorf("upsert university %s: %w", rec[0], err)
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return err
	}
	return nil
}

func importPrograms(ctx context.Context, pool *pgxpool.Pool, path string) error {
	f, err := os.Open(path)
	if err != nil {
		return err
	}
	defer f.Close()

	r := csv.NewReader(f)
	r.Comma = ','
	r.ReuseRecord = true

	// Expected header:
	// id,university_id,title,degree_level,field,language,tuition_amount,tuition_currency,has_scholarship
	header, err := r.Read()
	if err != nil {
		return fmt.Errorf("read header: %w", err)
	}
	log.Printf("programs header: %v", header)

	tx, err := pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	for {
		rec, err := r.Read()
		if err != nil {
			if err.Error() == "EOF" {
				break
			}
			return fmt.Errorf("read row: %w", err)
		}
		if len(rec) < 9 {
			continue
		}

		_, err = tx.Exec(ctx, `
			INSERT INTO programs (
				id, university_id, title, degree_level, field, language,
				tuition_amount, tuition_currency, has_scholarship
			)
			VALUES (
				$1, $2, $3, $4, $5, $6,
				NULLIF($7, '')::numeric, NULLIF($8, '')::tuition_currency, ($9::boolean)
			)
			ON CONFLICT (id) DO UPDATE SET
				title = EXCLUDED.title,
				field = EXCLUDED.field,
				language = EXCLUDED.language,
				tuition_amount = EXCLUDED.tuition_amount,
				tuition_currency = EXCLUDED.tuition_currency,
				has_scholarship = EXCLUDED.has_scholarship
		`,
			rec[0], rec[1], rec[2], rec[3], rec[4], rec[5], rec[6], rec[7], rec[8],
		)
		if err != nil {
			return fmt.Errorf("upsert program %s: %w", rec[0], err)
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return err
	}
	return nil
}

