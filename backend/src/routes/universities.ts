import { Router } from 'express';
import { pool } from '../database/connection.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const { country, region, limit = 50, offset = 0 } = req.query;
    
    let query = `
      SELECT 
        u.*,
        c.name as country_name,
        c.code as country_code,
        COUNT(DISTINCT p.id) as program_count
      FROM universities u
      INNER JOIN countries c ON u.country_id = c.id
      LEFT JOIN programs p ON p.university_id = u.id
      WHERE 1=1
    `;
    
    const params: any[] = [];
    let paramIndex = 1;
    
    if (country) {
      query += ` AND c.code = $${paramIndex}`;
      params.push(country);
      paramIndex++;
    }
    
    if (region) {
      query += ` AND u.region = $${paramIndex}`;
      params.push(region);
      paramIndex++;
    }
    
    query += ` GROUP BY u.id, c.name, c.code`;
    query += ` ORDER BY u.qs_ranking NULLS LAST, u.name`;
    query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(parseInt(limit as string), parseInt(offset as string));
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching universities:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const universityQuery = `
      SELECT 
        u.*,
        c.name as country_name,
        c.code as country_code
      FROM universities u
      INNER JOIN countries c ON u.country_id = c.id
      WHERE u.id = $1
    `;
    
    const universityResult = await pool.query(universityQuery, [id]);
    
    if (universityResult.rows.length === 0) {
      res.status(404).json({ error: 'University not found' });
      return;
    }
    
    const university = universityResult.rows[0];
    
    // Get programs
    const programsQuery = `
      SELECT p.*, req.*
      FROM programs p
      LEFT JOIN requirements req ON req.program_id = p.id
      WHERE p.university_id = $1
      ORDER BY p.degree_level, p.name
    `;
    const programsResult = await pool.query(programsQuery, [id]);
    
    // Get scholarships
    const scholarshipsQuery = `
      SELECT * FROM scholarships
      WHERE university_id = $1
      ORDER BY application_deadline NULLS LAST
    `;
    const scholarshipsResult = await pool.query(scholarshipsQuery, [id]);
    
    // Get average admission stats
    const statsQuery = `
      SELECT 
        AVG(acceptance_rate) as avg_acceptance_rate,
        AVG(avg_gpa) as avg_gpa,
        AVG(avg_ielts) as avg_ielts,
        AVG(avg_toefl) as avg_toefl
      FROM admission_stats ad
      INNER JOIN programs p ON ad.program_id = p.id
      WHERE p.university_id = $1
      AND ad.year >= EXTRACT(YEAR FROM CURRENT_DATE) - 3
    `;
    const statsResult = await pool.query(statsQuery, [id]);
    
    res.json({
      ...university,
      programs: programsResult.rows,
      scholarships: scholarshipsResult.rows,
      admission_stats: statsResult.rows[0] || null,
    });
  } catch (error) {
    console.error('Error fetching university:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export { router as universitiesRouter };