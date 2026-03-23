package programs

import (
	"context"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"
)

type Repo struct{ DB *pgxpool.Pool }

type ListParams struct {
	Q string
	// UseILikeFallback включает дополнительный ILIKE-поиск
	// по названию программы / направлению / университету,
	// поверх основного FTS. По умолчанию выключен.
	UseILikeFallback bool
	Countries        []string
	Levels           []string
	Fields           []string
	Cities           []string
	Languages        []string
	Regions          []string
	Currency         string
	MinTuition       *float64
	MaxTuition       *float64
	Scholarship      *bool
	Sort             string
	Page             int
	Limit            int
}

func (r Repo) List(ctx context.Context, p ListParams) (items []ProgramCard, total int, err error) {
	if p.Page <= 0 {
		p.Page = 1
	}
	if p.Limit <= 0 {
		p.Limit = 20
	}
	if p.Limit > 50 {
		p.Limit = 50
	}

	where := []string{"1=1"}
	args := []any{}
	add := func(cond string, val any) {
		args = append(args, val)
		where = append(where, fmt.Sprintf(cond, len(args)))
	}

	// q (FTS)
	ftsArgPos := 0
	useFTS := strings.TrimSpace(p.Q) != ""
	if useFTS {
		add("programs.search_vector @@ plainto_tsquery('simple', $%d)", p.Q)
		ftsArgPos = len(args)

		if p.UseILikeFallback {
			// Дополнительный (опциональный) fallback-поиск через ILIKE.
			pattern := "%" + p.Q + "%"
			args = append(args, pattern)
			patPos := len(args)
			where = append(where, fmt.Sprintf(
				"(programs.title ILIKE $%d OR programs.field ILIKE $%d OR universities.name ILIKE $%d)",
				patPos, patPos, patPos,
			))
		}
	}

	if len(p.Countries) > 0 {
		args = append(args, p.Countries)
		where = append(where, fmt.Sprintf("universities.country_code = ANY($%d)", len(args)))
	}
	if len(p.Levels) > 0 {
		args = append(args, p.Levels)
		where = append(where, fmt.Sprintf("programs.degree_level::text = ANY($%d)", len(args)))
	}
	if len(p.Fields) > 0 {
		args = append(args, p.Fields)
		where = append(where, fmt.Sprintf("programs.field = ANY($%d)", len(args)))
	}
	if len(p.Cities) > 0 {
		args = append(args, p.Cities)
		where = append(where, fmt.Sprintf("universities.city = ANY($%d)", len(args)))
	}
	if len(p.Languages) > 0 {
		args = append(args, p.Languages)
		langArg := len(args)
		langConds := []string{fmt.Sprintf("programs.language = ANY($%d)", langArg)}
		if r.hasColumn(ctx, "programs", "language_code") {
			langConds = append(langConds, fmt.Sprintf("programs.language_code::text = ANY($%d)", langArg))
		}
		if r.hasColumn(ctx, "programs", "study_language_normalized") {
			langConds = append(langConds, fmt.Sprintf("programs.study_language_normalized = ANY($%d)", langArg))
		}
		where = append(where, "("+strings.Join(langConds, " OR ")+")")
	}
	if len(p.Regions) > 0 && r.hasColumn(ctx, "universities", "region_or_state") {
		args = append(args, p.Regions)
		where = append(where, fmt.Sprintf("universities.region_or_state = ANY($%d)", len(args)))
	}
	if p.Currency != "" {
		add("programs.tuition_currency::text = $%d", p.Currency)
	}
	if p.MinTuition != nil {
		add("programs.tuition_amount >= $%d", *p.MinTuition)
	}
	if p.MaxTuition != nil {
		add("programs.tuition_amount <= $%d", *p.MaxTuition)
	}
	if p.Scholarship != nil {
		add("programs.has_scholarship = $%d", *p.Scholarship)
	}

	whereSQL := strings.Join(where, " AND ")

	// sort
	orderSQL := "universities.qs_rank ASC NULLS LAST, universities.the_rank ASC NULLS LAST, programs.title ASC"
	if useFTS && (p.Sort == "" || p.Sort == "relevance") {
		// Используем тот же параметр, что и в WHERE, чтобы не было "магических" $1.
		orderSQL = fmt.Sprintf(
			"ts_rank(programs.search_vector, plainto_tsquery('simple', $%d)) DESC, %s",
			ftsArgPos, orderSQL,
		)
	} else {
		switch p.Sort {
		case "tuition_asc":
			orderSQL = "programs.tuition_amount ASC NULLS LAST"
		case "tuition_desc":
			orderSQL = "programs.tuition_amount DESC NULLS LAST"
		case "qs":
			orderSQL = "universities.qs_rank ASC NULLS LAST"
		case "the":
			orderSQL = "universities.the_rank ASC NULLS LAST"
		}
	}

	// countQuery
	countSQL := `
    SELECT COUNT(*)
    FROM programs
    JOIN universities ON universities.id = programs.university_id
    WHERE ` + whereSQL

	if err := r.DB.QueryRow(ctx, countSQL, args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	sel := func(column, alias, castType string) string {
		if r.hasColumn(ctx, "programs", column) {
			return "programs." + column
		}
		return "NULL::" + castType + " AS " + alias
	}
	programDescriptionExpr := "programs.description AS program_description"
	if r.hasColumn(ctx, "programs", "program_description") {
		programDescriptionExpr = "programs.program_description"
	}

	// itemsQuery
	offset := (p.Page - 1) * p.Limit
	args = append(args, p.Limit, offset)
	limitPos := len(args) - 1
	offsetPos := len(args)

	itemsSQL := `
    SELECT
      programs.id, programs.title, programs.degree_level::text, programs.field, programs.language,
      programs.tuition_amount, programs.tuition_currency::text,
      programs.has_scholarship, programs.scholarship_type, programs.scholarship_percent_min, programs.scholarship_percent_max,
      ` + programDescriptionExpr + `,
      ` + sel("program_description_ru", "program_description_ru", "text") + `,
      ` + sel("title_ru", "title_ru", "text") + `,
      ` + sel("field_normalized", "field_normalized", "text") + `,
      ` + sel("study_language_normalized", "study_language_normalized", "text") + `,
      ` + sel("selectivity_tier", "selectivity_tier", "text") + `,
      ` + sel("career_paths_ru", "career_paths_ru", "text") + `,
      ` + sel("duration_months", "duration_months", "int") + `,
      ` + sel("mode_of_study", "mode_of_study", "text") + `,
      ` + sel("attendance_type", "attendance_type", "text") + `,
      ` + sel("official_program_url", "official_program_url", "text") + `,
      ` + sel("career_paths", "career_paths", "text") + `,
      ` + sel("admission_notes", "admission_notes", "text") + `,
      universities.name, universities.country_code, universities.city, universities.qs_rank, universities.the_rank,
      programs.university_id
    FROM programs
    JOIN universities ON universities.id = programs.university_id
    WHERE ` + whereSQL + `
    ORDER BY ` + orderSQL + `
    LIMIT $` + fmt.Sprint(limitPos) + ` OFFSET $` + fmt.Sprint(offsetPos)

	rows, err := r.DB.Query(ctx, itemsSQL, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	for rows.Next() {
		var it ProgramCard
		err := rows.Scan(
			&it.ID, &it.Title, &it.DegreeLevel, &it.Field, &it.Language,
			&it.TuitionAmount, &it.TuitionCurrency,
			&it.HasScholarship, &it.ScholarshipType, &it.ScholarshipPercentMin, &it.ScholarshipPercentMax,
			&it.ProgramDescription, &it.ProgramDescriptionRU, &it.TitleRU,
			&it.FieldNormalized, &it.StudyLanguageNorm, &it.SelectivityTier, &it.CareerPathsRU,
			&it.DurationMonths, &it.ModeOfStudy, &it.AttendanceType,
			&it.OfficialProgramURL, &it.CareerPaths, &it.AdmissionNotes,
			&it.UniversityName, &it.CountryCode, &it.City, &it.QSRank, &it.THERank, &it.UniversityID,
		)
		if err != nil {
			return nil, 0, err
		}
		items = append(items, it)
	}
	return items, total, rows.Err()
}

func (r Repo) hasColumn(ctx context.Context, tableName, columnName string) bool {
	var exists bool
	err := r.DB.QueryRow(ctx, `
		SELECT EXISTS (
			SELECT 1
			FROM information_schema.columns
			WHERE table_schema = 'public'
			  AND table_name = $1
			  AND column_name = $2
		)
	`, tableName, columnName).Scan(&exists)
	return err == nil && exists
}
