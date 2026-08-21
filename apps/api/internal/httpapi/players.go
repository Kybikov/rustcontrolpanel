package httpapi

import (
	"errors"
	"net/http"
	"strings"

	"github.com/Kybikov/rustcontrolpanel/apps/api/internal/integrations"
)

func (s *server) searchPlayers(w http.ResponseWriter, r *http.Request) {
	if _, ok := s.requireAuth(w, r, "players.search"); !ok {
		return
	}
	if s.integrations == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "Steam player lookup is not configured"})
		return
	}
	query := strings.TrimSpace(r.URL.Query().Get("query"))
	if query == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "enter a SteamID64, Steam profile URL, or vanity name"})
		return
	}
	player, err := s.integrations.SearchSteamPlayer(r.Context(), query)
	if err != nil {
		writeSteamPlayerError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"players": []integrations.SteamPlayer{player}})
}

func writeSteamPlayerError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, integrations.ErrInvalidCredential):
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "Steam lookup is temporarily unavailable. Try again shortly."})
	case errors.Is(err, integrations.ErrNotConfigured):
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "Steam lookup is not configured yet."})
	case errors.Is(err, integrations.ErrProviderUnavailable):
		writeJSON(w, http.StatusBadGateway, map[string]string{"error": "Steam is temporarily unavailable. Try again shortly."})
	case errors.Is(err, integrations.ErrProviderRejected):
		writeJSON(w, http.StatusBadGateway, map[string]string{"error": "Steam rejected the player lookup. Try again shortly."})
	case errors.Is(err, integrations.ErrResourceNotFound):
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "No public Steam profile was found for that value."})
	default:
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
	}
}
