package scoring

import "fmt"

func buildRecommendations(
	userGPA float64,
	userIELTS float64,
	requiredGPA float64,
	requiredIELTS float64,
) ([]string, []string) {
	var reasons []string
	var recommendations []string

	// GPA analysis
	if userGPA < requiredGPA {
		diff := requiredGPA - userGPA
		reasons = append(reasons, "GPA ниже требуемого уровня")
		recommendations = append(
			recommendations,
			fmt.Sprintf("Поднять GPA минимум до %.1f", requiredGPA),
		)

		if diff >= 0.3 {
			recommendations = append(
				recommendations,
				"Сконцентрироваться на улучшении академического профиля и оценок по профильным предметам",
			)
		}
	} else {
		reasons = append(reasons, "GPA соответствует или превышает требуемый уровень")
	}

	// IELTS analysis
	if userIELTS < requiredIELTS {
		diff := requiredIELTS - userIELTS
		reasons = append(reasons, "IELTS ниже минимального требования")
		recommendations = append(
			recommendations,
			fmt.Sprintf("Поднять IELTS минимум до %.1f", requiredIELTS),
		)

		if diff >= 0.5 {
			recommendations = append(
				recommendations,
				"Уделить внимание академическому английскому и тренировке writing/speaking",
			)
		}
	} else {
		reasons = append(reasons, "IELTS соответствует минимальному уровню")
	}

	// General strategic advice
	if userGPA >= requiredGPA && userIELTS >= requiredIELTS {
		recommendations = append(
			recommendations,
			"Профиль соответствует базовым требованиям. Рекомендуется усилить портфолио, мотивационное письмо и extracurricular activities",
		)
	}

	if len(recommendations) == 0 {
		recommendations = append(recommendations, "Профиль выглядит конкурентоспособным для данной программы")
	}

	return reasons, recommendations
}
