package scoring

import (
	"math"
)

// ProgramContext contains all information needed to evaluate a program for a student
type ProgramContext struct {
	ID                   string
	UniversityID         string
	UniversityName       string
	CountryCode          string
	Title                string
	DegreeLevel          string
	Field                string
	TuitionAmount        *float64
	TuitionCurrency      *string
	HasScholarship       bool
	CompetitiveFactor    float64 // 0.8 - 1.4
	AcceptanceRate       *float64
	AvgGPA               *float64
	AvgIELTS             *float64
	AvgTOEFL             *int
	AvgSAT               *int
	ScholarshipCoverages []float64 // e.g., [50, 100] for partial and full
	EligibleCitizenships []string  // e.g., ["KZ", "RU"] or empty for all
	RequiresPortfolio    bool
	MinWorkExperienceYrs *int
}

// EnrichedStudentProfile extends basic Profile with additional context
type EnrichedStudentProfile struct {
	GPA            *float64
	GPAScale       *float64
	IELTS          *float64
	TOEFL          *int
	SAT            *int
	BudgetYear     *float64
	BudgetCurrency *string
	Citizenship    string // Country code, e.g., "KZ"
	GraduationYear *int   // For timeline validation
	Achievements   struct {
		Olympiads    int // Weight: 3x
		Leadership   int // Weight: 2x
		Sports       int // Weight: 1.5x
		Volunteering int // Weight: 1x
		Other        int // Weight: 1x
	}
}

// MatchScore is the output of program-student matching
type MatchScore struct {
	// Individual component scores
	AcademicScore    int // 0-40: GPA + language + tests
	CompetitiveScore int // 0-30: acceptance rate vs student performance
	FinancialScore   int // 0-20: budget coverage percentage
	SpecialScore     int // 0-10: achievements weighted
	BreakdownScore   *Breakdown

	// Overall evaluation
	OverallScore int    // 0-100
	Category     string // "impossible" | "reach" | "target" | "safety"

	// Recommendations for improvement
	ImprovementPath struct {
		TargetScore         int      // e.g., 70 for safety
		CurrentScore        int      // Current overall score
		GapPoints           int      // Points needed
		RecommendedGPA      *float64 // If applicable
		RecommendedSAT      *int     // If applicable
		GpaImpactPercent    int      // +X% if GPA improved
		SatImpactPercent    int      // +X% if SAT added
		AchievImpactPercent int      // +X% if achievements added
		Next3Steps          []string // e.g., ["Raise GPA by 0.3", "Add SAT score"]
	}

	// Context for user understanding
	Reasons []string // "Why this score"
	Advice  string   // Actionable advice

	// Financial details
	FinancialStatus struct {
		CoveredByBudget         bool
		AnnualCostUSD           float64
		BudgetUSD               float64
		ShortfallUSD            float64
		BestScholarshipCoverage *float64
		NeedsScholarship        bool
	}
}

// Step in improvement path
type Next3Steps struct {
	Action       string
	ImpactPoints int
}

// Compute performs intelligent matching of student to program
func ComputeMatch(student EnrichedStudentProfile, program ProgramContext) MatchScore {
	score := 0
	reasons := []string{}

	// ===== PHASE 1: IMPOSSIBLE FILTER =====
	if student.GPA != nil && student.GPAScale != nil && *student.GPAScale > 0 {
		normalizedGPA := (*student.GPA) / (*student.GPAScale)
		if program.AvgGPA != nil && normalizedGPA < (*program.AvgGPA-0.5) {
			// Can still try, but very unlikely
		}
	}

	// Citizenship check for country-specific scholarships
	if program.HasScholarship && len(program.EligibleCitizenships) > 0 {
		found := false
		for _, code := range program.EligibleCitizenships {
			if code == student.Citizenship {
				found = true
				break
			}
		}
		if !found {
			reasons = append(reasons, "Стипендия доступна только для определённых стран")
		}
	}

	breakdown := Breakdown{}

	// ===== PHASE 2: ACADEMIC MATCHING (0-40 points) =====
	academicScore := 0

	// GPA component (0-25 points)
	if student.GPA != nil && student.GPAScale != nil && *student.GPAScale > 0 {
		normalizedGPA := (*student.GPA) / (*student.GPAScale)
		var gpaScore int

		if program.AvgGPA != nil {
			avgGPA := *program.AvgGPA
			if normalizedGPA >= avgGPA+0.1 {
				gpaScore = 25
				reasons = append(reasons, "GPA выше средней по программе")
			} else if normalizedGPA >= avgGPA {
				gpaScore = 20
				reasons = append(reasons, "GPA соответствует среднему показателю")
			} else if normalizedGPA >= avgGPA-0.3 {
				gpaScore = 12
				reasons = append(reasons, "GPA ниже среднего, но близко")
			} else {
				gpaScore = int(math.Max(0, float64(normalizedGPA/avgGPA*20)))
				reasons = append(reasons, "GPA существенно ниже требуемого")
			}
		} else {
			// No reference data, use normalized 0-25
			gpaScore = int(math.Round(25 * clamp01(normalizedGPA)))
		}

		academicScore += gpaScore
		breakdown.GPA = gpaScore
	} else {
		breakdown.GPA = 0
		reasons = append(reasons, "GPA не указан, точность оценки снижена")
	}

	// Language component (0-20 points)
	langScore := 0
	if student.IELTS != nil {
		if program.AvgIELTS != nil {
			avgIELTS := *program.AvgIELTS
			if *student.IELTS >= avgIELTS+0.5 {
				langScore = 20
				reasons = append(reasons, "IELTS выше среднего показателя")
			} else if *student.IELTS >= avgIELTS {
				langScore = 16
				reasons = append(reasons, "IELTS соответствует требованиям")
			} else if *student.IELTS >= avgIELTS-0.5 {
				langScore = 10
				reasons = append(reasons, "IELTS ниже среднего, но близко")
			} else {
				langScore = int(math.Max(0, (*student.IELTS/avgIELTS)*10))
				reasons = append(reasons, "IELTS значительно ниже требуемого")
			}
		} else {
			langScore = int(math.Round(20 * clamp01(*student.IELTS/9.0)))
		}
	} else if student.TOEFL != nil {
		if program.AvgTOEFL != nil {
			avgTOEFL := *program.AvgTOEFL
			if *student.TOEFL >= avgTOEFL+10 {
				langScore = 20
				reasons = append(reasons, "TOEFL выше среднего показателя")
			} else if *student.TOEFL >= avgTOEFL {
				langScore = 16
				reasons = append(reasons, "TOEFL соответствует требованиям")
			} else if *student.TOEFL >= avgTOEFL-10 {
				langScore = 10
				reasons = append(reasons, "TOEFL ниже среднего, но близко")
			} else {
				langScore = int(math.Max(0, (float64(*student.TOEFL)/float64(avgTOEFL))*10))
				reasons = append(reasons, "TOEFL значительно ниже требуемого")
			}
		} else {
			langScore = int(math.Round(20 * clamp01(float64(*student.TOEFL)/120.0)))
		}
	} else {
		reasons = append(reasons, "Языковой тест не указан (IELTS/TOEFL)")
	}
	academicScore += langScore
	breakdown.Language = langScore

	// Standardized tests component (0-15 points - SAT/GRE)
	testScore := 0
	if student.SAT != nil {
		if program.AvgSAT != nil {
			avgSAT := *program.AvgSAT
			if *student.SAT >= avgSAT+100 {
				testScore = 15
				reasons = append(reasons, "SAT выше среднего показателя")
			} else if *student.SAT >= avgSAT {
				testScore = 12
				reasons = append(reasons, "SAT соответствует требованиям")
			} else if *student.SAT >= avgSAT-100 {
				testScore = 7
				reasons = append(reasons, "SAT ниже среднего, но близко")
			} else {
				testScore = int(math.Max(0, (float64(*student.SAT)/float64(avgSAT))*7))
				reasons = append(reasons, "SAT значительно ниже требуемого")
			}
		} else {
			testScore = int(math.Round(15 * clamp01(float64(*student.SAT)/1600.0)))
		}
	}
	academicScore += testScore
	breakdown.Tests = testScore

	// ===== PHASE 3: COMPETITIVE SCORING (0-30 points) =====
	competitiveScore := 0

	if program.AcceptanceRate != nil && program.AvgGPA != nil && student.GPA != nil && student.GPAScale != nil {
		acceptanceRate := *program.AcceptanceRate
		normalizedStudentGPA := (*student.GPA) / (*student.GPAScale)
		avgCompetitorGPA := *program.AvgGPA

		// Calculate how student ranks vs average admitted
		studentVsAvg := (normalizedStudentGPA - avgCompetitorGPA) / avgCompetitorGPA

		// Adjust based on competition level
		competitionMultiplier := program.CompetitiveFactor // 0.8 - 1.4

		if studentVsAvg >= 0.1 {
			// Student is above average
			competitiveScore = int(30 * (1 - (acceptanceRate / 100.0)) * 1.2 / competitionMultiplier)
		} else if studentVsAvg >= 0 {
			// Student is at average
			competitiveScore = int(30 * (1 - (acceptanceRate / 100.0)) / competitionMultiplier)
		} else if studentVsAvg >= -0.1 {
			// Student is slightly below
			competitiveScore = int(30 * (1 - (acceptanceRate / 100.0)) * 0.7 / competitionMultiplier)
		} else {
			// Student is well below average
			competitiveScore = int(30 * (1 - (acceptanceRate / 100.0)) * 0.3 / competitionMultiplier)
		}

		if acceptanceRate > 30 {
			reasons = append(reasons, "Низкий уровень конкуренции при поступлении")
		} else if acceptanceRate > 10 {
			reasons = append(reasons, "Средний уровень конкуренции")
		} else {
			reasons = append(reasons, "Высокий уровень конкуренции")
		}
	} else {
		competitiveScore = 15 // Default middle value
	}
	competitiveScore = int(math.Max(0, math.Min(30, float64(competitiveScore))))

	// ===== PHASE 4: FINANCIAL SCORING (0-20 points) =====
	financialScore := 0
	financialStatus := struct {
		CoveredByBudget         bool
		AnnualCostUSD           float64
		BudgetUSD               float64
		ShortfallUSD            float64
		BestScholarshipCoverage *float64
		NeedsScholarship        bool
	}{}

	if program.TuitionAmount != nil && student.BudgetYear != nil {
		annualCost := *program.TuitionAmount
		budget := *student.BudgetYear

		// Simple budget coverage percentage
		coverage := budget / annualCost
		financialScore = int(math.Round(20 * clamp01(coverage)))

		if coverage >= 1.0 {
			financialScore = 20
			reasons = append(reasons, "Бюджет полностью покрывает обучение")
			financialStatus.CoveredByBudget = true
		} else if coverage >= 0.7 {
			financialScore = 14
			reasons = append(reasons, "Бюджет покрывает основную часть, возможен кредит")
		} else if program.HasScholarship && len(program.ScholarshipCoverages) > 0 {
			maxCoverage := program.ScholarshipCoverages[len(program.ScholarshipCoverages)-1]
			scholarshipAmount := annualCost * (maxCoverage / 100.0)
			totalAvailable := budget + scholarshipAmount
			if totalAvailable >= annualCost*0.8 {
				financialScore = 16
				reasons = append(reasons, "Стипендия + бюджет могут покрыть обучение")
				financialStatus.BestScholarshipCoverage = &maxCoverage
				financialStatus.NeedsScholarship = true
			} else {
				financialScore = 6
				reasons = append(reasons, "Даже со стипендией требуется дополнительное финансирование")
				financialStatus.NeedsScholarship = true
			}
		} else {
			financialScore = 6
			reasons = append(reasons, "Бюджет недостаточен для обучения")
		}

		financialStatus.AnnualCostUSD = annualCost
		financialStatus.BudgetUSD = budget
		if coverage < 1.0 {
			financialStatus.ShortfallUSD = annualCost - budget
		}
	} else if program.HasScholarship {
		financialScore = 12
		reasons = append(reasons, "Программа предоставляет стипендии")
		financialStatus.NeedsScholarship = true
	}

	// ===== PHASE 5: SPECIAL FACTORS (0-10 points) =====
	extraScore := 0

	// Calculate weighted achievements
	achievementWeight := student.Achievements.Olympiads*3 +
		student.Achievements.Leadership*2 +
		student.Achievements.Sports + int(float64(student.Achievements.Volunteering)*0.8) +
		student.Achievements.Other

	if achievementWeight >= 5 {
		extraScore = 10
		reasons = append(reasons, "Сильный набор достижений (олимпиады, лидерство, спорт)")
	} else if achievementWeight >= 3 {
		extraScore = 7
		reasons = append(reasons, "Хороший набор достижений")
	} else if achievementWeight >= 1 {
		extraScore = 4
		reasons = append(reasons, "Есть достижения, можно добавить")
	} else {
		extraScore = 0
		reasons = append(reasons, "Рекомендуется добавить достижения для повышения шансов")
	}

	breakdown.Extras = extraScore

	// ===== PHASE 6: OVERALL CALCULATION =====
	score = academicScore + competitiveScore + financialScore + extraScore
	if score > 100 {
		score = 100
	}
	if score < 0 {
		score = 0
	}

	// Categorize
	category := "target"
	if score >= 70 {
		category = "safety"
	} else if score < 40 {
		category = "reach"
	}

	// ===== PHASE 7: RECOMMENDATIONS =====
	improvementPath := struct {
		TargetScore         int
		CurrentScore        int
		GapPoints           int
		RecommendedGPA      *float64
		RecommendedSAT      *int
		GpaImpactPercent    int
		SatImpactPercent    int
		AchievImpactPercent int
		Next3Steps          []string
	}{
		TargetScore:  70, // Default: aim for safety
		CurrentScore: score,
		Next3Steps:   []string{},
	}

	if score < 70 {
		improvementPath.GapPoints = 70 - score

		// GPA improvement
		if student.GPA != nil && student.GPAScale != nil && program.AvgGPA != nil {
			delta := *program.AvgGPA - (*student.GPA)/(*student.GPAScale)
			if delta > 0 && delta <= 0.5 {
				improvementPath.RecommendedGPA = program.AvgGPA
				improvementPath.GpaImpactPercent = int(delta * 30) // Each 0.1 = 3%
				improvementPath.Next3Steps = append(improvementPath.Next3Steps,
					"Повысить GPA на +0."+string(rune(int(delta*10))))
			}
		}

		// SAT improvement
		if student.SAT == nil && program.AvgSAT != nil {
			improvementPath.RecommendedSAT = program.AvgSAT
			improvementPath.SatImpactPercent = 15
			improvementPath.Next3Steps = append(improvementPath.Next3Steps,
				"Сдать SAT (средний показатель в программе увеличит шансы на +15%)")
		}

		// Achievements
		if achievementWeight < 3 {
			improvementPath.AchievImpactPercent = 8
			improvementPath.Next3Steps = append(improvementPath.Next3Steps,
				"Добавить 2-3 достижения (олимпиада, лидерство, спорт) = +8-10%")
		}
	}

	// ===== CONSTRUCT ADVICE =====
	advice := ""
	if score >= 70 {
		advice = "Хороший шанс поступления. Подавайте заявку!"
	} else if score >= 40 {
		advice = "Реалистичный вариант. Есть вероятность поступления. " +
			"Убедитесь, что ваш профиль полный и все документы в порядке."
	} else if score >= 20 {
		advice = "Сложный вариант, но не невозможен. "
		if len(improvementPath.Next3Steps) > 0 {
			advice += "Рекомендуется: " + improvementPath.Next3Steps[0] + " Можно попробовать."
		}
	} else {
		advice = "Очень сложный вариант. Рекомендуется сосредоточиться на других программах."
	}

	return MatchScore{
		AcademicScore:    academicScore,
		CompetitiveScore: competitiveScore,
		FinancialScore:   financialScore,
		SpecialScore:     extraScore,
		OverallScore:     score,
		Category:         category,
		BreakdownScore:   &breakdown,
		Reasons:          reasons,
		Advice:           advice,
		FinancialStatus:  financialStatus,
		ImprovementPath:  improvementPath,
	}
}
