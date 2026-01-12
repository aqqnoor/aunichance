-- Countries table
CREATE TABLE IF NOT EXISTS countries (
    id SERIAL PRIMARY KEY,
    code VARCHAR(2) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    region VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Universities table
CREATE TABLE IF NOT EXISTS universities (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    country_id INTEGER REFERENCES countries(id),
    city VARCHAR(100),
    region VARCHAR(50),
    website VARCHAR(255),
    logo_url VARCHAR(255),
    qs_ranking INTEGER,
    the_ranking INTEGER,
    description TEXT,
    established_year INTEGER,
    student_count INTEGER,
    international_student_percentage DECIMAL(5,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Programs table
CREATE TABLE IF NOT EXISTS programs (
    id SERIAL PRIMARY KEY,
    university_id INTEGER REFERENCES universities(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    degree_level VARCHAR(20) NOT NULL CHECK (degree_level IN ('Bachelor', 'Master', 'PhD', 'Certificate')),
    field_of_study VARCHAR(100) NOT NULL,
    duration_years INTEGER,
    language VARCHAR(50) DEFAULT 'English',
    tuition_fee DECIMAL(10,2),
    tuition_currency VARCHAR(3) DEFAULT 'USD',
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Requirements table
CREATE TABLE IF NOT EXISTS requirements (
    id SERIAL PRIMARY KEY,
    program_id INTEGER REFERENCES programs(id) ON DELETE CASCADE,
    min_gpa DECIMAL(3,2),
    min_ielts DECIMAL(3,1),
    min_toefl INTEGER,
    requires_sat BOOLEAN DEFAULT FALSE,
    min_sat INTEGER,
    requires_act BOOLEAN DEFAULT FALSE,
    min_act INTEGER,
    requires_gre BOOLEAN DEFAULT FALSE,
    min_gre INTEGER,
    requires_gmat BOOLEAN DEFAULT FALSE,
    min_gmat INTEGER,
    portfolio_required BOOLEAN DEFAULT FALSE,
    work_experience_years INTEGER,
    other_requirements TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Scholarships table
CREATE TABLE IF NOT EXISTS scholarships (
    id SERIAL PRIMARY KEY,
    university_id INTEGER REFERENCES universities(id) ON DELETE CASCADE,
    program_id INTEGER REFERENCES programs(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) CHECK (type IN ('Full', 'Partial', 'Merit-based', 'Need-based', 'Country-specific')),
    amount DECIMAL(10,2),
    currency VARCHAR(3) DEFAULT 'USD',
    coverage_percentage INTEGER,
    description TEXT,
    eligibility_criteria TEXT,
    application_deadline DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Deadlines table
CREATE TABLE IF NOT EXISTS deadlines (
    id SERIAL PRIMARY KEY,
    program_id INTEGER REFERENCES programs(id) ON DELETE CASCADE,
    deadline_type VARCHAR(50) CHECK (deadline_type IN ('Early Decision', 'Regular Decision', 'Rolling', 'Scholarship')),
    deadline_date DATE NOT NULL,
    timezone VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Admission statistics table
CREATE TABLE IF NOT EXISTS admission_stats (
    id SERIAL PRIMARY KEY,
    program_id INTEGER REFERENCES programs(id) ON DELETE CASCADE,
    year INTEGER NOT NULL,
    total_applications INTEGER,
    total_admitted INTEGER,
    acceptance_rate DECIMAL(5,2),
    avg_gpa DECIMAL(3,2),
    avg_ielts DECIMAL(3,1),
    avg_toefl INTEGER,
    avg_sat INTEGER,
    avg_gre INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(program_id, year)
);

-- Users table (for applications and reviews)
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    encrypted_profile_data BYTEA, -- Encrypted personal data
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Applications table
CREATE TABLE IF NOT EXISTS applications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    program_id INTEGER REFERENCES programs(id) ON DELETE CASCADE,
    status VARCHAR(50) DEFAULT 'Draft' CHECK (status IN ('Draft', 'Submitted', 'Under Review', 'Accepted', 'Rejected', 'Waitlisted')),
    encrypted_application_data BYTEA,
    chance_score DECIMAL(5,2),
    submitted_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Reviews table
CREATE TABLE IF NOT EXISTS reviews (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    university_id INTEGER REFERENCES universities(id) ON DELETE CASCADE,
    program_id INTEGER REFERENCES programs(id) ON DELETE CASCADE,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    title VARCHAR(255),
    content TEXT,
    anonymous BOOLEAN DEFAULT TRUE,
    verified_student BOOLEAN DEFAULT FALSE,
    helpful_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_universities_country ON universities(country_id);
CREATE INDEX IF NOT EXISTS idx_universities_region ON universities(region);
CREATE INDEX IF NOT EXISTS idx_universities_city ON universities(city);
CREATE INDEX IF NOT EXISTS idx_programs_university ON programs(university_id);
CREATE INDEX IF NOT EXISTS idx_programs_degree ON programs(degree_level);
CREATE INDEX IF NOT EXISTS idx_programs_field ON programs(field_of_study);
CREATE INDEX IF NOT EXISTS idx_programs_language ON programs(language);
CREATE INDEX IF NOT EXISTS idx_requirements_program ON requirements(program_id);
CREATE INDEX IF NOT EXISTS idx_scholarships_university ON scholarships(university_id);
CREATE INDEX IF NOT EXISTS idx_scholarships_program ON scholarships(program_id);
CREATE INDEX IF NOT EXISTS idx_deadlines_program ON deadlines(program_id);
CREATE INDEX IF NOT EXISTS idx_deadlines_date ON deadlines(deadline_date);
CREATE INDEX IF NOT EXISTS idx_admission_stats_program ON admission_stats(program_id);
CREATE INDEX IF NOT EXISTS idx_admission_stats_year ON admission_stats(year);
CREATE INDEX IF NOT EXISTS idx_applications_user ON applications(user_id);
CREATE INDEX IF NOT EXISTS idx_applications_program ON applications(program_id);
CREATE INDEX IF NOT EXISTS idx_reviews_university ON reviews(university_id);
CREATE INDEX IF NOT EXISTS idx_reviews_program ON reviews(program_id);
CREATE INDEX IF NOT EXISTS idx_reviews_rating ON reviews(rating);

-- Full-text search indexes
CREATE INDEX IF NOT EXISTS idx_universities_name_fts ON universities USING gin(to_tsvector('english', name));
CREATE INDEX IF NOT EXISTS idx_programs_name_fts ON programs USING gin(to_tsvector('english', name));