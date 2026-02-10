package profile

type Profile struct {
	ID     string `json:"id"`
	UserID string `json:"user_id"`

	GPA      *float64 `json:"gpa"`
	GPAScale *float64 `json:"gpa_scale"`

	IELTS *float64 `json:"ielts"`
	TOEFL *int     `json:"toefl"`
	SAT   *int     `json:"sat"`

	BudgetYear     *float64 `json:"budget_year"`
	BudgetCurrency *string  `json:"budget_currency"`

	Awards              *string `json:"awards"`
	AchievementsSummary *string `json:"achievements_summary"`
	AchievementsCount   *int    `json:"achievements_count"`

	// For smart matching
	CitizenshipCode *string `json:"citizenship_code"`
	GraduationYear  *int    `json:"graduation_year"`
}

type ScoreResult struct {
	Score   int      `json:"score"`
	Reasons []string `json:"reasons"`
}
