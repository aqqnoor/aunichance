package smartmatching

import "unichance-backend-go/internal/programs"

type StudentProfileInput struct {
	DegreeTarget        string   `json:"degree_target"`
	IntendedMajor       string   `json:"intended_major"`
	CountryPreferences  []string `json:"country_preferences"`
	CityPreferences     []string `json:"city_preferences"`
	LanguagePreferences []string `json:"language_preferences"`
	BudgetAnnual        *float64 `json:"budget_annual"`
	BudgetCurrency      *string  `json:"budget_currency"`
	ScholarshipNeed     bool     `json:"scholarship_need"`
	GPA                 *float64 `json:"gpa"`
	GPAScale            *float64 `json:"gpa_scale"`
	IELTS               *float64 `json:"ielts"`
	TOEFL               *int     `json:"toefl"`
	Achievements        []string `json:"achievements"`
	Awards              []string `json:"awards"`
	Experience          []string `json:"experience"`
	OutputLanguage      string   `json:"output_language"`
}

type MatchFactors struct {
	ProgramRelevance float64 `json:"program_relevance"`
	DegreeFit        float64 `json:"degree_fit"`
	CountryFit       float64 `json:"country_fit"`
	LanguageFit      float64 `json:"language_fit"`
	TuitionFit       float64 `json:"tuition_fit"`
	ScholarshipFit   float64 `json:"scholarship_fit"`
	ProfileStrength  float64 `json:"profile_strength"`
	Competitiveness  float64 `json:"competitiveness"`
}

type MatchRecommendation struct {
	Program         programs.ProgramCard `json:"program"`
	MatchScore      float64              `json:"match_score"`
	ChanceBand      string               `json:"chance_band"`
	ChancePercent   int                  `json:"chance_percent"`
	Reasoning       []string             `json:"reasoning"`
	Improvements    []string             `json:"improvements"`
	FactorBreakdown MatchFactors         `json:"factor_breakdown"`
	AIExplanation   string               `json:"ai_explanation,omitempty"`
}

type RecommendationsResponse struct {
	Profile         StudentProfileInput   `json:"profile"`
	Recommendations []MatchRecommendation `json:"recommendations"`
	Meta            map[string]any        `json:"meta"`
}

type SaveProfileRequest struct {
	Profile StudentProfileInput `json:"profile"`
}

type RecommendRequest struct {
	Profile   *StudentProfileInput `json:"profile,omitempty"`
	Take      int                  `json:"take"`
	IncludeAI bool                 `json:"include_ai"`
	Language  string               `json:"language"`
}

type ChatRequest struct {
	Question        string                `json:"question"`
	Profile         *StudentProfileInput  `json:"profile,omitempty"`
	Recommendations []MatchRecommendation `json:"recommendations,omitempty"`
	Language        string                `json:"language"`
}
