import { pool } from '../database/connection.js';

interface PredictionInput {
  program_id: number;
  gpa: number;
  gpa_scale: '4.0' | '5.0' | '100';
  english_test?: 'IELTS' | 'TOEFL';
  english_score?: number;
  sat_score?: number;
  act_score?: number;
  gre_score?: number;
  gmat_score?: number;
  has_portfolio: boolean;
  work_experience_years: number;
  achievements_count: number;
}

interface PredictionResult {
  probability: number;
  category: 'reach' | 'target' | 'safety';
  factors: Array<{ name: string; impact: number; description: string }>;
  recommendations: string[];
}

/**
 * Normalize GPA to 4.0 scale
 */
function normalizeGPA(gpa: number, scale: '4.0' | '5.0' | '100'): number {
  if (scale === '4.0') return gpa;
  if (scale === '5.0') return (gpa / 5.0) * 4.0;
  if (scale === '100') {
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
 * Logistic regression-based admission chance prediction
 * Uses historical data when available, falls back to rule-based approach
 */
export async function calculateAdmissionChance(input: PredictionInput): Promise<PredictionResult> {
  // Get program requirements and historical stats
  const programQuery = `
    SELECT 
      p.*,
      req.*,
      u.name as university_name,
      u.qs_ranking,
      u.the_ranking,
      (
        SELECT AVG(acceptance_rate)
        FROM admission_stats
        WHERE program_id = p.id
        AND year >= EXTRACT(YEAR FROM CURRENT_DATE) - 3
      ) as avg_acceptance_rate,
      (
        SELECT AVG(avg_gpa)
        FROM admission_stats
        WHERE program_id = p.id
        AND year >= EXTRACT(YEAR FROM CURRENT_DATE) - 3
      ) as historical_avg_gpa,
      (
        SELECT AVG(avg_ielts)
        FROM admission_stats
        WHERE program_id = p.id
        AND year >= EXTRACT(YEAR FROM CURRENT_DATE) - 3
      ) as historical_avg_ielts
    FROM programs p
    INNER JOIN universities u ON p.university_id = u.id
    LEFT JOIN requirements req ON req.program_id = p.id
    WHERE p.id = $1
  `;

  const programResult = await pool.query(programQuery, [input.program_id]);
  
  if (programResult.rows.length === 0) {
    throw new Error('Program not found');
  }

  const program = programResult.rows[0];
  const normalizedGPA = normalizeGPA(input.gpa, input.gpa_scale);
  
  // Feature extraction
  const features: { [key: string]: number } = {};
  const factors: Array<{ name: string; impact: number; description: string }> = [];
  const recommendations: string[] = [];

  // GPA feature (0-1 normalized)
  const gpaScore = normalizedGPA / 4.0;
  features.gpa = gpaScore;
  
  if (program.min_gpa) {
    const gpaDiff = normalizedGPA - program.min_gpa;
    if (gpaDiff >= 0.3) {
      factors.push({ name: 'GPA', impact: 0.25, description: `Отличный GPA (${normalizedGPA.toFixed(2)}) значительно выше требований` });
    } else if (gpaDiff >= 0) {
      factors.push({ name: 'GPA', impact: 0.15, description: `GPA (${normalizedGPA.toFixed(2)}) соответствует требованиям` });
    } else {
      factors.push({ name: 'GPA', impact: -0.2, description: `GPA (${normalizedGPA.toFixed(2)}) ниже требований (${program.min_gpa})` });
      recommendations.push(`Повысьте GPA до минимум ${program.min_gpa}`);
    }
  }

  // English test feature
  if (input.english_test && input.english_score !== undefined) {
    if (input.english_test === 'IELTS') {
      const ieltsScore = input.english_score / 9.0;
      features.ielts = ieltsScore;
      
      if (program.min_ielts) {
        const ieltsDiff = input.english_score - program.min_ielts;
        if (ieltsDiff >= 1.0) {
          factors.push({ name: 'IELTS', impact: 0.2, description: `Отличный результат IELTS (${input.english_score})` });
        } else if (ieltsDiff >= 0) {
          factors.push({ name: 'IELTS', impact: 0.1, description: `IELTS (${input.english_score}) соответствует требованиям` });
        } else {
          factors.push({ name: 'IELTS', impact: -0.25, description: `IELTS (${input.english_score}) ниже требований (${program.min_ielts})` });
          recommendations.push(`Улучшите IELTS до минимум ${program.min_ielts}`);
        }
      }
    } else if (input.english_test === 'TOEFL') {
      if (program.min_toefl) {
        const toeflScore = input.english_score / 120.0;
        features.toefl = toeflScore;
        
        const toeflDiff = input.english_score - program.min_toefl;
        if (toeflDiff >= 20) {
          factors.push({ name: 'TOEFL', impact: 0.2, description: `Отличный результат TOEFL (${input.english_score})` });
        } else if (toeflDiff >= 0) {
          factors.push({ name: 'TOEFL', impact: 0.1, description: `TOEFL (${input.english_score}) соответствует требованиям` });
        } else {
          factors.push({ name: 'TOEFL', impact: -0.25, description: `TOEFL (${input.english_score}) ниже требований (${program.min_toefl})` });
          recommendations.push(`Улучшите TOEFL до минимум ${program.min_toefl}`);
        }
      } else {
        factors.push({ name: 'TOEFL', impact: -0.15, description: 'Университет не принимает TOEFL' });
        recommendations.push(`Для этого университета требуется IELTS (минимум ${program.min_ielts})`);
      }
    }
  } else {
    factors.push({ name: 'English Test', impact: -0.2, description: 'Не указан результат языкового теста' });
    recommendations.push('Сдайте IELTS или TOEFL для подтверждения уровня английского');
  }

  // Standardized tests
  if (program.requires_sat && input.sat_score) {
    const satScore = input.sat_score / 1600.0;
    features.sat = satScore;
    if (program.min_sat && input.sat_score >= program.min_sat) {
      factors.push({ name: 'SAT', impact: 0.1, description: `Хороший результат SAT (${input.sat_score})` });
    } else {
      factors.push({ name: 'SAT', impact: -0.1, description: `SAT (${input.sat_score}) ниже рекомендуемого` });
    }
  }

  if (program.requires_gre && input.gre_score) {
    const greScore = input.gre_score / 340.0;
    features.gre = greScore;
    if (program.min_gre && input.gre_score >= program.min_gre) {
      factors.push({ name: 'GRE', impact: 0.1, description: `Хороший результат GRE (${input.gre_score})` });
    } else {
      factors.push({ name: 'GRE', impact: -0.1, description: `GRE (${input.gre_score}) ниже рекомендуемого` });
    }
  }

  // Portfolio and achievements
  if (program.portfolio_required && input.has_portfolio) {
    features.portfolio = 1;
    factors.push({ name: 'Portfolio', impact: 0.05, description: 'Портфолио предоставлено' });
  } else if (program.portfolio_required && !input.has_portfolio) {
    features.portfolio = 0;
    factors.push({ name: 'Portfolio', impact: -0.1, description: 'Требуется портфолио' });
    recommendations.push('Подготовьте портфолио для подачи заявки');
  }

  if (input.achievements_count > 0) {
    features.achievements = Math.min(input.achievements_count / 5.0, 1.0);
    factors.push({ name: 'Achievements', impact: 0.05 * Math.min(input.achievements_count, 5), description: `Внеклассные достижения (${input.achievements_count})` });
  }

  if (input.work_experience_years > 0) {
    features.experience = Math.min(input.work_experience_years / 5.0, 1.0);
    factors.push({ name: 'Experience', impact: 0.05 * Math.min(input.work_experience_years, 5), description: `Опыт работы (${input.work_experience_years} лет)` });
  }

  // University ranking impact
  let rankingImpact = 0;
  if (program.qs_ranking) {
    if (program.qs_ranking <= 50) rankingImpact = -0.15;
    else if (program.qs_ranking <= 100) rankingImpact = -0.1;
    else if (program.qs_ranking <= 200) rankingImpact = -0.05;
  }
  if (rankingImpact !== 0) {
    factors.push({ name: 'University Ranking', impact: rankingImpact, description: `Высокий рейтинг университета (QS: ${program.qs_ranking})` });
  }

  // Historical acceptance rate adjustment
  let baseProbability = 0.5;
  if (program.avg_acceptance_rate) {
    baseProbability = program.avg_acceptance_rate / 100.0;
  }

  // Logistic regression-like calculation
  // Using weighted sum of features
  let logit = 0;
  logit += features.gpa * 2.0; // GPA weight
  logit += (features.ielts || features.toefl || 0) * 1.5; // English weight
  logit += (features.sat || features.gre || 0) * 1.0; // Test weight
  logit += (features.portfolio || 0) * 0.5;
  logit += (features.achievements || 0) * 0.5;
  logit += (features.experience || 0) * 0.3;
  logit += rankingImpact * 2.0;
  
  // Adjust based on historical acceptance rate
  if (program.avg_acceptance_rate) {
    logit += Math.log(program.avg_acceptance_rate / (100 - program.avg_acceptance_rate));
  }

  // Convert to probability using sigmoid
  const probability = 1 / (1 + Math.exp(-logit));
  
  // Normalize to 0-100 range
  let finalProbability = Math.max(0, Math.min(100, probability * 100));
  
  // Adjust based on historical data if available
  if (program.historical_avg_gpa && normalizedGPA < program.historical_avg_gpa - 0.3) {
    finalProbability *= 0.7;
  } else if (program.historical_avg_gpa && normalizedGPA > program.historical_avg_gpa + 0.3) {
    finalProbability *= 1.2;
    finalProbability = Math.min(100, finalProbability);
  }

  // Determine category
  let category: 'reach' | 'target' | 'safety';
  if (finalProbability < 30) {
    category = 'reach';
  } else if (finalProbability < 80) {
    category = 'target';
  } else {
    category = 'safety';
  }

  return {
    probability: Math.round(finalProbability),
    category,
    factors,
    recommendations,
  };
}