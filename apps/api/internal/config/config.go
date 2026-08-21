package config

import (
	"bufio"
	"fmt"
	"os"
	"strconv"
	"strings"
)

type Config struct {
	Environment                string
	ListenAddr                 string
	DatabaseURL                string
	RedisURL                   string
	RedisEnabled               bool
	AllowedOrigins             []string
	SuperAdminEmail            string
	SuperAdminPassword         string
	IntegrationsEncryptionKey  string
	IntegrationCredentialsFile string
	BattleMetricsAPIToken      string
	SteamWebAPIKey             string
	PublicAPIURL               string
	PublicWebURL               string
	VAPIDPublicKey             string
	VAPIDPrivateKey            string
	VAPIDSubject               string
}

func Load() (Config, error) {
	secretValues := loadSecretValues(os.Getenv("INTEGRATION_CREDENTIALS_FILE"))
	envOrSecret := func(key, fallback string) string {
		if value := strings.TrimSpace(os.Getenv(key)); value != "" {
			return value
		}
		if value := strings.TrimSpace(secretValues[key]); value != "" {
			return value
		}
		return fallback
	}

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
		Environment:                env("APP_ENV", "development"),
		ListenAddr:                 ":" + port,
		DatabaseURL:                env("DATABASE_URL", "postgres://rustcontrol:rustcontrol@localhost:5432/rustcontrol?sslmode=disable"),
		RedisURL:                   env("REDIS_URL", "redis://localhost:6379/0"),
		RedisEnabled:               redisEnabled,
		AllowedOrigins:             origins,
		SuperAdminEmail:            envOrSecret("SUPERADMIN_EMAIL", "admin@rustcontrol.local"),
		SuperAdminPassword:         envOrSecret("SUPERADMIN_PASSWORD", ""),
		IntegrationsEncryptionKey:  envOrSecret("INTEGRATIONS_ENCRYPTION_KEY", ""),
		IntegrationCredentialsFile: os.Getenv("INTEGRATION_CREDENTIALS_FILE"),
		BattleMetricsAPIToken:      envOrSecret("BATTLEMETRICS_API_TOKEN", ""),
		SteamWebAPIKey:             envOrSecret("STEAM_WEB_API_KEY", ""),
		PublicAPIURL:               env("PUBLIC_API_URL", "http://localhost:8080"),
		PublicWebURL:               env("PUBLIC_WEB_URL", "http://localhost:3001"),
		VAPIDPublicKey:             envOrSecret("VAPID_PUBLIC_KEY", ""),
		VAPIDPrivateKey:            envOrSecret("VAPID_PRIVATE_KEY", ""),
		VAPIDSubject:               envOrSecret("VAPID_SUBJECT", "mailto:rustcontrol@localhost"),
	}, nil
}

// loadSecretValues reads a Docker secret containing KEY=value entries. Missing
// files are intentionally ignored so local development keeps working without one.
func loadSecretValues(path string) map[string]string {
	values := make(map[string]string)
	path = strings.TrimSpace(path)
	if path == "" {
		return values
	}

	file, err := os.Open(path)
	if err != nil {
		return values
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		key, value, found := strings.Cut(line, "=")
		if !found {
			continue
		}
		key = strings.TrimSpace(key)
		value = strings.Trim(strings.TrimSpace(value), "\"'")
		if key != "" && value != "" {
			values[key] = value
		}
	}
	return values
}

func env(key, fallback string) string {
	if value := strings.TrimSpace(os.Getenv(key)); value != "" {
		return value
	}
	return fallback
}
