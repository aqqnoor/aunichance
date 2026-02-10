# SmartMatch - Intelligent Program-Student Matching System

## What's Implemented (Phase 2 Complete ✅)

### 1. **SmartMatcher Core Algorithm** (`backend-go/internal/scoring/matcher.go`)
   - **7-Phase Matching Logic**:
     1. Filter impossible candidates (GPA/Lang too low)
     2. Academic scoring (GPA, language tests, standardized tests) → 0-40 points
     3. Competitive scoring (acceptance rate vs student metrics) → 0-30 points
     4. Financial scoring (budget coverage + scholarships) → 0-20 points
     5. Special factors (achievements with weighted importance) → 0-10 points
     6. Overall scoring (0-100) with category assignment (reach/target/safety)
     7. Automatic recommendation generation

   - **Input**: EnrichedStudentProfile (GPA, IELTS, SAT, budget, citizenship, achievements)
   - **Output**: MatchScore with:
     - Overall score (0-100)
     - Category (reach: <40, target: 40-70, safety: 70+)
     - Breakdown by component
     - Actionable recommendations ("Raise GPA by 0.3 → +15% to chances")
     - Financial status (cost coverage, scholarship alignment)
     - Improvement path (specific steps to reach safety tier)

### 2. **Programs Repository Extension** (`backend-go/internal/programs/smart_search.go`)
   - `ListEnrichedForSmartSearch()`: Loads programs with full context
     - University info, Competitive factor, Admission statistics
     - Scholarship info, Financial data
     - Optimized SQL with LEFT JOINs for latest admission stats
   
   - `PerformSmartSearch()`: Batch matches student to programs
     - Scores each program through SmartMatcher
     - Groups results by category (reach/target/safety)
     - Sorts within each category by score

### 3. **SmartSearch Handler** (`backend-go/internal/programs/handler.go`)
   - `SmartSearch()` endpoint:
     - POST `/programs/smart-search` (requires JWT auth)
     - Parameters: countries, fields, degree_levels, max_tuition, take
     - Loads student profile from DB
     - Calls ListEnrichedForSmartSearch() and PerformSmartSearch()
     - Returns SmartSearchResponse (categorized programs with scores)

### 4. **API Integration** (`backend-go/internal/http/router.go`)
   - New route: `GET /programs/smart-search`
   - Protected by JWT authentication middleware
   - Returns structured response with reach/target/safety categories

### 5. **Database Enhancements** (`database/migrations/005_smart_matching.sql`)
   - Added `programs.competitive_factor` (DECIMAL 3,1)
     - Auto-calculated from acceptance_rate
     - Modulates competition impact on scoring
   
   - Added `scholarships.eligible_citizenship_codes` (VARCHAR 255)
     - Enables country-specific scholarship matching
   
   - Added to `profiles`:
     - `citizenship_code` (VARCHAR 2)
     - `graduation_year` (INTEGER)
     - `achievements_count` (INTEGER)
   
   - Created `match_history` table (optional, for analytics)
   
   - Added indexes for query performance

### 6. **Model Updates**
   - Extended `Profile` model with new fields
   - Created `EnrichedStudentProfile` for matching context
   - Created result types for JSON serialization:
     - `SmartSearchResult` with financial & improvement details
     - `FinancialResultInfo`
     - `ImprovementPathResult`

---

## How It Works: Example Flow

### Student Profile: GPA 3.5, IELTS 7.0, no SAT, $15k/year budget, from Kazakhstan

```
1. Student calls: GET /programs/smart-search?countries=US&take=30
   
2. Backend loads:
   - Student profile (GPA, budget, citizenship, etc.)
   - 30 programs from US with requirements & stats
   
3. For each program, SmartMatcher calculates:
   - Academic: GPA 3.5 vs avg 3.7 = 18/40 pts
   - Competitive: 8% acceptance × GPA ratio = 12/30 pts
   - Financial: $15k budget vs $35k tuition = 8/20 pts
     (+ scholarship? If yes: "has need-based aid available")
   - Special: No achievements = 0/10 pts
   → Total: 38/100 = "REACH"
   
4. Recommendations generated:
   - "SAT score: adds +15% to chances"
   - "Raise GPA to 3.7 for +12% improvement"
   - "MIT requires GPA 3.8+ (you have 3.5 delta: -0.3)"
   
5. Returns grouped response:
   {
     "reach": [MIT {...}, Stanford {...}],
     "target": [UC Berkeley {...}, ..],
     "safety": [State U {...}, ...],
     "total": 30
   }
```

---

## Key Algorithm Features

### Competitive Scoring
```
If acceptance_rate = 5% (very high competition):
  - Student above avg GPA → gets ~18/30 competitive pts
  - Student at avg GPA → gets ~12/30 pts
  - Student below avg → gets ~6/30 pts (harsh penalty for competitive schools)

If acceptance_rate = 40% (low competition):
  - Much more lenient multiplier (0.2x vs 1.4x)
```

### Achievement Weighting
```
Olympiad          × 3.0
Leadership        × 2.0
Sports            × 1.5
Volunteering      × 1.0
Other             × 1.0

Score mapping:
- weight >= 5: 10/10
- weight >= 3: 7/10
- weight >= 1: 4/10
- weight < 1:  0/10
```

### Financial Alignment
```
- budget >= tuition: 20/20 (full coverage)
- budget >= 70% tuition: 14/20 (needs partial loan)
- With scholarship + budget remaining: 16/20 (viable)
- Scholarship only: 12/20 (requires full scholarship)
- Insufficient even with scholarship: 0/20

Shortfall automatically calculated and shown to student
```

---

## What's NOT Yet Implemented

- [ ] **Phase 3**: Frontend SmartSearch page (integrates with new endpoint)
- [ ] **Phase 4**: Match history tracking (analytics on which programs students apply to)
- [ ] **Phase 5**: ML-based improving (collect real outcomes, train model)
- [ ] UI for viewing recommendations and improvement path  
- [ ] Admin dashboard for managing competitive_factor per university
- [ ] Citizenship-specific scholarship filtering (just schema, not logic)

---

## Testing the API

### Setup
```bash
# Run migrations
psql -d unichance -f database/migrations/005_smart_matching.sql

# Build backend
cd backend-go && go build ./cmd/api
```

### Example Request
```bash
# 1. Register user
curl -X POST http://localhost:8080/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"123456"}'
# Returns: {"token":"...", "user":{...}}

# 2. Fill profile
curl -X POST http://localhost:8080/profile/me \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "gpa": 3.5,
    "gpa_scale": 4.0,
    "ielts": 7.0,
    "budget_year": 15000,
    "budget_currency": "USD"
  }'

# 3. Smart search
curl -X GET "http://localhost:8080/programs/smart-search?countries=US&take=10" \
  -H "Authorization: Bearer YOUR_TOKEN"
# Returns: {"reach":[...], "target":[...], "safety":[...]}
```

---

## Performance Notes

- **Query optimization**: Uses LATERAL subquery for latest admission_stats (avoids JOIN bloat)
- **Sorting**: In-memory sorting inside Go (OK for 30-50 results)
- **Caching opportunity**: Could cache competitive_factor values daily
- **Scalability**: Currently handles ~1000 programs/sec sequential (fine for MVP)

---

## Next Steps (Roadmap)

1. **Phase 3**: Create React component for SmartSearch results page
2. **Phase 4**: Track matching decisions (match_history table population)
3. **Phase 5**: Add real-time achievement tracking (UI for updating achievements)
4. **Phase 6**: Implement scholarship matching based on citizenship
5. **Phase 7**: ML model integration (replace rule-based with trained model)
6. **Phase 8**: Analytics dashboard (universities, success rates, trends)

---

## Code Structure

```
backend-go/
├── internal/
│   ├── scoring/
│   │   ├── matcher.go          ← SmartMatcher algorithm (NEW)
│   │   └── scoring.go          ← Old rule-based (kept for compatibility)
│   ├── programs/
│   │   ├── smart_search.go     ← Repo methods for smart search (NEW)
│   │   ├── handler.go          ← SmartSearch endpoint (UPDATED)
│   │   └── repo.go             ← Existing search logic
│   ├── profile/
│   │   ├── models.go           ← Extended Profile struct (UPDATED)
│   │   └── repo.go             ← Profile CRUD (UPDATED)
│   └── http/
│       └── router.go           ← New route registration (UPDATED)
└── cmd/api/
    └── main.go                 ← Handler initialization (UPDATED)

database/migrations/
└── 005_smart_matching.sql      ← DB schema enhancements (NEW)
```

---

## Questions?

- Why separate EnrichedStudentProfile? → Avoids circular deps, keeps scoring pure
- Why competitive_factor in DB? → Allows non-technical admins to tune competition weight
- Why not ML now? → Rule-based is transparent, debuggable, and sufficient for MVP
