package programs

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/labstack/echo/v4"

	"unichance-backend-go/internal/middleware"
	"unichance-backend-go/internal/profile"
	"unichance-backend-go/internal/scoring"
)

type Handler struct {
	Repo        Repo
	DB          *pgxpool.Pool
	ProfileRepo profile.Repo
}

func splitCSV(s string) []string {
	if strings.TrimSpace(s) == "" {
		return nil
	}
	parts := strings.Split(s, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p != "" {
			out = append(out, p)
		}
	}
	return out
}

func (h Handler) List(c echo.Context) error {
	page, _ := strconv.Atoi(c.QueryParam("page"))
	limit, _ := strconv.Atoi(c.QueryParam("limit"))

	var minT *float64
	if v := c.QueryParam("min_tuition"); v != "" {
		f, _ := strconv.ParseFloat(v, 64)
		minT = &f
	}
	var maxT *float64
	if v := c.QueryParam("max_tuition"); v != "" {
		f, _ := strconv.ParseFloat(v, 64)
		maxT = &f
	}
	var sch *bool
	if v := c.QueryParam("scholarship"); v != "" {
		b := (v == "true")
		sch = &b
	}

	params := ListParams{
		Q:           c.QueryParam("q"),
		Countries:   splitCSV(c.QueryParam("countries")),
		Levels:      splitCSV(c.QueryParam("levels")),
		Fields:      splitCSV(c.QueryParam("fields")),
		Currency:    strings.TrimSpace(c.QueryParam("currency")),
		MinTuition:  minT,
		MaxTuition:  maxT,
		Scholarship: sch,
		Sort:        c.QueryParam("sort"),
		Page:        page,
		Limit:       limit,
	}

	items, total, err := h.Repo.List(c.Request().Context(), params)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusOK, map[string]any{
		"page":  params.Page,
		"limit": params.Limit,
		"total": total,
		"items": items,
	})
}

// SmartSearch performs intelligent program-student matching
func (h Handler) SmartSearch(c echo.Context) error {
	// Require authentication
	u := c.Get("user").(middleware.CtxUser)

	// Parse query parameters
	countries := splitCSV(c.QueryParam("countries"))
	fields := splitCSV(c.QueryParam("fields"))
	levels := splitCSV(c.QueryParam("levels"))

	var maxTuition *float64
	if v := c.QueryParam("max_tuition"); v != "" {
		f, _ := strconv.ParseFloat(v, 64)
		maxTuition = &f
	}

	take, _ := strconv.Atoi(c.QueryParam("take"))
	if take <= 0 {
		take = 30
	}

	ctx := c.Request().Context()

	// Load student profile
	prof, err := h.ProfileRepo.GetMyProfile(ctx, u.ID)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "profile not found, please fill profile first",
		})
	}

	// Build enriched student profile
	studentProfile := scoring.EnrichedStudentProfile{
		GPA:            prof.GPA,
		GPAScale:       prof.GPAScale,
		IELTS:          prof.IELTS,
		TOEFL:          prof.TOEFL,
		SAT:            prof.SAT,
		BudgetYear:     prof.BudgetYear,
		BudgetCurrency: prof.BudgetCurrency,
		Citizenship:    "US", // TODO: Load from profile if available
		GraduationYear: prof.GraduationYear,
	}

	// If profile has achievements info, parse it
	// For now, assume achievements_count is in profile
	studentProfile.Achievements.Olympiads = 0
	studentProfile.Achievements.Leadership = 0
	studentProfile.Achievements.Sports = 0
	studentProfile.Achievements.Volunteering = 0
	studentProfile.Achievements.Other = 0

	// Load enriched programs
	params := SmartSearchParams{
		Countries:    countries,
		Fields:       fields,
		DegreeLevels: levels,
		MaxTuition:   maxTuition,
		Take:         take,
	}

	enrichedPrograms, err := h.Repo.ListEnrichedForSmartSearch(ctx, params)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": err.Error(),
		})
	}

	// Perform smart search matching
	response := h.Repo.PerformSmartSearch(ctx, enrichedPrograms, studentProfile)

	// Save results to match_history (optional)
	// This is optional and could be async

	return c.JSON(http.StatusOK, response)
}
