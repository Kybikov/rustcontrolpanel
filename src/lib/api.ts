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
  player: PlayerIntel;
  watch: PlayerWatchState;
  live_player?: LivePlayer | null;
  current_server?: ServerIntel | null;
};

export type ServerLivePlayerItem = {
  live_player: LivePlayer;
  player?: PlayerIntel | null;
  watch?: PlayerWatchState | null;
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
};

export type ServerWipesResult = {
  items: ServerWipe[];
  server_id?: string;
  battlemetrics_server_id?: string;
  source?: string;
  source_status?: string;
};

export type ServerMapDetail = {
  server?: ServerIntel | null;
  map?: Record<string, unknown>;
  markers?: Array<Record<string, unknown>>;
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
  secret_hint?: string;
  updated_at?: string | null;
  config?: Record<string, unknown>;
};

export type IntegrationStatus = {
  providers: IntegrationProvider[];
};

export type IntegrationUpdatePayload = {
  enabled?: boolean;
  secret_hint?: string;
  config?: Record<string, unknown>;
};

export type IntegrationTestResult = {
  provider: string;
  status: string;
  enabled?: boolean;
  checked_at?: string;
  checks?: Array<Record<string, unknown>>;
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

export type ApiClient = ReturnType<typeof createApiClient>;

type RequestOptions = {
  method?: string;
  body?: unknown;
  token?: string;
};

export function createApiClient(baseUrl: string, token?: string) {
  const root = baseUrl.replace(/\/+$/, "");

  async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const response = await fetch(`${root}${path}`, {
      method: options.method ?? "GET",
      headers: {
        "Content-Type": "application/json",
        ...(token || options.token ? { Authorization: `Bearer ${options.token ?? token}` } : {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
    const text = await response.text();
    const envelope = text ? (JSON.parse(text) as ApiEnvelope<T>) : {};
    if (!response.ok || envelope.error) {
      const message = envelope.error?.message ?? `HTTP ${response.status}`;
      throw new Error(message);
    }
    return envelope.data as T;
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
    realtimeHealth() {
      return request<RealtimeHealth>("/api/admin/rustcontrol/realtime/health");
    },
    alerts() {
      return request<{ items: RustAlertItem[]; source_status: string }>("/api/admin/rustcontrol/alerts");
    },
    integrations() {
      return request<IntegrationStatus>("/api/admin/rustcontrol/integrations");
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
    trackedServers() {
      return request<ServerIntel[]>("/api/admin/rustcontrol/servers");
    },
    serverDetail(id: string) {
      return request<ServerDetail>(`/api/admin/rustcontrol/servers/${encodeURIComponent(id)}`);
    },
    serverSnapshots(id: string) {
      return request<ServerSnapshotsResult>(`/api/admin/rustcontrol/servers/${encodeURIComponent(id)}/snapshots`);
    },
    serverWipes(id: string) {
      return request<ServerWipesResult>(`/api/admin/rustcontrol/servers/${encodeURIComponent(id)}/wipes`);
    },
    serverMap(id: string) {
      return request<ServerMapDetail>(`/api/admin/rustcontrol/servers/${encodeURIComponent(id)}/map`);
    },
    serverLiveContext(id: string) {
      return request<ServerLiveContext>(`/api/admin/rustcontrol/servers/${encodeURIComponent(id)}/live-context`);
    },
    watchlist() {
      return request<WatchlistItem[]>("/api/admin/rustcontrol/watchlist");
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
      return request<{ items: TeamProbability[]; source_status: string; required_sources?: string[] }>(
        `/api/admin/rustcontrol/players/${encodeURIComponent(id)}/team-probability`,
      );
    },
    livePlayers() {
      return request<{ items: LivePlayer[]; source_status: string }>("/api/admin/rustcontrol/live/players");
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
    wipes() {
      return request<Array<Record<string, unknown>>>("/api/admin/rustcontrol/wipes");
    },
    activity() {
      return request<Array<Record<string, unknown>>>("/api/admin/rustcontrol/activity");
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
  };
}
