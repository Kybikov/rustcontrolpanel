package auth

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5"
)

func (s *Service) ListRoles(ctx context.Context) ([]Role, error) {
	rows, err := s.db.Query(ctx, `
		SELECT roles.id, roles.name, roles.slug, roles.description, roles.is_system, COUNT(userRoles.user_id)::int
		FROM control.roles roles
		LEFT JOIN control.user_roles userRoles ON userRoles.role_id = roles.id
		GROUP BY roles.id
		ORDER BY roles.is_system DESC, roles.name ASC
	`)
	if err != nil {
		return nil, fmt.Errorf("list roles: %w", err)
	}
	defer rows.Close()

	var roles []Role
	for rows.Next() {
		var role Role
		if err := rows.Scan(&role.ID, &role.Name, &role.Slug, &role.Description, &role.IsSystem, &role.UserCount); err != nil {
			return nil, fmt.Errorf("scan role: %w", err)
		}
		roles = append(roles, role)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate roles: %w", err)
	}
	for index := range roles {
		permissions, err := s.rolePermissions(ctx, roles[index].ID)
		if err != nil {
			return nil, err
		}
		roles[index].Permissions = permissions
	}
	return roles, nil
}

func (s *Service) CreateRole(ctx context.Context, actor User, name, description string, permissions []string) (Role, error) {
	name = strings.TrimSpace(name)
	description = strings.TrimSpace(description)
	slug := roleSlug(name)
	if name == "" || slug == "" {
		return Role{}, errors.New("role name is required")
	}
	if err := validatePermissions(permissions); err != nil {
		return Role{}, err
	}
	if !actor.IsSuperAdmin && containsUserManagementPermission(permissions) {
		return Role{}, ErrPrivilegeEscalation
	}

	tx, err := s.db.Begin(ctx)
	if err != nil {
		return Role{}, fmt.Errorf("begin create role: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var roleID int64
	err = tx.QueryRow(ctx, `
		INSERT INTO control.roles (name, slug, description, is_system)
		VALUES ($1, $2, $3, FALSE)
		RETURNING id
	`, name, slug, description).Scan(&roleID)
	if isUniqueViolation(err) {
		return Role{}, ErrConflict
	}
	if err != nil {
		return Role{}, fmt.Errorf("insert role: %w", err)
	}
	if err := insertRolePermissions(ctx, tx, roleID, permissions); err != nil {
		return Role{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return Role{}, fmt.Errorf("commit role: %w", err)
	}
	return s.role(ctx, roleID)
}

func (s *Service) UpdateRolePermissions(ctx context.Context, actor User, roleID int64, permissions []string) (Role, error) {
	if err := validatePermissions(permissions); err != nil {
		return Role{}, err
	}
	if !actor.IsSuperAdmin && containsUserManagementPermission(permissions) {
		return Role{}, ErrPrivilegeEscalation
	}
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return Role{}, fmt.Errorf("begin role permission update: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var isSystem bool
	err = tx.QueryRow(ctx, `SELECT is_system FROM control.roles WHERE id = $1`, roleID).Scan(&isSystem)
	if errors.Is(err, pgx.ErrNoRows) {
		return Role{}, ErrNotFound
	}
	if err != nil {
		return Role{}, fmt.Errorf("find role: %w", err)
	}
	if isSystem {
		return Role{}, ErrProtectedRole
	}
	if _, err := tx.Exec(ctx, `DELETE FROM control.role_permissions WHERE role_id = $1`, roleID); err != nil {
		return Role{}, fmt.Errorf("clear role permissions: %w", err)
	}
	if err := insertRolePermissions(ctx, tx, roleID, permissions); err != nil {
		return Role{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return Role{}, fmt.Errorf("commit role permissions: %w", err)
	}
	return s.role(ctx, roleID)
}

func (s *Service) DeleteRole(ctx context.Context, roleID int64) error {
	var isSystem bool
	err := s.db.QueryRow(ctx, `SELECT is_system FROM control.roles WHERE id = $1`, roleID).Scan(&isSystem)
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrNotFound
	}
	if err != nil {
		return fmt.Errorf("find role: %w", err)
	}
	if isSystem {
		return ErrProtectedRole
	}
	if _, err := s.db.Exec(ctx, `DELETE FROM control.roles WHERE id = $1`, roleID); err != nil {
		return fmt.Errorf("delete role: %w", err)
	}
	return nil
}

func (s *Service) AssignRoles(ctx context.Context, actor User, userID int64, roleIDs []int64) (User, error) {
	roleIDs = uniqueRoleIDs(roleIDs)
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return User{}, fmt.Errorf("begin role assignment: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var isSuperAdmin bool
	err = tx.QueryRow(ctx, `SELECT is_super_admin FROM control.users WHERE id = $1`, userID).Scan(&isSuperAdmin)
	if errors.Is(err, pgx.ErrNoRows) {
		return User{}, ErrNotFound
	}
	if err != nil {
		return User{}, fmt.Errorf("find user for roles: %w", err)
	}
	if isSuperAdmin || actor.ID == userID {
		return User{}, ErrProtectedUser
	}
	if err := validateRoleIDs(ctx, tx, actor, roleIDs); err != nil {
		return User{}, err
	}
	if _, err := tx.Exec(ctx, `DELETE FROM control.user_roles WHERE user_id = $1`, userID); err != nil {
		return User{}, fmt.Errorf("clear user roles: %w", err)
	}
	if err := insertRoles(ctx, tx, userID, roleIDs); err != nil {
		return User{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return User{}, fmt.Errorf("commit role assignment: %w", err)
	}
	return s.user(ctx, userID)
}

func (s *Service) role(ctx context.Context, roleID int64) (Role, error) {
	var role Role
	var userCount int
	err := s.db.QueryRow(ctx, `
		SELECT roles.id, roles.name, roles.slug, roles.description, roles.is_system, COUNT(userRoles.user_id)::int
		FROM control.roles roles
		LEFT JOIN control.user_roles userRoles ON userRoles.role_id = roles.id
		WHERE roles.id = $1
		GROUP BY roles.id
	`, roleID).Scan(&role.ID, &role.Name, &role.Slug, &role.Description, &role.IsSystem, &userCount)
	if errors.Is(err, pgx.ErrNoRows) {
		return Role{}, ErrNotFound
	}
	if err != nil {
		return Role{}, fmt.Errorf("load role: %w", err)
	}
	role.UserCount = userCount
	role.Permissions, err = s.rolePermissions(ctx, roleID)
	return role, err
}

func (s *Service) roleSummaries(ctx context.Context, userID int64) ([]RoleSummary, error) {
	rows, err := s.db.Query(ctx, `
		SELECT roles.id, roles.name, roles.slug
		FROM control.user_roles userRoles
		JOIN control.roles roles ON roles.id = userRoles.role_id
		WHERE userRoles.user_id = $1
		ORDER BY roles.is_system DESC, roles.name ASC
	`, userID)
	if err != nil {
		return nil, fmt.Errorf("load user roles: %w", err)
	}
	defer rows.Close()
	var roles []RoleSummary
	for rows.Next() {
		var role RoleSummary
		if err := rows.Scan(&role.ID, &role.Name, &role.Slug); err != nil {
			return nil, fmt.Errorf("scan user role: %w", err)
		}
		roles = append(roles, role)
	}
	return roles, rows.Err()
}

func (s *Service) rolePermissions(ctx context.Context, roleID int64) ([]string, error) {
	rows, err := s.db.Query(ctx, `SELECT permission_key FROM control.role_permissions WHERE role_id = $1 ORDER BY permission_key`, roleID)
	if err != nil {
		return nil, fmt.Errorf("load role permissions: %w", err)
	}
	defer rows.Close()
	var permissions []string
	for rows.Next() {
		var permission string
		if err := rows.Scan(&permission); err != nil {
			return nil, fmt.Errorf("scan role permission: %w", err)
		}
		permissions = append(permissions, permission)
	}
	return permissions, rows.Err()
}

func (s *Service) assignRoleBySlug(ctx context.Context, userID int64, slug string) error {
	_, err := s.db.Exec(ctx, `
		INSERT INTO control.user_roles (user_id, role_id)
		SELECT $1, id FROM control.roles WHERE slug = $2
		ON CONFLICT DO NOTHING
	`, userID, slug)
	return err
}

func validateRoleIDs(ctx context.Context, tx pgx.Tx, actor User, roleIDs []int64) error {
	for _, roleID := range roleIDs {
		var exists bool
		if err := tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM control.roles WHERE id = $1)`, roleID).Scan(&exists); err != nil {
			return fmt.Errorf("validate role: %w", err)
		}
		if !exists {
			return fmt.Errorf("%w: %d", ErrInvalidRole, roleID)
		}
		if !actor.IsSuperAdmin {
			var management bool
			if err := tx.QueryRow(ctx, `
				SELECT EXISTS(
					SELECT 1 FROM control.role_permissions
					WHERE role_id = $1 AND permission_key IN ('users.create', 'users.manage_access')
				)
			`, roleID).Scan(&management); err != nil {
				return fmt.Errorf("check role privileges: %w", err)
			}
			if management {
				return ErrPrivilegeEscalation
			}
		}
	}
	return nil
}

func insertRolePermissions(ctx context.Context, tx pgx.Tx, roleID int64, permissions []string) error {
	for _, permission := range permissions {
		if _, err := tx.Exec(ctx, `INSERT INTO control.role_permissions (role_id, permission_key) VALUES ($1, $2)`, roleID, permission); err != nil {
			return fmt.Errorf("insert role permission %q: %w", permission, err)
		}
	}
	return nil
}

func insertRoles(ctx context.Context, tx pgx.Tx, userID int64, roleIDs []int64) error {
	for _, roleID := range roleIDs {
		if _, err := tx.Exec(ctx, `INSERT INTO control.user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, userID, roleID); err != nil {
			return fmt.Errorf("insert user role %d: %w", roleID, err)
		}
	}
	return nil
}

func uniqueRoleIDs(roleIDs []int64) []int64 {
	seen := make(map[int64]struct{}, len(roleIDs))
	result := make([]int64, 0, len(roleIDs))
	for _, roleID := range roleIDs {
		if roleID < 1 {
			continue
		}
		if _, ok := seen[roleID]; ok {
			continue
		}
		seen[roleID] = struct{}{}
		result = append(result, roleID)
	}
	return result
}

func roleSlug(name string) string {
	var slug strings.Builder
	for _, char := range strings.ToLower(strings.TrimSpace(name)) {
		switch {
		case char >= 'a' && char <= 'z', char >= '0' && char <= '9':
			slug.WriteRune(char)
		case slug.Len() > 0 && !strings.HasSuffix(slug.String(), "-"):
			slug.WriteRune('-')
		}
	}
	return strings.Trim(slug.String(), "-")
}
