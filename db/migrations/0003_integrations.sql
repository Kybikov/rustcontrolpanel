CREATE TABLE IF NOT EXISTS control.integrations (
    provider TEXT PRIMARY KEY,
    credentials BYTEA NOT NULL,
    connected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_checked_at TIMESTAMPTZ,
    last_error TEXT NOT NULL DEFAULT ''
);
