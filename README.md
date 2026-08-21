# Rust Control

Нова версія Rust Control будується в одному репозиторії як production-oriented monorepo:

- `apps/web` — Next.js 16 + React 19 + TypeScript + shadcn/ui;
- `apps/api` — Go API з PostgreSQL, Redis і WebSocket realtime hub;
- `db/migrations` — SQL-схема даних;
- `docker-compose.yaml` — повний Docker-стек для production: gateway, frontend, API, PostgreSQL та Redis.

Поточний operational shell наслідує структуру [AdminCN Full Navbar Layout](https://shadcn-nextjs-admincn-full-navbar-layout-admin-template.vercel.app/), але вже адаптований під Rust-операції: сервери, гравці, live map, алерти, wipe calendar та activity feed.

## Швидкий старт

```bash
copy .env.example .env
docker compose up --build
```

Після запуску:

- application in Docker: http://localhost:3001
- frontend with hot reload: http://localhost:3000 (`npm run dev:web`)
- API liveness: http://localhost:3001/healthz
- API readiness: http://localhost:3001/readyz
- realtime WebSocket: `ws://localhost:3001/api/v1/realtime/ws`

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
- власний профіль, зміна пароля та прив’язка Steam: `/account`;
- пошук публічних Steam-профілів: `/players`;
- пошук і базова інформація Rust-серверів: `/servers`;
- сесія зберігається в HttpOnly cookie;
- super admin має повний доступ до всіх поточних і майбутніх функцій.

`INTEGRATIONS_ENCRYPTION_KEY` є обов’язковим ключем для шифрування credentials у PostgreSQL. Підключення спочатку проходить live-check провайдера, і лише після успіху credential зберігається backend-ом.

Provider credentials, super-admin password та ключ шифрування передаються одним Docker secret `RUST_CONTROL_CONFIG`. У deployment-панелі створи цю змінну як multiline value за шаблоном [secrets/keys.txt.example](secrets/keys.txt.example). Вона монтується лише в API-контейнер і не потрапляє у Git чи frontend.

Для production Compose також задай `POSTGRES_PASSWORD`. Усі браузерні запити й Steam callback ідуть через `https://rust.wtmelon.store`: gateway спрямовує `/api/v1/*` та WebSocket на внутрішній API-контейнер. Зовнішній API-домен не використовується.

Доступи видаються окремо: `dashboard.view`, `servers.view`, `servers.search`, `players.view`, `players.search`, `integrations.manage`, `users.view`, `users.create`, `users.manage_access`.

## Перевірки

```bash
npm --workspace apps/web run typecheck
npm --workspace apps/web run lint
npm --workspace apps/web run build
go test ./apps/api/...
docker compose config
```
