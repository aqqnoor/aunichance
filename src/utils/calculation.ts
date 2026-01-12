import { StudentProfile, University, AdmissionChance } from '../types';

/**
 * Rule-based formula for calculating admission chances
 * This is a transparent, deterministic approach that can later be replaced with ML
 */
export function calculateAdmissionChance(
  profile: StudentProfile,
  university: University
): AdmissionChance {
  let score = 50; // Base score
  const reasons: string[] = [];
  const recommendations: string[] = [];

  // GPA Analysis (40% weight)
  if (profile.gpa !== undefined) {
    const normalizedGPA = normalizeGPA(profile.gpa, profile.gpaScale || '4.0');
    const gpaDiff = normalizedGPA - university.minGPA;
    
    if (normalizedGPA >= university.avgGPA) {
      score += 20;
      reasons.push(`Ваш GPA (${normalizedGPA.toFixed(2)}) выше среднего для этого университета (${university.avgGPA})`);
    } else if (normalizedGPA >= university.minGPA) {
      score += 10;
      reasons.push(`Ваш GPA (${normalizedGPA.toFixed(2)}) соответствует минимальным требованиям`);
    } else {
      score -= 30;
      reasons.push(`Ваш GPA (${normalizedGPA.toFixed(2)}) ниже минимальных требований (${university.minGPA})`);
      recommendations.push(`Повысьте средний балл до минимум ${university.minGPA} для этого университета`);
    }

    if (normalizedGPA < university.avgGPA - 0.3) {
      score -= 10;
      recommendations.push(`Для повышения шансов рекомендуется GPA не менее ${university.avgGPA}`);
    }
  } else {
    score -= 15;
    recommendations.push('Укажите ваш средний балл (GPA) для более точной оценки');
  }

  // English Test Analysis (25% weight)
  if (profile.englishTest && profile.englishScore !== undefined) {
    const testScore = profile.englishScore;
    
    if (profile.englishTest === 'IELTS') {
      // IELTS analysis
      const minRequired = university.minIELTS;
      const avgScore = university.avgIELTS;
      
      if (testScore >= avgScore) {
        score += 15;
        reasons.push(`Отличный результат IELTS (${testScore}) выше среднего (${avgScore})`);
      } else if (testScore >= minRequired) {
        score += 8;
        reasons.push(`Результат IELTS (${testScore}) соответствует требованиям`);
      } else {
        score -= 25;
        reasons.push(`Результат IELTS (${testScore}) ниже минимальных требований (${minRequired})`);
        recommendations.push(`Необходимо улучшить результат IELTS до минимум ${minRequired}`);
      }
    } else if (profile.englishTest === 'TOEFL') {
      // TOEFL analysis
      // Check if university accepts TOEFL
      if (university.minTOEFL === undefined) {
        // University doesn't accept TOEFL (common for UK/European universities)
        score -= 15;
        reasons.push(`Этот университет не принимает результаты TOEFL, требуется IELTS`);
        recommendations.push(`Для этого университета необходимо сдать IELTS (минимум ${university.minIELTS})`);
      } else {
        const minRequired = university.minTOEFL;
        const avgScore = university.avgTOEFL;
        
        if (avgScore !== undefined && testScore >= avgScore) {
          score += 15;
          reasons.push(`Отличный результат TOEFL (${testScore}) выше среднего (${avgScore})`);
        } else if (testScore >= minRequired) {
          score += 8;
          reasons.push(`Результат TOEFL (${testScore}) соответствует требованиям`);
        } else {
          score -= 25;
          reasons.push(`Результат TOEFL (${testScore}) ниже минимальных требований (${minRequired})`);
          recommendations.push(`Необходимо улучшить результат TOEFL до минимум ${minRequired}`);
        }
      }
    }
  } else {
    score -= 20;
    const acceptsTOEFL = university.minTOEFL !== undefined;
    const testRecommendation = acceptsTOEFL 
      ? (university.minIELTS >= 7 ? 'IELTS или TOEFL' : 'IELTS или TOEFL')
      : 'IELTS';
    recommendations.push(`Сдайте ${testRecommendation} для подтверждения уровня английского`);
  }

  // Standardized Tests (15% weight)
  if (university.requiresSAT && profile.satScore !== undefined) {
    if (profile.satScore >= (university.minSAT || 1400)) {
      score += 10;
      reasons.push(`Хороший результат SAT (${profile.satScore})`);
    } else {
      score -= 10;
      recommendations.push(`Для этого университета рекомендуется SAT не менее ${university.minSAT || 1400}`);
    }
  } else if (university.requiresSAT) {
    score -= 10;
    recommendations.push('Этот университет требует результаты SAT');
  }

  if (university.requiresGRE && profile.greScore !== undefined) {
    if (profile.greScore >= (university.minGRE || 310)) {
      score += 8;
      reasons.push(`Хороший результат GRE (${profile.greScore})`);
    } else {
      score -= 8;
      recommendations.push(`Для магистратуры рекомендуется GRE не менее ${university.minGRE || 310}`);
    }
  }

  // Achievements (10% weight)
  const achievementCount = 
    (profile.olympiads?.length || 0) +
    (profile.sports?.length || 0) +
    (profile.volunteering?.length || 0) +
    (profile.leadership?.length || 0) +
    (profile.otherAchievements?.length || 0);

  if (achievementCount >= 3) {
    score += 10;
    reasons.push(`У вас есть значимые внеклассные достижения (${achievementCount})`);
  } else if (achievementCount >= 1) {
    score += 5;
    reasons.push(`Есть некоторые внеклассные достижения`);
  } else {
    score -= 5;
    recommendations.push('Добавьте внеклассные достижения: олимпиады, волонтерство, спорт или лидерские роли');
  }

  // Competition Level Adjustment (10% weight)
  const competitionMultiplier = {
    'very-high': 0.7,
    'high': 0.85,
    'medium': 1.0,
    'low': 1.15,
  };
  
  score *= competitionMultiplier[university.competition];
  
  if (university.competition === 'very-high') {
    reasons.push(`Высокий конкурс в этом университете (прием ${university.acceptanceRate}%)`);
  }

  // Normalize to 0-100 range
  score = Math.max(0, Math.min(100, score));

  // Determine category
  let category: 'reach' | 'target' | 'safety';
  if (score < 30) {
    category = 'reach';
  } else if (score < 80) {
    category = 'target';
  } else {
    category = 'safety';
  }

  // Add strategic advice
  if (category === 'reach') {
    recommendations.push('Этот университет является амбициозной целью - рассмотрите его как "reach" вариант');
  } else if (category === 'safety') {
    recommendations.push('Хорошие шансы поступления - можно использовать как "safety" вариант');
  }

  return {
    university,
    chance: Math.round(score),
    category,
    reasons,
    recommendations,
  };
}

/**
 * Normalize GPA from different scales to 4.0 scale
 */
function normalizeGPA(gpa: number, scale: '4.0' | '5.0' | '100'): number {
  if (scale === '4.0') {
    return gpa;
  } else if (scale === '5.0') {
    // Convert 5.0 to 4.0: 5.0 -> 4.0, 4.0 -> 3.0, etc.
    return (gpa / 5.0) * 4.0;
  } else if (scale === '100') {
    // Convert percentage to 4.0 scale
    if (gpa >= 97) return 4.0;
    if (gpa >= 93) return 3.9;
    if (gpa >= 90) return 3.7;
    if (gpa >= 87) return 3.3;
    if (gpa >= 83) return 3.0;
    if (gpa >= 80) return 2.7;
    if (gpa >= 77) return 2.3;
    if (gpa >= 73) return 2.0;
    if (gpa >= 70) return 1.7;
    return 1.0;
  }
  return gpa;
}

/**
 * Filter universities based on profile preferences
 */
export function filterUniversities(
  universities: University[],
  profile: StudentProfile
): University[] {
  let filtered = [...universities];

  // Filter by region/country
  if (profile.preferredRegions && profile.preferredRegions.length > 0) {
    filtered = filtered.filter(u => 
      profile.preferredRegions!.includes(u.region)
    );
  }
  
  if (profile.preferredCountries && profile.preferredCountries.length > 0) {
    filtered = filtered.filter(u => 
      profile.preferredCountries!.includes(u.country)
    );
  }

  // Filter by fields
  if (profile.preferredFields && profile.preferredFields.length > 0) {
    filtered = filtered.filter(u => 
      u.fields.some(field => 
        profile.preferredFields!.some(pf => 
          field.toLowerCase().includes(pf.toLowerCase())
        )
      )
    );
  }

  // Filter by budget
  if (profile.budget === 'scholarship') {
    filtered = filtered.filter(u => u.scholarshipAvailable);
  }

  return filtered;
}

/**
 * Calculate chances for multiple universities
 */
export function calculateChancesForUniversities(
  profile: StudentProfile,
  universities: University[]
): AdmissionChance[] {
  const filtered = filterUniversities(universities, profile);
  
  return filtered
    .map(uni => calculateAdmissionChance(profile, uni))
    .sort((a, b) => b.chance - a.chance);
}