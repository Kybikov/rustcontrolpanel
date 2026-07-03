export type ApiEnvelope<T> = {
  data?: T;
  meta?: {
    count?: number;
    total?: number;
    page?: number;
    per_page?: number;
  };
  error?: {
    code: string;
    message: string;
    details?: unknown[];
  };
  request_id?: string;
};

type ApiListData<T> = T[] | {
  items?: T[];
  stats?: Record<string, number>;
  source?: string;
  source_status?: string;
  stale?: boolean;
  raw_available?: boolean;
};

export type ApiListResult<T> = {
  items: T[];
  meta?: ApiEnvelope<unknown>["meta"];
  stats?: Record<string, number>;
  source?: string;
  source_status?: string;
  stale?: boolean;
  raw_available?: boolean;
};

export type AuthTokens = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
};

export type LoginResult = {
  totp_required?: boolean;
  tokens?: AuthTokens;
};

export type ServerIntel = {
  id?: string;
  battlemetrics_server_id: string;
  name: string;
  address?: string;
  ip?: string;
  port?: number;
  port_query?: number;
  players?: number;
  max_players?: number;
  rank?: number | null;
  status?: string;
  country?: string;
  rust_type?: string;
  rust_map?: string;
  rust_world_seed?: number | null;
  rust_world_size?: number | null;
  last_wipe_at?: string;
  next_wipe_at?: string;
  rustmaps_url?: string;
  rustmaps_thumbnail_url?: string;
  source?: string;
  source_updated_at?: string;
  updated_at?: string;
};

export type ServersQuery = {
  tracked_q?: string;
  status?: string;
  country?: string;
  server_type?: string;
  tag?: string;
  wipe_window?: string;
  freshness?: string;
  min_online?: string;
  max_online?: string;
  min_size?: string;
  max_size?: string;
  page?: string;
  per_page?: string;
};

export type ServerDetailListQuery = {
  page?: string;
  per_page?: string;
};

export type PlayerIntel = {
  id?: string;
  battlemetrics_player_id?: string;
  name?: string;
  display_name?: string;
  steam_id?: string;
  matched_alias?: string;
  aliases?: PlayerAlias[];
  private?: boolean;
  positive_match?: boolean;
  profile_url?: string;
  avatar_url?: string;
  source?: string;
  created_at?: string;
  updated_at?: string;
};

export type KnownPlayerItem = {
  player: PlayerIntel & {
    first_seen_at?: string | null;
    last_seen_at?: string | null;
    visibility_state?: number | null;
  };
  watch?: PlayerWatchState | null;
  live_player?: LivePlayer | null;
  current_server?: ServerIntel | null;
  stats?: {
    sessions?: number;
    playtime_seconds?: number;
    probable_team_count?: number;
    bans?: {
      community_banned?: boolean;
      vac_banned?: boolean;
      number_of_vac_bans?: number;
      number_of_game_bans?: number;
      economy_ban?: string;
      fetched_at?: string | null;
    };
  };
  last_activity_at?: string;
};

export type PlayerAlias = {
  alias: string;
  source?: string;
  first_seen_at?: string | null;
  last_seen_at?: string | null;
};

export type LivePlayer = {
  id: string;
  server_id?: string;
  battlemetrics_server_id?: string;
  server_name?: string;
  rustmaps_url?: string;
  steam_id?: string;
  battlemetrics_player_id?: string;
  display_name: string;
  clan_tag?: string;
  team_id?: string;
  is_online?: boolean;
  position?: {
    x?: number | null;
    y?: number | null;
    z?: number | null;
  };
  map_grid?: string;
  health?: number | null;
  sleeping?: boolean;
  source?: string;
  last_seen_at?: string;
};

export type MyLiveContext = {
  connected: boolean;
  steam?: Record<string, unknown>;
  live_player?: LivePlayer | null;
  teammates?: LivePlayer[];
  source_status?: string;
};

export type ResolvePlayerResult = {
  query: string;
  steam_id?: string;
  steam?: Record<string, unknown>;
  steam_profile?: Record<string, unknown> | null;
  steam_bans?: Array<Record<string, unknown>>;
  steam_friends?: Array<Record<string, unknown>>;
  battlemetrics?: PlayerIntel[];
  local_player?: PlayerIntel;
  local_matches?: PlayerIntel[];
  team_lookup_status?: string;
};

export type PlayerSessionSync = {
  items: unknown[];
  source?: string;
  source_status: string;
  message?: string;
  stored_sessions?: number;
  overlap_edges_updated?: number;
};

export type PlayerWatchState = {
  id: string;
  player_id: string;
  watched: boolean;
  risk_level: "watch" | "suspect" | "hostile" | "friendly" | "ignored" | string;
  reason?: string;
  note?: string;
  labels?: string[];
  created_at?: string;
  updated_at?: string;
};

export type WatchlistItem = {
  watch: PlayerWatchState;
  player: PlayerIntel;
  live_player?: LivePlayer | null;
  current_server?: ServerIntel | null;
};

export type WatchlistQuery = {
  q?: string;
  risk_level?: string;
  live?: string;
  actor_id?: string;
  updated_by?: string;
  page?: string;
  per_page?: string;
};

export type LivePlayersQuery = {
  q?: string;
  search?: string;
  battlemetrics_server_id?: string;
  online?: string;
  page?: string;
  per_page?: string;
};

export type PlayersQuery = {
  page?: string;
  per_page?: string;
};

export type AlertsQuery = {
  severity?: string;
  scope?: string;
  page?: string;
  per_page?: string;
};

export type RustAlertItem = {
  alert_type: string;
  severity: "critical" | "warning" | "info" | string;
  same_server_as_me?: boolean;
  distance_to_me?: number | null;
  proximity_status?: "near" | "close" | "same_server" | string;
  my_live?: {
    map_grid?: string;
    last_seen_at?: string | null;
  };
  player?: PlayerIntel | null;
  watch?: PlayerWatchState | null;
  live_player?: LivePlayer | null;
  current_server?: ServerIntel | null;
};

export type ServerLivePlayerItem = {
  live_player: LivePlayer;
  player?: PlayerIntel | null;
  watch?: PlayerWatchState | null;
};

export type ServerPositionSnapshotItem = ServerLivePlayerItem & {
  observed_at?: string;
};

export type PromoteLivePlayerResult = {
  player: PlayerIntel;
  watch?: PlayerWatchState | null;
  live_player: LivePlayer;
};

export type ServerTeamCluster = {
  team_id: string;
  clan_tag?: string;
  online_count?: number;
  watched_count?: number;
  member_count?: number;
  risk_score?: number;
  risk_level?: "hostile" | "suspect" | "watch" | "clear" | string;
  risk_summary?: {
    hostile?: number;
    suspect?: number;
    watch?: number;
    friendly?: number;
    watched?: number;
    online?: number;
  };
  members?: ServerLivePlayerItem[];
};

export type ServerLiveContext = {
  server?: ServerIntel | null;
  server_id?: string;
  battlemetrics_server_id?: string;
  live_players: ServerLivePlayerItem[];
  team_clusters: ServerTeamCluster[];
  watched_players: ServerLivePlayerItem[];
  activity: Array<Record<string, unknown>>;
  counts?: Record<string, number>;
  source_status?: string;
};

export type ServerSnapshot = {
  id: string;
  players?: number;
  max_players?: number;
  rank?: number | null;
  status?: string;
  captured_at?: string;
};

export type ServerWipe = {
  id: string;
  server_id?: string;
  server_name?: string;
  wipe_type: string;
  wipe_at: string;
  source?: string;
  confidence?: number;
  created_at?: string;
};

export type WipeReminder = {
  id: string;
  server_id?: string;
  server_name?: string;
  wipe_id?: string;
  wipe_type: string;
  wipe_at: string;
  remind_at: string;
  minutes_before: number;
  status: string;
  note?: string;
  due?: boolean;
  created_at?: string;
  updated_at?: string;
};

export type ServerDetail = {
  server?: ServerIntel | null;
  snapshots?: ServerSnapshot[];
  wipes?: ServerWipe[];
  activity?: Array<Record<string, unknown>>;
  settings?: Record<string, unknown>;
  source?: string;
  source_status?: string;
};

export type ServerSnapshotsResult = {
  items: ServerSnapshot[];
  server_id?: string;
  battlemetrics_server_id?: string;
  source?: string;
  source_status?: string;
  meta?: ApiEnvelope<unknown>["meta"];
};

export type ServerPositionSnapshotsResult = {
  items: ServerPositionSnapshotItem[];
  server_id?: string;
  battlemetrics_server_id?: string;
  source?: string;
  source_status?: string;
  meta?: ApiEnvelope<unknown>["meta"];
};

export type ServerWipesResult = {
  items: ServerWipe[];
  server_id?: string;
  battlemetrics_server_id?: string;
  source?: string;
  source_status?: string;
  meta?: ApiEnvelope<unknown>["meta"];
};

export type WipeOverrideInput = {
  server_id: string;
  wipe_type: string;
  wipe_at: string;
  confidence?: number;
  note?: string;
};

export type WipeReminderInput = {
  server_id: string;
  wipe_id?: string;
  wipe_type: string;
  wipe_at: string;
  minutes_before: number;
  note?: string;
};

export type WipesQuery = {
  server_id?: string;
  wipe_type?: string;
  source?: string;
  from?: string;
  to?: string;
  window?: "all" | string;
  page?: string;
  per_page?: string;
};

export type WipeRemindersQuery = {
  server_id?: string;
  status?: string;
  page?: string;
  per_page?: string;
};

export type ActivityQuery = {
  q?: string;
  severity?: string;
  source?: string;
  event_type?: string;
  server_id?: string;
  player_id?: string;
  actor_id?: string;
  from?: string;
  to?: string;
  page?: string;
  per_page?: string;
};

export type ActivityOptionCount = {
  value: string;
  count: number;
};

export type ActivityFeedResult = {
  items: Array<Record<string, unknown>>;
  meta?: ApiEnvelope<unknown>["meta"];
  stats?: {
    total?: number;
    warning?: number;
    error?: number;
    operator_notes?: number;
  };
  sources?: ActivityOptionCount[];
  event_types?: ActivityOptionCount[];
  source?: string;
  source_status?: string;
  stale?: boolean;
  raw_available?: boolean;
};

export type ServerMapDetail = {
  server?: ServerIntel | null;
  map?: Record<string, unknown>;
  markers?: Array<Record<string, unknown>>;
  event_markers?: Array<Record<string, unknown>>;
  map_history?: Array<Record<string, unknown>>;
  map_history_meta?: ApiEnvelope<unknown>["meta"];
  live_players?: ServerLivePlayerItem[];
  server_id?: string;
  battlemetrics_server_id?: string;
  source?: string;
  source_status?: string;
};

export type PlayerRelationItem = {
  player?: PlayerIntel | null;
  live_player?: LivePlayer | null;
  watch?: PlayerWatchState | null;
  score: number;
  source?: string;
  relation_type?: string;
  reasons?: unknown;
  calculated_at?: string;
};

export type PlayerRelationsGraph = {
  target: {
    player: PlayerIntel;
    live_player?: LivePlayer | null;
    watch?: PlayerWatchState | null;
    current_server?: ServerIntel | null;
  };
  items: PlayerRelationItem[];
  evidence: Array<Record<string, unknown>>;
  source_status?: string;
  required_sources?: string[];
};

export type PlayerNetworkNode = PlayerRelationItem & {
  key?: string;
  is_current_team?: boolean;
  is_online?: boolean;
  evidence_score?: number;
  evidence_summary?: Record<string, unknown>;
  evidence?: Array<Record<string, unknown>>;
  last_seen_at?: string;
};

export type PlayerNetwork = {
  target: {
    player: PlayerIntel;
    live_player?: LivePlayer | null;
    watch?: PlayerWatchState | null;
    current_server?: ServerIntel | null;
  };
  nodes: PlayerNetworkNode[];
  evidence: Array<Record<string, unknown>>;
  counts?: Record<string, number>;
  source_status?: string;
  required_sources?: string[];
};

export type PlayerServerHistory = {
  target: {
    player: PlayerIntel;
    live_player?: LivePlayer | null;
    current_server?: ServerIntel | null;
  };
  top_servers: Array<Record<string, unknown>>;
  recent_sessions: Array<Record<string, unknown>>;
  companions: Array<Record<string, unknown>>;
  evidence_servers: Array<Record<string, unknown>>;
  counts?: Record<string, number>;
  source_status?: string;
  required_sources?: string[];
};

export type PlayerPositionTrailItem = LivePlayer & {
  observed_at?: string;
};

export type PlayerPositionTrail = {
  target: {
    player: PlayerIntel;
    live_player?: LivePlayer | null;
  };
  items: PlayerPositionTrailItem[];
  heat_cells: Array<Record<string, unknown>>;
  counts?: Record<string, number>;
  source_status?: string;
};

export type PlayerTimelineItem = {
  id: string;
  item_type: "live" | "session" | "activity" | "evidence" | string;
  title: string;
  subtitle?: string;
  source?: string;
  severity?: string;
  occurred_at?: string;
  server?: Partial<ServerIntel> | null;
  live_player?: LivePlayer | null;
  related_player?: Partial<PlayerIntel> | null;
  score_delta?: number;
  session?: Record<string, unknown>;
  payload?: unknown;
};

export type PlayerTimeline = {
  target: {
    player: PlayerIntel;
    live_player?: LivePlayer | null;
  };
  items: PlayerTimelineItem[];
  counts?: Record<string, number>;
  source_status?: string;
};

export type PlayerDossier = {
  player: PlayerIntel;
  watch?: PlayerWatchState | null;
  live_player?: LivePlayer | null;
  summary?: Record<string, unknown>;
  top_servers?: Array<Record<string, unknown>>;
  clan_memberships?: Array<Record<string, unknown>>;
  active_hours?: Array<{ hour: number; count: number }>;
  activity_types?: Array<Record<string, unknown>>;
  evidence_types?: Array<Record<string, unknown>>;
  relation_sources?: Array<Record<string, unknown>>;
  source_status?: string;
};

export type TeamProbability = {
  player: PlayerIntel;
  score: number;
  reasons?: unknown;
  source?: string;
  calculated_at?: string;
};

export type TeamProbabilityResult = {
  items: TeamProbability[];
  source_status: string;
  required_sources?: string[];
};

export type TeamProbabilityRecalculateResult = TeamProbabilityResult & {
  cached_sessions?: number;
  battlemetrics_overlap_edges_deleted?: number;
  overlap_edges_updated?: number;
  recalculated_at?: string;
};

export type PlayerIntelDetail = {
  player: PlayerIntel & {
    visibility_state?: number | null;
    first_seen_at?: string | null;
    last_seen_at?: string | null;
    raw?: Record<string, unknown>;
  };
  watch?: PlayerWatchState | null;
  live_player?: LivePlayer | null;
  live_status?: PlayerLiveStatus;
  current_server?: ServerIntel | null;
  realtime_teammates?: LivePlayer[];
  realtime_context?: PlayerRealtimeContext;
  nearby_players?: PlayerRealtimeNearbyItem[];
  steam_profile?: Record<string, unknown> | null;
  steam_bans?: Array<Record<string, unknown>>;
  steam_friends?: Array<Record<string, unknown>>;
  steam_cache?: Record<string, unknown>;
  likely_teammates?: TeamProbability[];
  team_evidence?: Array<Record<string, unknown>>;
  recent_sessions?: Array<Record<string, unknown>>;
  recent_activity?: Array<Record<string, unknown>>;
  source_status?: string;
};

export type PlayerLiveStatus = {
  status?: "ok" | "recent" | "stale" | "silent" | "no_data" | "no_live" | string;
  is_online?: boolean;
  age_seconds?: number | null;
  last_seen_at?: string | null;
  source?: string;
  server_id?: string;
  battlemetrics_server_id?: string;
};

export type PlayerRealtimeNearbyItem = ServerLivePlayerItem & {
  distance_to_target?: number | null;
  proximity_status?: "near" | "close" | "same_server" | string;
  same_team?: boolean;
  same_grid?: boolean;
  is_target?: boolean;
};

export type PlayerRealtimeContext = {
  counts?: Record<string, number>;
  teammates?: PlayerRealtimeNearbyItem[];
  watched_players?: PlayerRealtimeNearbyItem[];
  same_grid_players?: PlayerRealtimeNearbyItem[];
  source_status?: string;
};

export type IntegrationProvider = {
  provider: string;
  label?: string;
  configured: boolean;
  enabled?: boolean;
  env_configured?: boolean;
  public_mode?: boolean;
  testable?: boolean;
  status?: string;
  use?: string;
  secret_source?: string;
  secret_configured?: boolean;
  stored_secret_configured?: boolean;
  secret_storage?: string;
  secret_hint?: string;
  updated_at?: string | null;
  config?: Record<string, unknown>;
};

export type SyncRun = {
  id: string;
  provider: string;
  target_type?: string;
  target_id?: string;
  status: string;
  items_scanned?: number;
  items_changed?: number;
  message?: string;
  error?: string;
  metadata?: Record<string, unknown>;
  started_by?: string;
  started_at?: string;
  finished_at?: string | null;
  duration_ms?: number | null;
};

export type SyncRunsQuery = {
  provider?: string;
  target_type?: string;
  target_id?: string;
  page?: string;
  per_page?: string;
};

export type SyncRunsResult = {
  items: SyncRun[];
  meta?: ApiEnvelope<unknown>["meta"];
  source?: string;
  source_status?: string;
};

export type IntegrationStatus = {
  providers: IntegrationProvider[];
  recent_sync_runs?: SyncRun[];
};

export type IntegrationUpdatePayload = {
  enabled?: boolean;
  secret_hint?: string;
  secret_value?: string;
  clear_secret?: boolean;
  config?: Record<string, unknown>;
};

export type IntegrationTestResult = {
  provider: string;
  status: string;
  enabled?: boolean;
  checked_at?: string;
  checks?: Array<Record<string, unknown>>;
};

export type PluginEventInput = {
  event_type: string;
  severity?: string;
  source?: string;
  payload?: unknown;
  occurred_at?: string;
};

export type RconActionInput = {
  action: "say" | "kick" | "ban" | "unban" | "mute" | "unmute";
  target?: string;
  message?: string;
  reason?: string;
};

export type RconActionResult = {
  status: string;
  message?: string;
  activity_id?: string;
  server_id?: string;
  battlemetrics_id?: string;
  action?: string;
  target?: string;
  response_preview?: string;
};

export type RealtimeHealth = {
  status: string;
  counts?: Record<string, unknown>;
  sources?: Array<Record<string, unknown>>;
  servers?: Array<Record<string, unknown>>;
  recent_events?: Array<Record<string, unknown>>;
  integrations?: Record<string, unknown>;
  stale_after_seconds?: number;
  silent_after_seconds?: number;
};

export type CommandSearchItem = {
  id: string;
  type: "command" | "server" | "player" | "live_player" | "activity" | string;
  title: string;
  subtitle?: string;
  href?: string;
  source?: string;
  score?: number;
  badges?: string[];
  payload?: Record<string, unknown>;
};

export type CommandSearchResult = {
  items: CommandSearchItem[];
  query?: string;
  source_status?: string;
};

export type ApiClient = ReturnType<typeof createApiClient>;

type RequestOptions = {
  method?: string;
  body?: unknown;
  token?: string;
  headers?: Record<string, string>;
  timeoutMs?: number;
};

export function createApiClient(baseUrl: string, token?: string) {
  const root = baseUrl.replace(/\/+$/, "");

  async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const envelope = await requestEnvelope<T>(path, options);
    return envelope.data as T;
  }

  async function requestEnvelope<T>(path: string, options: RequestOptions = {}): Promise<ApiEnvelope<T>> {
    const url = `${root}${path}`;
    let response: Response;
    const controller = options.timeoutMs ? new AbortController() : undefined;
    const timeout = controller ? window.setTimeout(() => controller.abort(), options.timeoutMs) : undefined;
    try {
      response = await fetch(url, {
        method: options.method ?? "GET",
        headers: {
          "Content-Type": "application/json",
          ...(options.headers ?? {}),
          ...(token || options.token ? { Authorization: `Bearer ${options.token ?? token}` } : {}),
        },
        body: options.body ? JSON.stringify(options.body) : undefined,
        signal: controller?.signal,
      });
    } catch (error) {
      const base = root || "same-origin API";
      const timedOut = error instanceof Error && error.name === "AbortError";
      const detail = timedOut && options.timeoutMs ? `request timed out after ${options.timeoutMs}ms` : error instanceof Error ? error.message : "network request failed";
      throw new Error(`Backend API is unreachable at ${base}: ${detail}`);
    } finally {
      if (timeout) window.clearTimeout(timeout);
    }
    const text = await response.text();
    const envelope = text ? (JSON.parse(text) as ApiEnvelope<T>) : {};
    if (!response.ok || envelope.error) {
      const message = envelope.error?.message ?? `HTTP ${response.status}`;
      throw new Error(message);
    }
    return envelope;
  }

  async function requestItems<T>(path: string, options: RequestOptions = {}): Promise<T[]> {
    const data = await request<ApiListData<T>>(path, options);
    if (Array.isArray(data)) return data;
    return data?.items ?? [];
  }

  async function requestList<T>(path: string, options: RequestOptions = {}): Promise<ApiListResult<T>> {
    const envelope = await requestEnvelope<ApiListData<T>>(path, options);
    const data = envelope.data;
    if (Array.isArray(data)) {
      return { items: data, meta: envelope.meta };
    }
    return {
      items: data?.items ?? [],
      meta: envelope.meta,
      stats: data?.stats,
      source: data?.source,
      source_status: data?.source_status,
      stale: data?.stale,
      raw_available: data?.raw_available,
    };
  }

  function withQuery(path: string, query?: Record<string, string | undefined>) {
    const params = new URLSearchParams();
    Object.entries(query ?? {}).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });
    const suffix = params.toString();
    return suffix ? `${path}?${suffix}` : path;
  }

  return {
    login(email: string, password: string, totpCode?: string) {
      return request<LoginResult>("/api/admin/auth/login", {
        method: "POST",
        body: { email, password, totp_code: totpCode ?? "" },
      });
    },
    overview() {
      return request<Record<string, unknown>>("/api/admin/rustcontrol/overview");
    },
    commandSearch(query: string) {
      return request<CommandSearchResult>(`/api/admin/rustcontrol/search?q=${encodeURIComponent(query)}`);
    },
    realtimeHealth() {
      return request<RealtimeHealth>("/api/admin/rustcontrol/realtime/health");
    },
    alerts(query?: AlertsQuery) {
      return request<{ items: RustAlertItem[]; source_status: string }>(withQuery("/api/admin/rustcontrol/alerts", query));
    },
    alertsPage(query?: AlertsQuery) {
      return requestList<RustAlertItem>(withQuery("/api/admin/rustcontrol/alerts", query));
    },
    integrations() {
      return request<IntegrationStatus>("/api/admin/rustcontrol/integrations");
    },
    async syncRuns(query?: SyncRunsQuery): Promise<SyncRunsResult> {
      const envelope = await requestEnvelope<ApiListData<SyncRun>>(withQuery("/api/admin/rustcontrol/sync-runs", query));
      const data = envelope.data;
      if (Array.isArray(data)) {
        return { items: data, meta: envelope.meta };
      }
      return {
        items: data?.items ?? [],
        meta: envelope.meta,
        source: data?.source,
        source_status: data?.source_status,
      };
    },
    updateIntegration(provider: string, payload: IntegrationUpdatePayload) {
      return request<{ provider: IntegrationProvider; dropped_secret_keys?: string[] }>(
        `/api/admin/rustcontrol/integrations/${encodeURIComponent(provider)}`,
        {
          method: "PUT",
          body: payload,
        },
      );
    },
    testIntegration(provider: string) {
      return request<IntegrationTestResult>(
        `/api/admin/rustcontrol/integrations/${encodeURIComponent(provider)}/test`,
        {
          method: "POST",
        },
      );
    },
    searchServers(query: string) {
      return request<{ items: ServerIntel[]; source: string }>(
        `/api/admin/rustcontrol/servers?q=${encodeURIComponent(query)}`,
      );
    },
    trackedServersPage(query?: ServersQuery) {
      return requestList<ServerIntel>(withQuery("/api/admin/rustcontrol/servers", query));
    },
    trackedServers(query?: ServersQuery) {
      return requestItems<ServerIntel>(withQuery("/api/admin/rustcontrol/servers", query));
    },
    serverDetail(id: string) {
      return request<ServerDetail>(`/api/admin/rustcontrol/servers/${encodeURIComponent(id)}`);
    },
    async serverSnapshots(id: string, query?: ServerDetailListQuery): Promise<ServerSnapshotsResult> {
      const envelope = await requestEnvelope<Omit<ServerSnapshotsResult, "meta">>(
        withQuery(`/api/admin/rustcontrol/servers/${encodeURIComponent(id)}/snapshots`, query),
      );
      return { ...(envelope.data ?? { items: [] }), meta: envelope.meta };
    },
    async serverPositionSnapshots(id: string, query?: ServerDetailListQuery): Promise<ServerPositionSnapshotsResult> {
      const envelope = await requestEnvelope<Omit<ServerPositionSnapshotsResult, "meta">>(
        withQuery(`/api/admin/rustcontrol/servers/${encodeURIComponent(id)}/position-snapshots`, query),
      );
      return { ...(envelope.data ?? { items: [] }), meta: envelope.meta };
    },
    async serverWipes(id: string, query?: ServerDetailListQuery): Promise<ServerWipesResult> {
      const envelope = await requestEnvelope<Omit<ServerWipesResult, "meta">>(
        withQuery(`/api/admin/rustcontrol/servers/${encodeURIComponent(id)}/wipes`, query),
      );
      return { ...(envelope.data ?? { items: [] }), meta: envelope.meta };
    },
    serverMap(id: string, query?: ServerDetailListQuery) {
      return request<ServerMapDetail>(withQuery(`/api/admin/rustcontrol/servers/${encodeURIComponent(id)}/map`, query));
    },
    serverLiveContext(id: string) {
      return request<ServerLiveContext>(`/api/admin/rustcontrol/servers/${encodeURIComponent(id)}/live-context`);
    },
    serverRconAction(id: string, payload: RconActionInput) {
      return request<RconActionResult>(`/api/admin/rustcontrol/servers/${encodeURIComponent(id)}/rcon/actions`, {
        method: "POST",
        body: payload,
      });
    },
    watchlist() {
      return requestItems<WatchlistItem>("/api/admin/rustcontrol/watchlist");
    },
    watchlistPage(query?: WatchlistQuery) {
      return requestList<WatchlistItem>(withQuery("/api/admin/rustcontrol/watchlist", query));
    },
    updatePlayerWatch(
      id: string,
      payload: {
        watched?: boolean;
        risk_level?: string;
        reason?: string;
        note?: string;
        labels?: string[];
      },
    ) {
      return request<PlayerWatchState>(`/api/admin/rustcontrol/players/${encodeURIComponent(id)}/watch`, {
        method: "PUT",
        body: payload,
      });
    },
    promoteLivePlayer(
      id: string,
      payload?: {
        watch?: boolean;
        risk_level?: string;
        reason?: string;
        note?: string;
        labels?: string[];
      },
    ) {
      return request<PromoteLivePlayerResult>(`/api/admin/rustcontrol/live/players/${encodeURIComponent(id)}/promote`, {
        method: "POST",
        body: payload ?? {},
      });
    },
    trackServer(battlemetricsServerId: string) {
      return request<{ id: string; server: ServerIntel; tracked: boolean }>("/api/admin/rustcontrol/servers/track", {
        method: "POST",
        body: { battlemetrics_server_id: battlemetricsServerId },
      });
    },
    syncServer(id: string) {
      return request<{ id: string; server: ServerIntel; tracked: boolean }>(
        `/api/admin/rustcontrol/servers/${encodeURIComponent(id)}/sync`,
        { method: "POST" },
      );
    },
    searchPlayers(query: string) {
      return request<{ items: PlayerIntel[]; local_items?: PlayerIntel[]; live_items?: ServerLivePlayerItem[]; source: string; battlemetrics_source_status?: string }>(
        `/api/admin/rustcontrol/players?q=${encodeURIComponent(query)}`,
      );
    },
    knownPlayersPage(query?: PlayersQuery) {
      return requestList<KnownPlayerItem>(withQuery("/api/admin/rustcontrol/players", query));
    },
    resolvePlayer(query: string) {
      return request<ResolvePlayerResult>("/api/admin/rustcontrol/players/resolve", {
        method: "POST",
        body: { query },
      });
    },
    playerSessions(id: string) {
      return request<PlayerSessionSync>(`/api/admin/rustcontrol/players/${encodeURIComponent(id)}/sessions`);
    },
    playerIntel(id: string) {
      return request<PlayerIntelDetail>(`/api/admin/rustcontrol/players/${encodeURIComponent(id)}/intel`);
    },
    playerDossier(id: string) {
      return request<PlayerDossier>(`/api/admin/rustcontrol/players/${encodeURIComponent(id)}/dossier`);
    },
    playerRelations(id: string) {
      return request<PlayerRelationsGraph>(`/api/admin/rustcontrol/players/${encodeURIComponent(id)}/relations`);
    },
    playerNetwork(id: string) {
      return request<PlayerNetwork>(`/api/admin/rustcontrol/players/${encodeURIComponent(id)}/network`);
    },
    playerTimeline(id: string) {
      return request<PlayerTimeline>(`/api/admin/rustcontrol/players/${encodeURIComponent(id)}/timeline`);
    },
    addPlayerNote(
      id: string,
      payload: {
        title?: string;
        note: string;
        severity?: string;
        labels?: string[];
      },
    ) {
      return request<Record<string, unknown>>(`/api/admin/rustcontrol/players/${encodeURIComponent(id)}/notes`, {
        method: "POST",
        body: payload,
      });
    },
    playerServerHistory(id: string) {
      return request<PlayerServerHistory>(`/api/admin/rustcontrol/players/${encodeURIComponent(id)}/server-history`);
    },
    playerPositionTrail(id: string) {
      return request<PlayerPositionTrail>(`/api/admin/rustcontrol/players/${encodeURIComponent(id)}/position-trail`);
    },
    teamEvidence(id: string) {
      return request<{ items: Array<Record<string, unknown>>; source_status: string }>(
        `/api/admin/rustcontrol/players/${encodeURIComponent(id)}/team-evidence`,
      );
    },
    teamProbability(id: string) {
      return request<TeamProbabilityResult>(`/api/admin/rustcontrol/players/${encodeURIComponent(id)}/team-probability`);
    },
    recalculateTeamProbability(id: string) {
      return request<TeamProbabilityRecalculateResult>(`/api/admin/rustcontrol/players/${encodeURIComponent(id)}/team-probability/recalculate`, {
        method: "POST",
      });
    },
    livePlayers() {
      return request<{ items: LivePlayer[]; source_status: string }>("/api/admin/rustcontrol/live/players");
    },
    livePlayersPage(query?: LivePlayersQuery) {
      return requestList<LivePlayer>(withQuery("/api/admin/rustcontrol/live/players", query));
    },
    myLiveContext() {
      return request<MyLiveContext>("/api/admin/rustcontrol/me/live-context");
    },
    connectMySteam(query: string) {
      return request<Record<string, unknown>>("/api/admin/rustcontrol/me/steam", {
        method: "POST",
        body: { query },
      });
    },
    disconnectMySteam() {
      return request<Record<string, unknown>>("/api/admin/rustcontrol/me/steam", {
        method: "DELETE",
      });
    },
    wipes(query?: WipesQuery) {
      return requestItems<ServerWipe>(withQuery("/api/admin/rustcontrol/wipes", query));
    },
    wipesPage(query?: WipesQuery) {
      return requestList<ServerWipe>(withQuery("/api/admin/rustcontrol/wipes", query));
    },
    createWipe(payload: WipeOverrideInput) {
      return request<{ item: ServerWipe }>("/api/admin/rustcontrol/wipes", {
        method: "POST",
        body: payload,
      });
    },
    wipeReminders(query?: WipeRemindersQuery) {
      return requestItems<WipeReminder>(withQuery("/api/admin/rustcontrol/wipes/reminders", query));
    },
    wipeRemindersPage(query?: WipeRemindersQuery) {
      return requestList<WipeReminder>(withQuery("/api/admin/rustcontrol/wipes/reminders", query));
    },
    createWipeReminder(payload: WipeReminderInput) {
      return request<{ item: WipeReminder }>("/api/admin/rustcontrol/wipes/reminders", {
        method: "POST",
        body: payload,
      });
    },
    cancelWipeReminder(id: string) {
      return request<{ item: WipeReminder }>(`/api/admin/rustcontrol/wipes/reminders/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
    },
    activity() {
      return requestItems<Record<string, unknown>>("/api/admin/rustcontrol/activity");
    },
    activityFeed(query?: ActivityQuery) {
      return requestEnvelope<Omit<ActivityFeedResult, "meta">>(withQuery("/api/admin/rustcontrol/activity", query), { timeoutMs: 5_000 }).then((envelope) => ({
        ...(envelope.data ?? { items: [] }),
        meta: envelope.meta,
      }));
    },
    sendRustPlusTestEvent() {
      return request<Record<string, unknown>>("/api/admin/rustcontrol/integrations/rustplus/test-event", {
        method: "POST",
      });
    },
    sendRustPlusSyntheticSnapshot() {
      return request<Record<string, unknown>>("/api/admin/rustcontrol/integrations/rustplus/synthetic-snapshot", {
        method: "POST",
      });
    },
    sendPluginEvent(payload: PluginEventInput, secret: string) {
      return request<Record<string, unknown>>("/api/admin/rustcontrol/plugin/events", {
        method: "POST",
        headers: { "X-RustControl-Secret": secret },
        body: payload,
      });
    },
  };
}
