package httpapi

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/Kybikov/rustcontrolpanel/apps/api/internal/push"
)

func (s *server) pushConfig(w http.ResponseWriter, r *http.Request) {
	if _, ok := s.requireAuth(w, r, "servers.view"); !ok {
		return
	}
	if s.push == nil || !s.push.Configured() {
		writeJSON(w, http.StatusServiceUnavailable, map[string]any{
			"configured": false,
			"error":      "push notifications are not configured",
		})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"configured": true,
		"publicKey":  s.push.PublicKey(),
	})
}

func (s *server) subscribePush(w http.ResponseWriter, r *http.Request) {
	user, ok := s.requireAuth(w, r, "servers.view")
	if !ok {
		return
	}
	if s.push == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "push notifications are not configured"})
		return
	}
	var subscription push.Subscription
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 16<<10)).Decode(&subscription); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid push subscription"})
		return
	}
	if err := s.push.Subscribe(r.Context(), user.ID, subscription); err != nil {
		status := http.StatusBadRequest
		if strings.Contains(err.Error(), "not configured") {
			status = http.StatusServiceUnavailable
		}
		writeJSON(w, status, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusCreated, map[string]string{"status": "subscribed"})
}

func (s *server) unsubscribePush(w http.ResponseWriter, r *http.Request) {
	user, ok := s.requireAuth(w, r, "servers.view")
	if !ok {
		return
	}
	if s.push == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "push notifications are not configured"})
		return
	}
	var input struct {
		Endpoint string `json:"endpoint"`
	}
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 8<<10)).Decode(&input); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid push subscription"})
		return
	}
	if err := s.push.Unsubscribe(r.Context(), user.ID, input.Endpoint); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "could not remove push subscription"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "unsubscribed"})
}
