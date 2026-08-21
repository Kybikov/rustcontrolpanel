package httpapi

import "net/http"

func (s *server) listNotifications(w http.ResponseWriter, r *http.Request) {
	user, ok := s.requireAuth(w, r, "servers.view")
	if !ok {
		return
	}
	if s.checker == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "notifications are not configured"})
		return
	}
	notifications, err := s.checker.ListNotifications(r.Context(), user.ID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "could not load notifications"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"notifications": notifications})
}

func (s *server) markNotificationsRead(w http.ResponseWriter, r *http.Request) {
	user, ok := s.requireAuth(w, r, "servers.view")
	if !ok {
		return
	}
	if s.checker == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "notifications are not configured"})
		return
	}
	if err := s.checker.MarkNotificationsRead(r.Context(), user.ID); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "could not mark notifications as read"})
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
