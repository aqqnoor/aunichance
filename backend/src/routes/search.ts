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
  sort: z.enum(['relevance', 'ranking', 'name']).default('relevance'),
  limit: z.number().min(1).max(100).default(20),
  offset: z.number().min(0).default(0),
});

router.get('/', async (req, res) => {
  try {
    const params = searchSchema.parse({
      ...req.query,
      min_tuition: req.query.min_tuition ? Number(req.query.min_tuition) : undefined,
      max_tuition: req.query.max_tuition ? Number(req.query.max_tuition) : undefined,
      has_scholarship:
        req.query.has_scholarship === undefined
          ? undefined
          : req.query.has_scholarship === 'true',
      min_acceptance_rate: req.query.min_acceptance_rate ? Number(req.query.min_acceptance_rate) : undefined,
      max_acceptance_rate: req.query.max_acceptance_rate ? Number(req.query.max_acceptance_rate) : undefined,
      sort: req.query.sort || 'relevance',
      limit: req.query.limit ? Number(req.query.limit) : 20,
      offset: req.query.offset ? Number(req.query.offset) : 0,
    });

    // Build base query with LATERAL joins for performance
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
        sch.has_scholarship,
        dl.next_deadline,
        acc.avg_acceptance_rate
    `;

    // Add relevance score if text search is used
    if (params.query) {
      query += `,
        GREATEST(
          COALESCE(ts_rank(p.search_vector, plainto_tsquery('simple', $1)), 0),
          COALESCE(ts_rank(u.search_vector, plainto_tsquery('simple', $1)), 0)
        ) as relevance_score
      `;
    }

    query += `
      FROM programs p
      INNER JOIN universities u ON p.university_id = u.id
      INNER JOIN countries c ON u.country_id = c.id
      LEFT JOIN requirements req ON req.program_id = p.id
      LEFT JOIN LATERAL (
        SELECT COUNT(*) > 0 AS has_scholarship
        FROM scholarships s
        WHERE s.program_id = p.id OR s.university_id = u.id
      ) sch ON true
      LEFT JOIN LATERAL (
        SELECT MIN(d.deadline_date) AS next_deadline
        FROM deadlines d
        WHERE d.program_id = p.id
      ) dl ON true
      LEFT JOIN LATERAL (
        SELECT AVG(ad.acceptance_rate) AS avg_acceptance_rate
        FROM admission_stats ad
        WHERE ad.program_id = p.id
          AND ad.year >= EXTRACT(YEAR FROM CURRENT_DATE) - 3
      ) acc ON true
      WHERE 1=1
    `;

    const queryParams: any[] = [];
    let paramIndex = params.query ? 2 : 1; // Start from 2 if query exists (used in SELECT)

    // Text search using search_vector (primary) with ILIKE fallback
    if (params.query) {
      queryParams.push(params.query); // $1 for tsquery
      const searchTerm = `%${params.query}%`;
      queryParams.push(searchTerm); // $2 for ILIKE fallback
      
      query += ` AND (
        (p.search_vector @@ plainto_tsquery('simple', $1) OR u.search_vector @@ plainto_tsquery('simple', $1))
        OR p.name ILIKE $2
        OR u.name ILIKE $2
        OR p.field_of_study ILIKE $2
      )`;
      paramIndex = 3;
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
      query += ` AND (p.language = $${paramIndex} OR p.language_id = (SELECT id FROM languages WHERE code = $${paramIndex} OR name = $${paramIndex} LIMIT 1))`;
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
      query += ` AND sch.has_scholarship = true`;
    }

    if (params.deadline_before) {
      query += ` AND dl.next_deadline <= $${paramIndex}`;
      queryParams.push(params.deadline_before);
      paramIndex++;
    }

    if (params.min_acceptance_rate !== undefined) {
      query += ` AND acc.avg_acceptance_rate >= $${paramIndex}`;
      queryParams.push(params.min_acceptance_rate);
      paramIndex++;
    }

    if (params.max_acceptance_rate !== undefined) {
      query += ` AND acc.avg_acceptance_rate <= $${paramIndex}`;
      queryParams.push(params.max_acceptance_rate);
      paramIndex++;
    }

    // Ordering
    if (params.query && params.sort === 'relevance') {
      query += ` ORDER BY relevance_score DESC NULLS LAST, u.qs_ranking NULLS LAST, u.the_ranking NULLS LAST, p.name`;
    } else if (params.sort === 'ranking') {
      query += ` ORDER BY u.qs_ranking NULLS LAST, u.the_ranking NULLS LAST, p.name`;
    } else {
      query += ` ORDER BY p.name, u.name`;
    }

    query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    queryParams.push(params.limit, params.offset);

    const result = await pool.query(query, queryParams);

    // Get total count for pagination (using same filters)
    let countQuery = `
      SELECT COUNT(DISTINCT p.id)
      FROM programs p
      INNER JOIN universities u ON p.university_id = u.id
      INNER JOIN countries c ON u.country_id = c.id
      LEFT JOIN LATERAL (
        SELECT MIN(d.deadline_date) AS next_deadline
        FROM deadlines d
        WHERE d.program_id = p.id
      ) dl ON true
      LEFT JOIN LATERAL (
        SELECT AVG(ad.acceptance_rate) AS avg_acceptance_rate
        FROM admission_stats ad
        WHERE ad.program_id = p.id
          AND ad.year >= EXTRACT(YEAR FROM CURRENT_DATE) - 3
      ) acc ON true
      WHERE 1=1
    `;
    const countParams: any[] = [];
    let countParamIndex = 1;

    // Apply same filters for count (including text search)
    if (params.query) {
      countParams.push(params.query);
      const searchTerm = `%${params.query}%`;
      countParams.push(searchTerm);
      
      countQuery += ` AND (
        (p.search_vector @@ plainto_tsquery('simple', $1) OR u.search_vector @@ plainto_tsquery('simple', $1))
        OR p.name ILIKE $2
        OR u.name ILIKE $2
        OR p.field_of_study ILIKE $2
      )`;
      countParamIndex = 3;
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
      countQuery += ` AND (p.language = $${countParamIndex} OR p.language_id = (SELECT id FROM languages WHERE code = $${countParamIndex} OR name = $${countParamIndex} LIMIT 1))`;
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

    if (params.deadline_before) {
      countQuery += ` AND dl.next_deadline <= $${countParamIndex}`;
      countParams.push(params.deadline_before);
      countParamIndex++;
    }

    if (params.min_acceptance_rate !== undefined) {
      countQuery += ` AND acc.avg_acceptance_rate >= $${countParamIndex}`;
      countParams.push(params.min_acceptance_rate);
      countParamIndex++;
    }

    if (params.max_acceptance_rate !== undefined) {
      countQuery += ` AND acc.avg_acceptance_rate <= $${countParamIndex}`;
      countParams.push(params.max_acceptance_rate);
      countParamIndex++;
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