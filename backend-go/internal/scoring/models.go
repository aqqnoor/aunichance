package scoring

type ChanceResult struct {
	Score           int      `json:"score"`
	Category        string   `json:"category"`
	Reasons         []string `json:"reasons"`
	Recommendations []string `json:"recommendations"`
}
