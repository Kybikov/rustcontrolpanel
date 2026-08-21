CREATE TABLE IF NOT EXISTS control.server_watchlist (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES control.users(id) ON DELETE CASCADE,
  ip INET NOT NULL,
  game_port INTEGER NOT NULL CHECK (game_port BETWEEN 1 AND 65535),
  query_port INTEGER NOT NULL CHECK (query_port BETWEEN 1 AND 65535),
  status TEXT NOT NULL DEFAULT 'unknown' CHECK (status IN ('online', 'offline', 'unknown')),
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
  latency_ms INTEGER,
  last_checked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, ip, game_port)
);

CREATE INDEX IF NOT EXISTS server_watchlist_user_updated_idx
  ON control.server_watchlist (user_id, updated_at DESC);
