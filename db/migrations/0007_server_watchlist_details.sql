ALTER TABLE control.server_watchlist
  DROP CONSTRAINT IF EXISTS server_watchlist_status_check;

ALTER TABLE control.server_watchlist
  ADD CONSTRAINT server_watchlist_status_check
  CHECK (status IN ('online', 'offline', 'blocked', 'unknown'));

ALTER TABLE control.server_watchlist
  ADD COLUMN IF NOT EXISTS protocol INTEGER,
  ADD COLUMN IF NOT EXISTS game_folder TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS game_name TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS server_kind TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS environment TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS server_steam_id TEXT NOT NULL DEFAULT '';
