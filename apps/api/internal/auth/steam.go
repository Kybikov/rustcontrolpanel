package auth

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
)

var (
	ErrSteamNotLinked = errors.New("Steam account is not linked")
	ErrSteamLinkState = errors.New("Steam link has expired or is invalid")
	ErrSteamInUse     = errors.New("this Steam account is already linked to another RustControl user")
)

type SteamAccount struct {
	SteamID    string    `json:"steamId"`
	ProfileURL string    `json:"profileUrl"`
	LinkedAt   time.Time `json:"linkedAt"`
}

func (s *Service) CreateSteamLinkState(ctx context.Context, userID int64) (string, error) {
	if userID < 1 {
		return "", ErrNotFound
	}
	state, err := randomState()
	if err != nil {
		return "", err
	}
	if _, err := s.db.Exec(ctx, `DELETE FROM control.steam_openid_states WHERE user_id = $1`, userID); err != nil {
		return "", fmt.Errorf("clear prior Steam link state: %w", err)
	}
	_, err = s.db.Exec(ctx, `
		INSERT INTO control.steam_openid_states (state, user_id, expires_at)
		VALUES ($1, $2, NOW() + INTERVAL '10 minutes')
	`, state, userID)
	if err != nil {
		return "", fmt.Errorf("create Steam link state: %w", err)
	}
	return state, nil
}

func (s *Service) SteamLinkStateUser(ctx context.Context, state string) (int64, error) {
	state = strings.TrimSpace(state)
	if state == "" {
		return 0, ErrSteamLinkState
	}
	var userID int64
	err := s.db.QueryRow(ctx, `
		SELECT user_id FROM control.steam_openid_states
		WHERE state = $1 AND expires_at > NOW()
	`, state).Scan(&userID)
	if errors.Is(err, pgx.ErrNoRows) {
		return 0, ErrSteamLinkState
	}
	if err != nil {
		return 0, fmt.Errorf("load Steam link state: %w", err)
	}
	return userID, nil
}

func (s *Service) LinkSteamAccount(ctx context.Context, state, steamID string) (SteamAccount, error) {
	steamID = strings.TrimSpace(steamID)
	if !isSteamID64(steamID) {
		return SteamAccount{}, ErrSteamLinkState
	}
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return SteamAccount{}, fmt.Errorf("begin Steam link: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var userID int64
	err = tx.QueryRow(ctx, `
		SELECT user_id FROM control.steam_openid_states
		WHERE state = $1 AND expires_at > NOW()
		FOR UPDATE
	`, strings.TrimSpace(state)).Scan(&userID)
	if errors.Is(err, pgx.ErrNoRows) {
		return SteamAccount{}, ErrSteamLinkState
	}
	if err != nil {
		return SteamAccount{}, fmt.Errorf("lock Steam link state: %w", err)
	}
	if _, err := tx.Exec(ctx, `DELETE FROM control.steam_openid_states WHERE state = $1`, strings.TrimSpace(state)); err != nil {
		return SteamAccount{}, fmt.Errorf("consume Steam link state: %w", err)
	}

	var account SteamAccount
	err = tx.QueryRow(ctx, `
		INSERT INTO control.user_steam_accounts (user_id, steam_id)
		VALUES ($1, $2)
		ON CONFLICT (user_id) DO UPDATE SET steam_id = EXCLUDED.steam_id, linked_at = NOW()
		RETURNING steam_id, linked_at
	`, userID, steamID).Scan(&account.SteamID, &account.LinkedAt)
	if isUniqueViolation(err) {
		return SteamAccount{}, ErrSteamInUse
	}
	if err != nil {
		return SteamAccount{}, fmt.Errorf("save Steam account: %w", err)
	}
	if err := tx.Commit(ctx); err != nil {
		return SteamAccount{}, fmt.Errorf("commit Steam link: %w", err)
	}
	account.ProfileURL = steamProfileURL(account.SteamID)
	return account, nil
}

func (s *Service) SteamAccount(ctx context.Context, userID int64) (SteamAccount, error) {
	var account SteamAccount
	err := s.db.QueryRow(ctx, `
		SELECT steam_id, linked_at
		FROM control.user_steam_accounts WHERE user_id = $1
	`, userID).Scan(&account.SteamID, &account.LinkedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return SteamAccount{}, ErrSteamNotLinked
	}
	if err != nil {
		return SteamAccount{}, fmt.Errorf("load Steam account: %w", err)
	}
	account.ProfileURL = steamProfileURL(account.SteamID)
	return account, nil
}

func (s *Service) UnlinkSteamAccount(ctx context.Context, userID int64) error {
	result, err := s.db.Exec(ctx, `DELETE FROM control.user_steam_accounts WHERE user_id = $1`, userID)
	if err != nil {
		return fmt.Errorf("unlink Steam account: %w", err)
	}
	if result.RowsAffected() == 0 {
		return ErrSteamNotLinked
	}
	return nil
}

func randomState() (string, error) {
	value := make([]byte, 32)
	if _, err := rand.Read(value); err != nil {
		return "", fmt.Errorf("generate Steam link state: %w", err)
	}
	return base64.RawURLEncoding.EncodeToString(value), nil
}

func isSteamID64(value string) bool {
	if len(value) != 17 || !strings.HasPrefix(value, "765") {
		return false
	}
	for _, character := range value {
		if character < '0' || character > '9' {
			return false
		}
	}
	return true
}

func steamProfileURL(steamID string) string {
	return "https://steamcommunity.com/profiles/" + steamID
}
