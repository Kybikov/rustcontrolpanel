package servercheck

import (
	"context"
	"encoding/binary"
	"errors"
	"fmt"
	"net"
	"net/netip"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/Kybikov/rustcontrolpanel/apps/api/internal/push"
	"github.com/Kybikov/rustcontrolpanel/apps/api/internal/realtime"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

const (
	rustAppID      = uint64(252490)
	queryTimeout   = 2500 * time.Millisecond
	maxWatchlist   = 25
	maxRefreshRows = 1000
	checkCacheTTL  = time.Minute
)

var (
	ErrInvalidAddress     = errors.New("enter a public server address and port, for example 79.137.98.23:28015 or eu2xt.warbandits.gg:28015")
	ErrNotRustServer      = errors.New("the endpoint answered, but it is not a Rust server")
	ErrPublicQueryBlocked = errors.New("server blocks public status queries")
	ErrWatchlistFull      = fmt.Errorf("a watchlist can contain at most %d servers", maxWatchlist)
)

type Snapshot struct {
	Address           string    `json:"address"`
	QueryAddress      string    `json:"queryAddress"`
	Name              string    `json:"name"`
	Map               string    `json:"map"`
	Players           int       `json:"players"`
	MaxPlayers        int       `json:"maxPlayers"`
	Bots              int       `json:"bots"`
	Version           string    `json:"version"`
	Tags              []string  `json:"tags"`
	VACSecured        bool      `json:"vacSecured"`
	PasswordProtected bool      `json:"passwordProtected"`
	Protocol          int       `json:"protocol"`
	GameFolder        string    `json:"gameFolder"`
	GameName          string    `json:"gameName"`
	ServerKind        string    `json:"serverKind"`
	Environment       string    `json:"environment"`
	ServerSteamID     string    `json:"serverSteamId,omitempty"`
	MapSeed           *int      `json:"mapSeed,omitempty"`
	MapSize           *int      `json:"mapSize,omitempty"`
	MapURL            string    `json:"mapUrl,omitempty"`
	LatencyMS         int       `json:"latencyMs"`
	CheckedAt         time.Time `json:"checkedAt"`
}

type WatchlistServer struct {
	ID                int64      `json:"id"`
	Address           string     `json:"address"`
	QueryAddress      string     `json:"queryAddress"`
	Status            string     `json:"status"`
	Error             string     `json:"error,omitempty"`
	Name              string     `json:"name,omitempty"`
	Map               string     `json:"map,omitempty"`
	Players           *int       `json:"players,omitempty"`
	MaxPlayers        *int       `json:"maxPlayers,omitempty"`
	Bots              *int       `json:"bots,omitempty"`
	Version           string     `json:"version,omitempty"`
	Tags              []string   `json:"tags"`
	VACSecured        *bool      `json:"vacSecured,omitempty"`
	PasswordProtected *bool      `json:"passwordProtected,omitempty"`
	Protocol          *int       `json:"protocol,omitempty"`
	GameFolder        string     `json:"gameFolder,omitempty"`
	GameName          string     `json:"gameName,omitempty"`
	ServerKind        string     `json:"serverKind,omitempty"`
	Environment       string     `json:"environment,omitempty"`
	ServerSteamID     string     `json:"serverSteamId,omitempty"`
	MapSeed           *int       `json:"mapSeed,omitempty"`
	MapSize           *int       `json:"mapSize,omitempty"`
	MapURL            string     `json:"mapUrl,omitempty"`
	LatencyMS         *int       `json:"latencyMs,omitempty"`
	CheckedAt         *time.Time `json:"checkedAt,omitempty"`
	CreatedAt         time.Time  `json:"createdAt"`
}

type Notification struct {
	ID        int64      `json:"id"`
	Type      string     `json:"type"`
	Title     string     `json:"title"`
	Body      string     `json:"body"`
	Href      string     `json:"href,omitempty"`
	ReadAt    *time.Time `json:"readAt,omitempty"`
	CreatedAt time.Time  `json:"createdAt"`
}

type HistoryPoint struct {
	Status     string    `json:"status"`
	Name       string    `json:"name,omitempty"`
	Map        string    `json:"map,omitempty"`
	Players    *int      `json:"players,omitempty"`
	MaxPlayers *int      `json:"maxPlayers,omitempty"`
	LatencyMS  *int      `json:"latencyMs,omitempty"`
	Error      string    `json:"error,omitempty"`
	CheckedAt  time.Time `json:"checkedAt"`
}

type Service struct {
	db           *pgxpool.Pool
	hub          *realtime.Hub
	cacheMu      sync.Mutex
	recentChecks map[recentCheckKey]cachedCheck
	push         *push.Service
}

type recentCheckKey struct {
	userID  int64
	address string
}
type cachedCheck struct {
	snapshot  Snapshot
	expiresAt time.Time
}

func NewService(db *pgxpool.Pool, hub *realtime.Hub, pushServices ...*push.Service) *Service {
	var pushService *push.Service
	if len(pushServices) > 0 {
		pushService = pushServices[0]
	}
	return &Service{db: db, hub: hub, push: pushService, recentChecks: make(map[recentCheckKey]cachedCheck)}
}

func (s *Service) EnsureSchema(ctx context.Context) error {
	if s == nil || s.db == nil {
		return errors.New("server checker database is not configured")
	}
	statements := []string{
		`CREATE SCHEMA IF NOT EXISTS control`,
		`CREATE TABLE IF NOT EXISTS control.server_watchlist (
			id BIGSERIAL PRIMARY KEY,
			user_id BIGINT NOT NULL REFERENCES control.users(id) ON DELETE CASCADE,
			ip INET NOT NULL,
			game_port INTEGER NOT NULL CHECK (game_port BETWEEN 1 AND 65535),
			query_port INTEGER NOT NULL CHECK (query_port BETWEEN 1 AND 65535),
			status TEXT NOT NULL DEFAULT 'unknown' CHECK (status IN ('online', 'offline', 'blocked', 'unknown')),
			last_error TEXT NOT NULL DEFAULT '',
			server_name TEXT NOT NULL DEFAULT '',
			map_name TEXT NOT NULL DEFAULT '',
			players INTEGER,
			max_players INTEGER,
			bots INTEGER,
			version TEXT NOT NULL DEFAULT '',
			tags TEXT[] NOT NULL DEFAULT '{}',
			vac_secured BOOLEAN,
			password_protected BOOLEAN,
			protocol INTEGER,
			game_folder TEXT NOT NULL DEFAULT '',
			game_name TEXT NOT NULL DEFAULT '',
			server_kind TEXT NOT NULL DEFAULT '',
			environment TEXT NOT NULL DEFAULT '',
			server_steam_id TEXT NOT NULL DEFAULT '',
			map_seed INTEGER,
			map_size INTEGER,
			map_url TEXT NOT NULL DEFAULT '',
			latency_ms INTEGER,
			last_checked_at TIMESTAMPTZ,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			UNIQUE (user_id, ip, game_port)
		)`,
		`CREATE INDEX IF NOT EXISTS server_watchlist_user_updated_idx ON control.server_watchlist (user_id, updated_at DESC)`,
		`CREATE TABLE IF NOT EXISTS control.notifications (
			id BIGSERIAL PRIMARY KEY,
			user_id BIGINT NOT NULL REFERENCES control.users(id) ON DELETE CASCADE,
			type TEXT NOT NULL,
			title TEXT NOT NULL,
			body TEXT NOT NULL DEFAULT '',
			href TEXT NOT NULL DEFAULT '',
			read_at TIMESTAMPTZ,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)`,
		`CREATE INDEX IF NOT EXISTS notifications_user_created_idx ON control.notifications (user_id, created_at DESC)`,
		`CREATE TABLE IF NOT EXISTS control.server_watchlist_history (
			id BIGSERIAL PRIMARY KEY,
			watchlist_id BIGINT NOT NULL REFERENCES control.server_watchlist(id) ON DELETE CASCADE,
			status TEXT NOT NULL,
			server_name TEXT NOT NULL DEFAULT '',
			map_name TEXT NOT NULL DEFAULT '',
			players INTEGER,
			max_players INTEGER,
			latency_ms INTEGER,
			last_error TEXT NOT NULL DEFAULT '',
			checked_at TIMESTAMPTZ NOT NULL
		)`,
		`CREATE INDEX IF NOT EXISTS server_watchlist_history_watchlist_checked_idx ON control.server_watchlist_history (watchlist_id, checked_at DESC)`,
		`ALTER TABLE control.server_watchlist DROP CONSTRAINT IF EXISTS server_watchlist_status_check`,
		`ALTER TABLE control.server_watchlist ADD CONSTRAINT server_watchlist_status_check CHECK (status IN ('online', 'offline', 'blocked', 'unknown'))`,
		`ALTER TABLE control.server_watchlist ADD COLUMN IF NOT EXISTS protocol INTEGER`,
		`ALTER TABLE control.server_watchlist ADD COLUMN IF NOT EXISTS game_folder TEXT NOT NULL DEFAULT ''`,
		`ALTER TABLE control.server_watchlist ADD COLUMN IF NOT EXISTS game_name TEXT NOT NULL DEFAULT ''`,
		`ALTER TABLE control.server_watchlist ADD COLUMN IF NOT EXISTS server_kind TEXT NOT NULL DEFAULT ''`,
		`ALTER TABLE control.server_watchlist ADD COLUMN IF NOT EXISTS environment TEXT NOT NULL DEFAULT ''`,
		`ALTER TABLE control.server_watchlist ADD COLUMN IF NOT EXISTS server_steam_id TEXT NOT NULL DEFAULT ''`,
		`ALTER TABLE control.server_watchlist ADD COLUMN IF NOT EXISTS map_seed INTEGER`,
		`ALTER TABLE control.server_watchlist ADD COLUMN IF NOT EXISTS map_size INTEGER`,
		`ALTER TABLE control.server_watchlist ADD COLUMN IF NOT EXISTS map_url TEXT NOT NULL DEFAULT ''`,
	}
	for _, statement := range statements {
		if _, err := s.db.Exec(ctx, statement); err != nil {
			return fmt.Errorf("apply server checker schema: %w", err)
		}
	}
	return nil
}

func (s *Service) Check(ctx context.Context, rawAddress string) (Snapshot, error) {
	endpoint, err := parseEndpoint(ctx, rawAddress)
	if err != nil {
		return Snapshot{}, err
	}

	var lastErr error
	for _, port := range probePorts(endpoint.port) {
		snapshot, err := queryInfo(ctx, endpoint.ip, port)
		if err == nil {
			if snapshot.AdvertisedPort > 0 {
				endpoint.port = snapshot.AdvertisedPort
			}
			return Snapshot{
				Address:           net.JoinHostPort(endpoint.ip.String(), strconv.Itoa(endpoint.port)),
				QueryAddress:      net.JoinHostPort(endpoint.ip.String(), strconv.Itoa(port)),
				Name:              snapshot.Name,
				Map:               snapshot.Map,
				Players:           snapshot.Players,
				MaxPlayers:        snapshot.MaxPlayers,
				Bots:              snapshot.Bots,
				Version:           snapshot.Version,
				Tags:              snapshot.Tags,
				VACSecured:        snapshot.VACSecured,
				PasswordProtected: snapshot.PasswordProtected,
				Protocol:          snapshot.Protocol,
				GameFolder:        snapshot.Folder,
				GameName:          snapshot.Game,
				ServerKind:        snapshot.ServerKind,
				Environment:       snapshot.Environment,
				ServerSteamID:     steamIDString(snapshot.ServerSteamID),
				MapSeed:           snapshot.MapSeed,
				MapSize:           snapshot.MapSize,
				MapURL:            snapshot.MapURL,
				LatencyMS:         snapshot.LatencyMS,
				CheckedAt:         time.Now().UTC(),
			}, nil
		}
		lastErr = err
	}
	if lastErr == nil {
		lastErr = errors.New("server did not answer")
	}
	return Snapshot{}, lastErr
}

func (s *Service) CheckForUser(ctx context.Context, userID int64, rawAddress string) (Snapshot, error) {
	snapshot, err := s.Check(ctx, rawAddress)
	if err != nil {
		return Snapshot{}, err
	}
	s.cacheMu.Lock()
	defer s.cacheMu.Unlock()
	s.pruneRecentChecks(time.Now())
	s.recentChecks[recentCheckKey{userID: userID, address: snapshot.Address}] = cachedCheck{snapshot: snapshot, expiresAt: time.Now().Add(checkCacheTTL)}
	return snapshot, nil
}

func (s *Service) Add(ctx context.Context, userID int64, rawAddress string) (WatchlistServer, error) {
	endpoint, parseErr := parseEndpoint(ctx, rawAddress)
	if parseErr != nil {
		return WatchlistServer{}, parseErr
	}
	var snapshot Snapshot
	var fromCache bool
	var checkErr error
	s.cacheMu.Lock()
	s.pruneRecentChecks(time.Now())
	if cached, ok := s.recentChecks[recentCheckKey{userID: userID, address: net.JoinHostPort(endpoint.ip.String(), strconv.Itoa(endpoint.port))}]; ok {
		snapshot, fromCache = cached.snapshot, true
	}
	s.cacheMu.Unlock()
	if !fromCache {
		snapshot, checkErr = s.Check(ctx, rawAddress)
		if checkErr == nil {
			endpoint, _ = parseEndpoint(ctx, snapshot.Address)
		}
	}

	var count int
	if err := s.db.QueryRow(ctx, `SELECT COUNT(*) FROM control.server_watchlist WHERE user_id = $1`, userID).Scan(&count); err != nil {
		return WatchlistServer{}, fmt.Errorf("count watchlist: %w", err)
	}
	if count >= maxWatchlist {
		var exists bool
		if err := s.db.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM control.server_watchlist WHERE user_id = $1 AND ip = $2 AND game_port = $3)`, userID, endpoint.ip.String(), endpoint.port).Scan(&exists); err != nil {
			return WatchlistServer{}, fmt.Errorf("find watchlist server: %w", err)
		}
		if !exists {
			return WatchlistServer{}, ErrWatchlistFull
		}
	}

	queryPort := endpoint.port
	if snapshot.Address != "" {
		_, queryPortRaw, _ := net.SplitHostPort(snapshot.QueryAddress)
		queryPort, _ = strconv.Atoi(queryPortRaw)
	}
	if _, err := s.db.Exec(ctx, `
		INSERT INTO control.server_watchlist (user_id, ip, game_port, query_port)
		VALUES ($1, $2, $3, $4)
		ON CONFLICT (user_id, ip, game_port) DO UPDATE SET query_port = EXCLUDED.query_port, updated_at = NOW()
	`, userID, endpoint.ip.String(), endpoint.port, queryPort); err != nil {
		return WatchlistServer{}, fmt.Errorf("save watchlist server: %w", err)
	}

	watchlist, err := s.list(ctx, userID)
	if err != nil {
		return WatchlistServer{}, err
	}
	for _, server := range watchlist {
		if server.Address != net.JoinHostPort(endpoint.ip.String(), strconv.Itoa(endpoint.port)) {
			continue
		}
		if snapshot.Address != "" {
			server, err = s.persistSnapshot(ctx, userID, server.ID, snapshot)
			if err != nil {
				return WatchlistServer{}, err
			}
		} else {
			server, err = s.persistFailure(ctx, userID, server.ID, checkErr)
			if err != nil {
				return WatchlistServer{}, err
			}
		}
		s.publish(userID, server)
		return server, nil
	}
	return WatchlistServer{}, errors.New("saved server could not be loaded")
}

func (s *Service) pruneRecentChecks(now time.Time) {
	for key, cached := range s.recentChecks {
		if !cached.expiresAt.After(now) {
			delete(s.recentChecks, key)
		}
	}
}

func (s *Service) List(ctx context.Context, userID int64) ([]WatchlistServer, error) {
	return s.list(ctx, userID)
}

func (s *Service) Find(ctx context.Context, userID, id int64) (WatchlistServer, error) {
	return s.find(ctx, userID, id)
}

func (s *Service) History(ctx context.Context, userID, id int64) ([]HistoryPoint, error) {
	var exists bool
	if err := s.db.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM control.server_watchlist WHERE id = $1 AND user_id = $2)`, id, userID).Scan(&exists); err != nil {
		return nil, fmt.Errorf("find server history owner: %w", err)
	}
	if !exists {
		return nil, pgx.ErrNoRows
	}
	rows, err := s.db.Query(ctx, `
		SELECT status, server_name, map_name, players, max_players, latency_ms, last_error, checked_at
		FROM control.server_watchlist_history WHERE watchlist_id = $1
		ORDER BY checked_at DESC LIMIT 200
	`, id)
	if err != nil {
		return nil, fmt.Errorf("list server history: %w", err)
	}
	defer rows.Close()
	history := make([]HistoryPoint, 0)
	for rows.Next() {
		var point HistoryPoint
		if err := rows.Scan(&point.Status, &point.Name, &point.Map, &point.Players, &point.MaxPlayers,
			&point.LatencyMS, &point.Error, &point.CheckedAt); err != nil {
			return nil, fmt.Errorf("scan server history: %w", err)
		}
		history = append(history, point)
	}
	return history, rows.Err()
}

func (s *Service) ListNotifications(ctx context.Context, userID int64) ([]Notification, error) {
	rows, err := s.db.Query(ctx, `
		SELECT id, type, title, body, href, read_at, created_at
		FROM control.notifications WHERE user_id = $1
		ORDER BY created_at DESC LIMIT 50
	`, userID)
	if err != nil {
		return nil, fmt.Errorf("list notifications: %w", err)
	}
	defer rows.Close()
	notifications := make([]Notification, 0)
	for rows.Next() {
		var notification Notification
		if err := rows.Scan(&notification.ID, &notification.Type, &notification.Title, &notification.Body,
			&notification.Href, &notification.ReadAt, &notification.CreatedAt); err != nil {
			return nil, fmt.Errorf("scan notification: %w", err)
		}
		notifications = append(notifications, notification)
	}
	return notifications, rows.Err()
}

func (s *Service) MarkNotificationsRead(ctx context.Context, userID int64) error {
	if _, err := s.db.Exec(ctx, `UPDATE control.notifications SET read_at = NOW() WHERE user_id = $1 AND read_at IS NULL`, userID); err != nil {
		return fmt.Errorf("mark notifications read: %w", err)
	}
	return nil
}

func (s *Service) Remove(ctx context.Context, userID, id int64) error {
	command, err := s.db.Exec(ctx, `DELETE FROM control.server_watchlist WHERE id = $1 AND user_id = $2`, id, userID)
	if err != nil {
		return fmt.Errorf("remove watchlist server: %w", err)
	}
	if command.RowsAffected() == 0 {
		return pgx.ErrNoRows
	}
	s.publish(userID, WatchlistServer{ID: id, Status: "removed"})
	return nil
}

func (s *Service) Refresh(ctx context.Context, userID, id int64) (WatchlistServer, error) {
	server, err := s.find(ctx, userID, id)
	if err != nil {
		return WatchlistServer{}, err
	}
	return s.refreshServer(ctx, userID, server)
}

func (s *Service) RefreshAll(ctx context.Context) error {
	rows, err := s.db.Query(ctx, `
		SELECT id, user_id, host(ip), game_port, query_port, status, last_error, server_name, map_name,
			players, max_players, bots, version, tags, vac_secured, password_protected, protocol, game_folder, game_name, server_kind, environment, server_steam_id, map_seed, map_size, map_url, latency_ms,
			last_checked_at, created_at
		FROM control.server_watchlist
		ORDER BY updated_at ASC
		LIMIT $1
	`, maxRefreshRows)
	if err != nil {
		return fmt.Errorf("list watchlist refreshes: %w", err)
	}
	defer rows.Close()
	for rows.Next() {
		server, userID, err := scanWatchlistServerWithUser(rows)
		if err != nil {
			return err
		}
		if _, err := s.refreshServer(ctx, userID, server); err != nil && !errors.Is(err, pgx.ErrNoRows) {
			continue
		}
	}
	return rows.Err()
}

func (s *Service) refreshServer(ctx context.Context, userID int64, server WatchlistServer) (WatchlistServer, error) {
	snapshot, err := s.Check(ctx, server.QueryAddress)
	if err != nil {
		updated, persistErr := s.persistFailure(ctx, userID, server.ID, err)
		if persistErr != nil {
			return WatchlistServer{}, persistErr
		}
		if err := s.notifyStatusChange(ctx, userID, server, updated); err != nil {
			return WatchlistServer{}, err
		}
		s.publish(userID, updated)
		return updated, nil
	}
	updated, err := s.persistSnapshot(ctx, userID, server.ID, snapshot)
	if err != nil {
		return WatchlistServer{}, err
	}
	if err := s.notifyStatusChange(ctx, userID, server, updated); err != nil {
		return WatchlistServer{}, err
	}
	s.publish(userID, updated)
	return updated, nil
}

func (s *Service) list(ctx context.Context, userID int64) ([]WatchlistServer, error) {
	rows, err := s.db.Query(ctx, `
		SELECT id, host(ip), game_port, query_port, status, last_error, server_name, map_name,
			players, max_players, bots, version, tags, vac_secured, password_protected, protocol, game_folder, game_name, server_kind, environment, server_steam_id, map_seed, map_size, map_url, latency_ms,
			last_checked_at, created_at
		FROM control.server_watchlist
		WHERE user_id = $1
		ORDER BY created_at DESC
	`, userID)
	if err != nil {
		return nil, fmt.Errorf("list watchlist: %w", err)
	}
	defer rows.Close()
	servers := make([]WatchlistServer, 0)
	for rows.Next() {
		server, err := scanWatchlistServer(rows)
		if err != nil {
			return nil, err
		}
		servers = append(servers, server)
	}
	return servers, rows.Err()
}

func (s *Service) find(ctx context.Context, userID, id int64) (WatchlistServer, error) {
	row := s.db.QueryRow(ctx, `
		SELECT id, host(ip), game_port, query_port, status, last_error, server_name, map_name,
			players, max_players, bots, version, tags, vac_secured, password_protected, protocol, game_folder, game_name, server_kind, environment, server_steam_id, map_seed, map_size, map_url, latency_ms,
			last_checked_at, created_at
		FROM control.server_watchlist WHERE id = $1 AND user_id = $2
	`, id, userID)
	return scanWatchlistServer(row)
}

func (s *Service) persistSnapshot(ctx context.Context, userID, id int64, snapshot Snapshot) (WatchlistServer, error) {
	row := s.db.QueryRow(ctx, `
		UPDATE control.server_watchlist SET
			query_port = $3, status = 'online', last_error = '', server_name = $4, map_name = $5,
			players = $6, max_players = $7, bots = $8, version = $9, tags = $10, vac_secured = $11,
			password_protected = $12, protocol = $13, game_folder = $14, game_name = $15, server_kind = $16,
			environment = $17, server_steam_id = $18, map_seed = $19, map_size = $20, map_url = $21, latency_ms = $22, last_checked_at = $23, updated_at = NOW()
		WHERE id = $1 AND user_id = $2
		RETURNING id, host(ip), game_port, query_port, status, last_error, server_name, map_name,
			players, max_players, bots, version, tags, vac_secured, password_protected, protocol, game_folder, game_name, server_kind, environment, server_steam_id, map_seed, map_size, map_url, latency_ms,
			last_checked_at, created_at
	`, id, userID, portFromAddress(snapshot.QueryAddress), snapshot.Name, snapshot.Map, snapshot.Players,
		snapshot.MaxPlayers, snapshot.Bots, snapshot.Version, snapshot.Tags, snapshot.VACSecured,
		snapshot.PasswordProtected, snapshot.Protocol, snapshot.GameFolder, snapshot.GameName, snapshot.ServerKind,
		snapshot.Environment, snapshot.ServerSteamID, snapshot.MapSeed, snapshot.MapSize, snapshot.MapURL, snapshot.LatencyMS, snapshot.CheckedAt)
	server, err := scanWatchlistServer(row)
	if err != nil {
		return WatchlistServer{}, err
	}
	if err := s.appendHistory(ctx, server); err != nil {
		return WatchlistServer{}, err
	}
	return server, nil
}

func (s *Service) appendHistory(ctx context.Context, server WatchlistServer) error {
	checkedAt := time.Now().UTC()
	if server.CheckedAt != nil {
		checkedAt = *server.CheckedAt
	}
	if _, err := s.db.Exec(ctx, `
		INSERT INTO control.server_watchlist_history (
			watchlist_id, status, server_name, map_name, players, max_players, latency_ms, last_error, checked_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
	`, server.ID, server.Status, server.Name, server.Map, server.Players, server.MaxPlayers, server.LatencyMS, server.Error, checkedAt); err != nil {
		return fmt.Errorf("save server history: %w", err)
	}
	if _, err := s.db.Exec(ctx, `
		DELETE FROM control.server_watchlist_history WHERE id IN (
			SELECT id FROM control.server_watchlist_history WHERE watchlist_id = $1
			ORDER BY checked_at DESC OFFSET 10080
		)
	`, server.ID); err != nil {
		return fmt.Errorf("trim server history: %w", err)
	}
	return nil
}

func (s *Service) persistFailure(ctx context.Context, userID, id int64, checkErr error) (WatchlistServer, error) {
	row := s.db.QueryRow(ctx, `
		UPDATE control.server_watchlist SET
			status = $3, last_error = $4, server_name = '', map_name = '', players = NULL,
			max_players = NULL, bots = NULL, version = '', tags = '{}', vac_secured = NULL,
			password_protected = NULL, protocol = NULL, game_folder = '', game_name = '', server_kind = '',
			environment = '', server_steam_id = '', map_seed = NULL, map_size = NULL, map_url = '', latency_ms = NULL, last_checked_at = NOW(), updated_at = NOW()
		WHERE id = $1 AND user_id = $2
		RETURNING id, host(ip), game_port, query_port, status, last_error, server_name, map_name,
			players, max_players, bots, version, tags, vac_secured, password_protected, protocol, game_folder, game_name, server_kind, environment, server_steam_id, map_seed, map_size, map_url, latency_ms,
			last_checked_at, created_at
	`, id, userID, failureStatus(checkErr), clientError(checkErr))
	server, err := scanWatchlistServer(row)
	if err != nil {
		return WatchlistServer{}, err
	}
	if err := s.appendHistory(ctx, server); err != nil {
		return WatchlistServer{}, err
	}
	return server, nil
}

func (s *Service) publish(userID int64, server WatchlistServer) {
	if s.hub == nil {
		return
	}
	s.hub.PublishToUser(userID, realtime.Event{
		Type:      "server.watchlist.updated",
		Timestamp: time.Now().UTC(),
		Payload:   map[string]any{"server": server},
	})
}

func (s *Service) notifyStatusChange(ctx context.Context, userID int64, previous, updated WatchlistServer) error {
	if previous.Status == "" || previous.Status == "unknown" || previous.Status == updated.Status {
		return nil
	}
	name := updated.Name
	if name == "" {
		name = previous.Name
	}
	if name == "" {
		name = updated.Address
	}
	title, body := serverStatusNotification(name, updated.Status)
	var notification Notification
	err := s.db.QueryRow(ctx, `
		INSERT INTO control.notifications (user_id, type, title, body, href)
		VALUES ($1, 'server.status', $2, $3, $4)
		RETURNING id, type, title, body, href, read_at, created_at
	`, userID, title, body, fmt.Sprintf("/servers/%d", updated.ID)).Scan(
		&notification.ID, &notification.Type, &notification.Title, &notification.Body,
		&notification.Href, &notification.ReadAt, &notification.CreatedAt,
	)
	if err != nil {
		return fmt.Errorf("create server status notification: %w", err)
	}
	if _, err := s.db.Exec(ctx, `
		DELETE FROM control.notifications WHERE id IN (
			SELECT id FROM control.notifications WHERE user_id = $1
			ORDER BY created_at DESC OFFSET 100
		)
	`, userID); err != nil {
		return fmt.Errorf("trim notifications: %w", err)
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
	return nil
}

func serverStatusNotification(name, status string) (string, string) {
	switch status {
	case "online":
		return name + " is online", "The server answered its public Rust status query."
	case "blocked":
		return name + " blocks public status", "It may still be online in Rust, but its public query did not return server data."
	default:
		return name + " is unavailable", "The server did not answer its public Rust status query."
	}
}

type endpoint struct {
	ip   netip.Addr
	port int
}

func parseEndpoint(ctx context.Context, raw string) (endpoint, error) {
	host, rawPort, err := net.SplitHostPort(strings.TrimSpace(raw))
	if err != nil {
		return endpoint{}, ErrInvalidAddress
	}
	port, err := strconv.Atoi(rawPort)
	if err != nil || port < 1 || port > 65535 {
		return endpoint{}, ErrInvalidAddress
	}
	ip, err := resolvePublicIPv4(ctx, host)
	if err != nil {
		return endpoint{}, ErrInvalidAddress
	}
	return endpoint{ip: ip, port: port}, nil
}

func resolvePublicIPv4(ctx context.Context, host string) (netip.Addr, error) {
	host = strings.TrimSuffix(strings.TrimSpace(host), ".")
	if ip, err := netip.ParseAddr(host); err == nil {
		if !ip.Is4() || !isPublicIPv4(ip) {
			return netip.Addr{}, ErrInvalidAddress
		}
		return ip, nil
	}
	if host == "" || len(host) > 253 || strings.Contains(host, " ") {
		return netip.Addr{}, ErrInvalidAddress
	}
	addresses, err := net.DefaultResolver.LookupNetIP(ctx, "ip4", host)
	if err != nil {
		return netip.Addr{}, err
	}
	for _, address := range addresses {
		if address.Is4() && isPublicIPv4(address) {
			return address, nil
		}
	}
	return netip.Addr{}, ErrInvalidAddress
}

func isPublicIPv4(ip netip.Addr) bool {
	return ip.Is4() && ip.IsGlobalUnicast() && !ip.IsPrivate() && !ip.IsLoopback() && !ip.IsLinkLocalUnicast() && !ip.IsMulticast() && !ip.IsUnspecified()
}

func probePorts(port int) []int {
	ports := make([]int, 0, 3)
	seen := make(map[int]struct{}, 3)
	for _, offset := range []int{0, 1, 5} {
		candidate := port + offset
		if candidate < 1 || candidate > 65535 {
			continue
		}
		if _, exists := seen[candidate]; exists {
			continue
		}
		seen[candidate] = struct{}{}
		ports = append(ports, candidate)
	}
	return ports
}

type infoResponse struct {
	Name, Map, Folder, Game, Version string
	Players, MaxPlayers, Bots        int
	VACSecured, PasswordProtected    bool
	Protocol                         int
	ServerKind, Environment          string
	AdvertisedPort                   int
	GameID                           uint64
	ServerSteamID                    uint64
	Tags                             []string
	LatencyMS                        int
	MapSeed                          *int
	MapSize                          *int
	MapURL                           string
}

func queryInfo(ctx context.Context, ip netip.Addr, port int) (infoResponse, error) {
	conn, err := net.DialUDP("udp4", nil, &net.UDPAddr{IP: net.IP(ip.AsSlice()), Port: port})
	if err != nil {
		return infoResponse{}, fmt.Errorf("open server query: %w", err)
	}
	defer conn.Close()

	deadline := time.Now().Add(queryTimeout)
	if limit, ok := ctx.Deadline(); ok && limit.Before(deadline) {
		deadline = limit
	}
	if err := conn.SetDeadline(deadline); err != nil {
		return infoResponse{}, fmt.Errorf("set server query deadline: %w", err)
	}
	started := time.Now()
	request := append([]byte{0xff, 0xff, 0xff, 0xff, 0x54}, []byte("Source Engine Query\x00")...)
	if _, err := conn.Write(request); err != nil {
		return infoResponse{}, fmt.Errorf("send server query: %w", err)
	}
	packet, err := readPacket(conn)
	if err != nil {
		return infoResponse{}, queryError(err)
	}
	if len(packet) >= 9 && packet[4] == 0x41 {
		request = append(request, packet[5:9]...)
		if _, err := conn.Write(request); err != nil {
			return infoResponse{}, fmt.Errorf("send server challenge: %w", err)
		}
		packet, err = readPacket(conn)
		if err != nil {
			return infoResponse{}, queryError(err)
		}
	}
	info, err := parseInfoPacket(packet)
	if err != nil {
		return infoResponse{}, err
	}
	if info.GameID != rustAppID && !strings.EqualFold(info.Folder, "rust") && !strings.EqualFold(info.Game, "rust") {
		return infoResponse{}, ErrNotRustServer
	}
	if rules, rulesErr := queryRules(ctx, ip, port); rulesErr == nil {
		info.MapSeed, info.MapSize, info.MapURL = mapMetadata(rules)
	}
	info.LatencyMS = max(1, int(time.Since(started).Milliseconds()))
	return info, nil
}

func queryRules(ctx context.Context, ip netip.Addr, port int) (map[string]string, error) {
	conn, err := net.DialUDP("udp4", nil, &net.UDPAddr{IP: net.IP(ip.AsSlice()), Port: port})
	if err != nil {
		return nil, err
	}
	defer conn.Close()

	deadline := time.Now().Add(900 * time.Millisecond)
	if limit, ok := ctx.Deadline(); ok && limit.Before(deadline) {
		deadline = limit
	}
	if err := conn.SetDeadline(deadline); err != nil {
		return nil, err
	}
	request := []byte{0xff, 0xff, 0xff, 0xff, 0x56, 0xff, 0xff, 0xff, 0xff}
	if _, err := conn.Write(request); err != nil {
		return nil, err
	}
	packet, err := readPacket(conn)
	if err != nil {
		return nil, err
	}
	if len(packet) >= 9 && packet[4] == 0x41 {
		request = append(request[:5], packet[5:9]...)
		if _, err := conn.Write(request); err != nil {
			return nil, err
		}
		packet, err = readPacket(conn)
		if err != nil {
			return nil, err
		}
	}
	if len(packet) < 7 || packet[4] != 0x45 {
		return nil, errors.New("server did not return rules")
	}
	reader := packetReader{data: packet[5:]}
	count, err := reader.uint16()
	if err != nil {
		return nil, err
	}
	if count > 1024 {
		return nil, errors.New("too many server rules")
	}
	rules := make(map[string]string, count)
	for range count {
		key, err := reader.string()
		if err != nil {
			return nil, err
		}
		value, err := reader.string()
		if err != nil {
			return nil, err
		}
		rules[strings.ToLower(strings.TrimSpace(key))] = strings.TrimSpace(value)
	}
	return rules, nil
}

func mapMetadata(rules map[string]string) (*int, *int, string) {
	readNumber := func(keys ...string) *int {
		for _, key := range keys {
			value, err := strconv.Atoi(rules[key])
			if err == nil && value > 0 {
				return &value
			}
		}
		return nil
	}
	var mapURL string
	for _, key := range []string{"server.levelurl", "levelurl", "map.url", "map_url"} {
		value := strings.TrimSpace(rules[key])
		if strings.HasPrefix(value, "https://") || strings.HasPrefix(value, "http://") {
			mapURL = value
			break
		}
	}
	return readNumber("world.seed", "server.seed", "seed"), readNumber("world.size", "server.worldsize", "worldsize"), mapURL
}

func readPacket(conn *net.UDPConn) ([]byte, error) {
	buffer := make([]byte, 8192)
	n, err := conn.Read(buffer)
	if err != nil {
		return nil, err
	}
	packet := buffer[:n]
	if len(packet) == 1 && packet[0] == 0 {
		return nil, ErrPublicQueryBlocked
	}
	if len(packet) < 5 || binary.LittleEndian.Uint32(packet[:4]) != 0xffffffff {
		return nil, errors.New("unsupported server response")
	}
	return packet, nil
}

func parseInfoPacket(packet []byte) (infoResponse, error) {
	if len(packet) < 6 || packet[4] != 0x49 {
		return infoResponse{}, errors.New("server did not return status information")
	}
	reader := packetReader{data: packet[5:]}
	protocol, err := reader.byte()
	if err != nil {
		return infoResponse{}, err
	}
	name, err := reader.string()
	if err != nil {
		return infoResponse{}, err
	}
	mapName, err := reader.string()
	if err != nil {
		return infoResponse{}, err
	}
	folder, err := reader.string()
	if err != nil {
		return infoResponse{}, err
	}
	game, err := reader.string()
	if err != nil {
		return infoResponse{}, err
	}
	if _, err := reader.uint16(); err != nil {
		return infoResponse{}, err
	}
	players, err := reader.byte()
	if err != nil {
		return infoResponse{}, err
	}
	maxPlayers, err := reader.byte()
	if err != nil {
		return infoResponse{}, err
	}
	bots, err := reader.byte()
	if err != nil {
		return infoResponse{}, err
	}
	serverType, err := reader.byte()
	if err != nil {
		return infoResponse{}, err
	}
	environment, err := reader.byte()
	if err != nil {
		return infoResponse{}, err
	}
	password, err := reader.byte()
	if err != nil {
		return infoResponse{}, err
	}
	vac, err := reader.byte()
	if err != nil {
		return infoResponse{}, err
	}
	version, err := reader.string()
	if err != nil {
		return infoResponse{}, err
	}
	info := infoResponse{Name: name, Map: mapName, Folder: folder, Game: game, Version: version, Players: int(players), MaxPlayers: int(maxPlayers), Bots: int(bots), PasswordProtected: password != 0, VACSecured: vac != 0, Protocol: int(protocol), ServerKind: serverKindLabel(serverType), Environment: environmentLabel(environment)}
	if reader.remaining() == 0 {
		return info, nil
	}
	edf, err := reader.byte()
	if err != nil {
		return infoResponse{}, err
	}
	if edf&0x80 != 0 {
		port, err := reader.uint16()
		if err != nil {
			return infoResponse{}, err
		}
		info.AdvertisedPort = int(port)
	}
	if edf&0x10 != 0 {
		steamID, err := reader.uint64()
		if err != nil {
			return infoResponse{}, err
		}
		info.ServerSteamID = steamID
	}
	if edf&0x40 != 0 {
		if _, err := reader.uint16(); err != nil {
			return infoResponse{}, err
		}
		if _, err := reader.string(); err != nil {
			return infoResponse{}, err
		}
	}
	if edf&0x20 != 0 {
		keywords, err := reader.string()
		if err != nil {
			return infoResponse{}, err
		}
		info.Tags = splitTags(keywords)
	}
	if edf&0x01 != 0 {
		gameID, err := reader.uint64()
		if err != nil {
			return infoResponse{}, err
		}
		info.GameID = gameID
	}
	return info, nil
}

type packetReader struct {
	data   []byte
	offset int
}

func (r *packetReader) remaining() int { return len(r.data) - r.offset }
func (r *packetReader) byte() (byte, error) {
	if r.remaining() < 1 {
		return 0, errors.New("truncated server response")
	}
	value := r.data[r.offset]
	r.offset++
	return value, nil
}
func (r *packetReader) uint16() (uint16, error) {
	if r.remaining() < 2 {
		return 0, errors.New("truncated server response")
	}
	value := binary.LittleEndian.Uint16(r.data[r.offset:])
	r.offset += 2
	return value, nil
}
func (r *packetReader) uint64() (uint64, error) {
	if r.remaining() < 8 {
		return 0, errors.New("truncated server response")
	}
	value := binary.LittleEndian.Uint64(r.data[r.offset:])
	r.offset += 8
	return value, nil
}
func (r *packetReader) string() (string, error) {
	end := r.offset
	for end < len(r.data) && r.data[end] != 0 {
		end++
	}
	if end == len(r.data) {
		return "", errors.New("truncated server response")
	}
	value := string(r.data[r.offset:end])
	r.offset = end + 1
	return value, nil
}

func splitTags(raw string) []string {
	parts := strings.Split(raw, ",")
	tags := make([]string, 0, len(parts))
	for _, part := range parts {
		if tag := strings.TrimSpace(part); tag != "" {
			tags = append(tags, tag)
		}
	}
	return tags
}

func steamIDString(value uint64) string {
	if value == 0 {
		return ""
	}
	return strconv.FormatUint(value, 10)
}

func queryError(err error) error {
	if errors.Is(err, ErrPublicQueryBlocked) {
		return ErrPublicQueryBlocked
	}
	if errors.Is(err, net.ErrClosed) || errors.Is(err, context.DeadlineExceeded) {
		return errors.New("server did not answer in time")
	}
	var netErr net.Error
	if errors.As(err, &netErr) && netErr.Timeout() {
		return errors.New("server did not answer in time")
	}
	return errors.New("server did not answer")
}

func serverKindLabel(value byte) string {
	switch value {
	case 'd':
		return "dedicated"
	case 'l':
		return "listen"
	case 'p':
		return "proxy"
	default:
		return "unknown"
	}
}

func environmentLabel(value byte) string {
	switch value {
	case 'l':
		return "linux"
	case 'w':
		return "windows"
	case 'm', 'o':
		return "macos"
	default:
		return "unknown"
	}
}

func clientError(err error) string {
	switch {
	case errors.Is(err, ErrPublicQueryBlocked):
		return "This server blocks public status queries."
	case errors.Is(err, ErrNotRustServer):
		return "The endpoint is not a Rust server."
	case errors.Is(err, ErrInvalidAddress):
		return "The saved address is not a public IPv4 endpoint."
	default:
		return "No response from the server."
	}
}

func failureStatus(err error) string {
	if errors.Is(err, ErrPublicQueryBlocked) {
		return "blocked"
	}
	return "offline"
}

func portFromAddress(address string) int {
	_, rawPort, err := net.SplitHostPort(address)
	if err != nil {
		return 0
	}
	port, _ := strconv.Atoi(rawPort)
	return port
}

type rowScanner interface{ Scan(...any) error }

func scanWatchlistServer(row rowScanner) (WatchlistServer, error) {
	var server WatchlistServer
	var ip string
	var gamePort, queryPort int
	err := row.Scan(&server.ID, &ip, &gamePort, &queryPort, &server.Status, &server.Error, &server.Name, &server.Map, &server.Players, &server.MaxPlayers, &server.Bots, &server.Version, &server.Tags, &server.VACSecured, &server.PasswordProtected, &server.Protocol, &server.GameFolder, &server.GameName, &server.ServerKind, &server.Environment, &server.ServerSteamID, &server.MapSeed, &server.MapSize, &server.MapURL, &server.LatencyMS, &server.CheckedAt, &server.CreatedAt)
	if err != nil {
		return WatchlistServer{}, err
	}
	server.Address = net.JoinHostPort(ip, strconv.Itoa(gamePort))
	server.QueryAddress = net.JoinHostPort(ip, strconv.Itoa(queryPort))
	return server, nil
}

func scanWatchlistServerWithUser(row rowScanner) (WatchlistServer, int64, error) {
	var server WatchlistServer
	var userID int64
	var ip string
	var gamePort, queryPort int
	err := row.Scan(&server.ID, &userID, &ip, &gamePort, &queryPort, &server.Status, &server.Error, &server.Name, &server.Map, &server.Players, &server.MaxPlayers, &server.Bots, &server.Version, &server.Tags, &server.VACSecured, &server.PasswordProtected, &server.Protocol, &server.GameFolder, &server.GameName, &server.ServerKind, &server.Environment, &server.ServerSteamID, &server.MapSeed, &server.MapSize, &server.MapURL, &server.LatencyMS, &server.CheckedAt, &server.CreatedAt)
	if err != nil {
		return WatchlistServer{}, 0, err
	}
	server.Address = net.JoinHostPort(ip, strconv.Itoa(gamePort))
	server.QueryAddress = net.JoinHostPort(ip, strconv.Itoa(queryPort))
	return server, userID, nil
}
