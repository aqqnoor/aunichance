package config

import "os"

type Config struct {
	DatabaseURL  string
	JwtSecret    string
	Port         string
	OpenAIAPIKey string
	OpenAIModel  string
}

func Load() Config {
	c := Config{
		DatabaseURL:  os.Getenv("DATABASE_URL"),
		JwtSecret:    os.Getenv("JWT_SECRET"),
		Port:         os.Getenv("PORT"),
		OpenAIAPIKey: os.Getenv("OPENAI_API_KEY"),
		OpenAIModel:  os.Getenv("OPENAI_MODEL"),
	}
	if c.Port == "" {
		c.Port = "8080"
	}
	return c
}
