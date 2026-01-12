# Database Setup

## Prerequisites

- PostgreSQL 12 or higher
- Node.js and npm

## Setup

1. Create PostgreSQL database:
```bash
createdb unichance
```

2. Set environment variables in `backend/.env`:
```
DATABASE_URL=postgresql://user:password@localhost:5432/unichance
DB_HOST=localhost
DB_PORT=5432
DB_NAME=unichance
DB_USER=user
DB_PASSWORD=password
```

3. Run migrations:
```bash
cd backend
psql -d unichance -f ../database/migrations/001_initial_schema.sql
psql -d unichance -f ../database/migrations/002_add_search_indexes.sql
```

## Database Schema

The database includes the following main tables:

- **countries**: Country information
- **universities**: University details and rankings
- **programs**: Academic programs offered
- **requirements**: Admission requirements for programs
- **scholarships**: Available scholarships
- **deadlines**: Application deadlines
- **admission_stats**: Historical admission statistics
- **users**: User accounts (with encrypted personal data)
- **applications**: User applications
- **reviews**: User reviews (with anonymization support)

## Indexes

The database includes comprehensive indexes for:
- Full-text search on university and program names
- Geographic searches (country, city, region)
- Program filtering (degree level, field, language)
- Performance optimization for common queries

## Security

- Personal data in `users.encrypted_profile_data` and `applications.encrypted_application_data` is stored encrypted
- Reviews support anonymization via `anonymous` flag
- Passwords are hashed using bcrypt