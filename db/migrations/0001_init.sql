CREATE SCHEMA IF NOT EXISTS control;

CREATE TABLE IF NOT EXISTS control.system_events (
    id BIGSERIAL PRIMARY KEY,
    event_type TEXT NOT NULL,
    aggregate_type TEXT,
    aggregate_id TEXT,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS system_events_created_at_idx
    ON control.system_events (created_at DESC);

CREATE INDEX IF NOT EXISTS system_events_type_idx
    ON control.system_events (event_type, created_at DESC);
