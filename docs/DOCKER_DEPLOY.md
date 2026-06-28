# Rust Control Panel Docker Deploy

This frontend is a static Vite SPA served by nginx.

## Build

```bash
docker build -t rust-control-panel .
```

## Run

If the backend is on a separate domain:

```bash
docker run -d \
  --name rust-control-panel \
  --restart unless-stopped \
  -p 8088:80 \
  -e API_BASE_URL="https://api.example.com" \
  rust-control-panel
```

If the backend is proxied on the same domain as the panel, `API_BASE_URL` can be omitted. The frontend will default to the current origin.

## Required Backend Notes

- The backend must allow the frontend origin through CORS when frontend and backend use different domains.
- Admin auth still goes through `POST /api/admin/auth/login`.
- RustControl endpoints are expected under `/api/admin/rustcontrol/...`.

## Healthcheck

Container health uses:

```text
GET /healthz
```

Expected response:

```text
ok
```

## Docker Compose

Compose is not required for this frontend alone. Use a single Dockerfile/container when:

- the backend is already deployed separately;
- database/redis are managed elsewhere;
- the server already has nginx/Traefik/Caddy in front.

Use Docker Compose when you want one command to run the whole stack: panel, `wtback`, Postgres, Redis, and reverse proxy.
