package main

import (
	"context"
	"log"
	"os"
	"fmt"

	"github.com/joho/godotenv"

	"unichance-backend-go/internal/auth"
	"unichance-backend-go/internal/config"
	"unichance-backend-go/internal/db"
	httpRouter "unichance-backend-go/internal/http"
	"unichance-backend-go/internal/profile"
	"unichance-backend-go/internal/programs"
	"unichance-backend-go/internal/universities"
)



func main() {
	_ = os.Getenv("DATABASE_URL")
	_ = os.Getenv("JWT_SECRET")
	_ = godotenv.Load(".env")
	// Загружаем .env из корня проекта
	err := godotenv.Load("../.env")
	if err != nil {
		log.Println("Warning: .env file not found, using system env")
	}

	fmt.Println("DB_URL from env:", os.Getenv("DATABASE_URL"))
	fmt.Println("JWT from env:", os.Getenv("JWT_SECRET"))
	cfg := config.Load()
	if cfg.DatabaseURL == "" || cfg.JwtSecret == "" {
		log.Fatal("DATABASE_URL and JWT_SECRET are required")
	}

	pool, err := db.Connect(context.Background(), cfg.DatabaseURL)
	if err != nil {
		log.Fatal(err)
	}
	defer pool.Close()

	// profile + scoring endpoints
	profRepo := profile.Repo{DB: pool}
	profH := profile.Handler{Repo: profRepo, DB: pool}

	// auth
	authSvc := auth.Service{DB: pool, JwtSecret: cfg.JwtSecret}
	authH := auth.Handler{Svc: authSvc}

	// programs
	progRepo := programs.Repo{DB: pool}
	progH := programs.Handler{Repo: progRepo, DB: pool, ProfileRepo: profRepo}
	uniRepo := universities.Repo{DB: pool}
	uniH := universities.Handler{Repo: uniRepo}

	e := httpRouter.NewRouter(httpRouter.Deps{
		AuthHandler:         authH,
		ProgramsHandler:     progH,
		ProfileHandler:      profH,
		JwtSecret:           cfg.JwtSecret,
		UniversitiesHandler: uniH,
	})

	log.Println("api listening on :" + cfg.Port)
	log.Fatal(e.Start(":" + cfg.Port))
}
