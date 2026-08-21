package httpapi

import (
	"errors"
	"net/http"
	"strconv"
	"strings"

	"github.com/Kybikov/rustcontrolpanel/apps/api/internal/integrations"
)

func (s *server) searchServers(w http.ResponseWriter, r *http.Request) {
	if _, ok := s.requireAuth(w, r, "servers.search"); !ok {
		return
	}
	if s.integrations == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "BattleMetrics integration is not configured"})
		return
	}
	page, perPage, err := pagination(r)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	result, err := s.integrations.SearchRustServers(r.Context(), r.URL.Query().Get("query"), page, perPage)
	if err != nil {
		writeServerIntegrationError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, result)
}

func (s *server) serverDetails(w http.ResponseWriter, r *http.Request) {
	if _, ok := s.requireAuth(w, r, "servers.view"); !ok {
		return
	}
	if s.integrations == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "BattleMetrics integration is not configured"})
		return
	}
	server, err := s.integrations.RustServer(r.Context(), r.PathValue("id"))
	if err != nil {
		writeServerIntegrationError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"server": server})
}

func pagination(r *http.Request) (int, int, error) {
	page, err := optionalPositiveInt(r.URL.Query().Get("page"), 1)
	if err != nil {
		return 0, 0, errors.New("page must be a positive number")
	}
	perPage, err := optionalPositiveInt(r.URL.Query().Get("perPage"), 12)
	if err != nil || perPage > 50 {
		return 0, 0, errors.New("perPage must be between 1 and 50")
	}
	return page, perPage, nil
}

func optionalPositiveInt(raw string, fallback int) (int, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return fallback, nil
	}
	value, err := strconv.Atoi(raw)
	if err != nil || value < 1 {
		return 0, errors.New("must be positive")
	}
	return value, nil
}

func writeServerIntegrationError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, integrations.ErrInvalidCredential):
		writeJSON(w, http.StatusBadGateway, map[string]string{"error": "BattleMetrics rejected the server credential. Sync a valid managed credential and try again."})
	case errors.Is(err, integrations.ErrNotConfigured):
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "BattleMetrics does not have a managed credential yet."})
	case errors.Is(err, integrations.ErrProviderUnavailable):
		writeJSON(w, http.StatusBadGateway, map[string]string{"error": "BattleMetrics is temporarily unavailable. Try again shortly."})
	case errors.Is(err, integrations.ErrProviderRejected):
		writeJSON(w, http.StatusBadGateway, map[string]string{"error": "BattleMetrics rejected the server request."})
	default:
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
	}
}
