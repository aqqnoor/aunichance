package smartmatching

import (
	"context"
	"encoding/json"

	"github.com/jackc/pgx/v5/pgxpool"
)

type Repo struct {
	DB *pgxpool.Pool
}

func (r Repo) SaveProfile(ctx context.Context, userID string, profile StudentProfileInput) error {
	b, err := json.Marshal(profile)
	if err != nil {
		return err
	}
	_, err = r.DB.Exec(ctx, `
		INSERT INTO smart_matching_profiles(user_id, profile_payload, preferred_output_language, updated_at)
		VALUES ($1, $2::jsonb, COALESCE(NULLIF($3, ''), 'ru'), now())
		ON CONFLICT (user_id) DO UPDATE SET
			profile_payload = EXCLUDED.profile_payload,
			preferred_output_language = EXCLUDED.preferred_output_language,
			updated_at = now()
	`, userID, string(b), profile.OutputLanguage)
	return err
}

func (r Repo) GetProfile(ctx context.Context, userID string) (*StudentProfileInput, error) {
	var b []byte
	var lang string
	if err := r.DB.QueryRow(ctx, `
		SELECT profile_payload::text, preferred_output_language
		FROM smart_matching_profiles WHERE user_id = $1
	`, userID).Scan(&b, &lang); err != nil {
		return nil, err
	}
	var out StudentProfileInput
	if err := json.Unmarshal(b, &out); err != nil {
		return nil, err
	}
	if out.OutputLanguage == "" {
		out.OutputLanguage = lang
	}
	return &out, nil
}
