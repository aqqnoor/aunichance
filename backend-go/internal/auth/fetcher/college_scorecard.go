package fetcher

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"time"
)

type ScorecardSchool struct {
	ID   int `json:"id"`
	Name struct {
		Institution string `json:"institution"`
	} `json:"school"`
	Admissions struct {
		AdmissionRateOverall *float64 `json:"latest.admissions.admission_rate.overall"`
		SatAverageOverall    *float64 `json:"latest.admissions.sat_scores.average.overall"`
	} `json:"admissions"`
	Cost struct {
		TuitionInState *float64 `json:"latest.cost.tuition.in_state"`
	} `json:"cost"`
}

type ScorecardResponse struct {
	Results []ScorecardSchool `json:"results"`
	Metadata struct {
		Total int `json:"total"`
	} `json:"metadata"`
}

func FetchCollegeScorecard(apiKey string, page int) (*ScorecardResponse, error) {
	url := fmt.Sprintf(
		"https://api.data.gov/ed/collegescorecard/v1/schools?api_key=%s&page=%d&per_page=100&fields=id,school.name,latest.admissions.admission_rate.overall,latest.admissions.sat_scores.average.overall,latest.cost.tuition.in_state",
		apiKey, page,
	)

	client := http.Client{Timeout: 10 * time.Second}
	resp, err := client.Get(url)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var result ScorecardResponse
	err = json.Unmarshal(body, &result)
	if err != nil {
		return nil, err
	}

	return &result, nil
}

func ImportScorecardToDB(db *sql.DB) error {
	apiKey := os.Getenv("COLLEGE_SCORECARD_KEY")
	if apiKey == "" {
		return fmt.Errorf("COLLEGE_SCORECARD_KEY not set")
	}

	page := 0
	imported := 0

	for {
		data, err := FetchCollegeScorecard(apiKey, page)
		if err != nil {
			return err
		}

		if len(data.Results) == 0 {
			break
		}

		for _, school := range data.Results {
			_, err := db.Exec(`
				INSERT INTO universities (
					name, country, acceptance_rate, sat_average, 
					tuition_in_state, source, last_updated
				) VALUES ($1, 'USA', $2, $3, $4, 'college_scorecard', $5)
				ON CONFLICT (name) DO UPDATE SET
					acceptance_rate = EXCLUDED.acceptance_rate,
					sat_average = EXCLUDED.sat_average,
					tuition_in_state = EXCLUDED.tuition_in_state,
					last_updated = EXCLUDED.last_updated
			`,
				school.Name.Institution,
				school.Admissions.AdmissionRateOverall,
				school.Admissions.SatAverageOverall,
				school.Cost.TuitionInState,
				time.Now(),
			)
			if err != nil {
				fmt.Printf("Error inserting %s: %v\n", school.Name.Institution, err)
			}
		}

		imported += len(data.Results)
		fmt.Printf("Page %d: imported %d schools (total: %d)\n", page, len(data.Results), imported)
		page++
		time.Sleep(1 * time.Second)
	}

	fmt.Printf("✅ Done! Imported %d universities from College Scorecard\n", imported)
	return nil
}