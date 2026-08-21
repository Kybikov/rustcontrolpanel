CREATE TABLE IF NOT EXISTS control.user_steam_accounts (
  user_id BIGINT PRIMARY KEY REFERENCES control.users(id) ON DELETE CASCADE,
  steam_id TEXT NOT NULL UNIQUE,
  linked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (steam_id ~ '^765[0-9]{14}$')
);

CREATE TABLE IF NOT EXISTS control.steam_openid_states (
  state TEXT PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES control.users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS steam_openid_states_expires_at_idx ON control.steam_openid_states (expires_at);
