package httpapi

import (
	"errors"
	"net/http"
	"strconv"

	"github.com/Kybikov/rustcontrolpanel/apps/api/internal/servercheck"
	"github.com/jackc/pgx/v5"
)

type serverAddressRequest struct {
	Address string `json:"address"`
}

func (s *server) checkServer(w http.ResponseWriter, r *http.Request) {
	user, ok := s.requireAuth(w, r, "servers.search")
	if !ok {
		return
	}
	if s.checker == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "server checker is not configured"})
		return
	}
	var input serverAddressRequest
	if err := decodeJSON(w, r, &input); err != nil {
		return
	}
	snapshot, err := s.checker.CheckForUser(r.Context(), user.ID, input.Address)
	if err != nil {
		writeCheckError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"server": snapshot})
}

func (s *server) listWatchlist(w http.ResponseWriter, r *http.Request) {
	user, ok := s.requireAuth(w, r, "servers.view")
	if !ok {
		return
	}
	if s.checker == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "server checker is not configured"})
		return
	}
	servers, err := s.checker.List(r.Context(), user.ID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "could not load watchlist"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"servers": servers})
}

func (s *server) addWatchlistServer(w http.ResponseWriter, r *http.Request) {
	user, ok := s.requireAuth(w, r, "servers.search")
	if !ok {
		return
	}
	if s.checker == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "server checker is not configured"})
		return
	}
	var input serverAddressRequest
	if err := decodeJSON(w, r, &input); err != nil {
		return
	}
	server, err := s.checker.Add(r.Context(), user.ID, input.Address)
	if err != nil {
		writeCheckError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"server": server})
}

func (s *server) refreshWatchlistServer(w http.ResponseWriter, r *http.Request) {
	user, ok := s.requireAuth(w, r, "servers.search")
	if !ok {
		return
	}
	if s.checker == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "server checker is not configured"})
		return
	}
	id, ok := watchlistID(w, r)
	if !ok {
		return
	}
	server, err := s.checker.Refresh(r.Context(), user.ID, id)
	if errors.Is(err, pgx.ErrNoRows) {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "watchlist server not found"})
		return
	}
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "could not refresh watchlist server"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"server": server})
}

func (s *server) removeWatchlistServer(w http.ResponseWriter, r *http.Request) {
	user, ok := s.requireAuth(w, r, "servers.search")
	if !ok {
		return
	}
	if s.checker == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "server checker is not configured"})
		return
	}
	id, ok := watchlistID(w, r)
	if !ok {
		return
	}
	if err := s.checker.Remove(r.Context(), user.ID, id); errors.Is(err, pgx.ErrNoRows) {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "watchlist server not found"})
		return
	} else if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "could not remove watchlist server"})
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func watchlistID(w http.ResponseWriter, r *http.Request) (int64, bool) {
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil || id < 1 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid watchlist server id"})
		return 0, false
	}
	return id, true
}

func writeCheckError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, servercheck.ErrInvalidAddress):
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
	case errors.Is(err, servercheck.ErrNotRustServer):
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
	case errors.Is(err, servercheck.ErrPublicQueryBlocked):
		writeJSON(w, http.StatusUnprocessableEntity, map[string]string{"error": "This server blocks public status queries. It may still be online in Rust."})
	case errors.Is(err, servercheck.ErrWatchlistFull):
		writeJSON(w, http.StatusConflict, map[string]string{"error": err.Error()})
	default:
		writeJSON(w, http.StatusBadGateway, map[string]string{"error": "server did not answer. Check the IP and port, then try again."})
	}
}
