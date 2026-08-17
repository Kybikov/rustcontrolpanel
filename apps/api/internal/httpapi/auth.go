package httpapi

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"github.com/Kybikov/rustcontrolpanel/apps/api/internal/auth"
)

const sessionCookieName = "rust_control_session"

type loginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type createUserRequest struct {
	Email       string   `json:"email"`
	DisplayName string   `json:"displayName"`
	Password    string   `json:"password"`
	Permissions []string `json:"permissions"`
}

type updatePermissionsRequest struct {
	Permissions []string `json:"permissions"`
}

func (s *server) login(w http.ResponseWriter, r *http.Request) {
	if s.auth == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "auth is not configured"})
		return
	}
	var input loginRequest
	if err := decodeJSON(w, r, &input); err != nil {
		return
	}
	token, user, err := s.auth.Login(r.Context(), input.Email, input.Password)
	if errors.Is(err, auth.ErrInvalidCredentials) {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "invalid email or password"})
		return
	}
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "could not create session"})
		return
	}
	http.SetCookie(w, &http.Cookie{
		Name:     sessionCookieName,
		Value:    token,
		Path:     "/",
		MaxAge:   24 * 60 * 60,
		HttpOnly: true,
		Secure:   s.cfg.Environment == "production",
		SameSite: http.SameSiteLaxMode,
	})
	writeJSON(w, http.StatusOK, map[string]any{"user": user})
}

func (s *server) logout(w http.ResponseWriter, r *http.Request) {
	if s.auth != nil {
		if err := s.auth.Logout(r.Context(), sessionToken(r)); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "could not close session"})
			return
		}
	}
	http.SetCookie(w, &http.Cookie{Name: sessionCookieName, Value: "", Path: "/", MaxAge: -1, HttpOnly: true, SameSite: http.SameSiteLaxMode})
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (s *server) me(w http.ResponseWriter, r *http.Request) {
	user, ok := s.requireAuth(w, r, "")
	if !ok {
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"user": user})
}

func (s *server) listPermissions(w http.ResponseWriter, r *http.Request) {
	if _, ok := s.requireAuth(w, r, "users.view"); !ok {
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"permissions": auth.Permissions()})
}

func (s *server) listUsers(w http.ResponseWriter, r *http.Request) {
	if _, ok := s.requireAuth(w, r, "users.view"); !ok {
		return
	}
	users, err := s.auth.ListUsers(r.Context())
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "could not load users"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"users": users})
}

func (s *server) createUser(w http.ResponseWriter, r *http.Request) {
	actor, ok := s.requireAuth(w, r, "users.create")
	if !ok {
		return
	}
	var input createUserRequest
	if err := decodeJSON(w, r, &input); err != nil {
		return
	}
	user, err := s.auth.CreateUser(r.Context(), actor, input.Email, input.DisplayName, input.Password, input.Permissions)
	if errors.Is(err, auth.ErrConflict) {
		writeJSON(w, http.StatusConflict, map[string]string{"error": "a user with this email already exists"})
		return
	}
	if errors.Is(err, auth.ErrInvalidPermission) {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	if errors.Is(err, auth.ErrPrivilegeEscalation) {
		writeJSON(w, http.StatusForbidden, map[string]string{"error": err.Error()})
		return
	}
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"user": user})
}

func (s *server) updateUserPermissions(w http.ResponseWriter, r *http.Request) {
	actor, ok := s.requireAuth(w, r, "users.manage_access")
	if !ok {
		return
	}
	userID, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil || userID < 1 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid user id"})
		return
	}
	var input updatePermissionsRequest
	if err := decodeJSON(w, r, &input); err != nil {
		return
	}
	user, err := s.auth.UpdatePermissions(r.Context(), actor, userID, input.Permissions)
	if errors.Is(err, auth.ErrNotFound) {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "user not found"})
		return
	}
	if errors.Is(err, auth.ErrProtectedUser) {
		writeJSON(w, http.StatusConflict, map[string]string{"error": "super admin access is protected"})
		return
	}
	if errors.Is(err, auth.ErrInvalidPermission) {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	if errors.Is(err, auth.ErrPrivilegeEscalation) {
		writeJSON(w, http.StatusForbidden, map[string]string{"error": err.Error()})
		return
	}
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "could not update permissions"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"user": user})
}

func (s *server) requireAuth(w http.ResponseWriter, r *http.Request, permission string) (auth.User, bool) {
	if s.auth == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "auth is not configured"})
		return auth.User{}, false
	}
	user, err := s.auth.Authenticate(r.Context(), sessionToken(r))
	if errors.Is(err, auth.ErrInvalidCredentials) {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "authentication required"})
		return auth.User{}, false
	}
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "could not validate session"})
		return auth.User{}, false
	}
	if permission != "" && !user.HasPermission(permission) {
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "permission denied"})
		return auth.User{}, false
	}
	return user, true
}

func sessionToken(r *http.Request) string {
	if cookie, err := r.Cookie(sessionCookieName); err == nil {
		return cookie.Value
	}
	authorization := strings.TrimSpace(r.Header.Get("Authorization"))
	if strings.HasPrefix(strings.ToLower(authorization), "bearer ") {
		return strings.TrimSpace(authorization[7:])
	}
	return ""
}

func decodeJSON(w http.ResponseWriter, r *http.Request, target any) error {
	decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<20))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(target); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": fmt.Sprintf("invalid JSON: %v", err)})
		return err
	}
	return nil
}
