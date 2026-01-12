import { Router } from 'express';
import { pool } from '../database/connection.js';
import { z } from 'zod';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

const reviewSchema = z.object({
  university_id: z.number().int().positive().optional(),
  program_id: z.number().int().positive().optional(),
  rating: z.number().int().min(1).max(5),
  title: z.string().min(1).max(255),
  content: z.string().min(10),
  anonymous: z.boolean().default(true),
});

router.get('/', async (req, res) => {
  try {
    const { university_id, program_id, limit = 20, offset = 0 } = req.query;
    
    let query = `
      SELECT 
        r.*,
        CASE 
          WHEN r.anonymous THEN 'Anonymous'
          ELSE CONCAT(LEFT(u.first_name, 1), '. ', u.last_name)
        END as reviewer_name,
        u.verified_student
      FROM reviews r
      INNER JOIN users u ON r.user_id = u.id
      WHERE 1=1
    `;
    
    const params: any[] = [];
    let paramIndex = 1;
    
    if (university_id) {
      query += ` AND r.university_id = $${paramIndex}`;
      params.push(university_id);
      paramIndex++;
    }
    
    if (program_id) {
      query += ` AND r.program_id = $${paramIndex}`;
      params.push(program_id);
      paramIndex++;
    }
    
    query += ` ORDER BY r.created_at DESC`;
    query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(parseInt(limit as string), parseInt(offset as string));
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching reviews:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', authenticateToken, async (req, res) => {
  try {
    const data = reviewSchema.parse(req.body);
    const userId = (req as any).user.id;
    
    if (!data.university_id && !data.program_id) {
      res.status(400).json({ error: 'Either university_id or program_id is required' });
      return;
    }
    
    const query = `
      INSERT INTO reviews (user_id, university_id, program_id, rating, title, content, anonymous)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;
    
    const result = await pool.query(query, [
      userId,
      data.university_id || null,
      data.program_id || null,
      data.rating,
      data.title,
      data.content,
      data.anonymous,
    ]);
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid review data', details: error.errors });
      return;
    }
    console.error('Error creating review:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export { router as reviewsRouter };