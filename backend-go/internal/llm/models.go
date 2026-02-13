package llm

import (
	"github.com/google/uuid"
)

type ParseProgramRequest struct {
	URL          string `json:"url"`
	UniversityID string `json:"university_id"`
	ProgramName  string `json:"program_name,omitempty"`
}

type ProgramData struct {
	Title                 string         `json:"title"`
	DegreeLevel           string         `json:"degree_level"`
	Field                 string         `json:"field"`
	Language              string         `json:"language"`
	TuitionAmount         *int           `json:"tuition_amount"`
	TuitionCurrency       string         `json:"tuition_currency"`
	HasScholarship        bool           `json:"has_scholarship"`
	ScholarshipType       *string        `json:"scholarship_type"`
	ScholarshipPercentMin *int           `json:"scholarship_percent_min"`
	ScholarshipPercentMax *int           `json:"scholarship_percent_max"`
	Deadline              *string        `json:"deadline"`
	Requirements          map[string]any `json:"requirements"`
	Description           string         `json:"description"`
}

type LLMResponse struct {
	ProgramID uuid.UUID   `json:"program_id"`
	Data      ProgramData `json:"data"`
}
