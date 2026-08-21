package httpapi

import (
	"errors"
	"net/http"
	"strings"

	"github.com/Kybikov/rustcontrolpanel/apps/api/internal/integrations"
	"github.com/Kybikov/rustcontrolpanel/apps/api/internal/playerstore"
	"github.com/jackc/pgx/v5"
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

type savePlayerRequest struct {
	SteamID string `json:"steamId"`
}

func (s *server) listSavedPlayers(w http.ResponseWriter, r *http.Request) {
	user, ok := s.requireAuth(w, r, "players.view")
	if !ok {
		return
	}
	if s.players == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "saved players are not configured"})
		return
	}
	players, err := s.players.List(r.Context(), user.ID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "could not load saved players"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"players": players})
}

func (s *server) savePlayer(w http.ResponseWriter, r *http.Request) {
	user, ok := s.requireAuth(w, r, "players.search")
	if !ok {
		return
	}
	if s.players == nil || s.integrations == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "saved player lookup is not configured"})
		return
	}
	var input savePlayerRequest
	if err := decodeJSON(w, r, &input); err != nil {
		return
	}
	player, err := s.integrations.SearchSteamPlayer(r.Context(), input.SteamID)
	if err != nil {
		writeSteamPlayerError(w, err)
		return
	}
	saved, err := s.players.Save(r.Context(), user.ID, player)
	if errors.Is(err, playerstore.ErrSavedPlayersFull) {
		writeJSON(w, http.StatusConflict, map[string]string{"error": err.Error()})
		return
	}
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "could not save player"})
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"player": saved})
}

func (s *server) savedPlayerDetails(w http.ResponseWriter, r *http.Request) {
	user, ok := s.requireAuth(w, r, "players.view")
	if !ok {
		return
	}
	if s.players == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "saved players are not configured"})
		return
	}
	player, err := s.players.Find(r.Context(), user.ID, r.PathValue("steamID"))
	if errors.Is(err, pgx.ErrNoRows) {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "saved player not found"})
		return
	}
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "could not load saved player"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"player": player})
}

func (s *server) refreshSavedPlayer(w http.ResponseWriter, r *http.Request) {
	user, ok := s.requireAuth(w, r, "players.search")
	if !ok {
		return
	}
	if s.players == nil || s.integrations == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "saved player lookup is not configured"})
		return
	}
	player, err := s.players.Refresh(r.Context(), user.ID, r.PathValue("steamID"), s.integrations)
	if errors.Is(err, pgx.ErrNoRows) {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "saved player not found"})
		return
	}
	if err != nil {
		writeSteamPlayerError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"player": player})
}

func (s *server) removeSavedPlayer(w http.ResponseWriter, r *http.Request) {
	user, ok := s.requireAuth(w, r, "players.search")
	if !ok {
		return
	}
	if s.players == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "saved players are not configured"})
		return
	}
	if err := s.players.Remove(r.Context(), user.ID, r.PathValue("steamID")); errors.Is(err, pgx.ErrNoRows) {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "saved player not found"})
		return
	} else if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "could not remove saved player"})
		return
	}
	w.WriteHeader(http.StatusNoContent)
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
