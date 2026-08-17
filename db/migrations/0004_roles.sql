CREATE TABLE IF NOT EXISTS control.roles (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    description TEXT NOT NULL DEFAULT '',
    is_system BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS control.role_permissions (
    role_id BIGINT NOT NULL REFERENCES control.roles(id) ON DELETE CASCADE,
    permission_key TEXT NOT NULL REFERENCES control.permissions(permission_key) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_key)
);

CREATE TABLE IF NOT EXISTS control.user_roles (
    user_id BIGINT NOT NULL REFERENCES control.users(id) ON DELETE CASCADE,
    role_id BIGINT NOT NULL REFERENCES control.roles(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, role_id)
);
