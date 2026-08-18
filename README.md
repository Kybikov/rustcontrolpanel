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

- frontend in Docker: http://localhost:3001
- frontend with hot reload: http://localhost:3000 (`npm run dev:web`)
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

## Authentication та доступ

Перший запуск API створює super admin з `SUPERADMIN_EMAIL` і `SUPERADMIN_PASSWORD`. Якщо користувач уже існує, пароль не перезаписується автоматично.

- login: http://localhost:3000/login або Docker web на http://localhost:3001/login;
- керування людьми, ролями та permission matrix: `/team`;
- власний профіль і зміна пароля: `/account`;
- статус і синхронізація BattleMetrics та Steam Web API: `/integrations`;
- сесія зберігається в HttpOnly cookie;
- super admin має повний доступ до всіх поточних і майбутніх функцій.

`INTEGRATIONS_ENCRYPTION_KEY` є обов’язковим ключем для шифрування credentials у PostgreSQL. Підключення спочатку проходить live-check провайдера, і лише після успіху credential зберігається backend-ом.

Provider credentials завантажуються backend-ом із `INTEGRATION_CREDENTIALS_FILE` або Docker secret `RUST_CONTROL_KEYS_FILE`. Вони не вводяться у frontend, не повертаються API та не комітяться у Git. Після заміни файла натисни `Sync from server` на `/integrations` або перезапусти API.

Доступи видаються окремо: `dashboard.view`, `servers.view`, `servers.search`, `players.view`, `players.search`, `integrations.manage`, `users.view`, `users.create`, `users.manage_access`.

## Перевірки

```bash
npm --workspace apps/web run typecheck
npm --workspace apps/web run lint
npm --workspace apps/web run build
go test ./apps/api/...
docker compose config
```
