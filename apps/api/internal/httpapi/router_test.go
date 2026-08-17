package httpapi

import (
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/Kybikov/rustcontrolpanel/apps/api/internal/config"
	"github.com/Kybikov/rustcontrolpanel/apps/api/internal/realtime"
)

func TestHealthzIsLivenessOnly(t *testing.T) {
	cfg := config.Config{Environment: "test", AllowedOrigins: []string{"http://localhost:3000"}}
	router := NewRouter(cfg, nil, realtime.NewHub(), slog.Default())
	req := httptest.NewRequest(http.MethodGet, "/healthz", nil)
	res := httptest.NewRecorder()

	router.ServeHTTP(res, req)

	if res.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", res.Code, http.StatusOK)
	}
	if res.Header().Get("Content-Type") != "application/json; charset=utf-8" {
		t.Fatalf("content type = %q", res.Header().Get("Content-Type"))
	}
}

func TestReadyzReportsMissingDependencies(t *testing.T) {
	cfg := config.Config{Environment: "test", AllowedOrigins: []string{"http://localhost:3000"}}
	router := NewRouter(cfg, nil, realtime.NewHub(), slog.Default())
	req := httptest.NewRequest(http.MethodGet, "/readyz", nil)
	res := httptest.NewRecorder()

	router.ServeHTTP(res, req)

	if res.Code != http.StatusServiceUnavailable {
		t.Fatalf("status = %d, want %d", res.Code, http.StatusServiceUnavailable)
	}
}
