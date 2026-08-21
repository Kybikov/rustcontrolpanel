package playerstore

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/Kybikov/rustcontrolpanel/apps/api/internal/integrations"
	"github.com/Kybikov/rustcontrolpanel/apps/api/internal/push"
	"github.com/Kybikov/rustcontrolpanel/apps/api/internal/realtime"
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

type ActivityPoint struct {
	Presence    string    `json:"presence"`
	CurrentGame string    `json:"currentGame,omitempty"`
	CapturedAt  time.Time `json:"capturedAt"`
}

type Service struct {
	db   *pgxpool.Pool
	hub  *realtime.Hub
	push *push.Service
}

func NewService(db *pgxpool.Pool, hub *realtime.Hub, pushServices ...*push.Service) *Service {
	var pushService *push.Service
	if len(pushServices) > 0 {
		pushService = pushServices[0]
	}
	return &Service{db: db, hub: hub, push: pushService}
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
		`CREATE TABLE IF NOT EXISTS control.player_activity_history (
			id BIGSERIAL PRIMARY KEY,
			user_id BIGINT NOT NULL REFERENCES control.users(id) ON DELETE CASCADE,
			steam_id TEXT NOT NULL,
			presence TEXT NOT NULL,
			current_game TEXT NOT NULL DEFAULT '',
			captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)`,
		`CREATE INDEX IF NOT EXISTS player_activity_history_user_steam_captured_idx ON control.player_activity_history (user_id, steam_id, captured_at DESC)`,
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

func (s *Service) Find(ctx context.Context, userID int64, steamID string) (SavedPlayer, error) {
	row := s.db.QueryRow(ctx, `
		SELECT steam_id, display_name, profile_url, avatar_url, visibility, presence, current_game,
			last_logoff_at, profile_created_at, created_at, updated_at
		FROM control.saved_players WHERE user_id = $1 AND steam_id = $2
	`, userID, strings.TrimSpace(steamID))
	return scan(row)
}

func (s *Service) ActivityHistory(ctx context.Context, userID int64, steamID string) ([]ActivityPoint, error) {
	if _, err := s.Find(ctx, userID, steamID); err != nil {
		return nil, err
	}
	rows, err := s.db.Query(ctx, `
		SELECT presence, current_game, captured_at
		FROM control.player_activity_history WHERE user_id = $1 AND steam_id = $2
		ORDER BY captured_at DESC LIMIT 200
	`, userID, strings.TrimSpace(steamID))
	if err != nil {
		return nil, fmt.Errorf("list player activity history: %w", err)
	}
	defer rows.Close()
	history := make([]ActivityPoint, 0)
	for rows.Next() {
		var point ActivityPoint
		if err := rows.Scan(&point.Presence, &point.CurrentGame, &point.CapturedAt); err != nil {
			return nil, fmt.Errorf("scan player activity history: %w", err)
		}
		history = append(history, point)
	}
	return history, rows.Err()
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
	saved, err := scan(row)
	if err != nil {
		return SavedPlayer{}, err
	}
	if !exists {
		if err := s.ensureInitialActivity(ctx, userID, saved); err != nil {
			return SavedPlayer{}, err
		}
	}
	return saved, nil
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

func (s *Service) Refresh(ctx context.Context, userID int64, steamID string, source *integrations.Service) (SavedPlayer, error) {
	previous, err := s.Find(ctx, userID, steamID)
	if err != nil {
		return SavedPlayer{}, err
	}
	player, err := source.SearchSteamPlayer(ctx, previous.SteamID)
	if err != nil {
		return SavedPlayer{}, err
	}
	updated, err := s.Save(ctx, userID, player)
	if err != nil {
		return SavedPlayer{}, err
	}
	if err := s.ensureInitialActivity(ctx, userID, updated); err != nil {
		return SavedPlayer{}, err
	}
	if err := s.publishUpdate(ctx, userID, previous, updated); err != nil {
		return SavedPlayer{}, err
	}
	return updated, nil
}

func (s *Service) RefreshAll(ctx context.Context, source *integrations.Service) error {
	rows, err := s.db.Query(ctx, `
		SELECT user_id, steam_id FROM control.saved_players
		ORDER BY updated_at ASC LIMIT 100
	`)
	if err != nil {
		return fmt.Errorf("list saved player refreshes: %w", err)
	}
	defer rows.Close()
	type target struct {
		userID  int64
		steamID string
	}
	targets := make([]target, 0)
	ids := make([]string, 0)
	for rows.Next() {
		var item target
		if err := rows.Scan(&item.userID, &item.steamID); err != nil {
			return fmt.Errorf("scan saved player refresh: %w", err)
		}
		targets = append(targets, item)
		ids = append(ids, item.steamID)
	}
	if err := rows.Err(); err != nil || len(targets) == 0 {
		return err
	}
	profiles, err := source.SteamPlayers(ctx, ids)
	if err != nil {
		return err
	}
	bySteamID := make(map[string]integrations.SteamPlayer, len(profiles))
	for _, profile := range profiles {
		bySteamID[profile.SteamID] = profile
	}
	for _, item := range targets {
		profile, ok := bySteamID[item.steamID]
		if !ok {
			continue
		}
		previous, err := s.Find(ctx, item.userID, item.steamID)
		if err != nil {
			return err
		}
		updated, err := s.Save(ctx, item.userID, profile)
		if err != nil {
			return err
		}
		if err := s.ensureInitialActivity(ctx, item.userID, updated); err != nil {
			return err
		}
		if err := s.publishUpdate(ctx, item.userID, previous, updated); err != nil {
			return err
		}
	}
	return nil
}

func (s *Service) publishUpdate(ctx context.Context, userID int64, previous, updated SavedPlayer) error {
	if playerActivityChanged(previous, updated) {
		if err := s.appendActivity(ctx, userID, updated); err != nil {
			return err
		}
		title, body := playerActivityNotification(updated)
		var notification struct {
			ID        int64      `json:"id"`
			Type      string     `json:"type"`
			Title     string     `json:"title"`
			Body      string     `json:"body"`
			Href      string     `json:"href"`
			ReadAt    *time.Time `json:"readAt,omitempty"`
			CreatedAt time.Time  `json:"createdAt"`
		}
		if err := s.db.QueryRow(ctx, `
			INSERT INTO control.notifications (user_id, type, title, body, href)
			VALUES ($1, 'player.activity', $2, $3, $4)
			RETURNING id, type, title, body, href, read_at, created_at
		`, userID, title, body, "/players/"+updated.SteamID).Scan(
			&notification.ID, &notification.Type, &notification.Title, &notification.Body,
			&notification.Href, &notification.ReadAt, &notification.CreatedAt,
		); err != nil {
			return fmt.Errorf("create player activity notification: %w", err)
		}
		if _, err := s.db.Exec(ctx, `
			DELETE FROM control.notifications WHERE id IN (
				SELECT id FROM control.notifications WHERE user_id = $1
				ORDER BY created_at DESC OFFSET 100
			)
		`, userID); err != nil {
			return fmt.Errorf("trim player notifications: %w", err)
		}
		if s.hub != nil {
			s.hub.PublishToUser(userID, realtime.Event{
				Type:      "notification.created",
				Timestamp: time.Now().UTC(),
				Payload:   map[string]any{"notification": notification},
			})
		}
		if s.push != nil {
			s.push.SendToUser(ctx, userID, push.Payload{
				Title: notification.Title, Body: notification.Body, Href: notification.Href, Tag: notification.Type,
			})
		}
	}
	if s.hub != nil {
		s.hub.PublishToUser(userID, realtime.Event{
			Type:      "player.saved.updated",
			Timestamp: time.Now().UTC(),
			Payload:   map[string]any{"player": updated},
		})
	}
	return nil
}

func (s *Service) ensureInitialActivity(ctx context.Context, userID int64, player SavedPlayer) error {
	if _, err := s.db.Exec(ctx, `
		INSERT INTO control.player_activity_history (user_id, steam_id, presence, current_game)
		SELECT $1, $2, $3, $4
		WHERE NOT EXISTS (
			SELECT 1 FROM control.player_activity_history WHERE user_id = $1 AND steam_id = $2
		)
	`, userID, player.SteamID, player.Presence, player.CurrentGame); err != nil {
		return fmt.Errorf("save initial player activity history: %w", err)
	}
	return nil
}

func (s *Service) appendActivity(ctx context.Context, userID int64, player SavedPlayer) error {
	if _, err := s.db.Exec(ctx, `
		INSERT INTO control.player_activity_history (user_id, steam_id, presence, current_game)
		VALUES ($1, $2, $3, $4)
	`, userID, player.SteamID, player.Presence, player.CurrentGame); err != nil {
		return fmt.Errorf("save player activity history: %w", err)
	}
	if _, err := s.db.Exec(ctx, `
		DELETE FROM control.player_activity_history WHERE id IN (
			SELECT id FROM control.player_activity_history WHERE user_id = $1 AND steam_id = $2
			ORDER BY captured_at DESC OFFSET 1000
		)
	`, userID, player.SteamID); err != nil {
		return fmt.Errorf("trim player activity history: %w", err)
	}
	return nil
}

func playerActivityChanged(previous, updated SavedPlayer) bool {
	return previous.Presence != updated.Presence || previous.CurrentGame != updated.CurrentGame
}

func playerActivityNotification(player SavedPlayer) (string, string) {
	name := player.DisplayName
	if name == "" {
		name = "Saved player"
	}
	if player.CurrentGame != "" {
		return name + " is playing " + player.CurrentGame, "Steam updated the public game activity."
	}
	if player.Presence == "online" {
		return name + " is online", "Steam updated the public player status."
	}
	return name + " is offline", "Steam updated the public player status."
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
