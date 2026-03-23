package smartmatching

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	"github.com/labstack/echo/v4"

	"unichance-backend-go/internal/middleware"
	"unichance-backend-go/internal/programs"
)

type Handler struct {
	Repo     Repo
	ProgRepo programs.Repo
	Service  Service
}

func (h Handler) SaveProfile(c echo.Context) error {
	u := c.Get("user").(middleware.CtxUser)
	var req SaveProfileRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid json"})
	}
	if strings.TrimSpace(req.Profile.OutputLanguage) == "" {
		req.Profile.OutputLanguage = "ru"
	}
	if err := h.Repo.SaveProfile(c.Request().Context(), u.ID, req.Profile); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]any{"status": "saved"})
}

func (h Handler) Recommendations(c echo.Context) error {
	u := c.Get("user").(middleware.CtxUser)
	var req RecommendRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid json"})
	}
	ctx := c.Request().Context()

	var profile StudentProfileInput
	if req.Profile != nil {
		profile = *req.Profile
	} else {
		stored, err := h.Repo.GetProfile(ctx, u.ID)
		if err != nil {
			return c.JSON(http.StatusBadRequest, map[string]string{"error": "smart matching profile not found"})
		}
		profile = *stored
	}
	if profile.OutputLanguage == "" {
		profile.OutputLanguage = "ru"
	}

	params := programs.ListParams{
		Countries:   profile.CountryPreferences,
		Levels:      nonEmptySlice(profile.DegreeTarget),
		Fields:      nonEmptySlice(profile.IntendedMajor),
		Cities:      profile.CityPreferences,
		Languages:   profile.LanguagePreferences,
		Sort:        "relevance",
		Page:        1,
		Limit:       100,
		MinTuition:  nil,
		MaxTuition:  profile.BudgetAnnual,
		Scholarship: nil,
	}
	items, total, err := h.ProgRepo.List(ctx, params)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	recs := h.Service.BuildRecommendations(ctx, profile, items, req.Take)
	if req.IncludeAI && h.Service.AI != nil {
		lang := req.Language
		if lang == "" {
			lang = profile.OutputLanguage
		}
		for i := range recs {
			if i >= 5 {
				break
			}
			programJSON, _ := json.Marshal(recs[i].Program)
			profileJSON, _ := json.Marshal(profile)
			prompt := fmt.Sprintf(ExplainPromptTemplate, lang, string(programJSON), string(profileJSON))
			text, err := h.Service.AI.Complete(ctx, prompt)
			if err == nil {
				recs[i].AIExplanation = strings.TrimSpace(text)
			}
		}
	}

	return c.JSON(http.StatusOK, RecommendationsResponse{
		Profile:         profile,
		Recommendations: recs,
		Meta: map[string]any{
			"source":           "internal_db",
			"total_candidates": total,
			"ai_enabled":       req.IncludeAI && h.Service.AI != nil,
		},
	})
}

func (h Handler) Chat(c echo.Context) error {
	var req ChatRequest
	if err := c.Bind(&req); err != nil || strings.TrimSpace(req.Question) == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "question is required"})
	}
	if h.Service.AI == nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "ai is not configured"})
	}
	if req.Language == "" {
		req.Language = "ru"
	}
	profileJSON, _ := json.Marshal(req.Profile)
	recsJSON, _ := json.Marshal(req.Recommendations)
	prompt := fmt.Sprintf(ChatPromptTemplate, req.Language, string(profileJSON), string(recsJSON), req.Question)
	text, err := h.Service.AI.Complete(c.Request().Context(), prompt)
	if err != nil {
		return c.JSON(http.StatusBadGateway, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]any{
		"answer": strings.TrimSpace(text),
		"source": "internal_recommendations",
	})
}

func nonEmptySlice(v string) []string {
	v = strings.TrimSpace(v)
	if v == "" {
		return nil
	}
	return []string{v}
}
