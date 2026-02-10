package profile

import (
	"context"

	"github.com/jackc/pgx/v5/pgxpool"
)

type Repo struct{ DB *pgxpool.Pool }

func (r Repo) UpsertMyProfile(ctx context.Context, userID string, p Profile) (Profile, error) {
	// 1 user = 1 profile (MVP)
	q := `
  INSERT INTO profiles(user_id,gpa,gpa_scale,ielts,toefl,sat,budget_year,budget_currency,awards,achievements_summary,achievements_count,citizenship_code,graduation_year)
  VALUES ($1,$2,$3,$4,$5,$6,$7,NULLIF($8,'')::tuition_currency,$9,$10,$11,$12,$13)
  ON CONFLICT (user_id) DO UPDATE SET
    gpa=EXCLUDED.gpa,
    gpa_scale=EXCLUDED.gpa_scale,
    ielts=EXCLUDED.ielts,
    toefl=EXCLUDED.toefl,
    sat=EXCLUDED.sat,
    budget_year=EXCLUDED.budget_year,
    budget_currency=EXCLUDED.budget_currency,
    awards=EXCLUDED.awards,
    achievements_summary=EXCLUDED.achievements_summary,
    achievements_count=EXCLUDED.achievements_count,
    citizenship_code=EXCLUDED.citizenship_code,
    graduation_year=EXCLUDED.graduation_year,
    updated_at=now()
  RETURNING id, user_id, gpa, gpa_scale, ielts, toefl, sat, budget_year, budget_currency::text, awards, achievements_summary, achievements_count, citizenship_code, graduation_year
  `
	return r.scanProfile(ctx, q,
		userID,
		p.GPA, p.GPAScale, p.IELTS, p.TOEFL, p.SAT,
		p.BudgetYear, strOrEmpty(p.BudgetCurrency),
		p.Awards, p.AchievementsSummary, p.AchievementsCount, p.CitizenshipCode, p.GraduationYear,
	)
}

func (r Repo) GetMyProfile(ctx context.Context, userID string) (Profile, error) {
	q := `
  SELECT id, user_id, gpa, gpa_scale, ielts, toefl, sat, budget_year, budget_currency::text, awards, achievements_summary, achievements_count, citizenship_code, graduation_year
  FROM profiles
  WHERE user_id=$1
  `
	return r.scanProfile(ctx, q, userID)
}

func (r Repo) scanProfile(ctx context.Context, q string, args ...any) (Profile, error) {
	var p Profile
	var cur *string
	var acCount *int
	var citizenCode *string
	var gradYear *int

	err := r.DB.QueryRow(ctx, q, args...).Scan(
		&p.ID, &p.UserID,
		&p.GPA, &p.GPAScale,
		&p.IELTS, &p.TOEFL, &p.SAT,
		&p.BudgetYear, &cur,
		&p.Awards, &p.AchievementsSummary,
		&acCount, &citizenCode, &gradYear,
	)
	if cur != nil {
		p.BudgetCurrency = cur
	}
	if acCount != nil {
		p.AchievementsCount = acCount
	}
	if citizenCode != nil {
		p.CitizenshipCode = citizenCode
	}
	if gradYear != nil {
		p.GraduationYear = gradYear
	}
	return p, err
}

func strOrEmpty(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}
