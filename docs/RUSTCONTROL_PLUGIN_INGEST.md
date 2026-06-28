# RustControl realtime ingest

Endpoint:

```text
POST /webhooks/rustcontrol/:workspace_id/events
```

Auth:

```text
X-RustControl-Signature: sha256=<hex_hmac_sha256_of_raw_body>
```

The HMAC key is `RUSTPLUS_WEBHOOK_SECRET`. For quick local tests only, the backend also accepts:

```text
X-RustControl-Secret: <RUSTPLUS_WEBHOOK_SECRET>
```

## Oxide/uMod plugin

Plugin source:

```text
plugins/oxide/RustControlPanel.cs
```

Install:

1. Set backend env:

```env
RUSTPLUS_WEBHOOK_SECRET=change-me-long-random-secret
```

2. Copy the plugin to the Rust server:

```text
oxide/plugins/RustControlPanel.cs
```

3. Reload the plugin from server console:

```text
oxide.reload RustControlPanel
```

4. Edit generated config:

```text
oxide/config/RustControlPanel.json
```

Minimal config:

```json
{
  "webhook_url": "https://api.example.com/webhooks/rustcontrol/<workspace_id>/events",
  "webhook_secret": "change-me-long-random-secret",
  "battlemetrics_server_id": "39442578",
  "server_name": "Rustoria Lite",
  "snapshot_interval_seconds": 10.0,
  "send_position_snapshots": true,
  "send_team_snapshots": true,
  "send_chat_events": false,
  "send_death_events": true
}
```

5. Test from Rust server console:

```text
rustcontrol.test
rustcontrol.snapshot
```

The plugin streams:

- `online_snapshot` with current online players, positions, health, sleeping state, map grid;
- `team_snapshot` with live Rust team members;
- `player_connected` and `player_disconnected`;
- `player_death` with attacker/victim combat relation;
- optional `player_chat` events when enabled in config.

## Local HMAC smoke test

Use the helper without a Rust server:

```powershell
.\scripts\send-rustcontrol-event.ps1 `
  -WebhookUrl "http://127.0.0.1:8080/webhooks/rustcontrol/<workspace_id>/events" `
  -Secret "change-me-long-random-secret"
```

After a successful request, check:

- `GET /api/admin/rustcontrol/live/players`;
- `GET /api/admin/rustcontrol/activity`;
- `GET /api/admin/rustcontrol/players/:id/intel`;
- `GET /api/admin/rustcontrol/players/:id/team-probability`.

## Player snapshot

```json
{
  "event_type": "player_snapshot",
  "severity": "info",
  "source": "oxide-plugin",
  "server": {
    "battlemetrics_server_id": "39442578",
    "name": "Rustoria Lite",
    "ip": "15.204.51.206",
    "port": 12567,
    "status": "online"
  },
  "player": {
    "steam_id": "76561198000000000",
    "name": "offender",
    "team_id": "team-123",
    "clan_tag": "ABC",
    "is_online": true,
    "position": { "x": 1234.0, "y": 12.4, "z": -480.0 },
    "map_grid": "J12",
    "health": 87,
    "sleeping": false
  },
  "related_players": [
    {
      "steam_id": "76561198000000001",
      "name": "mate-one",
      "team_id": "team-123",
      "evidence_type": "same_team_snapshot",
      "reason": "same live Rust team",
      "score_delta": 40
    }
  ]
}
```

## Team snapshot

```json
{
  "event_type": "team_snapshot",
  "source": "rustplus-adapter",
  "server": {
    "battlemetrics_server_id": "39442578",
    "name": "Rustoria Lite"
  },
  "team": {
    "id": "team-123",
    "name": "ABC",
    "members": [
      { "steam_id": "76561198000000000", "name": "offender", "map_grid": "J12", "health": 87 },
      { "steam_id": "76561198000000001", "name": "mate-one", "map_grid": "J13", "health": 92 }
    ]
  }
}
```

The backend stores:

- `rustcontrol.activity_events`;
- `rustcontrol.live_players`;
- `rustcontrol.player_position_snapshots`;
- `rustcontrol.team_evidence_events`;
- `rustcontrol.team_edges`.

The frontend reads this through:

- `GET /api/admin/rustcontrol/live/players`;
- `GET /api/admin/rustcontrol/me/live-context`;
- `GET /api/admin/rustcontrol/realtime/health`;
- `GET /api/admin/rustcontrol/alerts`;
- `GET /api/admin/rustcontrol/servers/:id/live-context`;
- `POST /api/admin/rustcontrol/live/players/:id/promote`;
- `GET /api/admin/rustcontrol/watchlist`;
- `GET /api/admin/rustcontrol/players/:id/intel`;
- `GET /api/admin/rustcontrol/players/:id/dossier`;
- `GET /api/admin/rustcontrol/players/:id/relations`;
- `GET /api/admin/rustcontrol/players/:id/network`;
- `GET /api/admin/rustcontrol/players/:id/server-history`;
- `GET /api/admin/rustcontrol/players/:id/position-trail`;
- `GET /api/admin/rustcontrol/players/:id/timeline`;
- `POST /api/admin/rustcontrol/players/:id/notes`;
- `PUT /api/admin/rustcontrol/players/:id/watch`;
- `GET /api/admin/rustcontrol/players/:id/team-probability`;
- `GET /api/admin/rustcontrol/players/:id/team-evidence`.

`GET /api/admin/rustcontrol/players/:id/intel` is the one-shot operator view for a resolved local player id. It returns the local profile, latest live player record, `live_status` freshness (`ok`, `recent`, `stale`, `silent`, or `no_live`), current server, realtime teammates, likely teammates, raw team evidence, recent sessions, and recent activity. When the target is currently live on a server, it also returns `realtime_context` and `nearby_players`: current-server roster counts, watched players on that server, same-grid players, current team members, distance-to-target, and proximity status for positioned players.

Player Intelligence renders an Identity Summary from the same payload: local profile id, Steam id/profile, BattleMetrics player/server links, current RustMaps link, visibility, first/last seen, created/updated, live source, and live freshness.

Player Intelligence also renders a Risk Evidence Digest from `watch`, `team_evidence`, `likely_teammates`, `realtime_context`, and `live_status`: current risk, watch reason/note, evidence count, total score, strongest proof, top evidence type/source, top likely teammate, realtime pressure counts, and the latest proof cards.

`GET /api/admin/rustcontrol/players/:id/dossier` returns aggregate player intelligence: alias/session/server/relation/evidence/activity counts, total session time, top servers, active-hour histogram, activity type counts, evidence type counts, and relation source counts.

`GET /api/admin/rustcontrol/players/:id/relations` is the operator relation graph payload. It returns the target player, current live/server context, merged relation items from `rustcontrol.team_edges` and current live-team data, raw evidence events, watch flags, and source status.

`GET /api/admin/rustcontrol/players/:id/network` returns an aggregated offender network: relation nodes merged with current live-team data, watch flags, online state, evidence counts, total evidence score, latest reasons, source/type breakdowns, and server ids where evidence was observed. Player Network cards expose quick `Watch`, `Suspect`, and `Hostile` actions; if a node only exists in live data, the UI can promote it into a local profile and flag it from the same card. The panel also builds a local evidence matrix with strongest links, top repeated servers, source mix, and evidence type counts across the whole network.

`GET /api/admin/rustcontrol/players/:id/server-history` returns a server-centric history for a local player: current server context, top cached servers, recent cached sessions, repeated companions from session overlap, and evidence grouped by server.

`GET /api/admin/rustcontrol/players/:id/position-trail` returns realtime movement history captured from plugin/Rust+ position snapshots: recent coordinates, grid/server metadata, heat cells, and sample counts.

`GET /api/admin/rustcontrol/players/:id/timeline` returns a chronological operator timeline for a local player: latest live snapshot, cached BattleMetrics sessions, activity events, and team evidence events merged into one feed. The Player Intelligence timeline UI adds local type filters (`live`, `session`, `evidence`, `activity`), full-text search across server/source/grid/team/related player/title/details, visible-item counters, and compact payload/session detail text for fast investigations.

`POST /api/admin/rustcontrol/players/:id/notes` stores an operator note as `rustcontrol.activity_events` with `event_type = operator_note`, `source = admin`, optional title/labels, and `info` or `warning` severity. These notes appear automatically in Activity and the player timeline.

`GET /api/admin/rustcontrol/realtime/health` returns operator health telemetry for realtime data: overall status, live/event counts, per-source freshness, per-server feed status, watched-player live counts, and recent feed events.

`GET /api/admin/rustcontrol/alerts` returns active watched-player signals: watched players currently online or recently seen, whether they are on the same server as the connected Steam account, proximity status, distance to the connected account when both live positions are known, severity, live position, watch reason, and current server.

Alert panels in Dashboard, Live, and Watchlist act as a realtime triage center: operators can filter by severity and scope (`same server`, `near`, `online`), see critical/warning/same-server/near counters, open Intel, and change the player's risk with quick `Watch`, `Suspect`, and `Hostile` actions from the alert card.

The global Activity page reads `GET /api/admin/rustcontrol/activity` as an operator investigation log with total/warning/error/operator-note counters, full-text payload search, severity filters, source chips, event-type chips, relative timestamps, and compact payload summaries instead of raw JSON-only rows.

`GET /api/admin/rustcontrol/servers/:id/live-context` is the one-shot server view. It accepts a local tracked server UUID or BattleMetrics server id and returns server summary, live roster, team clusters, watched players on that server, recent activity, and counts. Team clusters include `risk_score`, `risk_level`, and `risk_summary` counts for hostile/suspect/watch/friendly/watched/online members.

The frontend Online Map uses `GET /api/admin/rustcontrol/servers/:id/live-context` when available so the radar can center on the connected Steam account, show distance from the operator to nearby players, color watched players and teammates differently, and open local Intel profiles directly from map/list rows.

The Servers view reuses the same live-context payload for a server position radar. Operators can inspect any selected tracked/search server, see positioned players on the map, and use `Watch`, `Promote`, or `Intel` actions directly from the radar rows.

The server live roster is also a triage surface: operators can search by name, SteamID, BattleMetricsID, team, clan, grid, source, server, watch reason, or labels; filter by watched/hostile/suspect/online/clear; filter by the most populated realtime teams; see online/watched/hostile/suspect/positioned counters; and use the same `Watch`, `Suspect`, `Hostile`, `Promote`, or `Intel` actions from the filtered table.

Team clusters in server live context render actionable member rows with live identity, grid, health, last seen, current risk, and quick `Watch`, `Suspect`, `Hostile`, `Promote`, or `Intel` actions for each member. The UI sorts clusters by threat and highlights hostile/suspect teams so an operator can spot a risky group before opening each member.

`POST /api/admin/rustcontrol/live/players/:id/promote` promotes a live roster row into a local `rustcontrol.players` profile when the row has `steam_id` or `battlemetrics_player_id`. It can also set the initial watch flag with `{ "watch": true, "risk_level": "watch", "reason": "...", "labels": ["live"] }`, which is what the UI uses for one-click Watch from Live/Servers.

Live Online Map includes a Map Hunt toolbar over the positioned current-server rows: operators can search by identity/team/grid/source/risk, filter watched/hostile/suspect/team/150m/400m/same-grid/online/clear players, and keep the map centered while only matching dots/rows are shown.

Detected Team in Live Control reuses enriched server live rows when available, so each teammate card can promote live-only rows, open local Intel, or apply quick `Watch`, `Suspect`, and `Hostile` risk without leaving the current-server view.

## Operator watchlist

The watchlist is a local operator layer over the integrated data. It does not require BattleMetrics to be online after the player is known locally.

- `PUT /api/admin/rustcontrol/players/:id/watch` creates or updates a player flag with `watched`, `risk_level`, `reason`, `note`, and `labels`.
- `POST /api/admin/rustcontrol/live/players/:id/promote` can create the local player and flag it directly from the live roster, so operators do not need to search manually first.
- `GET /api/admin/rustcontrol/watchlist` returns watched players joined with the latest live player row and current server summary.
- `GET /api/admin/rustcontrol/players/:id/intel` includes `watch`, so the player detail panel can edit the flag inline.
- Player Intelligence realtime-context rows can promote live-only nearby/team/grid players into local profiles and place them on watch without leaving the offender view.
- Realtime rows in Live Search, Live Online Map, Player Intelligence, Live/Servers roster, and server radar expose quick `Watch`, `Suspect`, and `Hostile` actions so operators can set the initial risk level directly from live context.
- The Watchlist UI acts as a triage queue: operators can filter by risk/live state, search by identity/server/grid/team/note, change risk inline, and edit reason, note, and labels without leaving the queue.
- Data is stored in `rustcontrol.player_flags`.
- The Integrations page includes a Rust+ / Plugin Intake panel with public/admin webhook endpoints, `RUSTPLUS_WEBHOOK_SECRET` readiness, accepted source names, realtime traffic checks, source health rows, recent Rust+/plugin events, `Send Test Event`, and `Full Snapshot` actions.
- `POST /api/admin/rustcontrol/integrations/rustplus/test-event` creates a `rustplus_intake_test` event from the admin session without exposing `RUSTPLUS_WEBHOOK_SECRET` to the browser. Use it to verify Activity and Realtime Health before a real plugin is online.
- `POST /api/admin/rustcontrol/integrations/rustplus/synthetic-snapshot` creates a full synthetic realtime chain: connected operator if needed, tracked server, live roster, positions, suspect offender watch flag, team evidence, team edges, and a `team_snapshot` activity event. Use it to verify Live Map, My Current Server, Alerts, Watchlist, Player Intelligence, and Activity before a real plugin is online.

BattleMetrics session sync:

- `GET /api/admin/rustcontrol/players/:id/sessions` fetches BattleMetrics sessions and caches usable rows in `rustcontrol.player_sessions`;
- cached sessions are matched by local player, BattleMetrics player id, BattleMetrics server id, and start time;
- after sync, the backend recalculates `battlemetrics_overlap` team edges against other known local players;
- overlap scoring is capped below plugin-confirmed team evidence and is shown as a reason in the player intel probability table.
- Player Intelligence renders a visible BattleMetrics Session Sync panel with the selected BM player id, API/source status, fetched session count, cached session count, updated overlap edge count, last loaded age, backend message, and a manual `Sync` action.

Alias/local search:

- Steam persona names, BattleMetrics player names, BattleMetrics session names, plugin player names, and related-player names are stored in `rustcontrol.player_aliases`;
- `GET /api/admin/rustcontrol/players?q=...` returns BattleMetrics results, `local_items` from known players/aliases, and `live_items` from current/recent live roster rows;
- `POST /api/admin/rustcontrol/players/resolve` returns `local_matches`, so old nicknames can open the same local player intel profile.
- Player Intelligence renders Alias History with alias, source, first seen, last seen, relative age, and source counts, so identity changes are visible without opening raw JSON.
