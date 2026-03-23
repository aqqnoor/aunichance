package programs

type ProgramCard struct {
	ID          string `json:"id"`
	Title       string `json:"title"`
	DegreeLevel string `json:"degree_level"`
	Field       string `json:"field"`
	Language    string `json:"language"`

	TuitionAmount   *float64 `json:"tuition_amount"`
	TuitionCurrency *string  `json:"tuition_currency"`

	HasScholarship        bool    `json:"has_scholarship"`
	ScholarshipType       *string `json:"scholarship_type"`
	ScholarshipPercentMin *int    `json:"scholarship_percent_min"`
	ScholarshipPercentMax *int    `json:"scholarship_percent_max"`
	ProgramDescription    *string `json:"program_description,omitempty"`
	DurationMonths        *int    `json:"duration_months,omitempty"`
	ModeOfStudy           *string `json:"mode_of_study,omitempty"`
	AttendanceType        *string `json:"attendance_type,omitempty"`
	OfficialProgramURL    *string `json:"official_program_url,omitempty"`
	CareerPaths           *string `json:"career_paths,omitempty"`
	AdmissionNotes        *string `json:"admission_notes,omitempty"`

	UniversityName string  `json:"university_name"`
	CountryCode    string  `json:"country_code"`
	City           *string `json:"city"`
	QSRank         *int    `json:"qs_rank"`
	THERank        *int    `json:"the_rank"`

	UniversityID string `json:"university_id"`
}
