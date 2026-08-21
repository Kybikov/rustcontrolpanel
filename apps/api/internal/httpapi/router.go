package httpapi

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"slices"
	"time"

	"github.com/Kybikov/rustcontrolpanel/apps/api/internal/auth"
	"github.com/Kybikov/rustcontrolpanel/apps/api/internal/config"
	"github.com/Kybikov/rustcontrolpanel/apps/api/internal/integrations"
	"github.com/Kybikov/rustcontrolpanel/apps/api/internal/playerstore"
	"github.com/Kybikov/rustcontrolpanel/apps/api/internal/push"
	"github.com/Kybikov/rustcontrolpanel/apps/api/internal/realtime"
	"github.com/Kybikov/rustcontrolpanel/apps/api/internal/servercheck"
	"github.com/Kybikov/rustcontrolpanel/apps/api/internal/storage"
	"github.com/gorilla/websocket"
)

func NewRouter(cfg config.Config, clients *storage.Clients, hub *realtime.Hub, logger *slog.Logger, integrationServices ...*integrations.Service) http.Handler {
	var dbService *auth.Service
	if clients != nil {
		dbService = auth.NewService(clients.DB)
	}
	var integrationService *integrations.Service
	if len(integrationServices) > 0 {
		integrationService = integrationServices[0]
	}
	var checker *servercheck.Service
	var players *playerstore.Service
	var serverPush *push.Service
	if clients != nil {
		pushService := push.NewService(clients.DB, push.Config{
			PublicKey: cfg.VAPIDPublicKey, PrivateKey: cfg.VAPIDPrivateKey, Subject: cfg.VAPIDSubject,
		})
		checker = servercheck.NewService(clients.DB, hub, pushService)
		players = playerstore.NewService(clients.DB, hub, pushService)
		serverPush = pushService
	}
	server := &server{cfg: cfg, clients: clients, hub: hub, auth: dbService, integrations: integrationService, checker: checker, players: players, push: serverPush, logger: logger, startedAt: time.Now().UTC()}
	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", server.healthz)
	mux.HandleFunc("GET /readyz", server.readyz)
	mux.HandleFunc("GET /api/v1/health", server.health)
	mux.HandleFunc("GET /api/v1/realtime/stats", server.realtimeStats)
	mux.HandleFunc("GET /api/v1/realtime/ws", server.realtimeWS)
	mux.HandleFunc("POST /api/v1/auth/login", server.login)
	mux.HandleFunc("POST /api/v1/auth/logout", server.logout)
	mux.HandleFunc("GET /api/v1/auth/me", server.me)
	mux.HandleFunc("PATCH /api/v1/auth/profile", server.updateProfile)
	mux.HandleFunc("POST /api/v1/auth/password", server.changePassword)
	mux.HandleFunc("POST /api/v1/auth/steam/link", server.startSteamLink)
	mux.HandleFunc("GET /api/v1/auth/steam/callback", server.completeSteamLink)
	mux.HandleFunc("GET /api/v1/auth/steam", server.steamAccount)
	mux.HandleFunc("GET /api/v1/auth/steam/profile", server.steamAccountProfile)
	mux.HandleFunc("DELETE /api/v1/auth/steam", server.unlinkSteamAccount)
	mux.HandleFunc("GET /api/v1/servers", server.searchServers)
	mux.HandleFunc("GET /api/v1/servers/{id}", server.serverDetails)
	mux.HandleFunc("POST /api/v1/servers/check", server.checkServer)
	mux.HandleFunc("GET /api/v1/servers/watchlist", server.listWatchlist)
	mux.HandleFunc("POST /api/v1/servers/watchlist", server.addWatchlistServer)
	mux.HandleFunc("GET /api/v1/servers/watchlist/{id}", server.watchlistServerDetails)
	mux.HandleFunc("GET /api/v1/servers/watchlist/{id}/history", server.watchlistServerHistory)
	mux.HandleFunc("POST /api/v1/servers/watchlist/{id}/refresh", server.refreshWatchlistServer)
	mux.HandleFunc("DELETE /api/v1/servers/watchlist/{id}", server.removeWatchlistServer)
	mux.HandleFunc("GET /api/v1/players", server.searchPlayers)
	mux.HandleFunc("GET /api/v1/players/saved", server.listSavedPlayers)
	mux.HandleFunc("POST /api/v1/players/saved", server.savePlayer)
	mux.HandleFunc("GET /api/v1/players/saved/{steamID}", server.savedPlayerDetails)
	mux.HandleFunc("GET /api/v1/players/saved/{steamID}/history", server.savedPlayerHistory)
	mux.HandleFunc("POST /api/v1/players/saved/{steamID}/refresh", server.refreshSavedPlayer)
	mux.HandleFunc("DELETE /api/v1/players/saved/{steamID}", server.removeSavedPlayer)
	mux.HandleFunc("GET /api/v1/notifications", server.listNotifications)
	mux.HandleFunc("POST /api/v1/notifications/read", server.markNotificationsRead)
	mux.HandleFunc("GET /api/v1/push/config", server.pushConfig)
	mux.HandleFunc("POST /api/v1/push/subscriptions", server.subscribePush)
	mux.HandleFunc("DELETE /api/v1/push/subscriptions", server.unsubscribePush)
	mux.HandleFunc("GET /api/v1/permissions", server.listPermissions)
	mux.HandleFunc("GET /api/v1/roles", server.listRoles)
	mux.HandleFunc("POST /api/v1/roles", server.createRole)
	mux.HandleFunc("PATCH /api/v1/roles/{id}/permissions", server.updateRolePermissions)
	mux.HandleFunc("DELETE /api/v1/roles/{id}", server.deleteRole)
	mux.HandleFunc("GET /api/v1/users", server.listUsers)
	mux.HandleFunc("POST /api/v1/users", server.createUser)
	mux.HandleFunc("PATCH /api/v1/users/{id}/permissions", server.updateUserPermissions)
	mux.HandleFunc("PATCH /api/v1/users/{id}/roles", server.assignUserRoles)
	return withCORS(cfg, withRequestID(mux))
}

type server struct {
	cfg          config.Config
	clients      *storage.Clients
	hub          *realtime.Hub
	auth         *auth.Service
	integrations *integrations.Service
	checker      *servercheck.Service
	players      *playerstore.Service
	push         *push.Service
	logger       *slog.Logger
	startedAt    time.Time
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
	user, ok := s.requireAuth(w, r, "servers.view")
	if !ok {
		return
	}
	upgrader := websocket.Upgrader{
		ReadBufferSize:  1024,
		WriteBufferSize: 1024,
		CheckOrigin: func(r *http.Request) bool {
			origin := r.Header.Get("Origin")
			return origin == "" || slices.Contains(s.cfg.AllowedOrigins, "*") || slices.Contains(s.cfg.AllowedOrigins, origin)
		},
	}
	s.hub.ServeWS(w, r, s.logger, upgrader, user.ID)
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
