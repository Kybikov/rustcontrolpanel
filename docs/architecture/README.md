# Foundation architecture

## Boundaries

The Go API owns domain state, external integrations, authorization, event ingestion and the realtime fan-out layer. Next.js owns the operator experience and talks to the API over HTTP plus WebSocket. PostgreSQL is the source of truth; Redis is the low-latency coordination/cache layer and can be disabled for isolated API tests.

```text
Browser
  ├── HTTP /api/v1/* ────────> Go API ────> PostgreSQL
  └── WebSocket realtime ────> Go Hub ────> Redis (coordination/cache, later)
```

## Realtime contract

WebSocket endpoint: `GET /api/v1/realtime/ws`.

Events use an envelope that is safe to extend without breaking consumers:

```json
{
  "type": "server.player_count.changed",
  "timestamp": "2026-08-17T12:00:00Z",
  "payload": {
    "server_id": "server-123",
    "online": 218
  }
}
```

The foundation hub currently broadcasts a connection event and maintains connection stats. Domain event producers, Redis Streams and topic-level subscriptions are intentionally the next layer so that the first implementation can be tested with a stable transport contract.

## Service checks

- `/healthz` is liveness and does not require dependencies.
- `/readyz` verifies PostgreSQL and Redis availability.
- `/api/v1/health` returns dependency status and realtime connection counts for the operator shell and deployment diagnostics.
