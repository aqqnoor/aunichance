package programs

import (
	"context"
	"fmt"
	"strings"

	"unichance-backend-go/internal/scoring"
)

// FinancialResultInfo for JSON serialization
type FinancialResultInfo struct {
	CoveredByBudget         bool     `json:"covered_by_budget"`
	AnnualCostUSD           float64  `json:"annual_cost_usd"`
	BudgetUSD               float64  `json:"budget_usd"`
	ShortfallUSD            float64  `json:"shortfall_usd"`
	BestScholarshipCoverage *float64 `json:"best_scholarship_coverage"`
	NeedsScholarship        bool     `json:"needs_scholarship"`
}

// ImprovementPathResult for JSON serialization
type ImprovementPathResult struct {
	TargetScore         int      `json:"target_score"`
	GapPoints           int      `json:"gap_points"`
	Next3Steps          []string `json:"next_3_steps"`
	GpaImpactPercent    int      `json:"gpa_impact_percent"`
	SatImpactPercent    int      `json:"sat_impact_percent"`
	AchievImpactPercent int      `json:"achieve_impact_percent"`
}

// SmartSearchResult is a program scored and ranked for a specific student
type SmartSearchResult struct {
	Program         ProgramCard           `json:"program"`
	Score           int                   `json:"score"`
	Category        string                `json:"category"` // reach, target, safety
	Breakdown       *scoring.Breakdown    `json:"breakdown"`
	Reasons         []string              `json:"reasons"`
	Advice          string                `json:"advice"`
	FinancialInfo   FinancialResultInfo   `json:"financial_info"`
	ImprovementPath ImprovementPathResult `json:"improvement_path"`
}

// SmartSearchParams defines filters for smart search
type SmartSearchParams struct {
	Countries    []string
	Fields       []string
	DegreeLevels []string
	MaxTuition   *float64
	Take         int // How many results to return (max 50)
}

// SmartSearchResponse groups programs by category
type SmartSearchResponse struct {
	Reach  []SmartSearchResult `json:"reach"`
	Target []SmartSearchResult `json:"target"`
	Safety []SmartSearchResult `json:"safety"`
	Total  int                 `json:"total"`
}

// EnrichedProgramData contains all data needed for smart matching
type EnrichedProgramData struct {
	Program              ProgramCard
	UniversityName       string
	CountryCode          string
	CompetitiveFactor    float64
	AcceptanceRate       *float64
	AvgGPA               *float64
	AvgIELTS             *float64
	AvgTOEFL             *int
	AvgSAT               *int
	TuitionAmount        *float64
	TuitionCurrency      *string
	HasScholarship       bool
	ScholarshipTypes     []string
	ScholarshipCoverages []float64
	EligibleCountries    []string
}

// ListEnrichedForSmartSearch returns programs with all matching context
func (r Repo) ListEnrichedForSmartSearch(
	ctx context.Context,
	params SmartSearchParams,
) ([]EnrichedProgramData, error) {
	where := []string{"1=1"}
	args := []interface{}{}
	add := func(cond string, val interface{}) {
		args = append(args, val)
		where = append(where, fmt.Sprintf(cond, len(args)))
	}

	if len(params.Countries) > 0 {
		args = append(args, params.Countries)
		where = append(where, fmt.Sprintf("u.country_code = ANY($%d)", len(args)))
	}
	if len(params.Fields) > 0 {
		args = append(args, params.Fields)
		where = append(where, fmt.Sprintf("p.field = ANY($%d)", len(args)))
	}
	if len(params.DegreeLevels) > 0 {
		args = append(args, params.DegreeLevels)
		where = append(where, fmt.Sprintf("p.degree_level::text = ANY($%d)", len(args)))
	}
	if params.MaxTuition != nil {
		add("p.tuition_amount <= $%d", *params.MaxTuition)
	}

	whereSQL := strings.Join(where, " AND ")

	limit := params.Take
	if limit <= 0 {
		limit = 30
	}
	if limit > 50 {
		limit = 50
	}

	query := `
    SELECT
      p.id, p.title, p.degree_level::text, p.field, p.language,
      p.tuition_amount, p.tuition_currency::text,
      p.has_scholarship,
      u.name, u.country_code,
      COALESCE(p.competitive_factor, 1.0),
      COALESCE(admission.acceptance_rate, NULL),
      COALESCE(admission.avg_gpa, NULL),
      COALESCE(admission.avg_ielts, NULL),
      COALESCE(admission.avg_toefl, NULL),
      COALESCE(admission.avg_sat, NULL),
      p.university_id
    FROM programs p
    JOIN universities u ON u.id = p.university_id
    LEFT JOIN LATERAL (
      SELECT acceptance_rate, avg_gpa, avg_ielts, avg_toefl, avg_sat
      FROM admission_stats ads
      WHERE ads.program_id = p.id
      ORDER BY year DESC
      LIMIT 1
    ) admission ON true
    WHERE ` + whereSQL + `
    ORDER BY u.qs_rank ASC NULLS LAST, p.title ASC
    LIMIT $` + fmt.Sprint(len(args)+1)

	args = append(args, limit)

	rows, err := r.DB.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var results []EnrichedProgramData
	for rows.Next() {
		var epd EnrichedProgramData
		var pc ProgramCard

		err := rows.Scan(
			&pc.ID, &pc.Title, &pc.DegreeLevel, &pc.Field, &pc.Language,
			&pc.TuitionAmount, &pc.TuitionCurrency,
			&pc.HasScholarship,
			&epd.UniversityName, &epd.CountryCode,
			&epd.CompetitiveFactor,
			&epd.AcceptanceRate,
			&epd.AvgGPA,
			&epd.AvgIELTS,
			&epd.AvgTOEFL,
			&epd.AvgSAT,
			&pc.UniversityID,
		)
		if err != nil {
			return nil, err
		}

		pc.CountryCode = epd.CountryCode
		pc.UniversityName = epd.UniversityName
		epd.Program = pc
		epd.TuitionAmount = pc.TuitionAmount
		epd.TuitionCurrency = pc.TuitionCurrency
		epd.HasScholarship = pc.HasScholarship

		results = append(results, epd)
	}

	return results, rows.Err()
}

// PerformSmartSearch matches student profile to programs and returns ranked results
func (r Repo) PerformSmartSearch(
	ctx context.Context,
	enrichedPrograms []EnrichedProgramData,
	studentProfile scoring.EnrichedStudentProfile,
) SmartSearchResponse {
	response := SmartSearchResponse{
		Reach:  []SmartSearchResult{},
		Target: []SmartSearchResult{},
		Safety: []SmartSearchResult{},
	}

	// Score each program for this student
	allScores := []SmartSearchResult{}

	for _, epd := range enrichedPrograms {
		// Build ProgramContext for matching
		pc := scoring.ProgramContext{
			ID:                epd.Program.ID,
			UniversityID:      epd.Program.UniversityID,
			UniversityName:    epd.UniversityName,
			CountryCode:       epd.CountryCode,
			Title:             epd.Program.Title,
			DegreeLevel:       epd.Program.DegreeLevel,
			Field:             epd.Program.Field,
			TuitionAmount:     epd.TuitionAmount,
			TuitionCurrency:   epd.TuitionCurrency,
			HasScholarship:    epd.HasScholarship,
			CompetitiveFactor: epd.CompetitiveFactor,
			AcceptanceRate:    epd.AcceptanceRate,
			AvgGPA:            epd.AvgGPA,
			AvgIELTS:          epd.AvgIELTS,
			AvgTOEFL:          epd.AvgTOEFL,
			AvgSAT:            epd.AvgSAT,
		}

		// Perform matching
		match := scoring.ComputeMatch(studentProfile, pc)

		// Convert financial status to result type
		finInfo := FinancialResultInfo{
			CoveredByBudget:         match.FinancialStatus.CoveredByBudget,
			AnnualCostUSD:           match.FinancialStatus.AnnualCostUSD,
			BudgetUSD:               match.FinancialStatus.BudgetUSD,
			ShortfallUSD:            match.FinancialStatus.ShortfallUSD,
			BestScholarshipCoverage: match.FinancialStatus.BestScholarshipCoverage,
			NeedsScholarship:        match.FinancialStatus.NeedsScholarship,
		}

		// Convert improvement path to result type
		improvPath := ImprovementPathResult{
			TargetScore:         match.ImprovementPath.TargetScore,
			GapPoints:           match.ImprovementPath.GapPoints,
			Next3Steps:          match.ImprovementPath.Next3Steps,
			GpaImpactPercent:    match.ImprovementPath.GpaImpactPercent,
			SatImpactPercent:    match.ImprovementPath.SatImpactPercent,
			AchievImpactPercent: match.ImprovementPath.AchievImpactPercent,
		}

		// Build response item
		result := SmartSearchResult{
			Program:         epd.Program,
			Score:           match.OverallScore,
			Category:        match.Category,
			Breakdown:       match.BreakdownScore,
			Reasons:         match.Reasons,
			Advice:          match.Advice,
			FinancialInfo:   finInfo,
			ImprovementPath: improvPath,
		}

		allScores = append(allScores, result)
	}

	// Sort by category and then by score descending
	for _, result := range allScores {
		switch result.Category {
		case "reach":
			response.Reach = append(response.Reach, result)
		case "target":
			response.Target = append(response.Target, result)
		case "safety":
			response.Safety = append(response.Safety, result)
		}
	}

	// Sort each category by score descending
	sortResults := func(results []SmartSearchResult) {
		for i := 0; i < len(results); i++ {
			for j := i + 1; j < len(results); j++ {
				if results[j].Score > results[i].Score {
					results[i], results[j] = results[j], results[i]
				}
			}
		}
	}

	sortResults(response.Reach)
	sortResults(response.Target)
	sortResults(response.Safety)

	response.Total = len(response.Reach) + len(response.Target) + len(response.Safety)
	return response
}
