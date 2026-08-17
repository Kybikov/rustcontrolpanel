package auth

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"
)

var (
	ErrInvalidCredentials  = errors.New("invalid credentials")
	ErrNotFound            = errors.New("user not found")
	ErrConflict            = errors.New("user already exists")
	ErrInvalidPermission   = errors.New("invalid permission")
	ErrProtectedUser       = errors.New("super admin access cannot be changed here")
	ErrPrivilegeEscalation = errors.New("only a super admin can grant user-management permissions")
	ErrWeakPassword        = errors.New("password must be at least 12 characters")
)

type Permission struct {
	Key         string `json:"key"`
	Description string `json:"description"`
}

type User struct {
	ID           int64     `json:"id"`
	Email        string    `json:"email"`
	DisplayName  string    `json:"displayName"`
	IsActive     bool      `json:"isActive"`
	IsSuperAdmin bool      `json:"isSuperAdmin"`
	Permissions  []string  `json:"permissions"`
	CreatedAt    time.Time `json:"createdAt"`
}

type Service struct {
	db         *pgxpool.Pool
	sessionTTL time.Duration
}

var permissionCatalog = []Permission{
	{Key: "dashboard.view", Description: "View the operational overview"},
	{Key: "servers.view", Description: "View server workspace"},
	{Key: "servers.search", Description: "Search and inspect servers"},
	{Key: "players.view", Description: "View player workspace"},
	{Key: "players.search", Description: "Search and inspect players"},
	{Key: "integrations.manage", Description: "Configure provider integrations"},
	{Key: "users.view", Description: "View team members"},
	{Key: "users.create", Description: "Create team members"},
	{Key: "users.manage_access", Description: "Change team member permissions"},
}

func NewService(db *pgxpool.Pool) *Service {
	return &Service{db: db, sessionTTL: 24 * time.Hour}
}

func Permissions() []Permission {
	return append([]Permission(nil), permissionCatalog...)
}

func (s *Service) EnsureSchema(ctx context.Context) error {
	if s == nil || s.db == nil {
		return errors.New("auth database is not configured")
	}

	statements := []string{
		`CREATE SCHEMA IF NOT EXISTS control`,
		`CREATE TABLE IF NOT EXISTS control.users (
			id BIGSERIAL PRIMARY KEY,
			email TEXT NOT NULL UNIQUE,
			display_name TEXT NOT NULL,
			password_hash TEXT NOT NULL,
			is_active BOOLEAN NOT NULL DEFAULT TRUE,
			is_super_admin BOOLEAN NOT NULL DEFAULT FALSE,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)`,
		`CREATE TABLE IF NOT EXISTS control.permissions (
			permission_key TEXT PRIMARY KEY,
			description TEXT NOT NULL
		)`,
		`CREATE TABLE IF NOT EXISTS control.user_permissions (
			user_id BIGINT NOT NULL REFERENCES control.users(id) ON DELETE CASCADE,
			permission_key TEXT NOT NULL REFERENCES control.permissions(permission_key) ON DELETE CASCADE,
			PRIMARY KEY (user_id, permission_key)
		)`,
		`CREATE TABLE IF NOT EXISTS control.sessions (
			token_hash TEXT PRIMARY KEY,
			user_id BIGINT NOT NULL REFERENCES control.users(id) ON DELETE CASCADE,
			expires_at TIMESTAMPTZ NOT NULL,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)`,
		`CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON control.sessions (user_id)`,
		`CREATE INDEX IF NOT EXISTS sessions_expires_at_idx ON control.sessions (expires_at)`,
	}

	tx, err := s.db.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin auth schema transaction: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	for _, statement := range statements {
		if _, err := tx.Exec(ctx, statement); err != nil {
			return fmt.Errorf("apply auth schema: %w", err)
		}
	}
	for _, permission := range permissionCatalog {
		if _, err := tx.Exec(ctx, `
			INSERT INTO control.permissions (permission_key, description)
			VALUES ($1, $2)
			ON CONFLICT (permission_key) DO UPDATE SET description = EXCLUDED.description
		`, permission.Key, permission.Description); err != nil {
			return fmt.Errorf("seed permission %q: %w", permission.Key, err)
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit auth schema transaction: %w", err)
	}
	return nil
}

func (s *Service) EnsureBootstrap(ctx context.Context, email, password string) error {
	email = normalizeEmail(email)
	password = strings.TrimSpace(password)
	if email == "" || password == "" {
		return errors.New("SUPERADMIN_EMAIL and SUPERADMIN_PASSWORD must be configured")
	}

	var id int64
	err := s.db.QueryRow(ctx, `SELECT id FROM control.users WHERE email = $1`, email).Scan(&id)
	if err == nil {
		_, err = s.db.Exec(ctx, `
			UPDATE control.users
			SET is_active = TRUE, is_super_admin = TRUE, updated_at = NOW()
			WHERE id = $1
		`, id)
		if err != nil {
			return fmt.Errorf("promote bootstrap user: %w", err)
		}
		return nil
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return fmt.Errorf("find bootstrap user: %w", err)
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return fmt.Errorf("hash bootstrap password: %w", err)
	}
	_, err = s.db.Exec(ctx, `
		INSERT INTO control.users (email, display_name, password_hash, is_super_admin)
		VALUES ($1, $2, $3, TRUE)
	`, email, displayNameFromEmail(email), string(hash))
	if err != nil {
		return fmt.Errorf("create bootstrap user: %w", err)
	}
	return nil
}

func (s *Service) Login(ctx context.Context, email, password string) (string, User, error) {
	user, hash, err := s.userWithPassword(ctx, normalizeEmail(email))
	if err != nil || bcrypt.CompareHashAndPassword([]byte(hash), []byte(password)) != nil || !user.IsActive {
		return "", User{}, ErrInvalidCredentials
	}

	rawToken := make([]byte, 32)
	if _, err := rand.Read(rawToken); err != nil {
		return "", User{}, fmt.Errorf("generate session token: %w", err)
	}
	token := base64.RawURLEncoding.EncodeToString(rawToken)
	hashToken := tokenHash(token)
	expiresAt := time.Now().UTC().Add(s.sessionTTL)
	if _, err := s.db.Exec(ctx, `
		INSERT INTO control.sessions (token_hash, user_id, expires_at)
		VALUES ($1, $2, $3)
	`, hashToken, user.ID, expiresAt); err != nil {
		return "", User{}, fmt.Errorf("create session: %w", err)
	}
	return token, user, nil
}

func (s *Service) Authenticate(ctx context.Context, token string) (User, error) {
	token = strings.TrimSpace(token)
	if token == "" {
		return User{}, ErrInvalidCredentials
	}

	var userID int64
	err := s.db.QueryRow(ctx, `
		SELECT u.id
		FROM control.sessions session
		JOIN control.users u ON u.id = session.user_id
		WHERE session.token_hash = $1 AND session.expires_at > NOW() AND u.is_active = TRUE
	`, tokenHash(token)).Scan(&userID)
	if errors.Is(err, pgx.ErrNoRows) {
		return User{}, ErrInvalidCredentials
	}
	if err != nil {
		return User{}, fmt.Errorf("authenticate session: %w", err)
	}
	return s.user(ctx, userID)
}

func (s *Service) Logout(ctx context.Context, token string) error {
	if strings.TrimSpace(token) == "" {
		return nil
	}
	_, err := s.db.Exec(ctx, `DELETE FROM control.sessions WHERE token_hash = $1`, tokenHash(token))
	return err
}

func (s *Service) UpdateProfile(ctx context.Context, userID int64, email, displayName string) (User, error) {
	email = normalizeEmail(email)
	displayName = strings.TrimSpace(displayName)
	if email == "" || displayName == "" {
		return User{}, errors.New("email and display name are required")
	}

	result, err := s.db.Exec(ctx, `
		UPDATE control.users
		SET email = $1, display_name = $2, updated_at = NOW()
		WHERE id = $3
	`, email, displayName, userID)
	if isUniqueViolation(err) {
		return User{}, ErrConflict
	}
	if err != nil {
		return User{}, fmt.Errorf("update profile: %w", err)
	}
	if result.RowsAffected() == 0 {
		return User{}, ErrNotFound
	}
	return s.user(ctx, userID)
}

func (s *Service) ChangePassword(ctx context.Context, userID int64, currentPassword, newPassword, currentToken string) error {
	if len([]rune(newPassword)) < 12 {
		return ErrWeakPassword
	}

	var currentHash string
	err := s.db.QueryRow(ctx, `SELECT password_hash FROM control.users WHERE id = $1 AND is_active = TRUE`, userID).Scan(&currentHash)
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrNotFound
	}
	if err != nil {
		return fmt.Errorf("load current password: %w", err)
	}
	if bcrypt.CompareHashAndPassword([]byte(currentHash), []byte(currentPassword)) != nil {
		return ErrInvalidCredentials
	}

	newHash, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
	if err != nil {
		return fmt.Errorf("hash new password: %w", err)
	}

	tx, err := s.db.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin password change: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	if _, err := tx.Exec(ctx, `
		UPDATE control.users
		SET password_hash = $1, updated_at = NOW()
		WHERE id = $2
	`, string(newHash), userID); err != nil {
		return fmt.Errorf("update password: %w", err)
	}
	if strings.TrimSpace(currentToken) == "" {
		if _, err := tx.Exec(ctx, `DELETE FROM control.sessions WHERE user_id = $1`, userID); err != nil {
			return fmt.Errorf("revoke sessions: %w", err)
		}
	} else if _, err := tx.Exec(ctx, `
		DELETE FROM control.sessions
		WHERE user_id = $1 AND token_hash <> $2
	`, userID, tokenHash(currentToken)); err != nil {
		return fmt.Errorf("revoke other sessions: %w", err)
	}
	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit password change: %w", err)
	}
	return nil
}

func (s *Service) ListUsers(ctx context.Context) ([]User, error) {
	rows, err := s.db.Query(ctx, `
		SELECT id, email, display_name, is_active, is_super_admin, created_at
		FROM control.users
		ORDER BY is_super_admin DESC, created_at ASC
	`)
	if err != nil {
		return nil, fmt.Errorf("list users: %w", err)
	}
	defer rows.Close()

	var users []User
	for rows.Next() {
		var user User
		if err := rows.Scan(&user.ID, &user.Email, &user.DisplayName, &user.IsActive, &user.IsSuperAdmin, &user.CreatedAt); err != nil {
			return nil, fmt.Errorf("scan user: %w", err)
		}
		users = append(users, user)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate users: %w", err)
	}
	for index := range users {
		permissions, err := s.effectivePermissions(ctx, users[index].ID, users[index].IsSuperAdmin)
		if err != nil {
			return nil, err
		}
		users[index].Permissions = permissions
	}
	return users, nil
}

func (s *Service) CreateUser(ctx context.Context, actor User, email, displayName, password string, permissions []string) (User, error) {
	email = normalizeEmail(email)
	displayName = strings.TrimSpace(displayName)
	if email == "" || displayName == "" || strings.TrimSpace(password) == "" {
		return User{}, errors.New("email, display name and password are required")
	}
	if err := validatePermissions(permissions); err != nil {
		return User{}, err
	}
	if !actor.IsSuperAdmin && containsUserManagementPermission(permissions) {
		return User{}, ErrPrivilegeEscalation
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return User{}, fmt.Errorf("hash user password: %w", err)
	}

	tx, err := s.db.Begin(ctx)
	if err != nil {
		return User{}, fmt.Errorf("begin create user: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var id int64
	err = tx.QueryRow(ctx, `
		INSERT INTO control.users (email, display_name, password_hash)
		VALUES ($1, $2, $3)
		RETURNING id
	`, email, displayName, string(hash)).Scan(&id)
	if isUniqueViolation(err) {
		return User{}, ErrConflict
	}
	if err != nil {
		return User{}, fmt.Errorf("insert user: %w", err)
	}
	if err := insertPermissions(ctx, tx, id, permissions); err != nil {
		return User{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return User{}, fmt.Errorf("commit create user: %w", err)
	}
	return s.user(ctx, id)
}

func (s *Service) UpdatePermissions(ctx context.Context, actor User, userID int64, permissions []string) (User, error) {
	if err := validatePermissions(permissions); err != nil {
		return User{}, err
	}

	tx, err := s.db.Begin(ctx)
	if err != nil {
		return User{}, fmt.Errorf("begin update permissions: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var isSuperAdmin bool
	err = tx.QueryRow(ctx, `SELECT is_super_admin FROM control.users WHERE id = $1`, userID).Scan(&isSuperAdmin)
	if errors.Is(err, pgx.ErrNoRows) {
		return User{}, ErrNotFound
	}
	if err != nil {
		return User{}, fmt.Errorf("find user for permissions: %w", err)
	}
	if isSuperAdmin {
		return User{}, ErrProtectedUser
	}
	if actor.ID == userID {
		return User{}, ErrProtectedUser
	}
	if !actor.IsSuperAdmin && containsUserManagementPermission(permissions) {
		return User{}, ErrPrivilegeEscalation
	}
	if _, err := tx.Exec(ctx, `DELETE FROM control.user_permissions WHERE user_id = $1`, userID); err != nil {
		return User{}, fmt.Errorf("clear permissions: %w", err)
	}
	if err := insertPermissions(ctx, tx, userID, permissions); err != nil {
		return User{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return User{}, fmt.Errorf("commit permissions: %w", err)
	}
	return s.user(ctx, userID)
}

func (s *Service) user(ctx context.Context, userID int64) (User, error) {
	var user User
	err := s.db.QueryRow(ctx, `
		SELECT id, email, display_name, is_active, is_super_admin, created_at
		FROM control.users WHERE id = $1
	`, userID).Scan(&user.ID, &user.Email, &user.DisplayName, &user.IsActive, &user.IsSuperAdmin, &user.CreatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return User{}, ErrNotFound
	}
	if err != nil {
		return User{}, fmt.Errorf("load user: %w", err)
	}
	user.Permissions, err = s.effectivePermissions(ctx, user.ID, user.IsSuperAdmin)
	return user, err
}

func (s *Service) userWithPassword(ctx context.Context, email string) (User, string, error) {
	var user User
	var hash string
	err := s.db.QueryRow(ctx, `
		SELECT id, email, display_name, password_hash, is_active, is_super_admin, created_at
		FROM control.users WHERE email = $1
	`, email).Scan(&user.ID, &user.Email, &user.DisplayName, &hash, &user.IsActive, &user.IsSuperAdmin, &user.CreatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return User{}, "", ErrInvalidCredentials
	}
	if err != nil {
		return User{}, "", err
	}
	user.Permissions, err = s.effectivePermissions(ctx, user.ID, user.IsSuperAdmin)
	return user, hash, err
}

func (s *Service) permissions(ctx context.Context, userID int64) ([]string, error) {
	rows, err := s.db.Query(ctx, `SELECT permission_key FROM control.user_permissions WHERE user_id = $1 ORDER BY permission_key`, userID)
	if err != nil {
		return nil, fmt.Errorf("load user permissions: %w", err)
	}
	defer rows.Close()
	var permissions []string
	for rows.Next() {
		var permission string
		if err := rows.Scan(&permission); err != nil {
			return nil, fmt.Errorf("scan user permission: %w", err)
		}
		permissions = append(permissions, permission)
	}
	return permissions, rows.Err()
}

func (s *Service) effectivePermissions(ctx context.Context, userID int64, isSuperAdmin bool) ([]string, error) {
	if isSuperAdmin {
		permissions := make([]string, 0, len(permissionCatalog))
		for _, permission := range permissionCatalog {
			permissions = append(permissions, permission.Key)
		}
		return permissions, nil
	}
	return s.permissions(ctx, userID)
}

func insertPermissions(ctx context.Context, tx pgx.Tx, userID int64, permissions []string) error {
	for _, permission := range permissions {
		if _, err := tx.Exec(ctx, `INSERT INTO control.user_permissions (user_id, permission_key) VALUES ($1, $2)`, userID, permission); err != nil {
			return fmt.Errorf("insert permission %q: %w", permission, err)
		}
	}
	return nil
}

func validatePermissions(permissions []string) error {
	known := make(map[string]struct{}, len(permissionCatalog))
	for _, permission := range permissionCatalog {
		known[permission.Key] = struct{}{}
	}
	for _, permission := range permissions {
		if _, ok := known[permission]; !ok {
			return fmt.Errorf("%w: %s", ErrInvalidPermission, permission)
		}
	}
	return nil
}

func containsUserManagementPermission(permissions []string) bool {
	for _, permission := range permissions {
		if permission == "users.create" || permission == "users.manage_access" {
			return true
		}
	}
	return false
}

func normalizeEmail(email string) string {
	return strings.ToLower(strings.TrimSpace(email))
}

func displayNameFromEmail(email string) string {
	if index := strings.IndexByte(email, '@'); index > 0 {
		return email[:index]
	}
	return email
}

func tokenHash(token string) string {
	hash := sha256.Sum256([]byte(token))
	return base64.RawURLEncoding.EncodeToString(hash[:])
}

func isUniqueViolation(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "23505"
}

func (user User) HasPermission(permission string) bool {
	if user.IsSuperAdmin {
		return true
	}
	return slicesContains(user.Permissions, permission)
}

func slicesContains(items []string, target string) bool {
	for _, item := range items {
		if item == target {
			return true
		}
	}
	return false
}
