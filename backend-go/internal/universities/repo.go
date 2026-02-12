package universities

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Repo struct {
	DB *pgxpool.Pool
}

func (r Repo) GetByID(ctx context.Context, id string) (*University, error) {
	u := University{}

	err := r.DB.QueryRow(ctx, `
    SELECT id, name, country_code, city, website, qs_rank, the_rank, data_updated_at
    FROM universities
    WHERE id = $1
  `, id).Scan(
		&u.ID, &u.Name, &u.CountryCode, &u.City, &u.Website, &u.QSRank, &u.THERank, &u.DataUpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}

	// links
	rows, err := r.DB.Query(ctx, `
    SELECT
      ul.id, ul.link_type, ul.url, ul.title, ul.is_official, ul.priority,
      s.code as source_code,
      ul.last_verified_at
    FROM university_links ul
    LEFT JOIN sources s ON s.id = ul.source_id
    WHERE ul.university_id = $1
    ORDER BY ul.is_official DESC, ul.priority ASC, ul.link_type ASC
  `, id)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	u.Links = []UniversityLink{}
	for rows.Next() {
		var l UniversityLink
		if err := rows.Scan(
			&l.ID, &l.LinkType, &l.URL, &l.Title, &l.IsOfficial, &l.Priority,
			&l.SourceCode,
			&l.LastVerifiedAt,
		); err != nil {
			return nil, err
		}
		u.Links = append(u.Links, l)
	}

	// programs (lite)
	prow, err := r.DB.Query(ctx, `
    SELECT
      p.id, p.title, p.degree_level::text, p.field, p.language,
      p.tuition_amount, p.tuition_currency::text,
      p.has_scholarship
    FROM programs p
    WHERE p.university_id = $1
    ORDER BY p.degree_level ASC, p.title ASC
    LIMIT 50
  `, id)
	if err != nil {
		return nil, err
	}
	defer prow.Close()

	u.Programs = []ProgramLite{}
	for prow.Next() {
		var p ProgramLite
		if err := prow.Scan(
			&p.ID, &p.Title, &p.DegreeLevel, &p.Field, &p.Language,
			&p.TuitionAmount, &p.TuitionCurrency,
			&p.HasScholarship,
		); err != nil {
			return nil, err
		}
		u.Programs = append(u.Programs, p)
	}

	return &u, nil
}

func (r *Repo) List(ctx context.Context, limit, offset int) ([]University, int64, error) {
	var total int64
	var universities []University

	// Считаем общее количество
	err := r.DB.QueryRow(ctx, "SELECT COUNT(*) FROM universities").Scan(&total)
	if err != nil {
		return nil, 0, err
	}

	// Получаем университеты с пагинацией — ТОЛЬКО те поля, которые РЕАЛЬНО есть в таблице
	rows, err := r.DB.Query(ctx, `
		SELECT id, name, country_code, city, website, qs_rank, the_rank, data_updated_at
		FROM universities 
		ORDER BY name 
		LIMIT $1 OFFSET $2
	`, limit, offset)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	for rows.Next() {
		var u University
		err := rows.Scan(
			&u.ID,
			&u.Name,
			&u.CountryCode,
			&u.City,
			&u.Website,
			&u.QSRank,
			&u.THERank,
			&u.DataUpdatedAt,
		)
		if err != nil {
			return nil, 0, err
		}
		universities = append(universities, u)
	}

	return universities, total, nil
}
