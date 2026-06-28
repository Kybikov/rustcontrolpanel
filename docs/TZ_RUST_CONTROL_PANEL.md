# ТЗ: Rust Control Panel

Дата фиксации: 2026-06-28  
Фронтенд: `C:\Users\whoam\WebstormProjects\RustControlPanel`  
Бекенд: `C:\Users\whoam\GolandProjects\wtback`

## 1. Цель

Сделать админ-панель для Rust, которая собирает максимум полезной информации по серверам, игрокам, вайпам, картам и активности, объединяет внешние источники с данными собственных серверов и помогает быстро отвечать на вопросы:

- кто игрок, где играет, когда активен;
- какие серверы важны, когда у них вайпы, какой онлайн и тренд;
- какие игроки вероятно играют в одной команде;
- что происходило на сервере за выбранный период;
- где карта, seed, monuments, wipe schedule, server status;
- какие алерты требуют реакции админа.

Панель должна показывать источник каждого факта: BattleMetrics, Steam, RustMaps, RCON, серверный плагин, ручная заметка, расчетная модель.

## 2. Режимы работы

### 2.1 Public Intel Mode

Работает по публичным и ключевым API без контроля над сервером.

Возможности:

- поиск Rust-серверов;
- карточка сервера: online, max players, rank, status, страна, IP/порт, query port, описание, тип, карта, seed/size если доступны;
- история онлайна и снапшоты;
- календарь вайпов из BattleMetrics `rust_wipes`, `rust_next_wipe`, `rust_last_wipe`;
- поиск игрока по SteamID/vanity/name;
- Steam-профиль, аватар, profile URL, visibility, bans;
- публичная история серверов/сессий, если доступна через BattleMetrics;
- вероятные команды на основе совпадений активности и серверов;
- RustMaps-ссылка/карта по hash/seed/size, если ее можно связать.

Ограничение: публичные API не дают настоящие live-координаты игроков, приватные Steam-друзья, IP, инвентарь, командный состав внутри сервера и события боя.

### 2.2 Managed Server Mode

Работает для наших/подключенных серверов через RCON, Rust+ или серверный плагин Oxide/Carbon.

Возможности:

- live player list;
- live map с позициями игроков, если это отдает наш плагин;
- чат, команды, подключения/отключения;
- death/kill/raid/activity events, если плагин это отправляет;
- team/clan/group data, если плагин имеет доступ;
- админ-действия: say, kick, ban, mute, note, flag, teleport-like actions только если безопасно и разрешено;
- webhook/event ingest из плагина в бекенд.

Ограничение: любые RCON/плагин-действия должны быть behind permission + audit log.

## 3. Источники данных

### 3.1 BattleMetrics

Используем для серверов, онлайна, rank/status, публичных Rust details и wipe schedule.

Проверено 2026-06-28: публичный запрос `https://api.battlemetrics.com/servers?filter[game]=rust&page[size]=1` возвращает Rust-серверы и поля:

- `attributes.players`, `maxPlayers`, `rank`, `status`;
- `attributes.details.rust_world_seed`;
- `attributes.details.rust_world_size`;
- `attributes.details.rust_last_wipe`;
- `attributes.details.rust_wipes`;
- `attributes.details.rust_next_wipe`;
- `attributes.details.rust_next_wipe_map`;
- `attributes.details.rust_next_wipe_bp`;
- `attributes.details.rust_headerimage`;
- `attributes.details.rust_description`.

Нужно:

- клиент `internal/infra/battlemetrics`;
- rate limit + retry + cache;
- normalized ingest в таблицы `rustcontrol.*`;
- хранить raw JSON для диагностики.

### 3.2 Steam Web API

Используем только с бекенда, ключ не должен попадать во фронтенд.

Методы:

- `ISteamUser/GetPlayerSummaries/v2` - профиль, ник, аватар, profile URL, visibility;
- `ISteamUser/GetPlayerBans/v1` - VAC/Game/Community/Economy bans;
- `ISteamUser/ResolveVanityURL/v1` - vanity URL -> SteamID;
- опционально `GetFriendList`, но только если список публичный.

Нужно:

- `STEAM_WEB_API_KEY` или настройка в админских интеграциях;
- батчинг до 100 SteamID;
- кэш профилей на 12-24 часа;
- bans обновлять реже, например 6-24 часа.

### 3.3 RustMaps

Используем для карты/seed/size/визуализации, где возможно.

Нужно:

- клиент `internal/infra/rustmaps`;
- хранить `map_id`, `seed`, `size`, `hash`, `image_url`, `page_url`, `monuments`, `biomes/markers` если доступны;
- уметь превращать download-map URL в browser-view URL по hash-сегменту, если приходит такая ссылка;
- для frontend map viewer использовать изображение/тайлы как слой и накладывать markers/events.

### 3.4 RCON / Rust+ / серверный плагин

Для настоящего live-режима нужен controlled server.

Минимальный плагин/агент должен отправлять:

- server heartbeat;
- player connected/disconnected;
- player position snapshots;
- chat messages;
- command usage;
- kill/death events;
- team/clan/group snapshots, если доступно;
- ban/kick/mute events;
- wipe detected event;
- map seed/size/hash.

Приоритет: сначала webhook ingest + read-only live data, затем аккуратно RCON actions.

## 4. Фронтенд

Стек:

- Vite + React + TypeScript;
- Tailwind CSS;
- shadcn/ui;
- lucide-react icons;
- TanStack Query;
- React Router;
- Recharts для графиков;
- Map viewer: Leaflet/OpenSeadragon/MapLibre в зависимости от формата карт;
- dark-first operational UI, без лендинга.

Основной стиль:

- плотная админская панель, не маркетинговая страница;
- левый сайдбар, верхняя строка поиска/command palette;
- таблицы с saved filters;
- карточки только для KPI/detail panels;
- красный/стальной/зеленый акценты Rust-темы, без одноцветной оранжевой заливки.

## 5. Основные экраны

### 5.1 Dashboard

Показывает:

- tracked servers online/max/trend;
- total online по отслеживаемым серверам;
- ближайшие вайпы;
- топ растущих серверов;
- горячие игроки/подозрительные активности;
- последние события;
- health интеграций: BattleMetrics, Steam, RustMaps, RCON/plugin.

### 5.2 Servers

Таблица:

- name, status, online/max, queue, rank;
- country/region;
- map, seed, size;
- next wipe;
- last wipe;
- tags/type: official/modded/pve/rates;
- source freshness;
- tracked/favorite.

Фильтры:

- search;
- country;
- online range;
- wipe today/tomorrow/week;
- official/modded;
- min/max world size;
- tags.

### 5.3 Server Detail

Вкладки:

- Overview: KPI, description, image, source freshness;
- Online History: график players/max/rank;
- Wipes: календарь и история;
- Players: текущие/известные игроки;
- Map: карта, seed, size, monuments, markers;
- Activity: события;
- Settings: BattleMetrics ID, RustMaps link, RCON/plugin config.

### 5.4 Players

Поиск:

- SteamID64;
- vanity URL;
- nickname;
- BattleMetrics player ID;
- known aliases.

Таблица:

- avatar, current name, SteamID;
- last seen;
- current/last server;
- hours/activity score;
- bans summary;
- risk/interest flags;
- probable team count.

### 5.5 Player Detail

Вкладки:

- Profile: Steam profile, avatars, aliases, notes, tags;
- Activity: sessions, first seen, last seen, heatmap by hour/day;
- Servers: где играл, сколько, когда;
- Team Probability: вероятные тиммейты;
- Timeline: joins/leaves/events/admin notes;
- Steam: bans, visibility, public friends if available;
- Actions: note, flag, watch, mute/ban only for managed server mode.

### 5.6 Team Probability

Цель: не утверждать "это команда", а давать score и объяснение.

Факторы:

- одновременные сессии на одном сервере;
- повторяемость совпадений по разным дням/вайпам;
- одинаковые/похожие clan tags в никах;
- публичные Steam friends;
- известная team/clan data из нашего плагина;
- совместные события: raid/base/kill/team chat, если есть plugin data;
- общие сервера и похожий прайм-тайм.

Score:

- 0-30: слабая связь;
- 31-60: возможная связь;
- 61-80: вероятная команда;
- 81-100: сильное подтверждение.

UI обязан показывать reasons:

- `+24 same server sessions overlap 17h`;
- `+18 repeated co-play across 4 days`;
- `+12 matching tag [ABC]`;
- `+40 plugin team snapshot`;
- `-15 no overlap in last 14 days`.

### 5.7 Wipe Calendar

Показывает:

- календарь на день/неделю/месяц;
- map wipe / BP wipe / full wipe;
- local timezone;
- server filters;
- upcoming wipe cards;
- reminders/alerts.

Источники:

- BattleMetrics `rust_wipes`;
- manual override;
- plugin/RCON detected wipe;
- RustMaps map generation timestamp.

### 5.8 Online Map

Public mode:

- map image/tiles;
- monuments/markers если доступны;
- server metadata;
- no live player positions.

Managed server mode:

- live player dots;
- teams/colors;
- event markers: deaths, raids, heli/bradley, cargo, chinook if plugin sends;
- timeline replay by snapshots;
- filters by player/team/event.

### 5.9 Activity Feed

Unified event stream:

- join/leave;
- server online/offline;
- wipe detected;
- player profile changed;
- name alias detected;
- ban detected;
- RCON/admin action;
- plugin event;
- manual note.

Фильтры:

- server;
- player;
- event type;
- severity;
- source;
- time range.

### 5.10 Integrations

Настройки:

- BattleMetrics API token;
- Steam Web API key;
- RustMaps config/API key if needed;
- RCON endpoints;
- plugin webhook secret;
- sync intervals;
- test connection buttons;
- last sync result/errors.

Секреты хранить только на бекенде, шифровать через `APP_SECRET`/существующий crypto-подход.

## 6. Backend architecture в wtback

Новый модуль:

- `internal/api/admin/rustcontrol.go`;
- `internal/domain/rustcontrol`;
- `internal/infra/postgres/rustcontrol_repo.go`;
- `internal/infra/battlemetrics`;
- `internal/infra/steam`;
- `internal/infra/rustmaps`;
- `internal/infra/rustrcon`;
- `migrations/054_rustcontrol_core.sql`.

Маршруты под текущую auth/permission модель:

- `GET /api/admin/rustcontrol/overview`;
- `GET /api/admin/rustcontrol/servers`;
- `POST /api/admin/rustcontrol/servers/track`;
- `GET /api/admin/rustcontrol/servers/:id`;
- `POST /api/admin/rustcontrol/servers/:id/sync`;
- `GET /api/admin/rustcontrol/servers/:id/snapshots`;
- `GET /api/admin/rustcontrol/servers/:id/wipes`;
- `GET /api/admin/rustcontrol/servers/:id/map`;
- `GET /api/admin/rustcontrol/realtime/health`;
- `GET /api/admin/rustcontrol/players`;
- `GET /api/admin/rustcontrol/players/:id`;
- `POST /api/admin/rustcontrol/players/resolve`;
- `POST /api/admin/rustcontrol/live/players/:id/promote`;
- `GET /api/admin/rustcontrol/players/:id/sessions`;
- `GET /api/admin/rustcontrol/players/:id/network`;
- `GET /api/admin/rustcontrol/players/:id/server-history`;
- `GET /api/admin/rustcontrol/players/:id/position-trail`;
- `GET /api/admin/rustcontrol/players/:id/team-probability`;
- `GET /api/admin/rustcontrol/activity`;
- `GET /api/admin/rustcontrol/wipes`;
- `GET /api/admin/rustcontrol/integrations`;
- `POST /api/admin/rustcontrol/integrations/rustplus/test-event`;
- `POST /api/admin/rustcontrol/integrations/rustplus/synthetic-snapshot`;
- `PUT /api/admin/rustcontrol/integrations/:provider`;
- `POST /api/admin/rustcontrol/integrations/:provider/test`;
- `POST /api/admin/rustcontrol/plugin/events`;

Permissions:

- `rust.view`;
- `rust.manage`;
- `rust.integrations`;
- `rust.rcon`;
- `rust.actions`;

Если permission map пока не знает новые routes, добавить их в `permissionForRequest`.

## 7. Database draft

Schema: `rustcontrol`.

Основные таблицы:

- `servers`: tracked servers, BattleMetrics ID, name, address, ports, country, status, source metadata;
- `server_snapshots`: online/max/rank/status/details raw JSON by time;
- `server_wipes`: wipe type, timestamp, source, confidence, raw JSON;
- `maps`: seed, size, rustmaps hash, image/page URL, raw JSON;
- `players`: steam_id, battlemetrics_id, display name, avatar, profile URL, visibility, first_seen, last_seen;
- `player_aliases`: player_id, name, first_seen, last_seen, source;
- `player_sessions`: player_id, server_id, started_at, ended_at, duration, source, confidence;
- `player_bans`: player_id, VAC/game/community/economy fields, source, fetched_at;
- `activity_events`: server_id, player_id, event_type, severity, occurred_at, source, payload;
- `team_edges`: player_a_id, player_b_id, score, reasons JSONB, calculated_at;
- `integration_settings`: provider, config JSONB, secret refs/encrypted secret, enabled;
- `sync_runs`: provider, target_type, status, started_at, finished_at, error.

Индексы:

- `servers(workspace_id, battlemetrics_server_id)`;
- `players(workspace_id, steam_id)`;
- `player_aliases USING gin(name gin_trgm_ops)`;
- `player_sessions(workspace_id, player_id, started_at DESC)`;
- `player_sessions(workspace_id, server_id, started_at DESC)`;
- `activity_events(workspace_id, occurred_at DESC)`;
- `server_wipes(workspace_id, timestamp)`;
- `team_edges(workspace_id, player_a_id, score DESC)`.

## 8. Sync strategy

### 8.1 MVP sync

- Manual sync button for server/search/player.
- Background worker later.
- Cache external responses in DB.
- Never block UI on slow third-party API if cached data exists.

### 8.2 Suggested intervals

- tracked server current status: 1-5 minutes;
- server snapshots: every 5 minutes;
- wipe schedule: every 30-60 minutes;
- Steam profile: every 12-24 hours;
- Steam bans: every 6-24 hours;
- RustMaps map metadata: on server track + after wipe;
- team probability recalculation: after session imports, at most every 15-60 minutes.

## 9. API response rules

Следовать существующему `wtback/pkg/httpres`:

```json
{
  "data": {},
  "meta": {},
  "request_id": "..."
}
```

Все списки должны иметь pagination:

- `page`;
- `per_page`;
- `total`;
- filters in query params.

Каждый объект с внешними данными должен иметь:

- `source`;
- `source_updated_at`;
- `stale`;
- `raw_available` для debug/admin.

## 10. Security

- API keys только на бекенде.
- Secrets шифровать.
- RCON password никогда не отдавать во фронт.
- Все write/RCON/plugin actions писать в audit/activity log.
- Plugin webhook подписывать secret/HMAC.
- Rate limit на plugin ingest и external sync.
- Не показывать IP игроков в UI по умолчанию; если свой сервер присылает IP, хранить хэш/ограничить отдельным permission.
- Team probability показывать как расчетную оценку, не как факт.

## 11. MVP для первой реализации

### Phase 1: Foundation

- Scaffold frontend Vite React TS + shadcn/ui.
- Добавить базовый shell: sidebar, top search, dark theme.
- В `wtback` добавить `rustcontrol` migration + empty routes.
- Добавить integrations settings UI.
- Сделать BattleMetrics client и endpoint server search/list.

Результат: можно искать Rust-серверы, трекать сервер, видеть online/status/wipe fields.

### Phase 2: Servers + Wipes

- Server list/detail.
- Server snapshots.
- Wipe calendar.
- Manual sync.
- RustMaps page/map link.

Результат: рабочий мониторинг серверов и вайпов.

### Phase 3: Players

- Steam resolve/profile/bans.
- Player search/detail.
- Aliases and sessions from available sources.
- Activity timeline.

Результат: можно чекать игрока и видеть профиль/историю.

### Phase 4: Team Probability

- Rule-based scoring.
- Team graph/list.
- Reasons UI.
- Recalculate endpoint.

Результат: панель предлагает вероятных тиммейтов с объяснением score.

### Phase 5: Managed Server Mode

- Plugin webhook ingest.
- Live events.
- Online map with player positions.
- RCON test connection.
- Read-only first, actions later.

Результат: настоящая control panel для своих серверов.

## 12. Что нужно уточнить перед Phase 1

- Это панель только для наших серверов или еще global intelligence по любым Rust-серверам?
- Есть ли BattleMetrics API token или сначала работаем публичными endpoints?
- Есть ли Steam Web API key?
- Есть ли свои Rust-серверы с RCON/plugin доступом?
- Нужна ли мультитенантность через текущие workspaces `wtback` или один workspace достаточно?
- Какие действия разрешаем в MVP: только read-only или сразу ban/kick/note/watch?

## 13. Рекомендованный старт

Начать с Phase 1:

1. поднять frontend scaffold;
2. добавить `rustcontrol` schema и backend routes;
3. подключить BattleMetrics server search;
4. сделать первый экран Servers;
5. зафиксировать API keys/settings экран без раскрытия секретов.

Это даст видимый продукт быстро и не заблокирует нас на RCON/plugin-части, которая зависит от доступа к конкретным серверам.

## 14. Источники

- shadcn/ui: https://ui.shadcn.com/
- shadcn/ui Vite installation: https://ui.shadcn.com/docs/installation/vite
- BattleMetrics API endpoint, проверенный 2026-06-28: https://api.battlemetrics.com/servers?filter%5Bgame%5D=rust&page%5Bsize%5D=1
- Steam ISteamUser Web API: https://partner.steamgames.com/doc/webapi/ISteamUser
- RustMaps: https://rustmaps.com/

## Current implemented slice

- `GET /api/admin/rustcontrol/players/:id/intel` returns one operator-focused player detail payload: local profile, latest live row, current server, realtime teammates, likely teammates, evidence, sessions, and activity.
- `GET /api/admin/rustcontrol/live/players` drives the Live page online map with server filter, player dots from realtime positions, and RustMaps link when available.
- `GET /api/admin/rustcontrol/players?q=...` now returns `live_items` from realtime roster rows in addition to BattleMetrics and local alias matches.
- Player Intelligence now includes Live Search Results with `Promote`, `Intel`, and direct `Watch` actions, so an operator can search current/recent live players before a local profile already exists.
- `GET /api/admin/rustcontrol/players/:id/sessions` now caches BattleMetrics sessions into `rustcontrol.player_sessions` and recalculates `battlemetrics_overlap` team edges for known players with overlapping sessions on the same server.
- Player Intelligence now includes a visible BattleMetrics Session Sync panel with BM id, API/source status, fetched/cached session counts, overlap edge updates, last loaded age, backend message, and a manual `Sync` action.
- Steam/BattleMetrics/plugin/session names are stored as `rustcontrol.player_aliases`; player search now returns local alias matches alongside BattleMetrics results.
- Player Intelligence now includes an Alias History panel with alias source counts, first/last seen timestamps, and relative last-seen age for identity tracking.
- `rustcontrol.player_flags` stores operator watchlist state: watched flag, risk level, reason, note, labels, and audit fields.
- `GET /api/admin/rustcontrol/watchlist` returns flagged players with latest live/current-server context; `PUT /api/admin/rustcontrol/players/:id/watch` updates the flag.
- Player Intelligence includes inline watch controls and the Watchlist page can open the same local player profile for deeper team/session review.
- Watchlist now works as a live triage queue with total/hostile/suspect/online counters, risk/live filters, identity/server/grid/team/note search, quick `Watch`/`Suspect`/`Hostile` actions, and inline editing for reason, note, labels, and risk.
- `GET /api/admin/rustcontrol/servers/:id/live-context` returns a full live server context: server summary, roster, team clusters, watched players, activity, and counts. Team clusters now include `risk_score`, `risk_level`, and hostile/suspect/watch/friendly/watched/online `risk_summary`.
- Live and Servers views now use the server context payload so "my current server" can show roster/team clusters and open any known local player directly in Player Intelligence.
- Team Clusters now render sorted threat cards with team risk score, hostile/suspect/watch/friendly composition, identity, grid, health, last seen, risk, and quick `Watch`, `Suspect`, `Hostile`, `Promote`, or `Intel` actions for every visible teammate.
- Server live roster now includes online/watched/hostile/suspect/positioned counters, search across identity/server/team/clan/grid/source/reason/labels, filters for watched/hostile/suspect/online/clear, top team filters, and inline `Watch`, `Suspect`, `Hostile`, `Promote`, or `Intel` actions from the filtered table.
- Servers view now includes a Server Position Radar for any selected server, with realtime positioned players and inline `Watch`, `Promote`, and `Intel` actions from map rows.
- `POST /api/admin/rustcontrol/live/players/:id/promote` turns a live roster row with SteamID/BattleMetricsID into a local profile and can create the initial watch flag in one click.
- Live and Servers roster rows now expose `Promote`, `Intel`, and direct `Watch` actions, so an operator can flag a live offender without leaving the server context.
- `GET /api/admin/rustcontrol/players/:id/relations` returns a merged relation graph from `team_edges`, realtime live teammates, evidence events, watch flags, live player rows, and current server context.
- Player Intelligence now includes a Relation Graph panel with target player, relation cards, score/source/reason, online/watch badges, latest evidence, and direct Intel jumps for known teammates.
- `GET /api/admin/rustcontrol/players/:id/network` returns an aggregated offender network: current/live teammates, saved team edges, evidence summaries, online/watch state, latest reason, source/type breakdowns, and evidence server ids per node.
- Player Intelligence now includes a Player Network panel so an operator can inspect who the target plays with, how strong the proof is, whether the linked player is online/watched, open known local teammates directly, or use quick `Watch`, `Suspect`, and `Hostile` actions on any linked node. Live-only network nodes can be promoted into local profiles and flagged from the same card. The network panel also renders an evidence matrix with strongest links, top repeated servers, source mix, and evidence type counts across the whole teammate graph.
- `GET /api/admin/rustcontrol/players/:id/server-history` returns current server context, top cached servers, recent sessions, repeated companions from BattleMetrics session overlap, and evidence grouped by server.
- Player Intelligence now includes a Server History panel instead of raw session JSON, with top servers, evidence servers, repeated companions, recent sessions, RustMaps/current-server context, and direct Intel jumps.
- `rustcontrol.player_position_snapshots` stores realtime position samples from plugin/Rust+ ingest when a player has coordinates or grid data.
- `GET /api/admin/rustcontrol/players/:id/position-trail` returns recent movement samples and heat cells for a local player.
- Player Intelligence now includes a Position Trail panel with mini-map dots, latest coordinates, grid history, server context, and heat cells.
- `GET /api/admin/rustcontrol/realtime/health` returns realtime source health: overall status, live/event counts, source freshness, server feed status, watched live counts, and recent feed events.
- Dashboard and Live now include a Realtime Health panel so operators can tell whether a missing player means "not online" or "feed stale/silent".
- `GET /api/admin/rustcontrol/alerts` returns realtime watched-player alerts for online/recent watched players, with same-server-as-me detection, proximity status, and distance-to-me when the connected Steam account and target both have live positions.
- Dashboard, Live, and Watchlist now render active alert cards with severity, risk, proximity/distance, server, grid/team, watch reason, direct Intel jumps, severity/scope filters, critical/warning/same-server/near counters, and quick `Watch`, `Suspect`, and `Hostile` actions from the alert card.
- Live Control now lets the operator connect or replace their Steam account directly from the My Current Server card, then refreshes my live context, live roster, alerts, overview, and server context.
- My Current Server now shows full server facts in Live Control: BattleMetrics id, status, country, online/max, rank, address, query port, map/type, world size/seed, last/next wipe, source/update time, RustMaps link, and BattleMetrics link.
- Detected Team in Live Control now reuses enriched server live rows and supports `Promote`, `Intel`, and quick `Watch`, `Suspect`, `Hostile` actions for each detected teammate.
- Live Online Map now uses server live context when available, centers the radar on the connected Steam account, sorts nearby players by watch/distance, colors me/team/watched/other separately, and opens local Intel directly from radar rows.
- Live Online Map rows/dots now support `Promote`, `Intel`, and quick `Watch`, `Suspect`, `Hostile` actions, so an offender seen on the current server can be flagged from the map without dropping into the roster table.
- Live Online Map now has a Map Hunt toolbar with identity/team/grid/source/risk search, watched/team/150m/400m/same-grid/online/shown counters, and filters for watched/hostile/suspect/team/150m/400m/same-grid/online/clear players on the current server.
- Live Online Map now exposes explicit `My server`/`Top server` auto mode versus `All live`, so connecting Steam and receiving a live row immediately opens the current server context without making the operator think they are viewing all servers.
- `GET /api/admin/rustcontrol/players/:id/intel` now includes `realtime_context` and `nearby_players` for live targets: watched players on the same server, same-grid players, current team members, distance-to-target, and near-150m/near-400m counts.
- `GET /api/admin/rustcontrol/players/:id/intel` now also includes `live_status` freshness with age/source/last-seen fields so the UI can distinguish live, recent, stale, silent, and no-live targets.
- Player Intelligence now includes an Identity Summary panel with local id, Steam/BattleMetrics ids, visibility, first/last seen, created/updated, live source, freshness, and quick links to Steam, BattleMetrics player/server, and RustMaps.
- Player Intelligence now includes a Risk Evidence Digest with current risk, watch reason/note, evidence counts, total/strongest score, top source/type, top likely teammate, realtime pressure counts, and latest proof cards.
- Player Intelligence now includes a Realtime Server Context panel and a 5-second live tracker refresh so an operator opening an offender immediately sees who is around them, who is watched, who shares grid/team, which local profiles can be opened, and how fresh the target position is.
- Realtime Server Context rows now support inline `Watch`, `Promote`, and `Intel` actions for nearby/team/grid players, turning live-only rows into local profiles without leaving the offender detail view.
- Realtime rows across Live Search, Player Intelligence, Live/Servers roster, and server radar now expose quick `Watch`, `Suspect`, and `Hostile` actions so the first risk level can be set without opening the full watch editor.
- `GET /api/admin/rustcontrol/players/:id/timeline` returns a merged chronological player timeline from live snapshot, cached sessions, activity events, and team evidence.
- Player Intelligence now includes an Activity Timeline panel with type counts, type filters, full-text search across server/source/grid/team/related player/title/details, shown counters, source/severity badges, compact payload/session details, server context, related player, score deltas, and timestamps.
- `POST /api/admin/rustcontrol/players/:id/notes` stores manual operator notes in `rustcontrol.activity_events` as `operator_note` events with title, note, labels, severity, and admin source.
- Player Intelligence now includes an Operator Note form; saved notes immediately flow into Activity Timeline and global Activity after refetch.
- Global Activity now acts as a filtered investigation log with total/warning/error/operator-note counters, full-text payload search, severity filters, source chips, event-type chips, relative timestamps, and compact payload summaries.
- `GET /api/admin/rustcontrol/players/:id/dossier` returns aggregate player intelligence: identity/watch/live context, alias/session/server/relation/evidence/activity counts, total playtime, top servers, active hours, and source/type breakdowns.
- Player Intelligence now includes a Player Dossier panel with summary metrics, top servers, active-hours heatbar, activity/evidence type counts, and relation source counts.
- The Oxide/uMod plugin streams `online_snapshot`, `team_snapshot`, connect/disconnect, death/combat relations, and optional chat events into `POST /webhooks/rustcontrol/:workspace_id/events`.
- Integrations now includes a Rust+ / Plugin Intake panel with public/admin webhook endpoints, secret readiness, accepted source names, realtime traffic checks, source health, recent Rust+/plugin events, a `Send Test Event` action, and a `Full Snapshot` action.
- `POST /api/admin/rustcontrol/integrations/rustplus/synthetic-snapshot` creates a full synthetic realtime chain: connected operator if needed, tracked server, live roster, positions, offender watch flag, team evidence, team edges, and a `team_snapshot` activity event, so Live Map, My Current Server, Alerts, Watchlist, Player Intelligence, and Activity can be tested before a real plugin is online.
- Webhook activity events now attach `player_id` for the primary player when the payload identifies one, so player detail can show a clean activity timeline.
