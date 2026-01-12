import { Router } from 'express';
import { z } from 'zod';
import { calculateAdmissionChance } from '../ml/prediction.js';

const router = Router();

const chanceRequestSchema = z.object({
  program_id: z.number().int().positive(),
  gpa: z.number().min(0).max(5),
  gpa_scale: z.enum(['4.0', '5.0', '100']),
  english_test: z.enum(['IELTS', 'TOEFL']).optional(),
  english_score: z.number().optional(),
  sat_score: z.number().optional(),
  act_score: z.number().optional(),
  gre_score: z.number().optional(),
  gmat_score: z.number().optional(),
  has_portfolio: z.boolean().default(false),
  work_experience_years: z.number().min(0).default(0),
  achievements_count: z.number().min(0).default(0),
});

router.post('/calculate', async (req, res) => {
  try {
    const data = chanceRequestSchema.parse(req.body);
    
    const chance = await calculateAdmissionChance(data);
    
    res.json({
      program_id: data.program_id,
      chance: chance.probability,
      category: chance.category,
      factors: chance.factors,
      recommendations: chance.recommendations,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid request data', details: error.errors });
      return;
    }
    console.error('Error calculating chance:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export { router as chancesRouter };