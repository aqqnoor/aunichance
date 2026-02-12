package http

import (
	"unichance-backend-go/internal/universities"

	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
	echoMw "github.com/labstack/echo/v4/middleware"

	"unichance-backend-go/internal/auth"
	appMw "unichance-backend-go/internal/middleware"
	"unichance-backend-go/internal/profile"
	"unichance-backend-go/internal/programs"
)

type Deps struct {
	AuthHandler         auth.Handler
	ProgramsHandler     programs.Handler
	ProfileHandler      profile.Handler
	UniversitiesHandler universities.Handler
	JwtSecret           string
}

func NewRouter(d Deps) *echo.Echo {
	e := echo.New()

	e.Use(echoMw.Logger())
	e.Use(echoMw.Recover())
	e.Use(echoMw.CORSWithConfig(echoMw.CORSConfig{
		AllowOrigins: []string{"http://localhost:5173"},
		AllowHeaders: []string{"Authorization", "Content-Type"},
		AllowMethods: []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
	}))

	e.Use(middleware.CORSWithConfig(middleware.CORSConfig{
		AllowOrigins: []string{"http://localhost:5173", "http://127.0.0.1:5173"},
		AllowMethods: []string{echo.GET, echo.POST, echo.PUT, echo.DELETE, echo.OPTIONS},
		AllowHeaders: []string{"Origin", "Content-Type", "Accept", "Authorization"},
	}))

	e.GET("/health", func(c echo.Context) error { return c.String(200, "ok") })

	// auth (public)
	e.POST("/auth/register", d.AuthHandler.Register)
	e.POST("/auth/login", d.AuthHandler.Login)

	// auth/me (protected)
	e.GET("/auth/me", d.AuthHandler.Me, appMw.RequireAuth(d.JwtSecret))

	// programs (public)
	e.GET("/programs", d.ProgramsHandler.List)

	// smart-search (protected)
	e.GET("/programs/smart-search", d.ProgramsHandler.SmartSearch, appMw.RequireAuth(d.JwtSecret))

	// profile (protected)
	e.GET("/profile/me", d.ProfileHandler.GetMe, appMw.RequireAuth(d.JwtSecret))
	e.POST("/profile/me", d.ProfileHandler.UpsertMe, appMw.RequireAuth(d.JwtSecret))
	e.POST("/score", d.ProfileHandler.ScoreProgram, appMw.RequireAuth(d.JwtSecret))

	// universities (public)
	e.GET("/universities/:id", d.UniversitiesHandler.GetByID)
	e.GET("/universities", d.UniversitiesHandler.List) // ← добавить эту строку

	return e
}
