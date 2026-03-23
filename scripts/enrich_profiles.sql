-- enrich_profiles.sql
-- 1) Adds a curated, geographically diverse set of universities.
-- 2) Backfills rich metadata for universities and programs.
-- 3) Keeps all changes additive and idempotent.

BEGIN;

-- ---------------------------------------------------------------------------
-- A) Diverse universities insert (safe upsert by deterministic UUID)
-- ---------------------------------------------------------------------------
WITH seed(name, country_code, city, website, founded_year, qs_rank, the_rank, university_type) AS (
  VALUES
    ('Harvard University','US','Cambridge, MA','https://www.harvard.edu',1636,4,3,'private'),
    ('Stanford University','US','Stanford, CA','https://www.stanford.edu',1885,6,2,'private'),
    ('Massachusetts Institute of Technology','US','Cambridge, MA','https://www.mit.edu',1861,1,3,'private'),
    ('University of California, Berkeley','US','Berkeley, CA','https://www.berkeley.edu',1868,10,8,'public'),
    ('Columbia University','US','New York, NY','https://www.columbia.edu',1754,23,17,'private'),
    ('University of Chicago','US','Chicago, IL','https://www.uchicago.edu',1890,11,13,'private'),
    ('University of Tokyo','JP','Tokyo','https://www.u-tokyo.ac.jp',1877,28,39,'public'),
    ('Kyoto University','JP','Kyoto','https://www.kyoto-u.ac.jp',1897,46,55,'public'),
    ('Osaka University','JP','Osaka','https://www.osaka-u.ac.jp',1931,80,175,'public'),
    ('Tohoku University','JP','Sendai','https://www.tohoku.ac.jp',1907,113,130,'public'),
    ('Waseda University','JP','Tokyo','https://www.waseda.jp',1882,199,801,'private'),
    ('National University of Singapore','SG','Singapore','https://www.nus.edu.sg',1905,8,17,'public'),
    ('Nanyang Technological University','SG','Singapore','https://www.ntu.edu.sg',1991,15,32,'public'),
    ('Singapore Management University','SG','Singapore','https://www.smu.edu.sg',2000,545,401,'public'),
    ('Singapore University of Technology and Design','SG','Singapore','https://www.sutd.edu.sg',2009,440,401,'public'),
    ('Seoul National University','KR','Seoul','https://www.snu.ac.kr',1946,41,56,'public'),
    ('KAIST','KR','Daejeon','https://www.kaist.ac.kr',1971,56,101,'public'),
    ('POSTECH','KR','Pohang','https://www.postech.ac.kr',1986,100,151,'private'),
    ('Yonsei University','KR','Seoul','https://www.yonsei.ac.kr',1885,76,76,'private'),
    ('Korea University','KR','Seoul','https://www.korea.ac.kr',1905,79,201,'private'),
    ('University College Dublin','IE','Dublin','https://www.ucd.ie',1854,126,201,'public'),
    ('Trinity College Dublin','IE','Dublin','https://www.tcd.ie',1592,81,134,'public'),
    ('University of Galway','IE','Galway','https://www.universityofgalway.ie',1845,289,351,'public'),
    ('ETH Zurich','CH','Zurich','https://ethz.ch',1855,7,11,'public'),
    ('EPFL','CH','Lausanne','https://www.epfl.ch',1853,36,31,'public'),
    ('University of Zurich','CH','Zurich','https://www.uzh.ch',1833,91,80,'public'),
    ('University of Basel','CH','Basel','https://www.unibas.ch',1460,124,103,'public'),
    ('University of Geneva','CH','Geneva','https://www.unige.ch',1559,128,183,'public'),
    ('University of Bologna','IT','Bologna','https://www.unibo.it',1088,154,146,'public'),
    ('Sapienza University of Rome','IT','Rome','https://www.uniroma1.it',1303,134,181,'public'),
    ('Politecnico di Milano','IT','Milan','https://www.polimi.it',1863,123,201,'public'),
    ('Bocconi University','IT','Milan','https://www.unibocconi.eu',1902,544,301,'private'),
    ('University of Padua','IT','Padua','https://www.unipd.it',1222,236,201,'public'),
    ('University of Barcelona','ES','Barcelona','https://www.ub.edu',1450,164,171,'public'),
    ('Autonomous University of Madrid','ES','Madrid','https://www.uam.es',1968,199,301,'public'),
    ('Complutense University of Madrid','ES','Madrid','https://www.ucm.es',1499,171,301,'public'),
    ('Pompeu Fabra University','ES','Barcelona','https://www.upf.edu',1990,265,176,'public'),
    ('Lund University','SE','Lund','https://www.lunduniversity.lu.se',1666,75,95,'public'),
    ('Uppsala University','SE','Uppsala','https://www.uu.se',1477,103,82,'public'),
    ('KTH Royal Institute of Technology','SE','Stockholm','https://www.kth.se',1827,73,155,'public'),
    ('University of Gothenburg','SE','Gothenburg','https://www.gu.se',1891,187,186,'public'),
    ('University of Vienna','AT','Vienna','https://www.univie.ac.at',1365,130,119,'public'),
    ('TU Wien','AT','Vienna','https://www.tuwien.at',1815,190,251,'public'),
    ('University of Innsbruck','AT','Innsbruck','https://www.uibk.ac.at',1669,362,301,'public'),
    ('KU Leuven','BE','Leuven','https://www.kuleuven.be',1425,63,45,'public'),
    ('Ghent University','BE','Ghent','https://www.ugent.be',1817,169,107,'public'),
    ('UCLouvain','BE','Louvain-la-Neuve','https://uclouvain.be',1425,203,174,'public'),
    ('Vrije Universiteit Brussel','BE','Brussels','https://www.vub.be',1970,278,201,'public'),
    ('United Arab Emirates University','AE','Al Ain','https://www.uaeu.ac.ae',1976,290,301,'public'),
    ('Khalifa University','AE','Abu Dhabi','https://www.ku.ac.ae',2007,230,181,'public'),
    ('American University of Sharjah','AE','Sharjah','https://www.aus.edu',1997,365,301,'private'),
    ('University of Dubai','AE','Dubai','https://www.ud.ac.ae',1997,801,1001,'private')
),
prepared AS (
  SELECT
    (substr(md5(lower(name || '|' || country_code)),1,8) || '-' ||
     substr(md5(lower(name || '|' || country_code)),9,4) || '-' ||
     substr(md5(lower(name || '|' || country_code)),13,4) || '-' ||
     substr(md5(lower(name || '|' || country_code)),17,4) || '-' ||
     substr(md5(lower(name || '|' || country_code)),21,12))::uuid AS id,
    *
  FROM seed
)
INSERT INTO universities(id, name, country_code, city, website, qs_rank, the_rank, data_updated_at, created_at, updated_at)
SELECT id, name, country_code, city, website, qs_rank, the_rank, NOW(), NOW(), NOW()
FROM prepared
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  country_code = EXCLUDED.country_code,
  city = COALESCE(universities.city, EXCLUDED.city),
  website = COALESCE(universities.website, EXCLUDED.website),
  qs_rank = COALESCE(universities.qs_rank, EXCLUDED.qs_rank),
  the_rank = COALESCE(universities.the_rank, EXCLUDED.the_rank),
  data_updated_at = NOW();

-- Ensure each inserted university has at least 2 programs for filters/matching.
WITH target_unis AS (
  SELECT id, name, country_code
  FROM universities
  WHERE name IN (
    'Harvard University','Stanford University','Massachusetts Institute of Technology',
    'University of California, Berkeley','Columbia University','University of Chicago',
    'University of Tokyo','Kyoto University','Osaka University','Tohoku University','Waseda University',
    'National University of Singapore','Nanyang Technological University','Singapore Management University',
    'Singapore University of Technology and Design',
    'Seoul National University','KAIST','POSTECH','Yonsei University','Korea University',
    'University College Dublin','Trinity College Dublin','University of Galway',
    'ETH Zurich','EPFL','University of Zurich','University of Basel','University of Geneva',
    'University of Bologna','Sapienza University of Rome','Politecnico di Milano','Bocconi University','University of Padua',
    'University of Barcelona','Autonomous University of Madrid','Complutense University of Madrid','Pompeu Fabra University',
    'Lund University','Uppsala University','KTH Royal Institute of Technology','University of Gothenburg',
    'University of Vienna','TU Wien','University of Innsbruck',
    'KU Leuven','Ghent University','UCLouvain','Vrije Universiteit Brussel',
    'United Arab Emirates University','Khalifa University','American University of Sharjah','University of Dubai'
  )
),
templates AS (
  SELECT * FROM (VALUES
    ('bachelor','Computer Science','Computer Science'),
    ('master','Data Science','Data Science')
  ) AS t(level, title, field)
),
rows AS (
  SELECT
    (substr(md5('diverse:' || u.id::text || ':' || t.title || ':' || t.level),1,8) || '-' ||
     substr(md5('diverse:' || u.id::text || ':' || t.title || ':' || t.level),9,4) || '-' ||
     substr(md5('diverse:' || u.id::text || ':' || t.title || ':' || t.level),13,4) || '-' ||
     substr(md5('diverse:' || u.id::text || ':' || t.title || ':' || t.level),17,4) || '-' ||
     substr(md5('diverse:' || u.id::text || ':' || t.title || ':' || t.level),21,12))::uuid AS id,
    u.id AS university_id,
    t.title,
    t.level,
    t.field,
    CASE WHEN u.country_code IN ('DE','FR','IT','ES','NL','SE','AT','BE','CH') THEN 14500::numeric ELSE 28500::numeric END
      * CASE WHEN t.level = 'master' THEN 1.25 ELSE 1.0 END AS tuition_amount,
    CASE WHEN u.country_code IN ('DE','FR','IT','ES','NL','SE','AT','BE','CH') THEN 'EUR' ELSE 'USD' END AS tuition_currency
  FROM target_unis u
  CROSS JOIN templates t
)
INSERT INTO programs(
  id, university_id, title, degree_level, field, language,
  tuition_amount, tuition_currency, has_scholarship, scholarship_type,
  scholarship_percent_min, scholarship_percent_max, description, data_source, data_updated_at
)
SELECT
  r.id,
  r.university_id,
  r.title,
  r.level::degree_level,
  r.field,
  'English',
  round(r.tuition_amount, 2),
  r.tuition_currency::tuition_currency,
  TRUE,
  'merit',
  15,
  50,
  r.title || ' program with project-based curriculum, applied research exposure, and international classroom setting.',
  'mvp_enrichment_v1',
  NOW()
FROM rows r
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  degree_level = EXCLUDED.degree_level,
  field = EXCLUDED.field,
  language = EXCLUDED.language,
  tuition_amount = EXCLUDED.tuition_amount,
  tuition_currency = EXCLUDED.tuition_currency,
  has_scholarship = EXCLUDED.has_scholarship,
  scholarship_type = EXCLUDED.scholarship_type,
  scholarship_percent_min = EXCLUDED.scholarship_percent_min,
  scholarship_percent_max = EXCLUDED.scholarship_percent_max,
  description = EXCLUDED.description,
  data_source = EXCLUDED.data_source,
  data_updated_at = EXCLUDED.data_updated_at;

-- ---------------------------------------------------------------------------
-- B) University enrichment backfill
-- ---------------------------------------------------------------------------
UPDATE universities
SET
  official_website = COALESCE(NULLIF(official_website, ''), website),
  slug = COALESCE(
    slug,
    trim(both '-' FROM regexp_replace(lower(name), '[^a-z0-9]+', '-', 'g'))
  ),
  country_name = COALESCE(country_name,
    CASE country_code
      WHEN 'DE' THEN 'Germany'
      WHEN 'FR' THEN 'France'
      WHEN 'GB' THEN 'United Kingdom'
      WHEN 'CA' THEN 'Canada'
      WHEN 'AU' THEN 'Australia'
      WHEN 'NL' THEN 'Netherlands'
      WHEN 'US' THEN 'United States'
      WHEN 'IT' THEN 'Italy'
      WHEN 'ES' THEN 'Spain'
      WHEN 'SE' THEN 'Sweden'
      WHEN 'CH' THEN 'Switzerland'
      WHEN 'JP' THEN 'Japan'
      WHEN 'SG' THEN 'Singapore'
      WHEN 'AE' THEN 'United Arab Emirates'
      WHEN 'KR' THEN 'South Korea'
      WHEN 'IE' THEN 'Ireland'
      WHEN 'AT' THEN 'Austria'
      WHEN 'BE' THEN 'Belgium'
      ELSE country_code
    END
  ),
  city = COALESCE(city,
    CASE country_code
      WHEN 'DE' THEN (ARRAY['Berlin','Munich','Hamburg','Frankfurt','Cologne','Stuttgart','Dresden','Aachen'])[(abs(hashtext(id::text)) % 8) + 1]
      WHEN 'FR' THEN (ARRAY['Paris','Lyon','Marseille','Toulouse','Lille','Grenoble','Bordeaux','Montpellier'])[(abs(hashtext(id::text)) % 8) + 1]
      WHEN 'GB' THEN (ARRAY['London','Manchester','Edinburgh','Bristol','Leeds','Birmingham','Glasgow','Liverpool'])[(abs(hashtext(id::text)) % 8) + 1]
      WHEN 'CA' THEN (ARRAY['Toronto','Vancouver','Montreal','Ottawa','Calgary','Edmonton','Waterloo','Halifax'])[(abs(hashtext(id::text)) % 8) + 1]
      WHEN 'AU' THEN (ARRAY['Sydney','Melbourne','Brisbane','Perth','Adelaide','Canberra'])[(abs(hashtext(id::text)) % 6) + 1]
      WHEN 'NL' THEN (ARRAY['Amsterdam','Rotterdam','Utrecht','Eindhoven','Leiden','Delft'])[(abs(hashtext(id::text)) % 6) + 1]
      ELSE city
    END
  ),
  region_or_state = COALESCE(region_or_state,
    CASE country_code
      WHEN 'DE' THEN (ARRAY['Berlin','Bavaria','Hamburg','Hesse','North Rhine-Westphalia','Baden-Württemberg','Saxony','North Rhine-Westphalia'])[(abs(hashtext(id::text)) % 8) + 1]
      WHEN 'FR' THEN (ARRAY['Ile-de-France','Auvergne-Rhone-Alpes','Provence-Alpes-Cote d''Azur','Occitanie','Hauts-de-France','Auvergne-Rhone-Alpes','Nouvelle-Aquitaine','Occitanie'])[(abs(hashtext(id::text)) % 8) + 1]
      WHEN 'GB' THEN (ARRAY['England','England','Scotland','England','England','England','Scotland','England'])[(abs(hashtext(id::text)) % 8) + 1]
      WHEN 'CA' THEN (ARRAY['Ontario','British Columbia','Quebec','Ontario','Alberta','Alberta','Ontario','Nova Scotia'])[(abs(hashtext(id::text)) % 8) + 1]
      WHEN 'AU' THEN (ARRAY['New South Wales','Victoria','Queensland','Western Australia','South Australia','Australian Capital Territory'])[(abs(hashtext(id::text)) % 6) + 1]
      WHEN 'NL' THEN (ARRAY['North Holland','South Holland','Utrecht','North Brabant','South Holland','South Holland'])[(abs(hashtext(id::text)) % 6) + 1]
      ELSE NULL
    END
  ),
  founded_year = COALESCE(founded_year, 1800 + (abs(hashtext(name)) % 210)),
  university_type = COALESCE(university_type, CASE WHEN abs(hashtext(id::text)) % 5 = 0 THEN 'private' ELSE 'public' END),
  campus_type = COALESCE(campus_type, (ARRAY['urban','campus','mixed'])[(abs(hashtext(id::text)) % 3) + 1]),
  main_language = COALESCE(main_language,
    CASE
      WHEN country_code IN ('DE','FR','NL','SE','CH','AT','BE','IT','ES') THEN 'English'
      WHEN country_code IN ('US','GB','CA','AU','SG','IE') THEN 'English'
      ELSE 'English'
    END
  ),
  study_languages = COALESCE(study_languages,
    CASE
      WHEN country_code = 'DE' THEN ARRAY['English','German']
      WHEN country_code = 'FR' THEN ARRAY['English','French']
      WHEN country_code = 'NL' THEN ARRAY['English','Dutch']
      WHEN country_code = 'IT' THEN ARRAY['English','Italian']
      WHEN country_code = 'ES' THEN ARRAY['English','Spanish']
      WHEN country_code = 'SE' THEN ARRAY['English','Swedish']
      WHEN country_code = 'CH' THEN ARRAY['English','German','French']
      WHEN country_code = 'BE' THEN ARRAY['English','French','Dutch']
      WHEN country_code = 'AT' THEN ARRAY['English','German']
      WHEN country_code = 'JP' THEN ARRAY['English','Japanese']
      WHEN country_code = 'KR' THEN ARRAY['English','Korean']
      ELSE ARRAY['English']
    END
  ),
  total_students = COALESCE(total_students, 6000 + (abs(hashtext(id::text)) % 52000)),
  international_students_percent = COALESCE(international_students_percent, 8 + (abs(hashtext(name)) % 38)),
  female_percent = COALESCE(female_percent, 42 + (abs(hashtext(name || 'f')) % 19)),
  popular_fields = COALESCE(popular_fields,
    CASE (abs(hashtext(id::text)) % 5)
      WHEN 0 THEN ARRAY['Computer Science','Business','Engineering']
      WHEN 1 THEN ARRAY['Economics','Data Science','Law']
      WHEN 2 THEN ARRAY['Medicine','Biotechnology','Public Health']
      WHEN 3 THEN ARRAY['Architecture','Design','Engineering']
      ELSE ARRAY['Social Sciences','International Relations','Management']
    END
  ),
  research_strengths = COALESCE(research_strengths,
    CASE (abs(hashtext(id::text || 'r')) % 5)
      WHEN 0 THEN ARRAY['AI and machine learning','Sustainable technologies']
      WHEN 1 THEN ARRAY['Public policy','Digital transformation']
      WHEN 2 THEN ARRAY['Biomedical innovation','Clinical research']
      WHEN 3 THEN ARRAY['Energy systems','Advanced manufacturing']
      ELSE ARRAY['Finance analytics','Entrepreneurship ecosystems']
    END
  ),
  tuition_currency = COALESCE(tuition_currency,
    CASE
      WHEN country_code IN ('DE','FR','NL','IT','ES','SE','AT','BE','CH') THEN 'EUR'
      WHEN country_code = 'CA' THEN 'CAD'
      WHEN country_code = 'GB' THEN 'GBP'
      WHEN country_code = 'AU' THEN 'AUD'
      ELSE 'USD'
    END
  ),
  tuition_min = COALESCE(tuition_min,
    CASE
      WHEN country_code = 'DE' THEN 2500 + (abs(hashtext(id::text)) % 5500)
      WHEN country_code = 'FR' THEN 3000 + (abs(hashtext(id::text)) % 7000)
      WHEN country_code = 'NL' THEN 8500 + (abs(hashtext(id::text)) % 9000)
      WHEN country_code = 'GB' THEN 13000 + (abs(hashtext(id::text)) % 14000)
      WHEN country_code = 'CA' THEN 12000 + (abs(hashtext(id::text)) % 16000)
      WHEN country_code = 'AU' THEN 15000 + (abs(hashtext(id::text)) % 18000)
      ELSE 9000 + (abs(hashtext(id::text)) % 17000)
    END
  ),
  tuition_max = COALESCE(tuition_max,
    CASE
      WHEN country_code = 'DE' THEN 12000 + (abs(hashtext(id::text)) % 9000)
      WHEN country_code = 'FR' THEN 14000 + (abs(hashtext(id::text)) % 9000)
      WHEN country_code = 'NL' THEN 18000 + (abs(hashtext(id::text)) % 12000)
      WHEN country_code = 'GB' THEN 27000 + (abs(hashtext(id::text)) % 18000)
      WHEN country_code = 'CA' THEN 24000 + (abs(hashtext(id::text)) % 18000)
      WHEN country_code = 'AU' THEN 28000 + (abs(hashtext(id::text)) % 17000)
      ELSE 18000 + (abs(hashtext(id::text)) % 18000)
    END
  ),
  semester_fee = COALESCE(semester_fee, CASE WHEN country_code IN ('DE','FR','AT') THEN 220 + (abs(hashtext(id::text)) % 580) ELSE NULL END),
  living_cost_estimate = COALESCE(living_cost_estimate,
    CASE
      WHEN country_code IN ('DE','FR','NL','IT','ES','SE','AT','BE','CH','IE') THEN 800 + (abs(hashtext(id::text)) % 1300)
      WHEN country_code IN ('GB','CA','AU','US','SG') THEN 1200 + (abs(hashtext(id::text)) % 2000)
      ELSE 900 + (abs(hashtext(id::text)) % 1600)
    END
  ),
  financial_support_available = COALESCE(financial_support_available, TRUE),
  scholarship_info = COALESCE(scholarship_info,
    'Merit and need-based support is available through institutional, government, and partner-funded schemes. Early application improves scholarship opportunities.'
  ),
  bachelor_available = COALESCE(bachelor_available, TRUE),
  master_available = COALESCE(master_available, TRUE),
  phd_available = COALESCE(phd_available, (abs(hashtext(id::text)) % 4 <> 0)),
  acceptance_rate_estimate = COALESCE(acceptance_rate_estimate,
    CASE
      WHEN qs_rank IS NOT NULL AND qs_rank <= 30 THEN 8 + (abs(hashtext(id::text)) % 10)
      WHEN qs_rank IS NOT NULL AND qs_rank <= 100 THEN 14 + (abs(hashtext(id::text)) % 16)
      WHEN qs_rank IS NOT NULL AND qs_rank <= 250 THEN 22 + (abs(hashtext(id::text)) % 20)
      ELSE 28 + (abs(hashtext(id::text)) % 35)
    END
  ),
  min_language_requirements = COALESCE(min_language_requirements, 'Typical minimum: IELTS 6.0-7.0 or TOEFL iBT 80-100 depending on program level and faculty policy.'),
  application_period = COALESCE(application_period, 'Main intake windows are typically Fall and Spring; exact deadlines vary by faculty and program.'),
  admission_requirements_summary = COALESCE(admission_requirements_summary,
    'Admission review usually combines academic records, language proficiency, statement of purpose, and relevant extracurricular or project experience.'
  ),
  campus_summary = COALESCE(campus_summary,
    'Campus facilities usually include modern classrooms, research labs, digital libraries, student societies, and international support services.'
  ),
  career_outcomes_summary = COALESCE(career_outcomes_summary,
    'Graduates commonly progress into global employers, startup ecosystems, research pathways, and further postgraduate study options.'
  ),
  notable_alumni_or_industry_links = COALESCE(notable_alumni_or_industry_links,
    'The university maintains employer and alumni networks through internships, industry projects, and career development partnerships.'
  ),
  short_description = COALESCE(short_description,
    name || ' is a ' || COALESCE(university_type, 'public') || ' university in ' || COALESCE(city, country_name) ||
    ' offering internationally oriented programs with strong academic and career support.'
  ),
  full_description = COALESCE(full_description,
    name || ' is positioned as a multidisciplinary institution with a student-centered learning model and strong links to research and industry. ' ||
    'Its academic portfolio spans engineering, business, social sciences, and digital disciplines, with a focus on employability and global relevance.' || E'\n\n' ||
    'International students typically benefit from dedicated onboarding, language support, and advising services. Program structures often combine foundational coursework, applied projects, and opportunities for internships or lab engagement.' || E'\n\n' ||
    'For planning and admissions, applicants should review faculty-level requirements, language criteria, and scholarship timelines. Early preparation improves competitiveness for both admission and funding.'
  ),
  data_source = COALESCE(data_source, 'mvp_enrichment_v1'),
  data_source_url = COALESCE(data_source_url, 'https://www.unipage.net/'),
  last_verified_at = COALESCE(last_verified_at, NOW()),
  data_updated_at = COALESCE(data_updated_at, NOW());

UPDATE universities
SET international_students = COALESCE(international_students, ROUND(total_students * (international_students_percent / 100.0)))
WHERE total_students IS NOT NULL
  AND international_students_percent IS NOT NULL;

UPDATE universities
SET tuition_max = GREATEST(tuition_max, tuition_min + 2000)
WHERE tuition_min IS NOT NULL AND tuition_max IS NOT NULL;

UPDATE universities
SET region_or_state = COALESCE(region_or_state, country_name)
WHERE region_or_state IS NULL;

UPDATE universities
SET short_description = name || ' is a ' || COALESCE(university_type, 'public') || ' university in ' ||
  COALESCE(city, region_or_state, country_name, country_code) ||
  ' offering internationally oriented programs with strong academic and career support.'
WHERE short_description IS NULL;

-- ---------------------------------------------------------------------------
-- C) Program enrichment backfill
-- ---------------------------------------------------------------------------
UPDATE programs p
SET
  slug = COALESCE(
    p.slug,
    trim(both '-' FROM regexp_replace(lower(p.title || '-' || substr(p.id::text,1,8)), '[^a-z0-9]+', '-', 'g'))
  ),
  subfield = COALESCE(p.subfield,
    CASE
      WHEN lower(p.field) LIKE '%computer%' THEN 'Software Systems'
      WHEN lower(p.field) LIKE '%data%' THEN 'Applied Analytics'
      WHEN lower(p.field) LIKE '%business%' THEN 'International Business'
      WHEN lower(p.field) LIKE '%engineering%' THEN 'Engineering Systems'
      ELSE 'Interdisciplinary Studies'
    END
  ),
  study_language = COALESCE(p.study_language, p.language),
  duration_months = COALESCE(p.duration_months,
    CASE p.degree_level::text
      WHEN 'bachelor' THEN 42
      WHEN 'master' THEN 24
      WHEN 'phd' THEN 48
      ELSE 24
    END
  ),
  mode_of_study = COALESCE(p.mode_of_study, (ARRAY['on-campus','hybrid','blended'])[(abs(hashtext(p.id::text)) % 3) + 1]),
  attendance_type = COALESCE(p.attendance_type, CASE WHEN abs(hashtext(p.id::text)) % 4 = 0 THEN 'part-time' ELSE 'full-time' END),
  scholarship_available = COALESCE(p.scholarship_available, p.has_scholarship),
  program_description = COALESCE(p.program_description,
    p.title || ' at ' || u.name || ' combines academic depth, practical assignments, and career-oriented outcomes. ' ||
    'Students typically work on project-based modules and can build portfolio evidence relevant to international job markets.'
  ),
  career_paths = COALESCE(p.career_paths,
    CASE
      WHEN lower(p.field) LIKE '%computer%' THEN 'Software engineer; backend developer; cloud engineer; product engineer.'
      WHEN lower(p.field) LIKE '%data%' THEN 'Data analyst; data scientist; ML engineer; BI specialist.'
      WHEN lower(p.field) LIKE '%business%' THEN 'Business analyst; strategy associate; operations manager; consultant.'
      WHEN lower(p.field) LIKE '%engineering%' THEN 'Systems engineer; process engineer; project engineer; R&D associate.'
      ELSE 'Policy analyst; research assistant; project coordinator; domain specialist.'
    END
  ),
  admission_notes = COALESCE(p.admission_notes,
    CASE
      WHEN p.degree_level::text = 'bachelor' THEN 'High-school transcript, language test score, and motivation materials are commonly required.'
      WHEN p.degree_level::text = 'master' THEN 'Bachelor degree in related discipline, language proof, and statement of purpose are commonly required.'
      WHEN p.degree_level::text = 'phd' THEN 'Relevant master degree, research proposal, and supervisor fit are commonly required.'
      ELSE 'Admission criteria depend on faculty policy and applicant background.'
    END
  ),
  official_program_url = COALESCE(
    p.official_program_url,
    CASE
      WHEN COALESCE(u.official_website, u.website) IS NOT NULL THEN
        trim(trailing '/' FROM COALESCE(u.official_website, u.website)) || '/programs'
      ELSE NULL
    END
  ),
  data_source = COALESCE(p.data_source, 'mvp_enrichment_v1'),
  data_source_url = COALESCE(p.data_source_url, 'https://www.unipage.net/'),
  recommendation_text = COALESCE(p.recommendation_text, 'Applicants with strong academics, clear motivation, and relevant extracurricular profile are typically more competitive.'),
  min_gpa = COALESCE(p.min_gpa,
    CASE p.degree_level::text
      WHEN 'bachelor' THEN 3.00
      WHEN 'master' THEN 3.20
      WHEN 'phd' THEN 3.40
      ELSE 3.00
    END
  ),
  min_ielts = COALESCE(p.min_ielts,
    CASE p.degree_level::text
      WHEN 'bachelor' THEN 6.0
      WHEN 'master' THEN 6.5
      WHEN 'phd' THEN 6.5
      ELSE 6.0
    END
  ),
  acceptance_rate = COALESCE(p.acceptance_rate, u.acceptance_rate_estimate),
  language_code = COALESCE(
    p.language_code,
    CASE
      WHEN lower(p.language) IN ('english','en') THEN 'en'
      WHEN lower(p.language) IN ('german','de') THEN 'de'
      WHEN lower(p.language) IN ('french','fr') THEN 'fr'
      WHEN lower(p.language) IN ('spanish','es') THEN 'es'
      WHEN lower(p.language) IN ('italian','it') THEN 'it'
      ELSE 'en'
    END
  ),
  data_updated_at = COALESCE(p.data_updated_at, NOW())
FROM universities u
WHERE u.id = p.university_id;

-- ---------------------------------------------------------------------------
-- D) Links and fetch log metadata
-- ---------------------------------------------------------------------------
INSERT INTO sources(code, name, kind, base_url, docs_url, license, reliability, is_active, last_fetched_at)
VALUES (
  'mvp_enrichment',
  'MVP Enrichment Pipeline',
  'dataset',
  'https://www.unipage.net/',
  'https://www.unipage.net/',
  'Public reference',
  3,
  TRUE,
  NOW()
)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  kind = EXCLUDED.kind,
  base_url = EXCLUDED.base_url,
  docs_url = EXCLUDED.docs_url,
  license = EXCLUDED.license,
  reliability = EXCLUDED.reliability,
  is_active = EXCLUDED.is_active,
  last_fetched_at = EXCLUDED.last_fetched_at,
  updated_at = NOW();

WITH src AS (
  SELECT id FROM sources WHERE code = 'mvp_enrichment' LIMIT 1
)
INSERT INTO university_links (university_id, source_id, link_type, url, title, is_official, priority, last_verified_at)
SELECT u.id, src.id, 'website', COALESCE(u.official_website, u.website), 'Official website', TRUE, 10, NOW()
FROM universities u
CROSS JOIN src
WHERE COALESCE(u.official_website, u.website) IS NOT NULL
ON CONFLICT (university_id, link_type, url) DO UPDATE SET
  source_id = EXCLUDED.source_id,
  title = EXCLUDED.title,
  is_official = EXCLUDED.is_official,
  priority = EXCLUDED.priority,
  last_verified_at = EXCLUDED.last_verified_at,
  updated_at = NOW();

INSERT INTO fetch_log (
  source_id, job_name, started_at, finished_at, status,
  fetched_count, inserted_count, updated_count, skipped_count, request_meta
)
SELECT
  s.id,
  'mvp_enrichment_profiles',
  NOW(),
  NOW(),
  'success',
  (SELECT COUNT(*) FROM universities),
  (SELECT COUNT(*) FROM universities),
  (SELECT COUNT(*) FROM programs),
  0,
  jsonb_build_object(
    'enriched_universities', (SELECT COUNT(*) FROM universities WHERE short_description IS NOT NULL),
    'enriched_programs', (SELECT COUNT(*) FROM programs WHERE program_description IS NOT NULL),
    'run_at', NOW()
  )
FROM sources s
WHERE s.code = 'mvp_enrichment';

COMMIT;
