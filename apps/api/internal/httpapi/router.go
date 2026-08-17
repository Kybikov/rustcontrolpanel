package httpapi

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"slices"
	"time"

	"github.com/Kybikov/rustcontrolpanel/apps/api/internal/auth"
	"github.com/Kybikov/rustcontrolpanel/apps/api/internal/config"
	"github.com/Kybikov/rustcontrolpanel/apps/api/internal/realtime"
	"github.com/Kybikov/rustcontrolpanel/apps/api/internal/storage"
	"github.com/gorilla/websocket"
)

func NewRouter(cfg config.Config, clients *storage.Clients, hub *realtime.Hub, logger *slog.Logger) http.Handler {
	var dbService *auth.Service
	if clients != nil {
		dbService = auth.NewService(clients.DB)
	}
	server := &server{cfg: cfg, clients: clients, hub: hub, auth: dbService, logger: logger, startedAt: time.Now().UTC()}
	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", server.healthz)
	mux.HandleFunc("GET /readyz", server.readyz)
	mux.HandleFunc("GET /api/v1/health", server.health)
	mux.HandleFunc("GET /api/v1/realtime/stats", server.realtimeStats)
	mux.HandleFunc("GET /api/v1/realtime/ws", server.realtimeWS)
	mux.HandleFunc("POST /api/v1/auth/login", server.login)
	mux.HandleFunc("POST /api/v1/auth/logout", server.logout)
	mux.HandleFunc("GET /api/v1/auth/me", server.me)
	mux.HandleFunc("GET /api/v1/permissions", server.listPermissions)
	mux.HandleFunc("GET /api/v1/users", server.listUsers)
	mux.HandleFunc("POST /api/v1/users", server.createUser)
	mux.HandleFunc("PATCH /api/v1/users/{id}/permissions", server.updateUserPermissions)
	return withCORS(cfg, withRequestID(mux))
}

type server struct {
	cfg       config.Config
	clients   *storage.Clients
	hub       *realtime.Hub
	auth      *auth.Service
	logger    *slog.Logger
	startedAt time.Time
}

func (s *server) healthz(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{"status": "ok", "service": "api"})
}

func (s *server) readyz(w http.ResponseWriter, r *http.Request) {
	dependencies := s.clients.Ready(r.Context())
	status := http.StatusOK
	for _, ready := range dependencies {
		if !ready {
			status = http.StatusServiceUnavailable
			break
		}
	}
	writeJSON(w, status, map[string]any{"status": mapStatus(status), "dependencies": dependencies})
}

func (s *server) health(w http.ResponseWriter, r *http.Request) {
	dependencies := s.clients.Ready(r.Context())
	status := http.StatusOK
	for _, ready := range dependencies {
		if !ready {
			status = http.StatusServiceUnavailable
			break
		}
	}
	writeJSON(w, status, map[string]any{
		"service":      "rust-control-api",
		"environment":  s.cfg.Environment,
		"status":       mapStatus(status),
		"uptime":       time.Since(s.startedAt).Round(time.Second).String(),
		"dependencies": dependencies,
		"realtime":     s.hub.Stats(),
	})
}

func (s *server) realtimeStats(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{"data": s.hub.Stats()})
}

func (s *server) realtimeWS(w http.ResponseWriter, r *http.Request) {
	upgrader := websocket.Upgrader{
		ReadBufferSize:  1024,
		WriteBufferSize: 1024,
		CheckOrigin: func(r *http.Request) bool {
			origin := r.Header.Get("Origin")
			return origin == "" || slices.Contains(s.cfg.AllowedOrigins, "*") || slices.Contains(s.cfg.AllowedOrigins, origin)
		},
	}
	s.hub.ServeWS(w, r, s.logger, upgrader)
}

func withRequestID(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requestID := r.Header.Get("X-Request-ID")
		if requestID == "" {
			requestID = time.Now().UTC().Format("20060102T150405.000000000Z07:00")
		}
		w.Header().Set("X-Request-ID", requestID)
		next.ServeHTTP(w, r)
	})
}

func withCORS(cfg config.Config, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		if origin != "" && (slices.Contains(cfg.AllowedOrigins, "*") || slices.Contains(cfg.AllowedOrigins, origin)) {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Set("Vary", "Origin")
			w.Header().Set("Access-Control-Allow-Credentials", "true")
		}
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Request-ID")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}

func mapStatus(status int) string {
	if status >= http.StatusOK && status < http.StatusMultipleChoices {
		return "ok"
	}
	return "degraded"
}
