ALTER TABLE control.server_watchlist
  ADD COLUMN IF NOT EXISTS map_seed INTEGER,
  ADD COLUMN IF NOT EXISTS map_size INTEGER,
  ADD COLUMN IF NOT EXISTS map_url TEXT NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS control.web_push_subscriptions (
  endpoint TEXT PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES control.users(id) ON DELETE CASCADE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS web_push_subscriptions_user_idx
  ON control.web_push_subscriptions (user_id);
