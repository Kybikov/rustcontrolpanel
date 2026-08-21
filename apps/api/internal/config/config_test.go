package config

import (
	"os"
	"path/filepath"
	"testing"
)

func TestLoadDefaults(t *testing.T) {
	t.Setenv("APP_ENV", "")
	t.Setenv("API_PORT", "")
	t.Setenv("DATABASE_URL", "")
	t.Setenv("REDIS_URL", "")
	t.Setenv("REDIS_ENABLED", "")
	t.Setenv("CORS_ALLOWED_ORIGINS", "")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load() error = %v", err)
	}
	if cfg.ListenAddr != ":8080" {
		t.Fatalf("ListenAddr = %q, want :8080", cfg.ListenAddr)
	}
	if !cfg.RedisEnabled {
		t.Fatal("RedisEnabled = false, want true")
	}
	if len(cfg.AllowedOrigins) != 1 || cfg.AllowedOrigins[0] != "http://localhost:3000" {
		t.Fatalf("AllowedOrigins = %#v, want localhost frontend", cfg.AllowedOrigins)
	}
}

func TestLoadRejectsInvalidPort(t *testing.T) {
	t.Setenv("API_PORT", "not-a-port")
	if _, err := Load(); err == nil {
		t.Fatal("Load() error = nil, want invalid port error")
	}
}

func TestLoadUsesDockerSecretForSensitiveValues(t *testing.T) {
	secretPath := filepath.Join(t.TempDir(), "keys.txt")
	contents := "SUPERADMIN_EMAIL=admin@example.com\nSUPERADMIN_PASSWORD=secure-password\nINTEGRATIONS_ENCRYPTION_KEY=encryption-key\nSTEAM_WEB_API_KEY=steam-key\n"
	if err := os.WriteFile(secretPath, []byte(contents), 0o600); err != nil {
		t.Fatalf("write secret: %v", err)
	}
	t.Setenv("INTEGRATION_CREDENTIALS_FILE", secretPath)
	t.Setenv("SUPERADMIN_EMAIL", "")
	t.Setenv("SUPERADMIN_PASSWORD", "")
	t.Setenv("INTEGRATIONS_ENCRYPTION_KEY", "")
	t.Setenv("STEAM_WEB_API_KEY", "")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load() error = %v", err)
	}
	if cfg.SuperAdminEmail != "admin@example.com" || cfg.SuperAdminPassword != "secure-password" {
		t.Fatalf("super admin credentials were not loaded from secret: %#v", cfg)
	}
	if cfg.IntegrationsEncryptionKey != "encryption-key" || cfg.SteamWebAPIKey != "steam-key" {
		t.Fatalf("provider configuration was not loaded from secret: %#v", cfg)
	}
}
