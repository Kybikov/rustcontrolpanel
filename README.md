# Rust Control

Нова версія Rust Control будується в одному репозиторії як production-oriented monorepo:

- `apps/web` — Next.js 16 + React 19 + TypeScript + shadcn/ui;
- `apps/api` — Go API з PostgreSQL, Redis і WebSocket realtime hub;
- `db/migrations` — SQL-схема даних;
- `docker-compose.yml` — локальний повний стек.

Поточний operational shell наслідує структуру [AdminCN Full Navbar Layout](https://shadcn-nextjs-admincn-full-navbar-layout-admin-template.vercel.app/), але вже адаптований під Rust-операції: сервери, гравці, live map, алерти, wipe calendar та activity feed.

## Швидкий старт

```bash
copy .env.example .env
docker compose up --build
```

Після запуску:

- frontend: http://localhost:3000
- API liveness: http://localhost:8080/healthz
- API readiness: http://localhost:8080/readyz
- realtime WebSocket: `ws://localhost:8080/api/v1/realtime/ws`

Для frontend локально:

```bash
cd apps/web
npm install
npm run dev
```

Для API локально потрібні доступні Postgres та Redis:

```bash
cd apps/api
go run ./cmd/api
```

## Перевірки

```bash
npm --workspace apps/web run typecheck
npm --workspace apps/web run lint
npm --workspace apps/web run build
go test ./apps/api/...
docker compose config
```
