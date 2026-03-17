package scoring

func CalculateChance(
	userGPA float64,
	userIELTS float64,
	requiredGPA float64,
	requiredIELTS float64,
) ChanceResult {
	score := 0

	// GPA contributes 50 points
	if requiredGPA > 0 {
		gpaRatio := userGPA / requiredGPA
		if gpaRatio >= 1.0 {
			score += 50
		} else {
			score += int(gpaRatio * 50)
		}
	}

	// IELTS contributes 50 points
	if requiredIELTS > 0 {
		ieltsRatio := userIELTS / requiredIELTS
		if ieltsRatio >= 1.0 {
			score += 50
		} else {
			score += int(ieltsRatio * 50)
		}
	}

	if score > 100 {
		score = 100
	}
	if score < 0 {
		score = 0
	}

	category := "reach"
	if score >= 70 {
		category = "safety"
	} else if score >= 40 {
		category = "target"
	}

	reasons, recommendations := buildRecommendations(
		userGPA,
		userIELTS,
		requiredGPA,
		requiredIELTS,
	)

	return ChanceResult{
		Score:           score,
		Category:        category,
		Reasons:         reasons,
		Recommendations: recommendations,
	}
}
