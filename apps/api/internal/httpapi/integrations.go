package httpapi

import (
	"errors"
	"net/http"

	"github.com/Kybikov/rustcontrolpanel/apps/api/internal/integrations"
)

type connectIntegrationRequest struct {
	Credential string `json:"credential"`
}

func (s *server) listIntegrations(w http.ResponseWriter, r *http.Request) {
	if _, ok := s.requireAuth(w, r, "integrations.manage"); !ok {
		return
	}
	statuses, err := s.integrations.List(r.Context())
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "could not load integrations"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"integrations": statuses})
}

func (s *server) connectIntegration(w http.ResponseWriter, r *http.Request) {
	if _, ok := s.requireAuth(w, r, "integrations.manage"); !ok {
		return
	}
	var input connectIntegrationRequest
	if err := decodeJSON(w, r, &input); err != nil {
		return
	}
	status, err := s.integrations.Connect(r.Context(), r.PathValue("provider"), input.Credential)
	if err != nil {
		writeIntegrationError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"integration": status})
}

func (s *server) testIntegration(w http.ResponseWriter, r *http.Request) {
	if _, ok := s.requireAuth(w, r, "integrations.manage"); !ok {
		return
	}
	status, err := s.integrations.Test(r.Context(), r.PathValue("provider"))
	if err != nil {
		writeIntegrationError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"integration": status})
}

func (s *server) disconnectIntegration(w http.ResponseWriter, r *http.Request) {
	if _, ok := s.requireAuth(w, r, "integrations.manage"); !ok {
		return
	}
	if err := s.integrations.Disconnect(r.Context(), r.PathValue("provider")); err != nil {
		writeIntegrationError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "disconnected"})
}

func writeIntegrationError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, integrations.ErrInvalidProvider):
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "unsupported integration provider"})
	case errors.Is(err, integrations.ErrInvalidCredential):
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "provider rejected the credential"})
	case errors.Is(err, integrations.ErrNotConfigured):
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "integration is not configured"})
	case errors.Is(err, integrations.ErrProviderUnavailable):
		writeJSON(w, http.StatusBadGateway, map[string]string{"error": "provider is temporarily unavailable"})
	case errors.Is(err, integrations.ErrProviderRejected):
		writeJSON(w, http.StatusBadGateway, map[string]string{"error": "provider rejected the request"})
	default:
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "integration operation failed"})
	}
}
