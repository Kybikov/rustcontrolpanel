package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"
)

type Config struct {
	Environment    string
	ListenAddr     string
	DatabaseURL    string
	RedisURL       string
	RedisEnabled   bool
	AllowedOrigins []string
}

func Load() (Config, error) {
	port := env("API_PORT", "8080")
	if _, err := strconv.Atoi(port); err != nil {
		return Config{}, fmt.Errorf("API_PORT must be numeric: %w", err)
	}

	redisEnabled, err := strconv.ParseBool(env("REDIS_ENABLED", "true"))
	if err != nil {
		return Config{}, fmt.Errorf("REDIS_ENABLED must be boolean: %w", err)
	}

	origins := strings.FieldsFunc(env("CORS_ALLOWED_ORIGINS", "http://localhost:3000"), func(r rune) bool {
		return r == ',' || r == ' ' || r == '\n' || r == '\t'
	})

	return Config{
		Environment:    env("APP_ENV", "development"),
		ListenAddr:     ":" + port,
		DatabaseURL:    env("DATABASE_URL", "postgres://rustcontrol:rustcontrol@localhost:5432/rustcontrol?sslmode=disable"),
		RedisURL:       env("REDIS_URL", "redis://localhost:6379/0"),
		RedisEnabled:   redisEnabled,
		AllowedOrigins: origins,
	}, nil
}

func env(key, fallback string) string {
	if value := strings.TrimSpace(os.Getenv(key)); value != "" {
		return value
	}
	return fallback
}
