package httpapi

import (
	"errors"
	"net/http"
	"strconv"

	"github.com/Kybikov/rustcontrolpanel/apps/api/internal/auth"
)

type createRoleRequest struct {
	Name        string   `json:"name"`
	Description string   `json:"description"`
	Permissions []string `json:"permissions"`
}

type updateRolePermissionsRequest struct {
	Permissions []string `json:"permissions"`
}

type assignRolesRequest struct {
	RoleIDs []int64 `json:"roleIds"`
}

func (s *server) listRoles(w http.ResponseWriter, r *http.Request) {
	if _, ok := s.requireAuth(w, r, "users.view"); !ok {
		return
	}
	roles, err := s.auth.ListRoles(r.Context())
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "could not load roles"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"roles": roles})
}

func (s *server) createRole(w http.ResponseWriter, r *http.Request) {
	actor, ok := s.requireAuth(w, r, "users.manage_access")
	if !ok {
		return
	}
	var input createRoleRequest
	if err := decodeJSON(w, r, &input); err != nil {
		return
	}
	role, err := s.auth.CreateRole(r.Context(), actor, input.Name, input.Description, input.Permissions)
	if errors.Is(err, auth.ErrConflict) {
		writeJSON(w, http.StatusConflict, map[string]string{"error": "a role with this name already exists"})
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
	writeJSON(w, http.StatusCreated, map[string]any{"role": role})
}

func (s *server) updateRolePermissions(w http.ResponseWriter, r *http.Request) {
	actor, ok := s.requireAuth(w, r, "users.manage_access")
	if !ok {
		return
	}
	roleID, err := parseID(r.PathValue("id"), "role")
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	var input updateRolePermissionsRequest
	if err := decodeJSON(w, r, &input); err != nil {
		return
	}
	role, err := s.auth.UpdateRolePermissions(r.Context(), actor, roleID, input.Permissions)
	if errors.Is(err, auth.ErrNotFound) {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "role not found"})
		return
	}
	if errors.Is(err, auth.ErrProtectedRole) {
		writeJSON(w, http.StatusConflict, map[string]string{"error": "system roles are read-only"})
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
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "could not update role permissions"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"role": role})
}

func (s *server) deleteRole(w http.ResponseWriter, r *http.Request) {
	if _, ok := s.requireAuth(w, r, "users.manage_access"); !ok {
		return
	}
	roleID, err := parseID(r.PathValue("id"), "role")
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	if err := s.auth.DeleteRole(r.Context(), roleID); errors.Is(err, auth.ErrNotFound) {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "role not found"})
		return
	} else if errors.Is(err, auth.ErrProtectedRole) {
		writeJSON(w, http.StatusConflict, map[string]string{"error": "system roles cannot be deleted"})
		return
	} else if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "could not delete role"})
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *server) assignUserRoles(w http.ResponseWriter, r *http.Request) {
	actor, ok := s.requireAuth(w, r, "users.manage_access")
	if !ok {
		return
	}
	userID, err := parseID(r.PathValue("id"), "user")
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	var input assignRolesRequest
	if err := decodeJSON(w, r, &input); err != nil {
		return
	}
	user, err := s.auth.AssignRoles(r.Context(), actor, userID, input.RoleIDs)
	if errors.Is(err, auth.ErrNotFound) {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "user not found"})
		return
	}
	if errors.Is(err, auth.ErrProtectedUser) {
		writeJSON(w, http.StatusConflict, map[string]string{"error": "super admin and your own access are protected"})
		return
	}
	if errors.Is(err, auth.ErrInvalidRole) {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	if errors.Is(err, auth.ErrPrivilegeEscalation) {
		writeJSON(w, http.StatusForbidden, map[string]string{"error": err.Error()})
		return
	}
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "could not update user roles"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"user": user})
}

func parseID(raw, label string) (int64, error) {
	id, err := strconv.ParseInt(raw, 10, 64)
	if err != nil || id < 1 {
		return 0, errors.New("invalid " + label + " id")
	}
	return id, nil
}
