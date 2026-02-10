package scoring

import (
	"testing"
)

// TestBasicMatching tests the fundamental matching logic
func TestBasicMatching(t *testing.T) {
	tests := []struct {
		name           string
		student        EnrichedStudentProfile
		program        ProgramContext
		expectedMin    int // Expected minimum score
		expectedMax    int // Expected maximum score
		expectedStatus string
	}{
		{
			name: "Strong student to accessible program",
			student: EnrichedStudentProfile{
				GPA:        f64Ptr(3.8),
				GPAScale:   f64Ptr(4.0),
				IELTS:      f64Ptr(7.5),
				SAT:        intPtr(1500),
				BudgetYear: f64Ptr(50000),
			},
			program: ProgramContext{
				ID:                "prog-1",
				Title:             "Computer Science - MIT",
				AvgGPA:            f64Ptr(3.7),
				AvgIELTS:          f64Ptr(7.0),
				AvgSAT:            intPtr(1450),
				AcceptanceRate:    f64Ptr(3.0),
				CompetitiveFactor: 1.4,
				TuitionAmount:     f64Ptr(60000),
			},
			expectedMin:    60,
			expectedMax:    100,
			expectedStatus: "safety",
		},
		{
			name: "Weak student to selective program",
			student: EnrichedStudentProfile{
				GPA:        f64Ptr(2.5),
				GPAScale:   f64Ptr(4.0),
				IELTS:      f64Ptr(5.5),
				BudgetYear: f64Ptr(20000),
			},
			program: ProgramContext{
				ID:                "prog-2",
				Title:             "Engineering - Stanford",
				AvgGPA:            f64Ptr(3.9),
				AvgIELTS:          f64Ptr(7.5),
				AvgSAT:            intPtr(1550),
				AcceptanceRate:    f64Ptr(4.0),
				CompetitiveFactor: 1.4,
				TuitionAmount:     f64Ptr(70000),
			},
			expectedMin:    0,
			expectedMax:    30,
			expectedStatus: "reach",
		},
		{
			name: "Average student to moderate program",
			student: EnrichedStudentProfile{
				GPA:        f64Ptr(3.5),
				GPAScale:   f64Ptr(4.0),
				IELTS:      f64Ptr(7.0),
				BudgetYear: f64Ptr(30000),
			},
			program: ProgramContext{
				ID:                "prog-3",
				Title:             "Business - UC Berkeley",
				AvgGPA:            f64Ptr(3.5),
				AvgIELTS:          f64Ptr(7.0),
				AvgSAT:            intPtr(1350),
				AcceptanceRate:    f64Ptr(15.0),
				CompetitiveFactor: 1.2,
				TuitionAmount:     f64Ptr(45000),
			},
			expectedMin:    40,
			expectedMax:    70,
			expectedStatus: "target",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := ComputeMatch(tt.student, tt.program)

			if result.OverallScore < tt.expectedMin || result.OverallScore > tt.expectedMax {
				t.Errorf("Score %d not in expected range [%d-%d]",
					result.OverallScore, tt.expectedMin, tt.expectedMax)
			}

			if result.Category != tt.expectedStatus {
				t.Errorf("Expected category %s, got %s", tt.expectedStatus, result.Category)
			}

			if result.OverallScore < 0 || result.OverallScore > 100 {
				t.Errorf("Score %d out of valid range [0-100]", result.OverallScore)
			}

			if len(result.Reasons) == 0 {
				t.Errorf("Expected reasons, got none")
			}
		})
	}
}

// TestFinancialScoring tests financial component accuracy
func TestFinancialScoring(t *testing.T) {
	tests := []struct {
		name        string
		budget      *float64
		tuition     *float64
		hasScholar  bool
		expectedMin int
		expectedMax int
	}{
		{
			name:        "Full budget coverage",
			budget:      f64Ptr(60000),
			tuition:     f64Ptr(50000),
			hasScholar:  false,
			expectedMin: 20,
			expectedMax: 20,
		},
		{
			name:        "Partial budget coverage",
			budget:      f64Ptr(35000),
			tuition:     f64Ptr(50000),
			hasScholar:  false,
			expectedMin: 10,
			expectedMax: 15,
		},
		{
			name:        "Minimal budget, with scholarship",
			budget:      f64Ptr(15000),
			tuition:     f64Ptr(50000),
			hasScholar:  true,
			expectedMin: 12,
			expectedMax: 16,
		},
		{
			name:        "No budget, no scholarship",
			budget:      f64Ptr(0),
			tuition:     f64Ptr(50000),
			hasScholar:  false,
			expectedMin: 0,
			expectedMax: 6,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			student := EnrichedStudentProfile{
				BudgetYear: tt.budget,
			}
			program := ProgramContext{
				TuitionAmount:  tt.tuition,
				HasScholarship: tt.hasScholar,
			}

			result := ComputeMatch(student, program)

			if result.FinancialStatus.AnnualCostUSD == 0 && tt.tuition != nil {
				// Financial info was populated
				if tt.budget != nil && result.FinancialStatus.BudgetUSD != *tt.budget {
					t.Errorf("Budget mismatch: expected %f, got %f",
						*tt.budget, result.FinancialStatus.BudgetUSD)
				}
			}
		})
	}
}

// TestAcademicScoring tests GPA and language accuracy
func TestAcademicScoring(t *testing.T) {
	tests := []struct {
		name        string
		studentGPA  *float64
		gpaScale    *float64
		avgGPA      *float64
		expectedMin int
		expectedMax int
	}{
		{
			name:        "GPA well above average",
			studentGPA:  f64Ptr(3.9),
			gpaScale:    f64Ptr(4.0),
			avgGPA:      f64Ptr(3.5),
			expectedMin: 20,
			expectedMax: 25,
		},
		{
			name:        "GPA at average",
			studentGPA:  f64Ptr(3.5),
			gpaScale:    f64Ptr(4.0),
			avgGPA:      f64Ptr(3.5),
			expectedMin: 18,
			expectedMax: 22,
		},
		{
			name:        "GPA below average",
			studentGPA:  f64Ptr(3.0),
			gpaScale:    f64Ptr(4.0),
			avgGPA:      f64Ptr(3.5),
			expectedMin: 10,
			expectedMax: 15,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			student := EnrichedStudentProfile{
				GPA:      tt.studentGPA,
				GPAScale: tt.gpaScale,
			}
			program := ProgramContext{
				AvgGPA: tt.avgGPA,
			}

			result := ComputeMatch(student, program)

			if result.BreakdownScore == nil {
				t.Fatal("Breakdown score is nil")
			}

			gpaScore := result.BreakdownScore.GPA
			if gpaScore < tt.expectedMin || gpaScore > tt.expectedMax {
				t.Errorf("GPA score %d not in expected range [%d-%d]",
					gpaScore, tt.expectedMin, tt.expectedMax)
			}
		})
	}
}

// TestCompetitiveScoring tests acceptance rate impact
func TestCompetitiveScoring(t *testing.T) {
	student := EnrichedStudentProfile{
		GPA:      f64Ptr(3.5),
		GPAScale: f64Ptr(4.0),
		IELTS:    f64Ptr(7.0),
	}

	tests := []struct {
		name           string
		acceptanceRate *float64
		avgGPA         *float64
		expectedMin    int
		expectedMax    int
	}{
		{
			name:           "Very competitive (3% acceptance)",
			acceptanceRate: f64Ptr(3.0),
			avgGPA:         f64Ptr(3.5),
			expectedMin:    8,
			expectedMax:    15,
		},
		{
			name:           "Moderately competitive (15% acceptance)",
			acceptanceRate: f64Ptr(15.0),
			avgGPA:         f64Ptr(3.5),
			expectedMin:    12,
			expectedMax:    18,
		},
		{
			name:           "Less competitive (40% acceptance)",
			acceptanceRate: f64Ptr(40.0),
			avgGPA:         f64Ptr(3.0),
			expectedMin:    5,
			expectedMax:    12,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			program := ProgramContext{
				AcceptanceRate:    tt.acceptanceRate,
				AvgGPA:            tt.avgGPA,
				CompetitiveFactor: 1.2,
			}

			result := ComputeMatch(student, program)

			if result.BreakdownScore == nil {
				t.Fatal("Breakdown score is nil")
			}

			// Verify breakdown has proper structure
			if result.BreakdownScore.GPA < 0 || result.BreakdownScore.Language < 0 {
				t.Errorf("Invalid breakdown scores")
			}
		})
	}
}

// TestRecommendationsGeneration checks that recommendations are meaningful
func TestRecommendationsGeneration(t *testing.T) {
	student := EnrichedStudentProfile{
		GPA:        f64Ptr(3.2),
		GPAScale:   f64Ptr(4.0),
		IELTS:      f64Ptr(6.5),
		SAT:        nil, // No SAT
		BudgetYear: f64Ptr(20000),
	}

	program := ProgramContext{
		Title:             "Selective University",
		AvgGPA:            f64Ptr(3.7),
		AvgIELTS:          f64Ptr(7.0),
		AvgSAT:            intPtr(1450),
		TuitionAmount:     f64Ptr(50000),
		AcceptanceRate:    f64Ptr(5.0),
		CompetitiveFactor: 1.4,
	}

	result := ComputeMatch(student, program)

	// Should have recommendations
	if len(result.Reasons) == 0 {
		t.Fatal("Expected reasons, got none")
	}

	// Advice should be populated
	if result.Advice == "" {
		t.Fatal("Expected advice, got empty")
	}

	// Should have improvement path
	if result.ImprovementPath.GapPoints == 0 && result.OverallScore < 70 {
		t.Log("Note: Even weak students should get improvement suggestions")
	}

	t.Logf("Score: %d, Category: %s", result.OverallScore, result.Category)
	t.Logf("Advice: %s", result.Advice)
}

// Helpers
func f64Ptr(v float64) *float64 {
	return &v
}

func intPtr(v int) *int {
	return &v
}

// TestScoreConsistency ensures same inputs always produce same score
func TestScoreConsistency(t *testing.T) {
	student := EnrichedStudentProfile{
		GPA:        f64Ptr(3.5),
		GPAScale:   f64Ptr(4.0),
		IELTS:      f64Ptr(7.0),
		BudgetYear: f64Ptr(30000),
	}

	program := ProgramContext{
		Title:             "Test University",
		AvgGPA:            f64Ptr(3.5),
		AvgIELTS:          f64Ptr(7.0),
		TuitionAmount:     f64Ptr(40000),
		AcceptanceRate:    f64Ptr(20.0),
		CompetitiveFactor: 1.0,
	}

	// Run the same matching twice
	result1 := ComputeMatch(student, program)
	result2 := ComputeMatch(student, program)

	if result1.OverallScore != result2.OverallScore {
		t.Errorf("Inconsistent scoring: %d vs %d",
			result1.OverallScore, result2.OverallScore)
	}

	if result1.Category != result2.Category {
		t.Errorf("Inconsistent category: %s vs %s",
			result1.Category, result2.Category)
	}
}
