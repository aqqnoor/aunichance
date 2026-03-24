package universities

import "time"

type University struct {
	ID            string     `json:"id"`
	Name          string     `json:"name"`
	CountryCode   string     `json:"country_code"`
	City          *string    `json:"city,omitempty"`
	Website       *string    `json:"website,omitempty"`
	QSRank        *int       `json:"qs_rank,omitempty"`
	THERank       *int       `json:"the_rank,omitempty"`
	DataUpdatedAt *time.Time `json:"data_updated_at,omitempty"`

	Slug                       *string    `json:"slug,omitempty"`
	CountryName                *string    `json:"country_name,omitempty"`
	RegionOrState              *string    `json:"region_or_state,omitempty"`
	OfficialWebsite            *string    `json:"official_website,omitempty"`
	ShortDescription           *string    `json:"short_description,omitempty"`
	FullDescription            *string    `json:"full_description,omitempty"`
	FoundedYear                *int       `json:"founded_year,omitempty"`
	UniversityType             *string    `json:"university_type,omitempty"`
	CampusType                 *string    `json:"campus_type,omitempty"`
	MainLanguage               *string    `json:"main_language,omitempty"`
	StudyLanguages             []string   `json:"study_languages,omitempty"`
	TotalStudents              *int       `json:"total_students,omitempty"`
	InternationalStudents      *int       `json:"international_students,omitempty"`
	InternationalStudentsPct   *float64   `json:"international_students_percent,omitempty"`
	FemalePercent              *float64   `json:"female_percent,omitempty"`
	PopularFields              []string   `json:"popular_fields,omitempty"`
	ResearchStrengths          []string   `json:"research_strengths,omitempty"`
	TuitionMin                 *float64   `json:"tuition_min,omitempty"`
	TuitionMax                 *float64   `json:"tuition_max,omitempty"`
	TuitionCurrency            *string    `json:"tuition_currency,omitempty"`
	SemesterFee                *float64   `json:"semester_fee,omitempty"`
	LivingCostEstimate         *float64   `json:"living_cost_estimate,omitempty"`
	FinancialSupportAvailable  *bool      `json:"financial_support_available,omitempty"`
	ScholarshipInfo            *string    `json:"scholarship_info,omitempty"`
	BachelorAvailable          *bool      `json:"bachelor_available,omitempty"`
	MasterAvailable            *bool      `json:"master_available,omitempty"`
	PhDAvailable               *bool      `json:"phd_available,omitempty"`
	AdmissionReqSummary        *string    `json:"admission_requirements_summary,omitempty"`
	MinLanguageRequirements    *string    `json:"min_language_requirements,omitempty"`
	ApplicationPeriod          *string    `json:"application_period,omitempty"`
	AcceptanceRateEstimate     *float64   `json:"acceptance_rate_estimate,omitempty"`
	CampusSummary              *string    `json:"campus_summary,omitempty"`
	CareerOutcomesSummary      *string    `json:"career_outcomes_summary,omitempty"`
	NotableAlumniIndustryLinks *string    `json:"notable_alumni_or_industry_links,omitempty"`
	DataSource                 *string    `json:"data_source,omitempty"`
	DataSourceURL              *string    `json:"data_source_url,omitempty"`
	LastVerifiedAt             *time.Time `json:"last_verified_at,omitempty"`

	Links    []UniversityLink `json:"links"`
	Programs []ProgramLite    `json:"programs"`
}

type UniversityLink struct {
	ID             string     `json:"id"`
	LinkType       string     `json:"link_type"`
	URL            string     `json:"url"`
	Title          *string    `json:"title,omitempty"`
	IsOfficial     bool       `json:"is_official"`
	Priority       int        `json:"priority"`
	SourceCode     *string    `json:"source_code,omitempty"`
	LastVerifiedAt *time.Time `json:"last_verified_at,omitempty"`
}

type ProgramLite struct {
	ID                 string   `json:"id"`
	Title              string   `json:"title"`
	DegreeLevel        string   `json:"degree_level"`
	Field              string   `json:"field"`
	Language           string   `json:"language"`
	TuitionAmount      *float64 `json:"tuition_amount,omitempty"`
	TuitionCurrency    *string  `json:"tuition_currency,omitempty"`
	HasScholarship     bool     `json:"has_scholarship"`
	DurationMonths     *int     `json:"duration_months,omitempty"`
	ModeOfStudy        *string  `json:"mode_of_study,omitempty"`
	AttendanceType     *string  `json:"attendance_type,omitempty"`
	ProgramDescription *string  `json:"program_description,omitempty"`
	OfficialProgramURL *string  `json:"official_program_url,omitempty"`
}