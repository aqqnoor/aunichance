package scoring

import "math"

type Profile struct {
  GPA *float64
  GPAScale *float64
  IELTS *float64
  TOEFL *int
  SAT *int
  BudgetYear *float64
  HasAchievements bool // achievements_summary or awards present
}

type Requirements struct {
  MinGPA *float64
  MinIELTS *float64
  MinTOEFL *int
  MinSAT *int
}

type Breakdown struct {
  GPA int `json:"gpa"`        // 0-40
  Language int `json:"language"` // 0-30
  Tests int `json:"tests"`    // 0-20
  Extras int `json:"extras"`  // 0-10
}

type Result struct {
  Score int `json:"score"`           // 0-100
  Category string `json:"category"`  // "reach" | "target" | "safety"
  Breakdown Breakdown `json:"breakdown"`
  Reasons []string `json:"reasons"`
}

func Compute(p Profile, r Requirements) Result {
  score := 0
  reasons := []string{}
  breakdown := Breakdown{}

  // GPA (0-40 points)
  gpaScore := 0
  if p.GPA != nil && p.GPAScale != nil && *p.GPAScale > 0 {
    gpaNorm := (*p.GPA) / (*p.GPAScale) // 0..1
    gpaScore = int(math.Round(40 * clamp01(gpaNorm)))
    score += gpaScore
    
    if r.MinGPA != nil {
      if *p.GPA < *r.MinGPA {
        reasons = append(reasons, "GPA ниже минимальных требований программы")
      } else if *p.GPA >= *r.MinGPA {
        reasons = append(reasons, "GPA соответствует требованиям программы")
      }
    } else {
      reasons = append(reasons, "GPA соответствует средним показателям")
    }
  } else {
    reasons = append(reasons, "GPA не указан, точность оценки снижена")
  }
  breakdown.GPA = gpaScore

  // Language (0-30 points)
  langScore := 0
  if p.IELTS != nil {
    langScore = int(math.Round(30 * clamp01(*p.IELTS/9.0)))
    score += langScore
    
    if r.MinIELTS != nil {
      if *p.IELTS < *r.MinIELTS {
        reasons = append(reasons, "IELTS ниже среднего по программе")
      } else if *p.IELTS >= *r.MinIELTS {
        reasons = append(reasons, "IELTS соответствует требованиям")
      }
    } else {
      if *p.IELTS >= 7.0 {
        reasons = append(reasons, "Хороший уровень английского (IELTS)")
      } else {
        reasons = append(reasons, "IELTS на среднем уровне")
      }
    }
  } else if p.TOEFL != nil {
    langScore = int(math.Round(30 * clamp01(float64(*p.TOEFL)/120.0)))
    score += langScore
    
    if r.MinTOEFL != nil {
      if *p.TOEFL < *r.MinTOEFL {
        reasons = append(reasons, "TOEFL ниже среднего по программе")
      } else {
        reasons = append(reasons, "TOEFL соответствует требованиям")
      }
    } else {
      if *p.TOEFL >= 100 {
        reasons = append(reasons, "Хороший уровень английского (TOEFL)")
      } else {
        reasons = append(reasons, "TOEFL на среднем уровне")
      }
    }
  } else {
    reasons = append(reasons, "Языковой сертификат не указан (IELTS/TOEFL)")
  }
  breakdown.Language = langScore

  // Tests (0-20 points) - SAT/GRE
  testScore := 0
  if p.SAT != nil {
    testScore = int(math.Round(20 * clamp01(float64(*p.SAT)/1600.0)))
    score += testScore
    
    if r.MinSAT != nil {
      if *p.SAT < *r.MinSAT {
        reasons = append(reasons, "SAT ниже минимальных требований")
      } else {
        reasons = append(reasons, "SAT соответствует требованиям")
      }
    } else {
      if *p.SAT >= 1400 {
        reasons = append(reasons, "Хороший результат SAT")
      } else {
        reasons = append(reasons, "SAT на среднем уровне")
      }
    }
  } else {
    // SAT не обязателен для всех программ, но если требуется - это проблема
    if r.MinSAT != nil {
      reasons = append(reasons, "SAT не указан, но требуется для программы")
    }
  }
  breakdown.Tests = testScore

  // Extras (0-10 points) - achievements, awards
  extraScore := 0
  if p.HasAchievements {
    extraScore = 10
    score += extraScore
    reasons = append(reasons, "Есть дополнительные достижения")
  } else {
    reasons = append(reasons, "Рекомендуется добавить достижения для повышения шансов")
  }
  breakdown.Extras = extraScore

  // Normalize to 0-100
  if score > 100 { score = 100 }
  if score < 0 { score = 0 }

  // Determine category
  // 0-40 → reach, 40-70 → target, 70-100 → safety
  category := "target"
  if score < 40 {
    category = "reach"
  } else if score >= 70 {
    category = "safety"
  }

  return Result{
    Score: score,
    Category: category,
    Breakdown: breakdown,
    Reasons: reasons,
  }
}

func clamp01(x float64) float64 {
  if x < 0 { return 0 }
  if x > 1 { return 1 }
  return x
}
