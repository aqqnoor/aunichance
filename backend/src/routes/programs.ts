import { Router } from 'express';
import { pool } from '../database/connection.js';

const router = Router();

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const programQuery = `
      SELECT 
        p.*,
        u.name as university_name,
        u.city,
        u.country_id,
        c.name as country_name,
        c.code as country_code,
        req.*
      FROM programs p
      INNER JOIN universities u ON p.university_id = u.id
      INNER JOIN countries c ON u.country_id = c.id
      LEFT JOIN requirements req ON req.program_id = p.id
      WHERE p.id = $1
    `;
    
    const programResult = await pool.query(programQuery, [id]);
    
    if (programResult.rows.length === 0) {
      res.status(404).json({ error: 'Program not found' });
      return;
    }
    
    const program = programResult.rows[0];
    
    // Get deadlines
    const deadlinesQuery = `
      SELECT * FROM deadlines
      WHERE program_id = $1
      ORDER BY deadline_date
    `;
    const deadlinesResult = await pool.query(deadlinesQuery, [id]);
    
    // Get scholarships
    const scholarshipsQuery = `
      SELECT * FROM scholarships
      WHERE program_id = $1
      ORDER BY application_deadline NULLS LAST
    `;
    const scholarshipsResult = await pool.query(scholarshipsQuery, [id]);
    
    // Get admission stats
    const statsQuery = `
      SELECT * FROM admission_stats
      WHERE program_id = $1
      ORDER BY year DESC
      LIMIT 5
    `;
    const statsResult = await pool.query(statsQuery, [id]);
    
    res.json({
      ...program,
      deadlines: deadlinesResult.rows,
      scholarships: scholarshipsResult.rows,
      admission_stats: statsResult.rows,
    });
  } catch (error) {
    console.error('Error fetching program:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export { router as programsRouter };