package smartmatching

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"math"
	"net/http"
	"sort"
	"strings"
	"time"

	"unichance-backend-go/internal/programs"
)

type OpenAIClient struct {
	APIKey string
	Model  string
}

type chatReq struct {
	Model       string        `json:"model"`
	Messages    []chatMessage `json:"messages"`
	Temperature float64       `json:"temperature"`
}

type chatMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type chatResp struct {
	Choices []struct {
		Message chatMessage `json:"message"`
	} `json:"choices"`
}

func (c OpenAIClient) Complete(ctx context.Context, prompt string) (string, error) {
	if strings.TrimSpace(c.APIKey) == "" {
		return "", fmt.Errorf("OPENAI_API_KEY is not configured")
	}
	model := c.Model
	if model == "" {
		model = "gpt-4o-mini"
	}
	body := chatReq{Model: model, Temperature: 0.2, Messages: []chatMessage{{Role: "system", Content: "Follow the instruction strictly."}, {Role: "user", Content: prompt}}}
	b, _ := json.Marshal(body)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, "https://api.openai.com/v1/chat/completions", bytes.NewReader(b))
	if err != nil {
		return "", err
	}
	req.Header.Set("Authorization", "Bearer "+c.APIKey)
	req.Header.Set("Content-Type", "application/json")

	client := http.Client{Timeout: 25 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	respBody, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 400 {
		return "", fmt.Errorf("openai error: %s", string(respBody))
	}
	var parsed chatResp
	if err := json.Unmarshal(respBody, &parsed); err != nil {
		return "", err
	}
	if len(parsed.Choices) == 0 {
		return "", fmt.Errorf("openai empty choices")
	}
	return parsed.Choices[0].Message.Content, nil
}

type Service struct {
	AI *OpenAIClient
}

func (s Service) BuildRecommendations(ctx context.Context, profile StudentProfileInput, list []programs.ProgramCard, take int) []MatchRecommendation {
	if take <= 0 {
		take = 10
	}
	if take > 30 {
		take = 30
	}
	out := make([]MatchRecommendation, 0, len(list))
	for _, p := range list {
		f := scoreFactors(profile, p)
		total := f.ProgramRelevance*0.2 + f.DegreeFit*0.1 + f.CountryFit*0.1 + f.LanguageFit*0.1 + f.TuitionFit*0.15 + f.ScholarshipFit*0.1 + f.ProfileStrength*0.2 + f.Competitiveness*0.05
		chance := int(math.Round(total))
		band := "reach"
		if chance >= 70 {
			band = "safety"
		} else if chance >= 45 {
			band = "target"
		}
		reasoning := buildReasons(profile, p, f)
		improvements := buildImprovements(profile, p, f)
		out = append(out, MatchRecommendation{
			Program:         p,
			MatchScore:      total,
			ChanceBand:      band,
			ChancePercent:   chance,
			Reasoning:       reasoning,
			Improvements:    improvements,
			FactorBreakdown: f,
		})
	}
	sort.Slice(out, func(i, j int) bool { return out[i].MatchScore > out[j].MatchScore })
	if len(out) > take {
		out = out[:take]
	}
	return out
}

func scoreFactors(profile StudentProfileInput, p programs.ProgramCard) MatchFactors {
	contains := func(arr []string, val string) bool {
		v := strings.ToLower(strings.TrimSpace(val))
		for _, x := range arr {
			if strings.ToLower(strings.TrimSpace(x)) == v {
				return true
			}
		}
		return false
	}
	programRel := 50.0
	if profile.IntendedMajor != "" && strings.Contains(strings.ToLower(p.Field), strings.ToLower(profile.IntendedMajor)) {
		programRel = 95
	} else if profile.IntendedMajor != "" {
		programRel = 45
	}
	degreeFit := 55.0
	if profile.DegreeTarget != "" && strings.EqualFold(profile.DegreeTarget, p.DegreeLevel) {
		degreeFit = 100
	}
	countryFit := 60.0
	if len(profile.CountryPreferences) > 0 {
		if contains(profile.CountryPreferences, p.CountryCode) {
			countryFit = 100
		} else {
			countryFit = 30
		}
	}
	langFit := 60.0
	if len(profile.LanguagePreferences) > 0 {
		if contains(profile.LanguagePreferences, p.Language) {
			langFit = 100
		} else {
			langFit = 35
		}
	}
	tuitionFit := 65.0
	if profile.BudgetAnnual != nil && p.TuitionAmount != nil {
		if *p.TuitionAmount <= *profile.BudgetAnnual {
			tuitionFit = 100
		} else if *p.TuitionAmount <= *profile.BudgetAnnual*1.2 {
			tuitionFit = 60
		} else {
			tuitionFit = 20
		}
	}
	schFit := 50.0
	if profile.ScholarshipNeed {
		if p.HasScholarship {
			schFit = 100
		} else {
			schFit = 10
		}
	} else if p.HasScholarship {
		schFit = 80
	}
	profileStrength := 55.0
	if profile.GPA != nil {
		gpaScale := 4.0
		if profile.GPAScale != nil && *profile.GPAScale > 0 {
			gpaScale = *profile.GPAScale
		}
		norm := *profile.GPA / gpaScale
		if norm > 1 {
			norm = 1
		}
		profileStrength = 30 + norm*60
	}
	if profile.IELTS != nil {
		profileStrength += (*profile.IELTS - 5.5) * 5
	}
	if len(profile.Achievements)+len(profile.Awards)+len(profile.Experience) > 0 {
		profileStrength += 8
	}
	if profileStrength > 100 {
		profileStrength = 100
	}
	comp := 70.0
	if p.QSRank != nil {
		if *p.QSRank <= 50 {
			comp = 45
		} else if *p.QSRank <= 200 {
			comp = 60
		} else {
			comp = 80
		}
	}
	return MatchFactors{ProgramRelevance: programRel, DegreeFit: degreeFit, CountryFit: countryFit, LanguageFit: langFit, TuitionFit: tuitionFit, ScholarshipFit: schFit, ProfileStrength: profileStrength, Competitiveness: comp}
}

func buildReasons(profile StudentProfileInput, p programs.ProgramCard, f MatchFactors) []string {
	res := []string{fmt.Sprintf("Программа %q соотносится с направлением %q.", p.Title, p.Field)}
	if f.TuitionFit >= 80 {
		res = append(res, "Стоимость обучения укладывается в заявленный бюджет.")
	}
	if p.HasScholarship {
		res = append(res, "У программы отмечена доступность стипендий.")
	}
	if f.CountryFit >= 90 {
		res = append(res, fmt.Sprintf("Страна %s входит в ваши предпочтения.", p.CountryCode))
	}
	if profile.IELTS != nil {
		res = append(res, fmt.Sprintf("Ваш IELTS %.1f учтён в оценке академической готовности.", *profile.IELTS))
	}
	return res
}

func buildImprovements(profile StudentProfileInput, _ programs.ProgramCard, f MatchFactors) []string {
	out := make([]string, 0, 3)
	if f.ProfileStrength < 70 {
		out = append(out, "Поднимите академический профиль: улучшите GPA и добавьте результаты экзаменов.")
	}
	if profile.IELTS == nil && profile.TOEFL == nil {
		out = append(out, "Добавьте IELTS/TOEFL для более точного матчинга и повышения шансов.")
	}
	if len(profile.Achievements)+len(profile.Experience) == 0 {
		out = append(out, "Добавьте достижения, проекты, исследовательский или рабочий опыт.")
	}
	if len(out) == 0 {
		out = append(out, "Подготовьте сильное мотивационное письмо и 2 релевантные рекомендации.")
	}
	return out
}
