package llm

import (
	"bytes"
	"encoding/json"
	"net/http"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/labstack/echo/v4"

	"unichance-backend-go/internal/middleware"
	"unichance-backend-go/internal/profile"
)

type Handler struct {
	DB          *pgxpool.Pool
	ProfileRepo profile.Repo
	LLMURL      string
}

type improvReq struct {
	ProgramID string `json:"program_id"`
}

// ImprovementTips proxies a request to the LLM microservice to generate
// improvement tips for a program given the calling user's profile.
func (h Handler) ImprovementTips(c echo.Context) error {
	var req improvReq
	if err := c.Bind(&req); err != nil || req.ProgramID == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "program_id required"})
	}

	u := c.Get("user").(middleware.CtxUser)
	ctx := c.Request().Context()

	// Load program basic info and requirements
	var title string
	var requirements json.RawMessage
	var universityName string
	var country string

	row := h.DB.QueryRow(ctx, `
      SELECT p.title, p.requirements, u.name as university_name, u.country_code
      FROM programs p
      JOIN universities u ON p.university_id = u.id
      WHERE p.id = $1
    `, req.ProgramID)

	if err := row.Scan(&title, &requirements, &universityName, &country); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "program not found"})
	}

	// Load user profile
	prof, err := h.ProfileRepo.GetMyProfile(ctx, u.ID)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "profile not found"})
	}

	payload := map[string]interface{}{
		"program": map[string]interface{}{
			"id":    req.ProgramID,
			"title": title,
		},
		"requirements":    json.RawMessage(requirements),
		"country":         country,
		"university_name": universityName,
		"user_profile": map[string]interface{}{
			"sat":   prof.SAT,
			"toefl": prof.TOEFL,
			"ielts": prof.IELTS,
			"gpa":   prof.GPA,
		},
	}

	llmURL := h.LLMURL
	if llmURL == "" {
		llmURL = "http://llm_service:8000"
	}

	b, _ := json.Marshal(payload)
	client := &http.Client{Timeout: 20 * time.Second}
	resp, err := client.Post(llmURL+"/api/llm/improvement-tips", "application/json", bytes.NewReader(b))
	if err != nil {
		return c.JSON(http.StatusBadGateway, map[string]string{"error": "llm service request failed"})
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		var txt bytes.Buffer
		_, _ = txt.ReadFrom(resp.Body)
		return c.JSON(http.StatusBadGateway, map[string]string{"error": "llm service error: " + txt.String()})
	}

	var result interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return c.JSON(http.StatusBadGateway, map[string]string{"error": "invalid llm response"})
	}

	return c.JSON(http.StatusOK, result)
}
