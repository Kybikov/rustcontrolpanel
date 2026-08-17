CREATE TABLE IF NOT EXISTS control.users (
    id BIGSERIAL PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    is_super_admin BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS control.permissions (
    permission_key TEXT PRIMARY KEY,
    description TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS control.user_permissions (
    user_id BIGINT NOT NULL REFERENCES control.users(id) ON DELETE CASCADE,
    permission_key TEXT NOT NULL REFERENCES control.permissions(permission_key) ON DELETE CASCADE,
    PRIMARY KEY (user_id, permission_key)
);

CREATE TABLE IF NOT EXISTS control.sessions (
    token_hash TEXT PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES control.users(id) ON DELETE CASCADE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON control.sessions (user_id);
CREATE INDEX IF NOT EXISTS sessions_expires_at_idx ON control.sessions (expires_at);
