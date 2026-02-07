package profile

import (
  "net/http"

  "github.com/labstack/echo/v4"
  "github.com/jackc/pgx/v5"
  "github.com/jackc/pgx/v5/pgxpool"

  "unichance-backend-go/internal/middleware"
  "unichance-backend-go/internal/scoring"
)

type Handler struct {
  Repo Repo
  DB *pgxpool.Pool
}

func (h Handler) GetMe(c echo.Context) error {
  u := c.Get("user").(middleware.CtxUser)
  p, err := h.Repo.GetMyProfile(c.Request().Context(), u.ID)
  if err != nil {
    if err == pgx.ErrNoRows {
      return c.JSON(http.StatusOK, map[string]any{"profile": nil})
    }
    return c.JSON(http.StatusBadRequest, map[string]string{"error": err.Error()})
  }
  return c.JSON(http.StatusOK, map[string]any{"profile": p})
}

func (h Handler) UpsertMe(c echo.Context) error {
  u := c.Get("user").(middleware.CtxUser)
  var req Profile
  if err := c.Bind(&req); err != nil {
    return c.JSON(http.StatusBadRequest, map[string]string{"error":"bad body"})
  }
  p, err := h.Repo.UpsertMyProfile(c.Request().Context(), u.ID, req)
  if err != nil {
    return c.JSON(http.StatusBadRequest, map[string]string{"error": err.Error()})
  }
  return c.JSON(http.StatusOK, map[string]any{"profile": p})
}

type scoreReq struct {
  ProgramID string `json:"program_id"`
}

func (h Handler) ScoreProgram(c echo.Context) error {
  u := c.Get("user").(middleware.CtxUser)

  var req scoreReq
  if err := c.Bind(&req); err != nil || req.ProgramID == "" {
    return c.JSON(http.StatusBadRequest, map[string]string{"error":"program_id required"})
  }

  prof, err := h.Repo.GetMyProfile(c.Request().Context(), u.ID)
  if err != nil { return c.JSON(http.StatusBadRequest, map[string]string{"error":"profile not found"}) }

  // requirements алу (егер requirements кестесі толса)
  var r scoring.Requirements
  err = h.DB.QueryRow(c.Request().Context(), `
    SELECT min_gpa, min_ielts, min_toefl, min_sat
    FROM requirements WHERE program_id=$1
  `, req.ProgramID).Scan(&r.MinGPA, &r.MinIELTS, &r.MinTOEFL, &r.MinSAT)
  // requirements жоқ болса — норма
  if err != nil && err != pgx.ErrNoRows {
    return c.JSON(http.StatusBadRequest, map[string]string{"error": err.Error()})
  }

  // Check if user has achievements
  hasAchievements := (prof.Awards != nil && *prof.Awards != "") || 
                     (prof.AchievementsSummary != nil && *prof.AchievementsSummary != "")

  res := scoring.Compute(scoring.Profile{
    GPA: prof.GPA, GPAScale: prof.GPAScale,
    IELTS: prof.IELTS, TOEFL: prof.TOEFL, SAT: prof.SAT,
    BudgetYear: prof.BudgetYear,
    HasAchievements: hasAchievements,
  }, r)

  // Save to history
  _, _ = h.DB.Exec(c.Request().Context(), `
    INSERT INTO scores(profile_id, program_id, score, reasons)
    VALUES ($1,$2,$3,to_jsonb($4::text[]))
  `, prof.ID, req.ProgramID, res.Score, res.Reasons)

  return c.JSON(http.StatusOK, map[string]any{
    "score": res.Score,
    "category": res.Category,
    "breakdown": res.Breakdown,
    "reasons": res.Reasons,
  })
}
