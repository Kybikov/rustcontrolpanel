package playerstore

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/Kybikov/rustcontrolpanel/apps/api/internal/integrations"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

const maxSavedPlayers = 100

var ErrSavedPlayersFull = fmt.Errorf("you can save at most %d players", maxSavedPlayers)

type SavedPlayer struct {
	SteamID          string     `json:"steamId"`
	DisplayName      string     `json:"displayName"`
	ProfileURL       string     `json:"profileUrl"`
	AvatarURL        string     `json:"avatarUrl,omitempty"`
	Visibility       string     `json:"visibility"`
	Presence         string     `json:"presence"`
	CurrentGame      string     `json:"currentGame,omitempty"`
	LastLogoffAt     *time.Time `json:"lastLogoffAt,omitempty"`
	ProfileCreatedAt *time.Time `json:"profileCreatedAt,omitempty"`
	SavedAt          time.Time  `json:"savedAt"`
	UpdatedAt        time.Time  `json:"updatedAt"`
}

type Service struct {
	db *pgxpool.Pool
}

func NewService(db *pgxpool.Pool) *Service {
	return &Service{db: db}
}

func (s *Service) EnsureSchema(ctx context.Context) error {
	if s == nil || s.db == nil {
		return errors.New("player store database is not configured")
	}
	statements := []string{
		`CREATE SCHEMA IF NOT EXISTS control`,
		`CREATE TABLE IF NOT EXISTS control.saved_players (
			user_id BIGINT NOT NULL REFERENCES control.users(id) ON DELETE CASCADE,
			steam_id TEXT NOT NULL,
			display_name TEXT NOT NULL DEFAULT '',
			profile_url TEXT NOT NULL DEFAULT '',
			avatar_url TEXT NOT NULL DEFAULT '',
			visibility TEXT NOT NULL DEFAULT 'limited',
			presence TEXT NOT NULL DEFAULT 'offline',
			current_game TEXT NOT NULL DEFAULT '',
			last_logoff_at TIMESTAMPTZ,
			profile_created_at TIMESTAMPTZ,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			PRIMARY KEY (user_id, steam_id)
		)`,
		`CREATE INDEX IF NOT EXISTS saved_players_user_updated_idx ON control.saved_players (user_id, updated_at DESC)`,
	}
	for _, statement := range statements {
		if _, err := s.db.Exec(ctx, statement); err != nil {
			return fmt.Errorf("apply saved players schema: %w", err)
		}
	}
	return nil
}

func (s *Service) List(ctx context.Context, userID int64) ([]SavedPlayer, error) {
	rows, err := s.db.Query(ctx, `
		SELECT steam_id, display_name, profile_url, avatar_url, visibility, presence, current_game,
			last_logoff_at, profile_created_at, created_at, updated_at
		FROM control.saved_players WHERE user_id = $1 ORDER BY updated_at DESC
	`, userID)
	if err != nil {
		return nil, fmt.Errorf("list saved players: %w", err)
	}
	defer rows.Close()
	players := make([]SavedPlayer, 0)
	for rows.Next() {
		player, err := scan(rows)
		if err != nil {
			return nil, err
		}
		players = append(players, player)
	}
	return players, rows.Err()
}

func (s *Service) Save(ctx context.Context, userID int64, player integrations.SteamPlayer) (SavedPlayer, error) {
	if strings.TrimSpace(player.SteamID) == "" {
		return SavedPlayer{}, errors.New("Steam player identity is required")
	}
	var exists bool
	if err := s.db.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM control.saved_players WHERE user_id = $1 AND steam_id = $2)`, userID, player.SteamID).Scan(&exists); err != nil {
		return SavedPlayer{}, fmt.Errorf("find saved player: %w", err)
	}
	if !exists {
		var count int
		if err := s.db.QueryRow(ctx, `SELECT COUNT(*) FROM control.saved_players WHERE user_id = $1`, userID).Scan(&count); err != nil {
			return SavedPlayer{}, fmt.Errorf("count saved players: %w", err)
		}
		if count >= maxSavedPlayers {
			return SavedPlayer{}, ErrSavedPlayersFull
		}
	}
	row := s.db.QueryRow(ctx, `
		INSERT INTO control.saved_players (
			user_id, steam_id, display_name, profile_url, avatar_url, visibility, presence, current_game,
			last_logoff_at, profile_created_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
		ON CONFLICT (user_id, steam_id) DO UPDATE SET
			display_name = EXCLUDED.display_name, profile_url = EXCLUDED.profile_url,
			avatar_url = EXCLUDED.avatar_url, visibility = EXCLUDED.visibility, presence = EXCLUDED.presence,
			current_game = EXCLUDED.current_game, last_logoff_at = EXCLUDED.last_logoff_at,
			profile_created_at = EXCLUDED.profile_created_at, updated_at = NOW()
		RETURNING steam_id, display_name, profile_url, avatar_url, visibility, presence, current_game,
			last_logoff_at, profile_created_at, created_at, updated_at
	`, userID, player.SteamID, player.DisplayName, player.ProfileURL, player.AvatarURL, player.Visibility,
		player.Presence, player.CurrentGame, player.LastLogoffAt, player.ProfileCreatedAt)
	return scan(row)
}

func (s *Service) Remove(ctx context.Context, userID int64, steamID string) error {
	command, err := s.db.Exec(ctx, `DELETE FROM control.saved_players WHERE user_id = $1 AND steam_id = $2`, userID, strings.TrimSpace(steamID))
	if err != nil {
		return fmt.Errorf("remove saved player: %w", err)
	}
	if command.RowsAffected() == 0 {
		return pgx.ErrNoRows
	}
	return nil
}

type scanner interface{ Scan(...any) error }

func scan(row scanner) (SavedPlayer, error) {
	var player SavedPlayer
	if err := row.Scan(&player.SteamID, &player.DisplayName, &player.ProfileURL, &player.AvatarURL,
		&player.Visibility, &player.Presence, &player.CurrentGame, &player.LastLogoffAt,
		&player.ProfileCreatedAt, &player.SavedAt, &player.UpdatedAt); err != nil {
		return SavedPlayer{}, fmt.Errorf("scan saved player: %w", err)
	}
	return player, nil
}
