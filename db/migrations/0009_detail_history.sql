CREATE TABLE IF NOT EXISTS control.server_watchlist_history (
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
);

CREATE INDEX IF NOT EXISTS server_watchlist_history_watchlist_checked_idx
  ON control.server_watchlist_history (watchlist_id, checked_at DESC);

CREATE TABLE IF NOT EXISTS control.player_activity_history (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES control.users(id) ON DELETE CASCADE,
  steam_id TEXT NOT NULL,
  presence TEXT NOT NULL,
  current_game TEXT NOT NULL DEFAULT '',
  captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS player_activity_history_user_steam_captured_idx
  ON control.player_activity_history (user_id, steam_id, captured_at DESC);
