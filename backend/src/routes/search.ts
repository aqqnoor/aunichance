import { Router } from 'express';
import { pool } from '../database/connection.js';
import { z } from 'zod';

const router = Router();

const searchSchema = z.object({
  query: z.string().optional(),
  country: z.string().optional(),
  city: z.string().optional(),
  region: z.string().optional(),
  field_of_study: z.string().optional(),
  degree_level: z.enum(['Bachelor', 'Master', 'PhD', 'Certificate']).optional(),
  language: z.string().optional(),
  min_tuition: z.number().optional(),
  max_tuition: z.number().optional(),
  has_scholarship: z.boolean().optional(),
  deadline_before: z.string().optional(), // ISO date string
  min_acceptance_rate: z.number().optional(),
  max_acceptance_rate: z.number().optional(),
  limit: z.number().min(1).max(100).default(20),
  offset: z.number().min(0).default(0),
});

router.get('/', async (req, res) => {
  try {
    const params = searchSchema.parse({
      ...req.query,
      min_tuition: req.query.min_tuition ? Number(req.query.min_tuition) : undefined,
      max_tuition: req.query.max_tuition ? Number(req.query.max_tuition) : undefined,
      has_scholarship: req.query.has_scholarship === 'true',
      min_acceptance_rate: req.query.min_acceptance_rate ? Number(req.query.min_acceptance_rate) : undefined,
      max_acceptance_rate: req.query.max_acceptance_rate ? Number(req.query.max_acceptance_rate) : undefined,
      limit: req.query.limit ? Number(req.query.limit) : 20,
      offset: req.query.offset ? Number(req.query.offset) : 0,
    });

    let query = `
      SELECT DISTINCT
        p.id,
        p.name as program_name,
        p.degree_level,
        p.field_of_study,
        p.language,
        p.tuition_fee,
        p.tuition_currency,
        p.duration_years,
        p.description,
        u.id as university_id,
        u.name as university_name,
        u.city,
        u.country_id,
        c.name as country_name,
        c.code as country_code,
        u.qs_ranking,
        u.the_ranking,
        u.logo_url,
        req.min_gpa,
        req.min_ielts,
        req.min_toefl,
        COALESCE((
          SELECT COUNT(*) > 0 
          FROM scholarships s 
          WHERE s.program_id = p.id OR s.university_id = u.id
        ), false) as has_scholarship,
        COALESCE((
          SELECT MIN(d.deadline_date)
          FROM deadlines d
          WHERE d.program_id = p.id
        ), NULL) as next_deadline,
        COALESCE((
          SELECT AVG(ad.acceptance_rate)
          FROM admission_stats ad
          WHERE ad.program_id = p.id
          AND ad.year >= EXTRACT(YEAR FROM CURRENT_DATE) - 3
        ), NULL) as avg_acceptance_rate
      FROM programs p
      INNER JOIN universities u ON p.university_id = u.id
      INNER JOIN countries c ON u.country_id = c.id
      LEFT JOIN requirements req ON req.program_id = p.id
      WHERE 1=1
    `;

    const queryParams: any[] = [];
    let paramIndex = 1;

    // Text search
    if (params.query) {
      query += ` AND (
        to_tsvector('english', p.name) @@ plainto_tsquery('english', $${paramIndex}) OR
        to_tsvector('english', u.name) @@ plainto_tsquery('english', $${paramIndex}) OR
        p.name ILIKE $${paramIndex + 1} OR
        u.name ILIKE $${paramIndex + 1}
      )`;
      const searchTerm = `%${params.query}%`;
      queryParams.push(params.query, searchTerm);
      paramIndex += 2;
    }

    // Filters
    if (params.country) {
      query += ` AND c.code = $${paramIndex}`;
      queryParams.push(params.country);
      paramIndex++;
    }

    if (params.city) {
      query += ` AND u.city ILIKE $${paramIndex}`;
      queryParams.push(`%${params.city}%`);
      paramIndex++;
    }

    if (params.region) {
      query += ` AND u.region = $${paramIndex}`;
      queryParams.push(params.region);
      paramIndex++;
    }

    if (params.field_of_study) {
      query += ` AND p.field_of_study ILIKE $${paramIndex}`;
      queryParams.push(`%${params.field_of_study}%`);
      paramIndex++;
    }

    if (params.degree_level) {
      query += ` AND p.degree_level = $${paramIndex}`;
      queryParams.push(params.degree_level);
      paramIndex++;
    }

    if (params.language) {
      query += ` AND p.language = $${paramIndex}`;
      queryParams.push(params.language);
      paramIndex++;
    }

    if (params.min_tuition !== undefined) {
      query += ` AND (p.tuition_fee IS NULL OR p.tuition_fee >= $${paramIndex})`;
      queryParams.push(params.min_tuition);
      paramIndex++;
    }

    if (params.max_tuition !== undefined) {
      query += ` AND (p.tuition_fee IS NULL OR p.tuition_fee <= $${paramIndex})`;
      queryParams.push(params.max_tuition);
      paramIndex++;
    }

    if (params.has_scholarship) {
      query += ` AND EXISTS (
        SELECT 1 FROM scholarships s 
        WHERE (s.program_id = p.id OR s.university_id = u.id)
      )`;
    }

    if (params.deadline_before) {
      query += ` AND EXISTS (
        SELECT 1 FROM deadlines d
        WHERE d.program_id = p.id
        AND d.deadline_date <= $${paramIndex}
      )`;
      queryParams.push(params.deadline_before);
      paramIndex++;
    }

    // Ordering and pagination
    query += ` ORDER BY u.qs_ranking NULLS LAST, u.the_ranking NULLS LAST, p.name`;
    query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    queryParams.push(params.limit, params.offset);

    const result = await pool.query(query, queryParams);

    // Get total count for pagination
    let countQuery = `
      SELECT COUNT(DISTINCT p.id)
      FROM programs p
      INNER JOIN universities u ON p.university_id = u.id
      INNER JOIN countries c ON u.country_id = c.id
      WHERE 1=1
    `;
    const countParams: any[] = [];
    let countParamIndex = 1;

    // Apply same filters for count
    if (params.query) {
      countQuery += ` AND (
        to_tsvector('english', p.name) @@ plainto_tsquery('english', $${countParamIndex}) OR
        to_tsvector('english', u.name) @@ plainto_tsquery('english', $${countParamIndex}) OR
        p.name ILIKE $${countParamIndex + 1} OR
        u.name ILIKE $${countParamIndex + 1}
      )`;
      const searchTerm = `%${params.query}%`;
      countParams.push(params.query, searchTerm);
      countParamIndex += 2;
    }

    if (params.country) {
      countQuery += ` AND c.code = $${countParamIndex}`;
      countParams.push(params.country);
      countParamIndex++;
    }

    if (params.city) {
      countQuery += ` AND u.city ILIKE $${countParamIndex}`;
      countParams.push(`%${params.city}%`);
      countParamIndex++;
    }

    if (params.region) {
      countQuery += ` AND u.region = $${countParamIndex}`;
      countParams.push(params.region);
      countParamIndex++;
    }

    if (params.field_of_study) {
      countQuery += ` AND p.field_of_study ILIKE $${countParamIndex}`;
      countParams.push(`%${params.field_of_study}%`);
      countParamIndex++;
    }

    if (params.degree_level) {
      countQuery += ` AND p.degree_level = $${countParamIndex}`;
      countParams.push(params.degree_level);
      countParamIndex++;
    }

    if (params.language) {
      countQuery += ` AND p.language = $${countParamIndex}`;
      countParams.push(params.language);
      countParamIndex++;
    }

    if (params.min_tuition !== undefined) {
      countQuery += ` AND (p.tuition_fee IS NULL OR p.tuition_fee >= $${countParamIndex})`;
      countParams.push(params.min_tuition);
      countParamIndex++;
    }

    if (params.max_tuition !== undefined) {
      countQuery += ` AND (p.tuition_fee IS NULL OR p.tuition_fee <= $${countParamIndex})`;
      countParams.push(params.max_tuition);
      countParamIndex++;
    }

    if (params.has_scholarship) {
      countQuery += ` AND EXISTS (
        SELECT 1 FROM scholarships s 
        WHERE (s.program_id = p.id OR s.university_id = u.id)
      )`;
    }

    const countResult = await pool.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].count);

    res.json({
      results: result.rows,
      pagination: {
        total,
        limit: params.limit,
        offset: params.offset,
        hasMore: params.offset + params.limit < total,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid search parameters', details: error.errors });
      return;
    }
    console.error('Search error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export { router as searchRouter };