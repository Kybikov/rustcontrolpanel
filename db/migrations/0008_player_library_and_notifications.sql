CREATE TABLE IF NOT EXISTS control.saved_players (
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
);

CREATE INDEX IF NOT EXISTS saved_players_user_updated_idx
  ON control.saved_players (user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS control.notifications (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES control.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  href TEXT NOT NULL DEFAULT '',
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS notifications_user_created_idx
  ON control.notifications (user_id, created_at DESC);
