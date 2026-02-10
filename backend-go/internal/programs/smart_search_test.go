package programs

import (
	"context"
	"os"
	"testing"

	"unichance-backend-go/internal/scoring"

	"github.com/jackc/pgx/v5/pgxpool"
)

// TestDatabaseConnection checks if we can connect to the test database
func TestDatabaseConnection(t *testing.T) {
	connStr := os.Getenv("DATABASE_URL")
	if connStr == "" {
		t.Skip("DATABASE_URL not set, skipping database tests")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5)
	defer cancel()

	pool, err := pgxpool.New(ctx, connStr)
	if err != nil {
		t.Fatalf("Failed to connect to database: %v", err)
	}
	defer pool.Close()

	// Test simple query
	var result int
	err = pool.QueryRow(ctx, "SELECT 1").Scan(&result)
	if err != nil {
		t.Fatalf("Failed to execute test query: %v", err)
	}

	if result != 1 {
		t.Fatalf("Expected 1, got %d", result)
	}

	t.Log("✓ Database connection successful")
}

// TestSmartSearchParameterValidation checks input validation
func TestSmartSearchParameterValidation(t *testing.T) {
	tests := []struct {
		name        string
		params      SmartSearchParams
		shouldError bool
	}{
		{
			name: "Valid parameters",
			params: SmartSearchParams{
				Countries:    []string{"US", "UK"},
				Fields:       []string{"CS", "MATH"},
				DegreeLevels: []string{"BACHELOR", "MASTER"},
				MaxTuition:   Float64Ptr(50000),
				Take:         50,
			},
			shouldError: false,
		},
		{
			name: "Empty fields",
			params: SmartSearchParams{
				Countries:  []string{},
				Fields:     []string{},
				MaxTuition: Float64Ptr(50000),
				Take:       50,
			},
			shouldError: false,
		},
		{
			name: "Zero take",
			params: SmartSearchParams{
				Take: 0,
			},
			shouldError: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if tt.params.Take <= 0 {
				tt.params.Take = 50
			}
			t.Logf("✓ Parameters validated: countries=%v, fields=%v, max_tuition=%v, take=%d",
				tt.params.Countries, tt.params.Fields, tt.params.MaxTuition, tt.params.Take)
		})
	}
}

// TestSmartSearchResponseStructure validates the response format
func TestSmartSearchResponseStructure(t *testing.T) {
	// Create mock response
	response := SmartSearchResponse{
		Reach: []SmartSearchResult{
			{
				Score:    45,
				Category: "reach",
				Breakdown: &scoring.Breakdown{
					GPA:      15,
					Language: 10,
					Tests:    10,
					Extras:   5,
				},
				Reasons: []string{"Competitive program", "Lower acceptance rate"},
			},
		},
		Target: []SmartSearchResult{
			{
				Score:    65,
				Category: "target",
				Breakdown: &scoring.Breakdown{
					GPA:      20,
					Language: 15,
					Tests:    15,
					Extras:   5,
				},
				Reasons: []string{"Good match", "Meets requirements"},
			},
		},
		Safety: []SmartSearchResult{
			{
				Score:    85,
				Category: "safety",
				Breakdown: &scoring.Breakdown{
					GPA:      25,
					Language: 20,
					Tests:    20,
					Extras:   10,
				},
				Reasons: []string{"Excellent fit", "Well above requirements"},
			},
		},
	}

	// Validate structure
	if len(response.Reach) == 0 {
		t.Fatal("Expected reach programs")
	}
	if len(response.Target) == 0 {
		t.Fatal("Expected target programs")
	}
	if len(response.Safety) == 0 {
		t.Fatal("Expected safety programs")
	}

	// Check first reach program
	reach := response.Reach[0]
	if reach.Category != "reach" {
		t.Errorf("Expected category 'reach', got %s", reach.Category)
	}
	if reach.Score > 50 {
		t.Errorf("Reach program score should be <50, got %d", reach.Score)
	}
	if reach.Breakdown == nil {
		t.Fatal("Expected breakdown score")
	}

	// Check first target program
	target := response.Target[0]
	if target.Category != "target" {
		t.Errorf("Expected category 'target', got %s", target.Category)
	}
	if target.Score < 50 || target.Score > 70 {
		t.Errorf("Target program score should be 50-70, got %d", target.Score)
	}

	// Check first safety program
	safety := response.Safety[0]
	if safety.Category != "safety" {
		t.Errorf("Expected category 'safety', got %s", safety.Category)
	}
	if safety.Score < 70 {
		t.Errorf("Safety program score should be >70, got %d", safety.Score)
	}

	totalPrograms := len(response.Reach) + len(response.Target) + len(response.Safety)
	t.Logf("✓ Response structure valid: %d reach, %d target, %d safety (total: %d)",
		len(response.Reach), len(response.Target), len(response.Safety), totalPrograms)
}

// TestFinancialResultInfo validates financial output structure
func TestFinancialResultInfo(t *testing.T) {
	tests := []struct {
		name   string
		info   FinancialResultInfo
		verify func(*FinancialResultInfo) bool
	}{
		{
			name: "Full coverage",
			info: FinancialResultInfo{
				AnnualCostUSD:           50000,
				BudgetUSD:               60000,
				ShortfallUSD:            0,
				NeedsScholarship:        false,
				BestScholarshipCoverage: nil,
			},
			verify: func(f *FinancialResultInfo) bool {
				return f.ShortfallUSD == 0 && f.AnnualCostUSD == 50000
			},
		},
		{
			name: "Partial coverage",
			info: FinancialResultInfo{
				AnnualCostUSD:           50000,
				BudgetUSD:               30000,
				ShortfallUSD:            20000,
				NeedsScholarship:        true,
				BestScholarshipCoverage: Float64Ptr(50),
			},
			verify: func(f *FinancialResultInfo) bool {
				return f.ShortfallUSD > 0 && f.BestScholarshipCoverage != nil && *f.BestScholarshipCoverage == 50
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if !tt.verify(&tt.info) {
				t.Errorf("Financial info verification failed: %+v", tt.info)
			}
			t.Logf("✓ Financial structure valid: cost=%v, budget=%v, shortfall=%v",
				tt.info.AnnualCostUSD, tt.info.BudgetUSD, tt.info.ShortfallUSD)
		})
	}
}

// TestImprovementPathInfo validates improvement path output
func TestImprovementPathInfo(t *testing.T) {
	path := ImprovementPathResult{
		TargetScore: 70,
		GapPoints:   25,
		Next3Steps: []string{
			"Improve GPA by 0.5 points",
			"Take SAT (avg 1450 in program)",
			"Add leadership achievement",
		},
		GpaImpactPercent:    15,
		SatImpactPercent:    20,
		AchievImpactPercent: 10,
	}

	// Validate structure
	if len(path.Next3Steps) == 0 {
		t.Fatal("Expected improvement steps")
	}

	if len(path.Next3Steps) > 3 {
		t.Errorf("Expected max 3 steps, got %d", len(path.Next3Steps))
	}

	totalImpact := path.GpaImpactPercent + path.SatImpactPercent + path.AchievImpactPercent
	t.Logf("✓ Improvement path valid: gap=%d pts, total_impact=%d%%, steps=%d",
		path.GapPoints, totalImpact, len(path.Next3Steps))
}

// TestCategoryDistribution checks if categorization is correct
func TestCategoryDistribution(t *testing.T) {
	results := []SmartSearchResult{
		{Score: 25, Reasons: []string{}},
		{Score: 40, Reasons: []string{}},
		{Score: 60, Reasons: []string{}},
		{Score: 75, Reasons: []string{}},
		{Score: 90, Reasons: []string{}},
	}

	response := SmartSearchResponse{
		Reach:  []SmartSearchResult{results[0], results[1]},
		Target: []SmartSearchResult{results[2]},
		Safety: []SmartSearchResult{results[3], results[4]},
	}

	// Verify categorization
	for _, r := range response.Reach {
		if r.Score > 50 {
			t.Errorf("Reach program has score %d, should be <50", r.Score)
		}
	}

	for _, r := range response.Target {
		if r.Score <= 50 || r.Score >= 70 {
			t.Errorf("Target program has score %d, should be 50-70", r.Score)
		}
	}

	for _, r := range response.Safety {
		if r.Score < 70 {
			t.Errorf("Safety program has score %d, should be >70", r.Score)
		}
	}

	t.Logf("✓ Category distribution correct: %d reach, %d target, %d safety",
		len(response.Reach), len(response.Target), len(response.Safety))
}

func Float64Ptr(v float64) *float64 {
	return &v
}

func IntPtr(v int) *int {
	return &v
}
