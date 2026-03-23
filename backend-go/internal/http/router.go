package http

import (
	"fmt"
	"net/http"

	"github.com/labstack/echo/v4"
	echoMw "github.com/labstack/echo/v4/middleware"

	"unichance-backend-go/internal/auth"
	appMw "unichance-backend-go/internal/middleware"
	"unichance-backend-go/internal/profile"
	"unichance-backend-go/internal/programs"
	"unichance-backend-go/internal/smartmatching"
	"unichance-backend-go/internal/universities"
)

type Deps struct {
	AuthHandler          auth.Handler
	ProgramsHandler      programs.Handler
	ProfileHandler       profile.Handler
	UniversitiesHandler  universities.Handler
	SmartMatchingHandler smartmatching.Handler
	LLMHandler           interface{}
	JwtSecret            string
}

func NewRouter(d Deps) *echo.Echo {
	e := echo.New()

	e.Use(echoMw.Logger())
	e.Use(echoMw.Recover())
	e.Use(echoMw.CORSWithConfig(echoMw.CORSConfig{
		AllowOrigins: []string{"http://localhost:5173", "http://127.0.0.1:5173"},
		AllowHeaders: []string{"Authorization", "Content-Type", "Origin", "Accept"},
		AllowMethods: []string{echo.GET, echo.POST, echo.PUT, echo.PATCH, echo.DELETE, echo.OPTIONS},
	}))

	e.HTTPErrorHandler = func(err error, c echo.Context) {
		if c.Response().Committed {
			return
		}
		code := 500
		message := "internal server error"

		if he, ok := err.(*echo.HTTPError); ok {
			code = he.Code
			if m, ok := he.Message.(string); ok {
				message = m
			} else if he.Message != nil {
				message = fmt.Sprint(he.Message)
			} else {
				message = http.StatusText(code)
			}
		}

		_ = c.JSON(code, map[string]any{
			"error": map[string]any{
				"code":    code,
				"message": message,
				"details": nil,
			},
		})
	}

	e.GET("/health", func(c echo.Context) error {
		return c.JSON(200, map[string]any{
			"status":  "ok",
			"service": "backend",
		})
	})

	authLimiter := echoMw.RateLimiter(echoMw.NewRateLimiterMemoryStore(20))
	searchLimiter := echoMw.RateLimiter(echoMw.NewRateLimiterMemoryStore(60))

	e.POST("/auth/register", d.AuthHandler.Register, authLimiter)
	e.POST("/auth/login", d.AuthHandler.Login, authLimiter)
	e.GET("/auth/me", d.AuthHandler.Me, appMw.RequireAuth(d.JwtSecret))

	e.GET("/programs", d.ProgramsHandler.List, searchLimiter)
	e.GET("/programs/search", d.ProgramsHandler.List, searchLimiter)
	e.GET("/programs/smart-search", d.ProgramsHandler.SmartSearch, appMw.RequireAuth(d.JwtSecret))

	e.GET("/profile/me", d.ProfileHandler.GetMe, appMw.RequireAuth(d.JwtSecret))
	e.POST("/profile/me", d.ProfileHandler.UpsertMe, appMw.RequireAuth(d.JwtSecret))
	e.POST("/score", d.ProfileHandler.ScoreProgram, appMw.RequireAuth(d.JwtSecret))

	e.POST("/smart-matching/profile", d.SmartMatchingHandler.SaveProfile, appMw.RequireAuth(d.JwtSecret))
	e.POST("/smart-matching/recommendations", d.SmartMatchingHandler.Recommendations, appMw.RequireAuth(d.JwtSecret))
	e.POST("/smart-matching/chat", d.SmartMatchingHandler.Chat, appMw.RequireAuth(d.JwtSecret))

	if d.LLMHandler != nil {
		if h, ok := d.LLMHandler.(interface{ ImprovementTips(echo.Context) error }); ok {
			e.POST("/api/llm/improvement-tips", h.ImprovementTips, appMw.RequireAuth(d.JwtSecret))
		}
	}

	e.GET("/universities/:id", d.UniversitiesHandler.GetByID)
	e.GET("/universities", d.UniversitiesHandler.List)

	return e
}
