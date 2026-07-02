import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate, useParams } from "react-router-dom";
import {
  Activity,
  BarChart3,
  CalendarClock,
  Crosshair,
  DatabaseZap,
  Gamepad2,
  History,
  KeyRound,
  Link2,
  LogOut,
  MapPinned,
  Pencil,
  Radar,
  RefreshCw,
  Search,
  Server,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Save,
  UserCircle,
  Users,
  Wifi,
  X,
} from "lucide-react";
import {
  createApiClient,
  type IntegrationProvider,
  type IntegrationStatus,
  type LivePlayer,
  type MyLiveContext,
  type PlayerAlias,
  type PlayerDossier,
  type PlayerIntel,
  type PlayerIntelDetail,
  type PlayerNetwork,
  type PlayerNetworkNode,
  type PlayerPositionTrail,
  type PlayerRealtimeContext,
  type PlayerRealtimeNearbyItem,
  type PlayerRelationItem,
  type PlayerRelationsGraph,
  type PlayerSessionSync,
  type PlayerServerHistory,
  type PlayerTimeline,
  type PlayerTimelineItem,
  type PlayerWatchState,
  type RealtimeHealth,
  type RustAlertItem,
  type ServerDetail,
  type ServerLiveContext,
  type ServerLivePlayerItem,
  type ServerMapDetail,
  type ServerSnapshot,
  type ServerIntel,
  type ServerWipe,
  type TeamProbability,
  type WatchlistItem,
} from "@/lib/api";
import { compactText, formatDateTime, formatNumber } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, Td, Th } from "@/components/ui/table";

type View = "dashboard" | "live" | "players" | "watchlist" | "servers" | "wipes" | "activity" | "integrations" | "profile";
type QuickRiskLevel = "watch" | "suspect" | "hostile";
type WatchlistRiskFilter = "all" | QuickRiskLevel;
type WatchlistLiveFilter = "all" | "online" | "offline";
type AlertSeverityFilter = "all" | "critical" | "warning" | "info";
type AlertScopeFilter = "all" | "same_server" | "near" | "online";
type PlayerTimelineFilter = "all" | "live" | "session" | "evidence" | "activity";
type ServerRosterFilter = "all" | "watched" | QuickRiskLevel | "online" | "clear";
type LiveMapFilter = "all" | "watched" | QuickRiskLevel | "team" | "near150" | "near400" | "same_grid" | "online" | "clear";
type ActivitySeverityFilter = "all" | "info" | "warning" | "error";
type ProfileTab = "account" | "steam" | "stats" | "history" | "security";
type ServerDetailTab = "overview" | "history" | "wipes" | "players" | "map" | "activity" | "settings";
type BadgeVariant = "default" | "secondary" | "outline" | "danger" | "success" | "warning";

const quickRiskLevels: QuickRiskLevel[] = ["watch", "suspect", "hostile"];
const profileTabValues: ProfileTab[] = ["account", "steam", "stats", "history", "security"];
const serverDetailTabs: Array<{ value: ServerDetailTab; label: string }> = [
  { value: "overview", label: "Overview" },
  { value: "history", label: "History" },
  { value: "wipes", label: "Wipes" },
  { value: "players", label: "Players" },
  { value: "map", label: "Map" },
  { value: "activity", label: "Activity" },
  { value: "settings", label: "Settings" },
];

function viewFromPath(pathname: string): View {
  const segment = pathname.split("/").filter(Boolean)[0] ?? "dashboard";
  if (segment === "live") return "live";
  if (segment === "players") return "players";
  if (segment === "watchlist") return "watchlist";
  if (segment === "servers") return "servers";
  if (segment === "wipes") return "wipes";
  if (segment === "activity") return "activity";
  if (segment === "integrations") return "integrations";
  if (segment === "profile") return "profile";
  return "dashboard";
}

function isProfileTab(value: string): value is ProfileTab {
  return profileTabValues.includes(value as ProfileTab);
}

declare global {
  interface Window {
    __RUST_CONTROL_CONFIG__?: {
      API_BASE_URL?: string;
    };
  }
}

function defaultApiBaseUrl() {
  const configured = window.__RUST_CONTROL_CONFIG__?.API_BASE_URL?.trim();
  if (configured) return configured;

  const host = window.location.hostname;
  if (host === "localhost" || host === "127.0.0.1") {
    return "http://127.0.0.1:8080";
  }

  return window.location.origin;
}

const savedBaseUrl = localStorage.getItem("rustcp.baseUrl") ?? defaultApiBaseUrl();
const savedToken = localStorage.getItem("rustcp.accessToken") ?? "";

export default function App() {
  return (
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  );
}

function AppShell() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const [baseUrl, setBaseUrl] = useState(savedBaseUrl);
  const [accessToken, setAccessToken] = useState(savedToken);
  const api = useMemo(() => createApiClient(baseUrl, accessToken), [baseUrl, accessToken]);
  const activeView = viewFromPath(location.pathname);

  function saveSession(nextBaseUrl: string, token: string) {
    queryClient.clear();
    localStorage.setItem("rustcp.baseUrl", nextBaseUrl);
    localStorage.setItem("rustcp.accessToken", token);
    setBaseUrl(nextBaseUrl);
    setAccessToken(token);
    navigate("/", { replace: true });
  }

  function logout() {
    queryClient.clear();
    localStorage.removeItem("rustcp.accessToken");
    setAccessToken("");
    navigate("/", { replace: true });
  }

  function openPlayer(playerId: string) {
    if (playerId) navigate(`/players/${encodeURIComponent(playerId)}`);
  }

  function openServer(serverId: string) {
    if (serverId) navigate(`/servers/${encodeURIComponent(serverId)}`);
  }

  if (!accessToken) {
    return <LoginScreen baseUrl={baseUrl} onBaseUrl={setBaseUrl} onLogin={saveSession} />;
  }

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <aside className="flex w-full shrink-0 flex-col border-b border-border bg-background/82 px-3 py-4 backdrop-blur lg:sticky lg:top-0 lg:h-screen lg:w-[260px] lg:border-b-0 lg:border-r">
        <div className="mb-5 flex items-center gap-3 px-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-primary/35 bg-primary/15">
            <Crosshair className="h-5 w-5 text-primary" />
          </div>
          <div>
            <div className="text-sm font-semibold">Rust Control</div>
            <div className="text-xs text-muted-foreground">{baseUrl.replace(/^https?:\/\//, "")}</div>
          </div>
        </div>
        <nav className="grid grid-cols-2 gap-1 sm:grid-cols-4 lg:flex lg:flex-1 lg:flex-col">
          <NavButton active={activeView === "dashboard"} icon={<Radar />} label="Overview" onClick={() => navigate("/")} />
          <NavButton active={activeView === "live"} icon={<MapPinned />} label="Live" onClick={() => navigate("/live")} />
          <NavButton active={activeView === "players"} icon={<Users />} label="Players" onClick={() => navigate("/players")} />
          <NavButton active={activeView === "watchlist"} icon={<ShieldAlert />} label="Watchlist" onClick={() => navigate("/watchlist")} />
          <NavButton active={activeView === "servers"} icon={<Server />} label="Servers" onClick={() => navigate("/servers")} />
          <NavButton active={activeView === "wipes"} icon={<CalendarClock />} label="Wipes" onClick={() => navigate("/wipes")} />
          <NavButton active={activeView === "activity"} icon={<Activity />} label="Activity" onClick={() => navigate("/activity")} />
          <NavButton active={activeView === "integrations"} icon={<DatabaseZap />} label="Integrations" onClick={() => navigate("/integrations")} />
        </nav>
        <SidebarProfileFooter api={api} active={activeView === "profile"} onOpen={() => navigate("/profile")} onLogout={logout} />
      </aside>
      <main className="min-w-0 flex-1 px-4 py-4 sm:px-6 sm:py-5">
        <Routes>
          <Route path="/" element={<Dashboard api={api} onOpenPlayer={openPlayer} />} />
          <Route path="/live" element={<LiveView api={api} onOpenPlayer={openPlayer} />} />
          <Route path="/players" element={<PlayersView api={api} />} />
          <Route path="/players/:playerId" element={<PlayerRoute api={api} />} />
          <Route path="/watchlist" element={<WatchlistView api={api} onOpenPlayer={openPlayer} />} />
          <Route path="/servers" element={<ServersView api={api} onOpenPlayer={openPlayer} onOpenServer={openServer} />} />
          <Route path="/servers/:serverId" element={<ServerRoute api={api} onOpenPlayer={openPlayer} />} />
          <Route path="/wipes" element={<WipesView api={api} />} />
          <Route path="/activity" element={<ActivityView api={api} />} />
          <Route path="/integrations" element={<IntegrationsView api={api} baseUrl={baseUrl} />} />
          <Route path="/profile" element={<ProfileView api={api} baseUrl={baseUrl} accessToken={accessToken} onOpenPlayer={openPlayer} onOpenTab={(tab) => navigate(`/profile/${tab}`)} />} />
          <Route path="/profile/:tab" element={<ProfileRoute api={api} baseUrl={baseUrl} accessToken={accessToken} onOpenPlayer={openPlayer} />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}

function PlayerRoute({ api }: { api: ReturnType<typeof createApiClient> }) {
  const { playerId = "" } = useParams();
  return <PlayersView api={api} focusedPlayerId={playerId} />;
}

function ServerRoute({
  api,
  onOpenPlayer,
}: {
  api: ReturnType<typeof createApiClient>;
  onOpenPlayer: (playerId: string) => void;
}) {
  const { serverId = "" } = useParams();
  return <ServerDetailView api={api} serverId={serverId} onOpenPlayer={onOpenPlayer} />;
}

function ProfileRoute({
  api,
  baseUrl,
  accessToken,
  onOpenPlayer,
}: {
  api: ReturnType<typeof createApiClient>;
  baseUrl: string;
  accessToken: string;
  onOpenPlayer: (playerId: string) => void;
}) {
  const navigate = useNavigate();
  const { tab = "account" } = useParams();
  const activeTab = isProfileTab(tab) ? tab : "account";
  return <ProfileView api={api} baseUrl={baseUrl} accessToken={accessToken} initialTab={activeTab} onOpenPlayer={onOpenPlayer} onOpenTab={(nextTab) => navigate(`/profile/${nextTab}`)} />;
}

function SidebarProfileFooter({
  api,
  active,
  onOpen,
  onLogout,
}: {
  api: ReturnType<typeof createApiClient>;
  active: boolean;
  onOpen: () => void;
  onLogout: () => void;
}) {
  const profile = useQuery({ queryKey: ["myLiveContext"], queryFn: api.myLiveContext, refetchInterval: 30_000 });
  const steam = objectFrom(profile.data?.steam);
  const live = profile.data?.live_player;
  const avatarUrl = String(steam.avatar_url ?? "");
  const name = compactText(steam.persona_name ?? live?.display_name ?? "Operator");
  const subtitle = profile.data?.connected
    ? compactText(live?.server_name ?? live?.map_grid ?? steam.steam_id)
    : profile.isFetching
      ? "Loading profile"
      : "Steam not linked";

  return (
    <div className="grid gap-2 border-t border-border pt-3">
      <button
        className={`flex min-h-[68px] items-center gap-3 rounded-md border px-3 py-2 text-left transition-colors ${
          active ? "border-primary/45 bg-primary/15" : "border-border bg-background/45 hover:bg-secondary"
        }`}
        onClick={onOpen}
      >
        {avatarUrl ? (
          <img className="h-10 w-10 shrink-0 rounded-md border border-border object-cover" src={avatarUrl} />
        ) : (
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md border border-border bg-secondary">
            <UserCircle className="h-5 w-5 text-muted-foreground" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{name}</div>
          <div className="mt-1 truncate text-xs text-muted-foreground">{subtitle}</div>
        </div>
        <Badge variant={live?.is_online ? "success" : profile.data?.connected ? "secondary" : "outline"}>
          {live?.is_online ? "live" : profile.data?.connected ? "linked" : "setup"}
        </Badge>
      </button>
      <Button variant="ghost" className="justify-start" onClick={onLogout}>
        <LogOut className="h-4 w-4" />
        Logout
      </Button>
    </div>
  );
}

function LiveView({ api, onOpenPlayer }: { api: ReturnType<typeof createApiClient>; onOpenPlayer: (playerId: string) => void }) {
  const queryClient = useQueryClient();
  const [selectedServerKey, setSelectedServerKey] = useState("");
  const [steamConnectQuery, setSteamConnectQuery] = useState("");
  const myContext = useQuery({ queryKey: ["myLiveContext"], queryFn: api.myLiveContext, refetchInterval: 5_000 });
  const livePlayers = useQuery({ queryKey: ["livePlayers"], queryFn: api.livePlayers, refetchInterval: 5_000 });
  const alerts = useQuery({ queryKey: ["rustAlerts"], queryFn: api.alerts, refetchInterval: 5_000 });
  const health = useQuery({ queryKey: ["realtimeHealth"], queryFn: api.realtimeHealth, refetchInterval: 5_000 });
  const connectSteam = useMutation({
    mutationFn: () => api.connectMySteam(steamConnectQuery),
    onSuccess: () => {
      setSteamConnectQuery("");
      invalidateLiveControlContext();
    },
  });
  const promoteLiveMap = useMutation({
    mutationFn: ({ liveId, riskLevel }: { liveId: string; riskLevel?: QuickRiskLevel; open: boolean }) =>
      api.promoteLivePlayer(liveId, {
        watch: Boolean(riskLevel),
        risk_level: riskLevel ?? "watch",
        reason: riskLevel ? quickRiskReason("live map", riskLevel) : "Promoted from live map",
        labels: ["live-map"],
      }),
    onSuccess: (result, variables) => {
      invalidateLiveControlContext();
      if (variables.open && result.player?.id) {
        onOpenPlayer(result.player.id);
      }
    },
  });
  const watchLiveMap = useMutation({
    mutationFn: ({ playerId, riskLevel }: { playerId: string; riskLevel: QuickRiskLevel }) =>
      api.updatePlayerWatch(playerId, {
        watched: true,
        risk_level: riskLevel,
        reason: quickRiskReason("live map", riskLevel),
        labels: ["live-map"],
      }),
    onSuccess: () => invalidateLiveControlContext(),
  });
  const promoteDetectedTeam = useMutation({
    mutationFn: ({ liveId, riskLevel }: { liveId: string; riskLevel?: QuickRiskLevel; open: boolean }) =>
      api.promoteLivePlayer(liveId, {
        watch: Boolean(riskLevel),
        risk_level: riskLevel ?? "watch",
        reason: riskLevel ? quickRiskReason("detected team", riskLevel) : "Promoted from detected team",
        labels: ["detected-team"],
      }),
    onSuccess: (result, variables) => {
      invalidateLiveControlContext();
      if (variables.open && result.player?.id) {
        onOpenPlayer(result.player.id);
      }
    },
  });
  const watchDetectedTeam = useMutation({
    mutationFn: ({ playerId, riskLevel }: { playerId: string; riskLevel: QuickRiskLevel }) =>
      api.updatePlayerWatch(playerId, {
        watched: true,
        risk_level: riskLevel,
        reason: quickRiskReason("detected team", riskLevel),
        labels: ["detected-team"],
      }),
    onSuccess: () => invalidateLiveControlContext(),
  });
  const me = myContext.data?.live_player;
  const teammates = myContext.data?.teammates ?? [];
  const allLivePlayers = livePlayers.data?.items ?? [];
  const serverOptions = useMemo(() => {
    const byKey = new Map<string, { key: string; label: string; count: number; rustmapsUrl?: string }>();
    for (const player of allLivePlayers) {
      const key = player.battlemetrics_server_id || player.server_id || "unknown";
      const current = byKey.get(key) ?? { key, label: player.server_name || key, count: 0, rustmapsUrl: player.rustmaps_url };
      current.count += 1;
      if (!current.rustmapsUrl && player.rustmaps_url) current.rustmapsUrl = player.rustmaps_url;
      byKey.set(key, current);
    }
    return Array.from(byKey.values()).sort((a, b) => b.count - a.count);
  }, [allLivePlayers]);
  const myServerKey = me?.battlemetrics_server_id || me?.server_id || "";
  const autoServerKey = myServerKey || serverOptions[0]?.key || "";
  const effectiveServerKey = selectedServerKey === "__all__" ? "" : selectedServerKey || autoServerKey;
  const mapPlayers = effectiveServerKey
    ? allLivePlayers.filter((player) => (player.battlemetrics_server_id || player.server_id || "unknown") === effectiveServerKey)
    : allLivePlayers;
  const selectedServer = serverOptions.find((server) => server.key === effectiveServerKey);
  const autoServerLabel = myServerKey ? "My server" : "Top server";
  const selectedModeLabel = selectedServerKey === "__all__" ? "All live feed" : selectedServerKey ? compactText(selectedServer?.label ?? selectedServerKey) : autoServerLabel;
  const serverContext = useQuery({
    queryKey: ["serverLiveContext", effectiveServerKey],
    queryFn: () => api.serverLiveContext(effectiveServerKey),
    enabled: effectiveServerKey !== "" && effectiveServerKey !== "unknown",
    refetchInterval: 5_000,
  });
  const serverDetail = serverContext.data?.server;
  const liveMapItems = serverContext.data?.live_players?.length
    ? serverContext.data.live_players
    : mapPlayers.map((player) => ({ live_player: player }));
  const detectedTeamItems = teammates.map((player) => {
    const enriched = serverContext.data?.live_players?.find(
      (item) =>
        item.live_player.id === player.id ||
        (player.steam_id && item.live_player.steam_id === player.steam_id) ||
        (player.battlemetrics_player_id && item.live_player.battlemetrics_player_id === player.battlemetrics_player_id),
    );
    return enriched ?? { live_player: player };
  });
  const liveMapActionBusy = promoteLiveMap.isPending || watchLiveMap.isPending;
  const liveMapActionError = promoteLiveMap.error ?? watchLiveMap.error;
  const detectedTeamActionBusy = promoteDetectedTeam.isPending || watchDetectedTeam.isPending;
  const detectedTeamActionError = promoteDetectedTeam.error ?? watchDetectedTeam.error;

  function invalidateLiveControlContext() {
    queryClient.invalidateQueries({ queryKey: ["myLiveContext"] });
    queryClient.invalidateQueries({ queryKey: ["livePlayers"] });
    queryClient.invalidateQueries({ queryKey: ["rustAlerts"] });
    queryClient.invalidateQueries({ queryKey: ["watchlist"] });
    queryClient.invalidateQueries({ queryKey: ["overview"] });
    queryClient.invalidateQueries({ queryKey: ["serverLiveContext"] });
  }

  function liveMapCanAct(item: ServerLivePlayerItem) {
    return Boolean(item.player?.id || item.live_player.steam_id || item.live_player.battlemetrics_player_id);
  }

  function openOrPromoteFromLiveMap(item: ServerLivePlayerItem) {
    if (item.player?.id) {
      onOpenPlayer(item.player.id);
      return;
    }
    if (liveMapCanAct(item)) {
      promoteLiveMap.mutate({ liveId: item.live_player.id, open: true });
    }
  }

  function watchFromLiveMap(item: ServerLivePlayerItem, riskLevel: QuickRiskLevel = "watch") {
    if (item.player?.id) {
      watchLiveMap.mutate({ playerId: item.player.id, riskLevel });
      return;
    }
    if (liveMapCanAct(item)) {
      promoteLiveMap.mutate({ liveId: item.live_player.id, riskLevel, open: false });
    }
  }

  function openOrPromoteDetectedTeam(item: ServerLivePlayerItem) {
    if (item.player?.id) {
      onOpenPlayer(item.player.id);
      return;
    }
    if (liveMapCanAct(item)) {
      promoteDetectedTeam.mutate({ liveId: item.live_player.id, open: true });
    }
  }

  function watchFromDetectedTeam(item: ServerLivePlayerItem, riskLevel: QuickRiskLevel = "watch") {
    if (item.player?.id) {
      watchDetectedTeam.mutate({ playerId: item.player.id, riskLevel });
      return;
    }
    if (liveMapCanAct(item)) {
      promoteDetectedTeam.mutate({ liveId: item.live_player.id, riskLevel, open: false });
    }
  }

  return (
    <section className="grid gap-4">
      <Header title="Live Control" subtitle="Your Steam link, current server, team and live plugin/Rust+ feed" />
      <RealtimeHealthPanel health={health.data} loading={health.isFetching} compact />
      <AlertsPanel api={api} title="Watched Player Alerts" items={alerts.data?.items ?? []} loading={alerts.isFetching} onOpenPlayer={onOpenPlayer} />
      <div className="grid gap-4 xl:grid-cols-[420px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>My Current Server</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
              <Input
                value={steamConnectQuery}
                onChange={(event) => setSteamConnectQuery(event.target.value)}
                placeholder="SteamID or profile URL"
              />
              <Button onClick={() => connectSteam.mutate()} disabled={!steamConnectQuery || connectSteam.isPending}>
                {connectSteam.isPending ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Gamepad2 className="h-4 w-4" />}
                Connect Me
              </Button>
            </div>
            {connectSteam.data ? <StatusLine tone="ok" text={`Steam connected: ${compactText(connectSteam.data.steam_id)}`} /> : null}
            {connectSteam.error ? <StatusLine tone="bad" text={connectSteam.error.message} /> : null}
            {!myContext.data?.connected ? (
              <EmptyState label="Steam not connected" />
            ) : me ? (
              <div className="grid gap-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-lg font-semibold">{compactText(me.display_name)}</div>
                    <div className="text-xs text-muted-foreground">{compactText(me.steam_id)}</div>
                  </div>
                  <Badge variant={me.is_online ? "success" : "outline"}>{me.is_online ? "online" : "offline"}</Badge>
                </div>
                <CurrentServerFacts server={serverDetail} live={me} />
                <LiveFacts player={me} />
              </div>
            ) : (
              <div className="grid gap-3">
                <div className="rounded-md border border-border bg-background/50 p-3">
                  <div className="text-sm font-medium">{compactText(myContext.data?.steam?.persona_name ?? "Steam connected")}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{compactText(myContext.data?.steam?.steam_id)}</div>
                </div>
                <EmptyState label={compactText(myContext.data?.source_status ?? "No live plugin data")} />
              </div>
            )}
            {myContext.error ? <div className="mt-3 text-sm text-destructive">{myContext.error.message}</div> : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Detected Team</CardTitle>
          </CardHeader>
          <CardContent>
            {teammates.length ? (
              <div className="grid gap-2 md:grid-cols-2">
                {detectedTeamItems.map((item) => (
                  <ServerPlayerCard
                    key={item.live_player.id}
                    item={item}
                    busy={detectedTeamActionBusy}
                    canAct={liveMapCanAct(item)}
                    onOpenOrPromote={openOrPromoteDetectedTeam}
                    onWatch={watchFromDetectedTeam}
                  />
                ))}
              </div>
            ) : (
              <EmptyState label="Team evidence appears after Rust+/plugin snapshots" />
            )}
            {detectedTeamActionError ? <div className="mt-3"><StatusLine tone="bad" text={detectedTeamActionError.message} /></div> : null}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Online Map</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Badge variant={effectiveServerKey ? "success" : "outline"}>{selectedModeLabel}</Badge>
            <Button size="sm" variant={selectedServerKey === "" ? "default" : "secondary"} onClick={() => setSelectedServerKey("")}>
              {autoServerLabel}
            </Button>
            <Button size="sm" variant={selectedServerKey === "__all__" ? "default" : "secondary"} onClick={() => setSelectedServerKey("__all__")}>
              All live
            </Button>
            {serverOptions.map((server) => (
              <Button key={server.key} size="sm" variant={effectiveServerKey === server.key ? "default" : "secondary"} onClick={() => setSelectedServerKey(server.key)}>
                {compactText(server.label)} - {server.count}
              </Button>
            ))}
            {selectedServer?.rustmapsUrl ? (
              <a className="ml-auto text-sm text-primary underline-offset-4 hover:underline" href={selectedServer.rustmapsUrl} target="_blank" rel="noreferrer">
                Open RustMaps
              </a>
            ) : null}
          </div>
          <LiveMap
            items={liveMapItems}
            focusSteamId={me?.steam_id}
            teammateSteamIds={teammates.map((player) => player.steam_id ?? "")}
            onOpenPlayer={onOpenPlayer}
            onOpenOrPromote={openOrPromoteFromLiveMap}
            onWatch={watchFromLiveMap}
            canAct={liveMapCanAct}
            busy={liveMapActionBusy}
          />
          {liveMapActionError ? <div className="mt-3"><StatusLine tone="bad" text={liveMapActionError.message} /></div> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Live Players</CardTitle>
        </CardHeader>
        <CardContent>
          <ServerContextPanel
            api={api}
            context={serverContext.data}
            loading={serverContext.isFetching}
            fallbackPlayers={mapPlayers}
            onOpenPlayer={onOpenPlayer}
            onChanged={() => {
              void serverContext.refetch();
              void queryClient.invalidateQueries({ queryKey: ["livePlayers"] });
              void queryClient.invalidateQueries({ queryKey: ["rustAlerts"] });
              void queryClient.invalidateQueries({ queryKey: ["watchlist"] });
              void queryClient.invalidateQueries({ queryKey: ["overview"] });
            }}
          />
          {serverContext.error ? <div className="mt-3 text-sm text-destructive">{serverContext.error.message}</div> : null}
        </CardContent>
      </Card>
    </section>
  );
}

function CurrentServerFacts({ server, live }: { server?: ServerIntel | null; live?: LivePlayer }) {
  const name = server?.name || live?.server_name || "-";
  const serverKey = server?.battlemetrics_server_id || live?.battlemetrics_server_id || "";
  const address = server?.ip ? `${server.ip}:${compactText(server.port)}` : server?.address || "-";
  const rustmapsUrl = server?.rustmaps_url || live?.rustmaps_url || "";
  const battleMetricsUrl = battleMetricsServerUrl(serverKey);
  const updatedAt = server?.source_updated_at || server?.updated_at || live?.last_seen_at;

  return (
    <div className="rounded-md border border-border bg-background/50 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">{compactText(name)}</div>
          <div className="mt-1 truncate text-xs text-muted-foreground">{compactText(serverKey)}</div>
        </div>
        <div className="flex flex-wrap gap-1">
          <Badge variant={server?.status === "online" || live?.is_online ? "success" : "outline"}>{compactText(server?.status ?? (live?.is_online ? "online" : "unknown"))}</Badge>
          {server?.country ? <Badge variant="secondary">{compactText(server.country)}</Badge> : null}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <Fact label="Online" value={`${compactText(server?.players)} / ${compactText(server?.max_players)}`} />
        <Fact label="Rank" value={compactText(server?.rank)} />
        <Fact label="Address" value={address} wide />
        <Fact label="Query port" value={server?.port_query} />
        <Fact label="Type" value={server?.rust_type || server?.rust_map} />
        <Fact label="World" value={`${compactText(server?.rust_world_size)} / ${compactText(server?.rust_world_seed)}`} wide />
        <Fact label="Last wipe" value={formatDateTime(server?.last_wipe_at)} />
        <Fact label="Next wipe" value={formatDateTime(server?.next_wipe_at)} />
        <Fact label="Source" value={server?.source ?? live?.source} />
        <Fact label="Updated" value={formatDateTime(updatedAt)} />
      </div>

      <div className="mt-3 flex flex-wrap gap-3 text-sm">
        {rustmapsUrl ? (
          <a className="text-primary underline-offset-4 hover:underline" href={rustmapsUrl} target="_blank" rel="noreferrer">
            Open RustMaps
          </a>
        ) : null}
        {battleMetricsUrl ? (
          <a className="text-primary underline-offset-4 hover:underline" href={battleMetricsUrl} target="_blank" rel="noreferrer">
            Open BattleMetrics
          </a>
        ) : null}
      </div>
    </div>
  );
}

function LiveMap({
  items,
  focusSteamId,
  teammateSteamIds,
  onOpenPlayer,
  onOpenOrPromote,
  onWatch,
  canAct,
  busy,
}: {
  items: ServerLivePlayerItem[];
  focusSteamId?: string;
  teammateSteamIds: string[];
  onOpenPlayer?: (playerId: string) => void;
  onOpenOrPromote?: (item: ServerLivePlayerItem) => void;
  onWatch?: (item: ServerLivePlayerItem, riskLevel: QuickRiskLevel) => void;
  canAct?: (item: ServerLivePlayerItem) => boolean;
  busy?: boolean;
}) {
  const [searchText, setSearchText] = useState("");
  const [signalFilter, setSignalFilter] = useState<LiveMapFilter>("all");
  const teammateSet = useMemo(() => new Set(teammateSteamIds.filter(Boolean)), [teammateSteamIds]);
  const positioned = useMemo(() => items.filter((item) => hasMapPosition(item.live_player)), [items]);
  const focusItem = positioned.find((item) => focusSteamId && item.live_player.steam_id === focusSteamId);
  const centerX = focusItem
    ? mapCoordX(focusItem.live_player)
    : positioned.reduce((sum, item) => sum + mapCoordX(item.live_player), 0) / Math.max(1, positioned.length);
  const centerZ = focusItem
    ? mapCoordZ(focusItem.live_player)
    : positioned.reduce((sum, item) => sum + mapCoordZ(item.live_player), 0) / Math.max(1, positioned.length);
  const radius = Math.ceil(
    Math.max(
      250,
      ...positioned.flatMap((item) => [
        Math.abs(mapCoordX(item.live_player) - centerX),
        Math.abs(mapCoordZ(item.live_player) - centerZ),
      ]),
    ) * 1.18 / 100,
  ) * 100;
  const allRows = positioned
    .map((item) => {
      const isMe = Boolean(focusSteamId && item.live_player.steam_id === focusSteamId);
      const isTeammate = Boolean(item.live_player.steam_id && teammateSet.has(item.live_player.steam_id));
      return { item, isMe, isTeammate, distance: playerDistance(focusItem?.live_player, item.live_player) };
    })
    .sort((a, b) => {
      if (a.isMe !== b.isMe) return a.isMe ? -1 : 1;
      if (Boolean(a.item.watch?.watched) !== Boolean(b.item.watch?.watched)) return a.item.watch?.watched ? -1 : 1;
      return (a.distance ?? Number.POSITIVE_INFINITY) - (b.distance ?? Number.POSITIVE_INFINITY);
    });
  const focusGrid = focusItem?.live_player.map_grid ?? "";
  const rows = allRows.filter((row) => liveMapFilterMatches(row, signalFilter, focusGrid) && liveMapSearchMatches(row.item, searchText));
  const mapStats = liveMapStats(allRows, rows, focusGrid);

  if (!positioned.length) {
    return <EmptyState label={`${items.length} live players, no realtime positions yet`} />;
  }

  return (
    <div className="grid gap-3">
      <div className="rounded-md border border-border bg-background/45 p-3">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-sm font-medium">Map Hunt</div>
            <div className="text-xs text-muted-foreground">Search live positions by identity, team, grid, source, or risk</div>
          </div>
          <Badge variant="outline">{rows.length} / {allRows.length} shown</Badge>
        </div>
        <div className="mb-3 flex flex-wrap gap-2">
          <WatchlistSummaryPill label="Positioned" value={mapStats.positioned} variant={mapStats.positioned ? "success" : "outline"} />
          <WatchlistSummaryPill label="Watched" value={mapStats.watched} variant={mapStats.watched ? "danger" : "outline"} />
          <WatchlistSummaryPill label="Team" value={mapStats.team} variant={mapStats.team ? "success" : "outline"} />
          <WatchlistSummaryPill label="150m" value={mapStats.near150} variant={mapStats.near150 ? "warning" : "outline"} />
          <WatchlistSummaryPill label="400m" value={mapStats.near400} variant={mapStats.near400 ? "warning" : "outline"} />
          <WatchlistSummaryPill label="Same grid" value={mapStats.sameGrid} variant={mapStats.sameGrid ? "warning" : "outline"} />
          <WatchlistSummaryPill label="Online" value={mapStats.online} variant={mapStats.online ? "success" : "outline"} />
          <WatchlistSummaryPill label="Shown" value={mapStats.shown} variant="outline" />
        </div>
        <div className="grid gap-2 xl:grid-cols-[1fr_auto]">
          <Input
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
            placeholder="Search map by name, SteamID, BattleMetricsID, team, clan, grid, source"
          />
          <div className="flex flex-wrap gap-2">
            {(["all", "watched", "hostile", "suspect", "team", "near150", "near400", "same_grid", "online", "clear"] as LiveMapFilter[]).map((filter) => (
              <Button key={filter} size="sm" variant={signalFilter === filter ? "default" : "secondary"} onClick={() => setSignalFilter(filter)}>
                {liveMapFilterLabel(filter)}
              </Button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-4 2xl:grid-cols-[minmax(360px,1fr)_minmax(0,390px)]">
      <div className="relative aspect-square min-h-[320px] overflow-hidden rounded-md border border-border bg-[linear-gradient(90deg,rgba(255,255,255,0.055)_1px,transparent_1px),linear-gradient(180deg,rgba(255,255,255,0.055)_1px,transparent_1px),linear-gradient(135deg,rgba(41,80,67,0.42),rgba(31,37,45,0.94)_55%,rgba(104,55,42,0.42))] bg-[length:10%_10%,10%_10%,100%_100%] sm:min-h-[420px]">
        <div className="absolute left-1/2 top-0 h-full w-px bg-border/80" />
        <div className="absolute left-0 top-1/2 h-px w-full bg-border/80" />
        <div className="absolute left-1/2 top-1/2 h-1/4 w-1/4 -translate-x-1/2 -translate-y-1/2 rounded-full border border-border/70" />
        <div className="absolute left-1/2 top-1/2 h-1/2 w-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-border/50" />
        <div className="absolute left-1/2 top-1/2 h-3/4 w-3/4 -translate-x-1/2 -translate-y-1/2 rounded-full border border-border/30" />
        {rows.map(({ item, isMe, isTeammate, distance }) => {
          const live = item.live_player;
          const itemCanAct = canAct?.(item) ?? Boolean(item.player?.id);
          const x = 50 + ((mapCoordX(live) - centerX) / radius) * 50;
          const y = 50 - ((mapCoordZ(live) - centerZ) / radius) * 50;
          return (
            <button
              key={live.id}
              type="button"
              className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full border border-background shadow-[0_0_0_3px_rgba(255,255,255,0.08)] transition-transform hover:scale-125 disabled:cursor-default ${radarPointClass(item, isMe, isTeammate)}`}
              style={{ left: `${Math.max(1, Math.min(99, x))}%`, top: `${Math.max(1, Math.min(99, y))}%` }}
              title={`${compactText(item.player?.display_name ?? live.display_name)} - ${formatRange(distance, isMe)} - ${compactText(live.map_grid)} - ${Math.round(mapCoordX(live))}, ${Math.round(mapCoordZ(live))}`}
              onClick={() => {
                if (onOpenOrPromote && itemCanAct) {
                  onOpenOrPromote(item);
                } else if (item.player?.id) {
                  onOpenPlayer?.(item.player.id);
                }
              }}
              disabled={!itemCanAct && !item.player?.id}
            >
              <span className="sr-only">{compactText(item.player?.display_name ?? live.display_name)}</span>
            </button>
          );
        })}
        <div className="absolute left-3 top-3 flex flex-wrap gap-2 rounded-md border border-border bg-background/82 px-2 py-1 text-xs text-muted-foreground backdrop-blur">
          <span>{focusItem ? "centered on you" : "centered on live cluster"}</span>
          <span>radius {formatMeters(radius)}</span>
          <span>{positioned.length}/{items.length} positioned</span>
        </div>
        <div className="absolute bottom-3 left-3 flex flex-wrap gap-2 rounded-md border border-border bg-background/82 px-2 py-1 text-xs text-muted-foreground backdrop-blur">
          <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-primary" /> me</span>
          <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-destructive" /> watched</span>
          <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-emerald-400" /> team</span>
          <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-amber-300" /> other</span>
        </div>
        {!rows.length ? (
          <div className="absolute inset-x-3 top-1/2 -translate-y-1/2 rounded-md border border-border bg-background/86 p-3 text-center text-sm text-muted-foreground backdrop-blur">
            No positioned players match current map filters
          </div>
        ) : null}
      </div>
      <div className="max-h-[520px] min-w-0 overflow-auto rounded-md border border-border">
        <Table>
          <thead>
            <tr>
              <Th>Player</Th>
              <Th>Range</Th>
              <Th>Signal</Th>
              <Th>Grid</Th>
              <Th>HP</Th>
              <Th></Th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ item, isMe, isTeammate, distance }) => {
              const live = item.live_player;
              const itemCanAct = canAct?.(item) ?? Boolean(item.player?.id);
              return (
              <tr key={live.id}>
                <Td>
                  <div className="max-w-[170px] truncate font-medium">{compactText(item.player?.display_name ?? live.display_name)}</div>
                  <div className="text-xs text-muted-foreground">
                    {Math.round(mapCoordX(live))} / {Math.round(mapCoordZ(live))}
                  </div>
                </Td>
                <Td>{formatRange(distance, isMe)}</Td>
                <Td>
                  <Badge variant={radarSignalVariant(item, isMe, isTeammate)}>{radarSignalLabel(item, isMe, isTeammate)}</Badge>
                </Td>
                <Td>{compactText(live.map_grid)}</Td>
                <Td>{compactText(live.health)}</Td>
                <Td className="text-right">
                  <div className="flex justify-end gap-2">
                    {onWatch && !item.watch?.watched ? (
                      <QuickRiskActions busy={busy} canAct={itemCanAct} onSelect={(level) => onWatch(item, level)} />
                    ) : null}
                    {onOpenOrPromote ? (
                      <Button size="sm" variant="secondary" onClick={() => onOpenOrPromote(item)} disabled={!itemCanAct || busy}>
                        {item.player?.id ? "Intel" : "Promote"}
                      </Button>
                    ) : item.player?.id ? (
                      <Button size="sm" variant="secondary" onClick={() => onOpenPlayer?.(item.player?.id ?? "")}>
                        Intel
                      </Button>
                    ) : (
                      <Badge variant="outline">live</Badge>
                    )}
                  </div>
                </Td>
              </tr>
              );
            })}
          </tbody>
        </Table>
        {!rows.length ? <EmptyState label="No positioned players match current map filters" /> : null}
      </div>
      </div>
    </div>
  );
}

function liveMapStats(
  allRows: Array<{ item: ServerLivePlayerItem; isMe: boolean; isTeammate: boolean; distance?: number }>,
  shownRows: Array<{ item: ServerLivePlayerItem; isTeammate: boolean }>,
  focusGrid: string,
) {
  return {
    positioned: allRows.length,
    watched: allRows.filter((row) => row.item.watch?.watched).length,
    team: allRows.filter((row) => row.isTeammate).length,
    near150: allRows.filter((row) => !row.isMe && typeof row.distance === "number" && row.distance <= 150).length,
    near400: allRows.filter((row) => !row.isMe && typeof row.distance === "number" && row.distance <= 400).length,
    sameGrid: allRows.filter((row) => !row.isMe && focusGrid && row.item.live_player.map_grid === focusGrid).length,
    online: allRows.filter((row) => row.item.live_player.is_online).length,
    shown: shownRows.length,
  };
}

function liveMapFilterMatches(
  row: { item: ServerLivePlayerItem; isMe: boolean; isTeammate: boolean; distance?: number },
  filter: LiveMapFilter,
  focusGrid: string,
) {
  const item = row.item;
  if (filter === "all") return true;
  if (filter === "watched") return Boolean(item.watch?.watched);
  if (filter === "team") return row.isTeammate;
  if (filter === "near150") return !row.isMe && typeof row.distance === "number" && row.distance <= 150;
  if (filter === "near400") return !row.isMe && typeof row.distance === "number" && row.distance <= 400;
  if (filter === "same_grid") return !row.isMe && Boolean(focusGrid) && item.live_player.map_grid === focusGrid;
  if (filter === "online") return Boolean(item.live_player.is_online);
  if (filter === "clear") return !item.watch?.watched;
  return item.watch?.risk_level === filter;
}

function liveMapFilterLabel(filter: LiveMapFilter) {
  if (filter === "all") return "All map";
  if (filter === "watched") return "Watched";
  if (filter === "team") return "Team";
  if (filter === "near150") return "150m";
  if (filter === "near400") return "400m";
  if (filter === "same_grid") return "Same grid";
  if (filter === "online") return "Online";
  if (filter === "clear") return "Clear";
  return riskActionLabel(filter);
}

function liveMapSearchMatches(item: ServerLivePlayerItem, searchText: string) {
  const search = searchText.trim().toLowerCase();
  if (!search) return true;
  const live = item.live_player;
  return [
    item.player?.display_name,
    item.player?.name,
    item.player?.steam_id,
    item.player?.battlemetrics_player_id,
    live.display_name,
    live.steam_id,
    live.battlemetrics_player_id,
    live.server_name,
    live.battlemetrics_server_id,
    live.team_id,
    live.clan_tag,
    live.map_grid,
    live.source,
    item.watch?.risk_level,
    item.watch?.reason,
    item.watch?.note,
  ]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(search));
}

function hasMapPosition(player: LivePlayer) {
  return typeof player.position?.x === "number" && typeof player.position?.z === "number";
}

function mapCoordX(player: LivePlayer) {
  return typeof player.position?.x === "number" ? player.position.x : 0;
}

function mapCoordY(player: LivePlayer) {
  return typeof player.position?.y === "number" ? player.position.y : 0;
}

function mapCoordZ(player: LivePlayer) {
  return typeof player.position?.z === "number" ? player.position.z : 0;
}

function playerDistance(from?: LivePlayer, to?: LivePlayer) {
  if (!from || !to || !hasMapPosition(from) || !hasMapPosition(to)) return undefined;
  const dx = mapCoordX(to) - mapCoordX(from);
  const dy = mapCoordY(to) - mapCoordY(from);
  const dz = mapCoordZ(to) - mapCoordZ(from);
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function formatRange(distance: number | undefined, isMe?: boolean) {
  if (isMe) return "you";
  return formatMeters(distance);
}

function radarPointClass(item: ServerLivePlayerItem, isMe: boolean, isTeammate: boolean) {
  if (isMe) return "h-5 w-5 bg-primary ring-4 ring-primary/25";
  if (item.watch?.watched) return "h-4 w-4 bg-destructive ring-4 ring-destructive/25";
  if (isTeammate) return "h-4 w-4 bg-emerald-400 ring-4 ring-emerald-400/20";
  return "h-3.5 w-3.5 bg-amber-300";
}

function radarSignalVariant(item: ServerLivePlayerItem, isMe: boolean, isTeammate: boolean) {
  if (isMe) return "default";
  if (item.watch?.watched) return riskBadgeVariant(item.watch.risk_level);
  if (isTeammate) return "success";
  return item.live_player.is_online ? "secondary" : "outline";
}

function radarSignalLabel(item: ServerLivePlayerItem, isMe: boolean, isTeammate: boolean) {
  if (isMe) return "me";
  if (item.watch?.watched) return compactText(item.watch.risk_level);
  if (isTeammate) return "team";
  return item.live_player.is_online ? "online" : "recent";
}

function LoginScreen({
  baseUrl,
  onBaseUrl,
  onLogin,
}: {
  baseUrl: string;
  onBaseUrl: (value: string) => void;
  onLogin: (baseUrl: string, token: string) => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [totp, setTotp] = useState("");
  const [totpRequired, setTotpRequired] = useState(false);
  const loginApi = useMemo(() => createApiClient(baseUrl), [baseUrl]);
  const login = useMutation({
    mutationFn: () => loginApi.login(email, password, totp),
    onSuccess: (result) => {
      const token = result.tokens?.access_token;
      if (token) {
        setTotpRequired(false);
        onLogin(baseUrl, token);
        return;
      }
      setTotpRequired(Boolean(result.totp_required));
    },
    onError: () => setTotpRequired(false),
  });

  return (
    <div className="grid min-h-screen place-items-center px-4">
      <Card className="w-full max-w-[460px]">
        <CardHeader>
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-lg border border-primary/35 bg-primary/15">
            <Gamepad2 className="h-5 w-5 text-primary" />
          </div>
          <CardTitle>Rust Control Panel</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              login.mutate();
            }}
          >
            <Input value={baseUrl} onChange={(event) => onBaseUrl(event.target.value)} />
            <Input type="email" placeholder="admin@email" value={email} onChange={(event) => setEmail(event.target.value)} />
            <Input type="password" placeholder="password" value={password} onChange={(event) => setPassword(event.target.value)} />
            <Input placeholder={totpRequired ? "2FA code required" : "2FA"} value={totp} onChange={(event) => setTotp(event.target.value)} />
            {totpRequired ? <StatusLine tone="ok" text="Two-factor code required. Enter the current 2FA code and log in again." /> : null}
            {login.error ? <div className="text-sm text-destructive">{login.error.message}</div> : null}
            <Button type="submit" disabled={login.isPending}>
              {login.isPending ? <RefreshCw className="h-4 w-4 animate-spin" /> : <ShieldAlert className="h-4 w-4" />}
              Login
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function AlertsPanel({
  api,
  title,
  items,
  loading,
  onOpenPlayer,
}: {
  api: ReturnType<typeof createApiClient>;
  title: string;
  items: RustAlertItem[];
  loading: boolean;
  onOpenPlayer?: (playerId: string) => void;
}) {
  const queryClient = useQueryClient();
  const [severityFilter, setSeverityFilter] = useState<AlertSeverityFilter>("all");
  const [scopeFilter, setScopeFilter] = useState<AlertScopeFilter>("all");
  const filteredItems = useMemo(
    () => items.filter((item) => alertSeverityMatches(item, severityFilter) && alertScopeMatches(item, scopeFilter)),
    [items, scopeFilter, severityFilter],
  );
  const stats = useMemo(() => alertStats(items), [items]);
  const updateRisk = useMutation({
    mutationFn: ({ playerId, riskLevel }: { playerId: string; riskLevel: QuickRiskLevel }) =>
      api.updatePlayerWatch(playerId, {
        watched: true,
        risk_level: riskLevel,
        reason: quickRiskReason("alert center", riskLevel),
        labels: ["alert"],
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rustAlerts"] });
      queryClient.invalidateQueries({ queryKey: ["watchlist"] });
      queryClient.invalidateQueries({ queryKey: ["overview"] });
      queryClient.invalidateQueries({ queryKey: ["livePlayers"] });
      queryClient.invalidateQueries({ queryKey: ["playerIntel"] });
      queryClient.invalidateQueries({ queryKey: ["playerNetwork"] });
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-3">
          <span>{title}</span>
          <Badge variant={items.length ? "danger" : "outline"}>{items.length} active</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {items.length ? (
          <div className="grid gap-3">
            <div className="grid gap-2 lg:grid-cols-[1fr_auto_auto]">
              <div className="grid gap-2 md:grid-cols-4">
                <WatchlistSummaryPill label="Critical" value={stats.critical} variant="danger" />
                <WatchlistSummaryPill label="Warning" value={stats.warning} variant="warning" />
                <WatchlistSummaryPill label="Same server" value={stats.sameServer} variant="danger" />
                <WatchlistSummaryPill label="Near" value={stats.near} variant="warning" />
              </div>
              <div className="flex flex-wrap gap-1">
                {(["all", "critical", "warning", "info"] as AlertSeverityFilter[]).map((level) => (
                  <Button key={level} size="sm" variant={severityFilter === level ? "default" : "secondary"} onClick={() => setSeverityFilter(level)}>
                    {level === "all" ? "All severity" : level}
                  </Button>
                ))}
              </div>
              <div className="flex flex-wrap gap-1">
                {(["all", "same_server", "near", "online"] as AlertScopeFilter[]).map((scope) => (
                  <Button key={scope} size="sm" variant={scopeFilter === scope ? "default" : "secondary"} onClick={() => setScopeFilter(scope)}>
                    {alertScopeLabel(scope)}
                  </Button>
                ))}
              </div>
            </div>
            {updateRisk.error ? <StatusLine tone="bad" text={updateRisk.error.message} /> : null}
            <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
              {filteredItems.slice(0, 9).map((item) => (
                <AlertCard
                  key={`${item.alert_type}-${item.player.id ?? item.player.steam_id ?? item.live_player?.id}`}
                  item={item}
                  busy={updateRisk.isPending}
                  onOpenPlayer={onOpenPlayer}
                  onRisk={(riskLevel) => {
                    const playerId = item.player.id ?? item.watch?.player_id;
                    if (playerId) updateRisk.mutate({ playerId, riskLevel });
                  }}
                />
              ))}
            </div>
            {!filteredItems.length ? <EmptyState label="No alerts match current filters" /> : null}
          </div>
        ) : (
          <EmptyState label={loading ? "Loading alerts" : "No watched players online"} />
        )}
      </CardContent>
    </Card>
  );
}

function AlertCard({
  item,
  busy,
  onOpenPlayer,
  onRisk,
}: {
  item: RustAlertItem;
  busy?: boolean;
  onOpenPlayer?: (playerId: string) => void;
  onRisk?: (riskLevel: QuickRiskLevel) => void;
}) {
  const watch = item.watch;
  const playerId = item.player.id ?? watch?.player_id;
  const proximityLabel = alertProximityLabel(item);
  return (
    <div className="rounded-md border border-border bg-background/55 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate font-semibold">{compactText(item.player.display_name ?? item.player.name ?? item.live_player?.display_name)}</div>
          <div className="text-xs text-muted-foreground">{compactText(item.player.steam_id ?? item.live_player?.steam_id ?? item.player.battlemetrics_player_id)}</div>
        </div>
        <Badge variant={alertSeverityVariant(item.severity)}>{compactText(item.alert_type)}</Badge>
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        <Badge variant={watch ? riskBadgeVariant(watch.risk_level) : "outline"}>{watch ? compactText(watch.risk_level) : "untracked"}</Badge>
        {proximityLabel ? <Badge variant={proximityBadgeVariant(item.proximity_status)}>{proximityLabel}</Badge> : null}
        <Badge variant={item.live_player?.is_online ? "success" : "outline"}>{item.live_player?.is_online ? "online" : "recent"}</Badge>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <Fact label="Server" value={compactText(item.current_server?.name ?? item.live_player?.server_name)} wide />
        <Fact label="Grid" value={compactText(item.live_player?.map_grid)} />
        <Fact label="Team" value={compactText(item.live_player?.team_id)} />
        <Fact label="Distance" value={item.same_server_as_me ? formatMeters(item.distance_to_me) : "-"} />
        <Fact label="My grid" value={compactText(item.my_live?.map_grid)} />
      </div>
      <div className="mt-2 truncate text-xs text-muted-foreground">{compactText(watch?.reason ?? watch?.note)}</div>
      <div className="mt-3 flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">{formatDateTime(item.live_player?.last_seen_at)}</span>
        <div className="flex flex-wrap justify-end gap-2">
          {onRisk ? <QuickRiskActions busy={busy} canAct={Boolean(playerId)} onSelect={onRisk} /> : null}
          {onOpenPlayer ? (
            <Button size="sm" variant="secondary" onClick={() => onOpenPlayer(playerId)} disabled={!playerId || busy}>
              Intel
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Dashboard({ api, onOpenPlayer }: { api: ReturnType<typeof createApiClient>; onOpenPlayer: (playerId: string) => void }) {
  const overview = useQuery({ queryKey: ["overview"], queryFn: api.overview, refetchInterval: 30_000 });
  const alerts = useQuery({ queryKey: ["rustAlerts"], queryFn: api.alerts, refetchInterval: 5_000 });
  const integrations = useQuery({ queryKey: ["integrations"], queryFn: api.integrations });
  const health = useQuery({ queryKey: ["realtimeHealth"], queryFn: api.realtimeHealth, refetchInterval: 5_000 });
  const data = overview.data ?? {};

  return (
    <section className="grid gap-4">
      <Header title="Overview" subtitle="Servers, players, realtime and source health" />
      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard label="Tracked servers" value={data.tracked_servers} icon={<Server />} />
        <MetricCard label="Known players" value={data.known_players} icon={<Users />} />
        <MetricCard label="Team edges" value={data.team_edges} icon={<Crosshair />} />
        <MetricCard label="Watched online" value={data.watched_online} icon={<ShieldAlert />} />
      </div>
      <AlertsPanel api={api} title="Realtime Alerts" items={alerts.data?.items ?? []} loading={alerts.isFetching} onOpenPlayer={onOpenPlayer} />
      <RealtimeHealthPanel health={health.data} loading={health.isFetching} />
      <Card>
        <CardHeader>
          <CardTitle>Source Health</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-4">
          {integrations.data?.providers.map((provider) => (
            <div key={provider.provider} className="rounded-md border border-border bg-background/50 p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium">{provider.provider}</span>
                <Badge variant={provider.configured || provider.public_mode ? "success" : "outline"}>
                  {provider.configured ? "configured" : provider.public_mode ? "public" : "missing"}
                </Badge>
              </div>
              <div className="text-xs leading-5 text-muted-foreground">{provider.use}</div>
            </div>
          ))}
          {overview.error ? <div className="text-sm text-destructive">{overview.error.message}</div> : null}
        </CardContent>
      </Card>
    </section>
  );
}

function RealtimeHealthPanel({ health, loading, compact = false }: { health?: RealtimeHealth; loading: boolean; compact?: boolean }) {
  const counts = health?.counts ?? {};
  const sources = health?.sources ?? [];
  const servers = health?.servers ?? [];
  const recentEvents = health?.recent_events ?? [];
  const shownServers = servers.slice(0, compact ? 4 : 8);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center justify-between gap-2">
          Realtime Health
          <Badge variant={healthStatusVariant(health?.status)}>{compactText(health?.status ?? (loading ? "loading" : "no data"))}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid gap-2 md:grid-cols-4">
          <Fact label="Live online" value={counts.live_online} />
          <Fact label="Recent live" value={counts.live_recent_5m} />
          <Fact label="Events 5m" value={counts.events_5m} />
          <Fact label="Watched online" value={counts.watched_online} />
        </div>

        <div className="grid gap-3 xl:grid-cols-[0.9fr_1.2fr]">
          <div className="rounded-md border border-border bg-background/50 p-3">
            <div className="mb-2 text-sm font-medium">Sources</div>
            <div className="grid gap-2">
              {sources.slice(0, compact ? 3 : 6).map((source) => (
                <div key={String(source.source)} className="grid grid-cols-[1fr_auto] gap-2 border-b border-border pb-2 last:border-0 last:pb-0">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{compactText(source.source)}</div>
                    <div className="text-xs text-muted-foreground">
                      {compactText(source.online_players)} online / {compactText(source.events_5m)} events
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge variant={healthStatusVariant(String(source.status ?? ""))}>{compactText(source.status)}</Badge>
                    <span className="text-xs text-muted-foreground">{formatDateTime(String(source.last_seen_at ?? source.last_event_at ?? ""))}</span>
                  </div>
                </div>
              ))}
              {!sources.length ? <EmptyState label={loading ? "Loading source health" : "No realtime sources yet"} /> : null}
            </div>
          </div>

          <div className="rounded-md border border-border bg-background/50 p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="text-sm font-medium">Server Feed</div>
              <Badge variant="outline">{compactText(counts.live_servers)} live servers</Badge>
            </div>
            <div className="overflow-auto">
              <Table>
                <thead>
                  <tr>
                    <Th>Server</Th>
                    <Th>Status</Th>
                    <Th>Live</Th>
                    <Th>Teams</Th>
                    <Th>Last</Th>
                  </tr>
                </thead>
                <tbody>
                  {shownServers.map((server) => (
                    <tr key={String(server.id ?? server.battlemetrics_server_id)}>
                      <Td>
                        <div className="max-w-[320px] truncate font-medium">{compactText(server.name)}</div>
                        <div className="text-xs text-muted-foreground">{compactText(server.battlemetrics_server_id)}</div>
                      </Td>
                      <Td>
                        <Badge variant={healthStatusVariant(String(server.status ?? ""))}>{compactText(server.status)}</Badge>
                      </Td>
                      <Td>
                        {compactText(server.online_players)} / {compactText(server.known_live_players)}
                        {Number(server.watched_players ?? 0) > 0 ? <div className="text-xs text-destructive">{compactText(server.watched_players)} watched</div> : null}
                      </Td>
                      <Td>{compactText(server.teams)}</Td>
                      <Td>{formatDateTime(String(server.last_live_at ?? server.last_event_at ?? ""))}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
              {!shownServers.length ? <EmptyState label={loading ? "Loading server feed" : "No tracked server feed yet"} /> : null}
            </div>
          </div>
        </div>

        {!compact && recentEvents.length ? (
          <div className="rounded-md border border-border bg-background/50 p-3">
            <div className="mb-2 text-sm font-medium">Recent Feed Events</div>
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {recentEvents.slice(0, 6).map((event) => (
                <div key={String(event.id)} className="rounded-md border border-border p-2">
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant={timelineSeverityVariant(String(event.severity ?? ""))}>{compactText(event.source)}</Badge>
                    <span className="text-xs text-muted-foreground">{formatDateTime(String(event.occurred_at ?? ""))}</span>
                  </div>
                  <div className="mt-2 truncate text-sm font-medium">{compactText(event.event_type)}</div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function PlayersView({ api, focusedPlayerId }: { api: ReturnType<typeof createApiClient>; focusedPlayerId?: string }) {
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const [selectedLocalPlayerId, setSelectedLocalPlayerId] = useState("");
  const [selectedBattleMetricsId, setSelectedBattleMetricsId] = useState("");
  const resolve = useMutation({
    mutationFn: () => api.resolvePlayer(query),
    onSuccess: (result) => {
      if (result.local_player?.id) {
        setSelectedLocalPlayerId(result.local_player.id);
      }
    },
  });
  const search = useMutation({ mutationFn: () => api.searchPlayers(query) });
  const connect = useMutation({ mutationFn: () => api.connectMySteam(query) });
  const localMatches = resolve.data?.local_matches ?? search.data?.local_items ?? [];
  const liveMatches = search.data?.live_items ?? [];
  const selectedLocalPlayer = localMatches.find((player) => player.id === selectedLocalPlayerId) ?? resolve.data?.local_player;
  const localPlayerId = selectedLocalPlayerId || resolve.data?.local_player?.id || "";
  const intel = useQuery({
    queryKey: ["playerIntel", localPlayerId],
    queryFn: () => api.playerIntel(localPlayerId),
    enabled: localPlayerId.length > 0,
    refetchInterval: 5_000,
  });
  const sessionBattleMetricsId =
    selectedBattleMetricsId ||
    selectedLocalPlayer?.battlemetrics_player_id ||
    resolve.data?.local_player?.battlemetrics_player_id ||
    intel.data?.player.battlemetrics_player_id ||
    "";
  const sessions = useQuery({
    queryKey: ["sessions", sessionBattleMetricsId],
    queryFn: () => api.playerSessions(sessionBattleMetricsId),
    enabled: sessionBattleMetricsId.length > 0,
  });
  const dossier = useQuery({
    queryKey: ["playerDossier", localPlayerId],
    queryFn: () => api.playerDossier(localPlayerId),
    enabled: localPlayerId.length > 0,
    refetchInterval: 15_000,
  });
  const relations = useQuery({
    queryKey: ["playerRelations", localPlayerId],
    queryFn: () => api.playerRelations(localPlayerId),
    enabled: localPlayerId.length > 0,
    refetchInterval: 5_000,
  });
  const network = useQuery({
    queryKey: ["playerNetwork", localPlayerId],
    queryFn: () => api.playerNetwork(localPlayerId),
    enabled: localPlayerId.length > 0,
    refetchInterval: 5_000,
  });
  const serverHistory = useQuery({
    queryKey: ["playerServerHistory", localPlayerId],
    queryFn: () => api.playerServerHistory(localPlayerId),
    enabled: localPlayerId.length > 0,
    refetchInterval: 10_000,
  });
  const positionTrail = useQuery({
    queryKey: ["playerPositionTrail", localPlayerId],
    queryFn: () => api.playerPositionTrail(localPlayerId),
    enabled: localPlayerId.length > 0,
    refetchInterval: 10_000,
  });
  const timeline = useQuery({
    queryKey: ["playerTimeline", localPlayerId],
    queryFn: () => api.playerTimeline(localPlayerId),
    enabled: localPlayerId.length > 0,
    refetchInterval: 10_000,
  });
  const players = resolve.data?.battlemetrics ?? search.data?.items ?? [];
  const profile = resolve.data?.steam_profile as Record<string, unknown> | null | undefined;
  const likelyTeammates = intel.data?.likely_teammates ?? [];
  const teamEvidence = intel.data?.team_evidence ?? [];
  const relationItems = relations.data?.items ?? [];
  const promoteLiveSearch = useMutation({
    mutationFn: ({ liveId, riskLevel }: { liveId: string; riskLevel?: QuickRiskLevel; open: boolean }) =>
      api.promoteLivePlayer(liveId, {
        watch: Boolean(riskLevel),
        risk_level: riskLevel ?? "watch",
        reason: riskLevel ? quickRiskReason("live search", riskLevel) : "Promoted from live search",
        labels: ["live-search"],
      }),
    onSuccess: (result, variables) => {
      if (result.player?.id) {
        invalidatePlayerSearchState(result.player.id);
        if (variables.open) {
          setSelectedLocalPlayerId(result.player.id);
          setSelectedBattleMetricsId(result.player.battlemetrics_player_id ?? "");
        }
      } else {
        invalidatePlayerSearchState();
      }
    },
  });
  const watchLiveSearch = useMutation({
    mutationFn: ({ playerId, riskLevel }: { playerId: string; riskLevel: QuickRiskLevel }) =>
      api.updatePlayerWatch(playerId, {
        watched: true,
        risk_level: riskLevel,
        reason: quickRiskReason("live search", riskLevel),
        labels: ["live-search"],
      }),
    onSuccess: (_watch, variables) => invalidatePlayerSearchState(variables.playerId),
  });

  function invalidatePlayerSearchState(playerId?: string) {
    queryClient.invalidateQueries({ queryKey: ["rustAlerts"] });
    queryClient.invalidateQueries({ queryKey: ["watchlist"] });
    queryClient.invalidateQueries({ queryKey: ["overview"] });
    queryClient.invalidateQueries({ queryKey: ["livePlayers"] });
    if (query) search.mutate();
    if (playerId) {
      queryClient.invalidateQueries({ queryKey: ["playerIntel", playerId] });
      queryClient.invalidateQueries({ queryKey: ["playerDossier", playerId] });
      queryClient.invalidateQueries({ queryKey: ["playerRelations", playerId] });
      queryClient.invalidateQueries({ queryKey: ["playerNetwork", playerId] });
      queryClient.invalidateQueries({ queryKey: ["playerServerHistory", playerId] });
      queryClient.invalidateQueries({ queryKey: ["playerPositionTrail", playerId] });
      queryClient.invalidateQueries({ queryKey: ["playerTimeline", playerId] });
    }
  }

  function openLiveSearchItem(item: ServerLivePlayerItem) {
    if (item.player?.id) {
      setSelectedLocalPlayerId(item.player.id);
      setSelectedBattleMetricsId(item.player.battlemetrics_player_id ?? "");
      return;
    }
    if (item.live_player.steam_id || item.live_player.battlemetrics_player_id) {
      promoteLiveSearch.mutate({ liveId: item.live_player.id, open: true });
    }
  }

  function watchLiveSearchItem(item: ServerLivePlayerItem, riskLevel: QuickRiskLevel = "watch") {
    if (item.player?.id) {
      watchLiveSearch.mutate({ playerId: item.player.id, riskLevel });
      return;
    }
    if (item.live_player.steam_id || item.live_player.battlemetrics_player_id) {
      promoteLiveSearch.mutate({ liveId: item.live_player.id, riskLevel, open: false });
    }
  }

  useEffect(() => {
    if (focusedPlayerId) {
      setSelectedLocalPlayerId(focusedPlayerId);
      setSelectedBattleMetricsId("");
      setQuery("");
    }
  }, [focusedPlayerId]);

  useEffect(() => {
    if (sessions.data && localPlayerId) {
      queryClient.invalidateQueries({ queryKey: ["playerIntel", localPlayerId] });
      queryClient.invalidateQueries({ queryKey: ["playerDossier", localPlayerId] });
      queryClient.invalidateQueries({ queryKey: ["playerRelations", localPlayerId] });
      queryClient.invalidateQueries({ queryKey: ["playerNetwork", localPlayerId] });
      queryClient.invalidateQueries({ queryKey: ["playerServerHistory", localPlayerId] });
      queryClient.invalidateQueries({ queryKey: ["playerTimeline", localPlayerId] });
    }
  }, [localPlayerId, queryClient, sessions.dataUpdatedAt]);

  function invalidateCurrentPlayerContext() {
    if (localPlayerId) queryClient.invalidateQueries({ queryKey: ["playerIntel", localPlayerId] });
    queryClient.invalidateQueries({ queryKey: ["livePlayers"] });
    queryClient.invalidateQueries({ queryKey: ["rustAlerts"] });
    queryClient.invalidateQueries({ queryKey: ["watchlist"] });
    queryClient.invalidateQueries({ queryKey: ["overview"] });
    if (localPlayerId) queryClient.invalidateQueries({ queryKey: ["playerDossier", localPlayerId] });
    if (localPlayerId) queryClient.invalidateQueries({ queryKey: ["playerRelations", localPlayerId] });
    if (localPlayerId) queryClient.invalidateQueries({ queryKey: ["playerNetwork", localPlayerId] });
    if (localPlayerId) queryClient.invalidateQueries({ queryKey: ["playerServerHistory", localPlayerId] });
    if (localPlayerId) queryClient.invalidateQueries({ queryKey: ["playerPositionTrail", localPlayerId] });
    if (localPlayerId) queryClient.invalidateQueries({ queryKey: ["playerTimeline", localPlayerId] });
  }

  function updateQuery(value: string) {
    setQuery(value);
    setSelectedLocalPlayerId("");
    setSelectedBattleMetricsId("");
    resolve.reset();
    search.reset();
    connect.reset();
  }

  function runResolve() {
    search.reset();
    resolve.mutate();
  }

  function runSearch() {
    resolve.reset();
    search.mutate();
  }

  function runConnectMe() {
    resolve.reset();
    search.reset();
    connect.mutate();
  }

  return (
    <section className="grid gap-4">
      <Header title="Player Intelligence" subtitle="Steam, BattleMetrics, sessions and team probability" />
      <Card>
        <CardContent className="grid gap-3 pt-4 lg:grid-cols-[1fr_auto_auto_auto]">
          <Input
            value={query}
            onChange={(event) => updateQuery(event.target.value)}
            placeholder="SteamID, profile URL, nickname, BattleMetrics player ID"
          />
          <Button onClick={runResolve} disabled={!query || resolve.isPending}>
            <Crosshair className="h-4 w-4" />
            Resolve
          </Button>
          <Button variant="secondary" onClick={runSearch} disabled={!query || search.isPending}>
            <Search className="h-4 w-4" />
            Search
          </Button>
          <Button variant="secondary" onClick={runConnectMe} disabled={!query || connect.isPending}>
            <Gamepad2 className="h-4 w-4" />
            Connect Me
          </Button>
        </CardContent>
      </Card>

      {connect.data ? <StatusLine tone="ok" text={`Steam connected: ${compactText(connect.data.steam_id)}`} /> : null}
      {resolve.error || search.error || connect.error || promoteLiveSearch.error || watchLiveSearch.error ? (
        <StatusLine tone="bad" text={(resolve.error ?? search.error ?? connect.error ?? promoteLiveSearch.error ?? watchLiveSearch.error)?.message ?? "Request failed"} />
      ) : null}
      {resolve.data?.local_player ? (
        <StatusLine tone="ok" text={`Local intel profile: ${compactText(resolve.data.local_player.display_name ?? resolve.data.local_player.id)}`} />
      ) : null}
      {search.data?.battlemetrics_source_status ? <StatusLine tone="bad" text={`BattleMetrics: ${search.data.battlemetrics_source_status}`} /> : null}
      {intel.error ? <StatusLine tone="bad" text={intel.error.message} /> : null}
      {dossier.error ? <StatusLine tone="bad" text={dossier.error.message} /> : null}
      {relations.error ? <StatusLine tone="bad" text={relations.error.message} /> : null}
      {network.error ? <StatusLine tone="bad" text={network.error.message} /> : null}
      {serverHistory.error ? <StatusLine tone="bad" text={serverHistory.error.message} /> : null}
      {positionTrail.error ? <StatusLine tone="bad" text={positionTrail.error.message} /> : null}
      {timeline.error ? <StatusLine tone="bad" text={timeline.error.message} /> : null}

      {localMatches.length > 0 ? (
        <LocalMatchesTable
          items={localMatches}
          selectedId={localPlayerId}
          onOpen={(player) => {
            setSelectedLocalPlayerId(player.id ?? "");
            setSelectedBattleMetricsId(player.battlemetrics_player_id ?? "");
          }}
        />
      ) : null}

      {liveMatches.length > 0 ? (
        <LiveSearchMatchesTable
          items={liveMatches}
          busy={promoteLiveSearch.isPending || watchLiveSearch.isPending || search.isPending}
          onOpen={openLiveSearchItem}
          onWatch={watchLiveSearchItem}
        />
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[390px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Steam Profile</CardTitle>
          </CardHeader>
          <CardContent>
            {profile ? (
              <div className="flex gap-4">
                <img className="h-16 w-16 rounded-md border border-border object-cover" src={String(profile.avatarfull ?? profile.avatarmedium ?? "")} />
                <div className="min-w-0">
                  <div className="truncate text-lg font-semibold">{compactText(profile.personaname)}</div>
                  <div className="text-xs text-muted-foreground">{compactText(profile.steamid)}</div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {(resolve.data?.steam_bans ?? []).map((ban, index) => (
                      <Badge key={index} variant={ban.VACBanned || Number(ban.NumberOfGameBans) > 0 ? "danger" : "success"}>
                        VAC {String(ban.VACBanned)} / Game {String(ban.NumberOfGameBans ?? 0)}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <EmptyState label="-" />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>BattleMetrics Matches</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-auto">
              <Table>
                <thead>
                  <tr>
                    <Th>Name</Th>
                    <Th>ID</Th>
                    <Th>Match</Th>
                    <Th>Updated</Th>
                    <Th></Th>
                  </tr>
                </thead>
                <tbody>
                  {players.map((player) => (
                    <tr key={player.battlemetrics_player_id}>
                      <Td className="font-medium">{compactText(player.name)}</Td>
                      <Td>{compactText(player.battlemetrics_player_id)}</Td>
                      <Td>
                        <Badge variant={player.positive_match ? "success" : "outline"}>
                          {player.positive_match ? "positive" : "weak"}
                        </Badge>
                      </Td>
                      <Td>{formatDateTime(player.updated_at)}</Td>
                      <Td className="text-right">
                        <Button size="sm" variant="secondary" onClick={() => setSelectedBattleMetricsId(player.battlemetrics_player_id ?? "")}>
                          Sessions
                        </Button>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Player Detail / Team Evidence</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-3 flex flex-wrap gap-2">
            <Badge variant={sessions.data?.source_status === "ok" ? "success" : "outline"}>
              {compactText(sessions.data?.source_status ?? resolve.data?.team_lookup_status)}
            </Badge>
            <Badge variant={Number(sessions.data?.stored_sessions ?? 0) > 0 ? "success" : "outline"}>
              stored sessions {compactText(sessions.data?.stored_sessions)}
            </Badge>
            <Badge variant={Number(sessions.data?.overlap_edges_updated ?? 0) > 0 ? "success" : "outline"}>
              overlap edges {compactText(sessions.data?.overlap_edges_updated)}
            </Badge>
            <Badge variant={intel.data?.source_status === "ok" ? "success" : "outline"}>
              intel {compactText(intel.data?.source_status ?? "-")}
            </Badge>
            <Badge variant={dossier.data?.source_status === "ok" ? "success" : "outline"}>
              dossier {compactText(dossier.data?.source_status ?? "-")}
            </Badge>
            <Badge variant={likelyTeammates.length ? "success" : "outline"}>
              probability {likelyTeammates.length}
            </Badge>
            <Badge variant={teamEvidence.length ? "success" : "outline"}>
              evidence {teamEvidence.length}
            </Badge>
            <Badge variant={relationItems.length ? "success" : "outline"}>
              relations {relationItems.length}
            </Badge>
            <Badge variant={Number(network.data?.counts?.nodes ?? 0) > 0 ? "success" : "outline"}>
              network {compactText(network.data?.counts?.nodes)}
            </Badge>
            <Badge variant={Number(serverHistory.data?.counts?.recent_sessions ?? 0) > 0 ? "success" : "outline"}>
              servers {compactText(serverHistory.data?.counts?.top_servers)}
            </Badge>
            <Badge variant={Number(positionTrail.data?.counts?.samples ?? 0) > 0 ? "success" : "outline"}>
              trail {compactText(positionTrail.data?.counts?.samples)}
            </Badge>
            <Badge variant={Number(timeline.data?.counts?.total ?? 0) > 0 ? "success" : "outline"}>
              timeline {compactText(timeline.data?.counts?.total)}
            </Badge>
            <Badge variant="secondary">Rust+ team layer ready</Badge>
            <Badge variant="secondary">Plugin event layer ready</Badge>
          </div>
          <BattleMetricsSessionSyncPanel
            battleMetricsId={sessionBattleMetricsId}
            data={sessions.data}
            loading={sessions.isFetching}
            error={sessions.error}
            updatedAt={sessions.dataUpdatedAt}
            onRefresh={() => {
              void sessions.refetch();
            }}
          />
          <PlayerIntelPanel
            api={api}
            intel={intel.data}
            loading={intel.isFetching}
            refreshing={intel.isFetching}
            onRefresh={() => {
              void intel.refetch();
            }}
            onOpenPlayer={(player) => {
              setSelectedLocalPlayerId(player.id ?? "");
              setSelectedBattleMetricsId(player.battlemetrics_player_id ?? "");
            }}
            onWatchChanged={invalidateCurrentPlayerContext}
          />
          <PlayerDossierPanel data={dossier.data} loading={dossier.isFetching} />
          <PlayerPositionTrailPanel data={positionTrail.data} loading={positionTrail.isFetching} />
          <RelationGraphPanel
            data={relations.data}
            loading={relations.isFetching}
            onOpenPlayer={(player) => {
              setSelectedLocalPlayerId(player.id ?? "");
              setSelectedBattleMetricsId(player.battlemetrics_player_id ?? "");
            }}
          />
          <PlayerNetworkPanel
            api={api}
            data={network.data}
            loading={network.isFetching}
            onOpenPlayer={(player) => {
              setSelectedLocalPlayerId(player.id ?? "");
              setSelectedBattleMetricsId(player.battlemetrics_player_id ?? "");
            }}
            onChanged={invalidateCurrentPlayerContext}
          />
          <PlayerServerHistoryPanel
            data={serverHistory.data}
            loading={serverHistory.isFetching}
            onOpenPlayer={(player) => {
              setSelectedLocalPlayerId(player.id ?? "");
              setSelectedBattleMetricsId(player.battlemetrics_player_id ?? "");
            }}
          />
          <PlayerTimelinePanel data={timeline.data} loading={timeline.isFetching} />
          <div className="grid gap-4 xl:grid-cols-2">
            <TeamProbabilityTable items={likelyTeammates} />
            <TeamEvidenceTable items={teamEvidence} />
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

function LocalMatchesTable({
  items,
  selectedId,
  onOpen,
}: {
  items: PlayerIntel[];
  selectedId: string;
  onOpen: (player: PlayerIntel) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Known Local Matches</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-auto">
          <Table>
            <thead>
              <tr>
                <Th>Player</Th>
                <Th>Matched alias</Th>
                <Th>Aliases</Th>
                <Th>Updated</Th>
                <Th></Th>
              </tr>
            </thead>
            <tbody>
              {items.map((player) => (
                <tr key={player.id ?? player.battlemetrics_player_id ?? player.steam_id}>
                  <Td>
                    <div className="font-medium">{compactText(player.display_name ?? player.name)}</div>
                    <div className="text-xs text-muted-foreground">
                      {compactText(player.steam_id)} / {compactText(player.battlemetrics_player_id)}
                    </div>
                  </Td>
                  <Td>{compactText(player.matched_alias)}</Td>
                  <Td>{compactText(player.aliases?.length)}</Td>
                  <Td>{formatDateTime(player.updated_at)}</Td>
                  <Td className="text-right">
                    <Button size="sm" variant={selectedId === player.id ? "default" : "secondary"} onClick={() => onOpen(player)}>
                      Open
                    </Button>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

function LiveSearchMatchesTable({
  items,
  busy,
  onOpen,
  onWatch,
}: {
  items: ServerLivePlayerItem[];
  busy: boolean;
  onOpen: (item: ServerLivePlayerItem) => void;
  onWatch: (item: ServerLivePlayerItem, riskLevel: QuickRiskLevel) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-3">
          <span>Live Search Results</span>
          <Badge variant="success">{items.length} realtime</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-auto">
          <Table>
            <thead>
              <tr>
                <Th>Player</Th>
                <Th>Server</Th>
                <Th>Team</Th>
                <Th>Grid</Th>
                <Th>Risk</Th>
                <Th>Last seen</Th>
                <Th></Th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const live = item.live_player;
                const canAct = Boolean(item.player?.id || live.steam_id || live.battlemetrics_player_id);
                return (
                  <tr key={live.id}>
                    <Td>
                      <div className="font-medium">{compactText(item.player?.display_name ?? live.display_name)}</div>
                      <div className="text-xs text-muted-foreground">
                        {compactText(live.steam_id ?? live.battlemetrics_player_id)} / {compactText(live.source)}
                      </div>
                    </Td>
                    <Td>
                      <div className="max-w-[300px] truncate">{compactText(live.server_name ?? live.battlemetrics_server_id)}</div>
                      <div className="text-xs text-muted-foreground">{compactText(live.battlemetrics_server_id)}</div>
                    </Td>
                    <Td>{compactText(live.team_id || live.clan_tag)}</Td>
                    <Td>{compactText(live.map_grid)}</Td>
                    <Td>
                      {item.watch?.watched ? (
                        <Badge variant={riskBadgeVariant(item.watch.risk_level)}>{compactText(item.watch.risk_level)}</Badge>
                      ) : (
                        <Badge variant={live.is_online ? "success" : "outline"}>{live.is_online ? "online" : "seen"}</Badge>
                      )}
                    </Td>
                    <Td>{formatDateTime(live.last_seen_at)}</Td>
                    <Td className="text-right">
                      <div className="flex justify-end gap-2">
                        {!item.watch?.watched ? (
                          <QuickRiskActions busy={busy} canAct={canAct} onSelect={(level) => onWatch(item, level)} />
                        ) : null}
                        <Button size="sm" variant="secondary" onClick={() => onOpen(item)} disabled={!canAct || busy}>
                          {item.player?.id ? "Intel" : "Promote"}
                        </Button>
                      </div>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

function BattleMetricsSessionSyncPanel({
  battleMetricsId,
  data,
  loading,
  error,
  updatedAt,
  onRefresh,
}: {
  battleMetricsId: string;
  data?: PlayerSessionSync;
  loading: boolean;
  error?: Error | null;
  updatedAt?: number;
  onRefresh: () => void;
}) {
  const status = data?.source_status ?? (battleMetricsId ? "not synced" : "missing BattleMetrics id");
  const fetchedSessions = Array.isArray(data?.items) ? data.items.length : 0;
  const storedSessions = Number(data?.stored_sessions ?? 0);
  const overlapEdges = Number(data?.overlap_edges_updated ?? 0);
  const hasMessage = Boolean(error?.message || data?.message);
  const isOk = data?.source_status === "ok";
  const statusVariant: "success" | "danger" | "outline" = isOk ? "success" : data?.source_status || error ? "danger" : "outline";
  const updatedAgeSeconds = updatedAt ? Math.max(0, Math.floor((Date.now() - updatedAt) / 1000)) : null;

  return (
    <div className="mb-4 rounded-md border border-border bg-background/45 p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <DatabaseZap className="h-4 w-4 text-primary" />
              BattleMetrics Session Sync
            </div>
            <Badge variant={statusVariant}>{compactText(status)}</Badge>
            {loading ? <Badge variant="secondary">syncing</Badge> : null}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            Caches public sessions and recalculates same-server overlap edges for team probability.
          </div>
        </div>
        <Button size="sm" variant="secondary" onClick={onRefresh} disabled={!battleMetricsId || loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Sync
        </Button>
      </div>

      <div className="mt-3 grid gap-2 md:grid-cols-3 xl:grid-cols-6">
        <Fact label="BM Player" value={battleMetricsId || "-"} />
        <Fact label="Fetched" value={fetchedSessions} />
        <Fact label="Cached" value={storedSessions} />
        <Fact label="Overlap edges" value={overlapEdges} />
        <Fact label="Source" value={data?.source ?? "BattleMetrics"} />
        <Fact label="Updated" value={updatedAgeSeconds === null ? "-" : formatAgeSeconds(updatedAgeSeconds)} />
      </div>

      {!battleMetricsId ? <div className="mt-3"><EmptyState label="Select or resolve a BattleMetrics player to sync sessions" /></div> : null}
      {hasMessage ? <div className="mt-3"><StatusLine tone={error ? "bad" : isOk ? "ok" : "bad"} text={error?.message ?? data?.message ?? "BattleMetrics session sync message"} /></div> : null}
    </div>
  );
}

function PlayerIntelPanel({
  api,
  intel,
  loading,
  refreshing,
  onRefresh,
  onOpenPlayer,
  onWatchChanged,
}: {
  api: ReturnType<typeof createApiClient>;
  intel?: PlayerIntelDetail;
  loading: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  onOpenPlayer?: (player: PlayerIntel) => void;
  onWatchChanged: () => void;
}) {
  if (!intel) {
    return <div className="mb-4"><EmptyState label={loading ? "Loading player intel" : "Resolve a player to load full intel"} /></div>;
  }

  const live = intel.live_player;
  const liveStatus = intel.live_status;
  const server = intel.current_server;
  const activity = intel.recent_activity ?? [];
  const realtimeTeammates = intel.realtime_teammates ?? [];
  const realtimeContext = intel.realtime_context;
  const nearbyPlayers = intel.nearby_players ?? [];
  const aliases = intel.player.aliases ?? [];

  return (
    <div className="mb-4 grid gap-4 xl:grid-cols-[360px_1fr]">
      <div className="grid gap-3 rounded-md border border-border bg-background/45 p-3">
        <div className="flex items-start gap-3">
          {intel.player.avatar_url ? (
            <img className="h-14 w-14 rounded-md border border-border object-cover" src={intel.player.avatar_url} />
          ) : (
            <div className="grid h-14 w-14 place-items-center rounded-md border border-border bg-secondary">
              <Users className="h-5 w-5 text-muted-foreground" />
            </div>
          )}
          <div className="min-w-0">
            <div className="truncate text-lg font-semibold">{compactText(intel.player.display_name ?? intel.player.name)}</div>
            <div className="text-xs text-muted-foreground">{compactText(intel.player.steam_id)}</div>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge variant={liveStatusVariant(liveStatus?.status)}>{compactText(liveStatus?.status ?? (live?.is_online ? "ok" : "no_live"))}</Badge>
              <Badge variant={live?.is_online ? "success" : "outline"}>{live?.is_online ? "online" : "offline"}</Badge>
              <Badge variant="secondary">{compactText(intel.player.battlemetrics_player_id)}</Badge>
            </div>
          </div>
          {onRefresh ? (
            <Button size="icon" variant="secondary" onClick={onRefresh} title="Refresh live intel">
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            </Button>
          ) : null}
        </div>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <Fact label="Live age" value={formatAgeSeconds(liveStatus?.age_seconds)} />
          <Fact label="Live source" value={compactText(liveStatus?.source)} />
          <Fact label="Last live" value={formatDateTime(liveStatus?.last_seen_at)} wide />
        </div>
        <WatchControls api={api} playerId={intel.player.id ?? ""} watch={intel.watch} onSaved={onWatchChanged} />
        <OperatorNoteBox api={api} playerId={intel.player.id ?? ""} onSaved={onWatchChanged} />
        {live ? <LiveFacts player={live} /> : <EmptyState label="No live position yet" />}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-md border border-border bg-background/45 p-3">
          <div className="mb-2 text-sm font-medium">Current Server</div>
          {server ? (
            <div className="grid gap-2 text-sm">
              <div className="font-medium">{compactText(server.name)}</div>
              <div className="text-xs text-muted-foreground">{compactText(server.ip)}:{compactText(server.port)} - rank {compactText(server.rank)}</div>
              <div className="grid grid-cols-2 gap-2">
                <Fact label="Online" value={`${compactText(server.players)} / ${compactText(server.max_players)}`} />
                <Fact label="Wipe" value={formatDateTime(server.next_wipe_at)} />
                <Fact label="Map" value={`${compactText(server.rust_world_size)} / ${compactText(server.rust_world_seed)}`} wide />
              </div>
              {server.rustmaps_url ? (
                <a className="text-sm text-primary underline-offset-4 hover:underline" href={server.rustmaps_url} target="_blank" rel="noreferrer">
                  Open RustMaps
                </a>
              ) : null}
            </div>
          ) : (
            <EmptyState label="No current server detected" />
          )}
        </div>

        <div className="rounded-md border border-border bg-background/45 p-3">
          <div className="mb-2 text-sm font-medium">Realtime Team</div>
          {realtimeTeammates.length ? (
            <div className="grid gap-2">
              {realtimeTeammates.slice(0, 6).map((player) => (
                <LivePlayerCompact key={player.id} player={player} />
              ))}
            </div>
          ) : (
            <EmptyState label="No live teammates detected" />
          )}
        </div>
      </div>

      <PlayerIdentitySummaryPanel intel={intel} />

      <PlayerRiskEvidenceDigestPanel intel={intel} />

      <PlayerAliasHistoryPanel aliases={aliases} currentName={intel.player.display_name ?? intel.player.name} />

      <PlayerRealtimeContextPanel
        api={api}
        context={realtimeContext}
        nearbyPlayers={nearbyPlayers}
        onOpenPlayer={onOpenPlayer}
        onChanged={onWatchChanged}
      />

      <div className="xl:col-span-2">
        <div className="mb-2 text-sm font-medium">Recent Activity</div>
        <div className="max-h-[190px] overflow-auto rounded-md border border-border">
          <Table>
            <thead>
              <tr>
                <Th>Time</Th>
                <Th>Event</Th>
                <Th>Source</Th>
              </tr>
            </thead>
            <tbody>
              {activity.map((event) => (
                <tr key={String(event.id)}>
                  <Td>{formatDateTime(String(event.occurred_at ?? ""))}</Td>
                  <Td>{compactText(event.event_type)}</Td>
                  <Td>{compactText(event.source)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
          {!activity.length ? <EmptyState label="No player activity yet" /> : null}
        </div>
      </div>
    </div>
  );
}

function PlayerIdentitySummaryPanel({ intel }: { intel: PlayerIntelDetail }) {
  const player = intel.player;
  const live = intel.live_player;
  const server = intel.current_server;
  const liveStatus = intel.live_status;
  const links = playerQuickLinks(player, live, server);

  return (
    <div className="xl:col-span-2 rounded-md border border-border bg-background/45 p-3">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-sm font-medium">Identity Summary</div>
          <div className="text-xs text-muted-foreground">Local profile, external source IDs and current live anchors</div>
        </div>
        <div className="flex flex-wrap gap-1">
          {player.steam_id ? <Badge variant="success">Steam</Badge> : <Badge variant="outline">no Steam</Badge>}
          {player.battlemetrics_player_id ? <Badge variant="default">BattleMetrics</Badge> : <Badge variant="outline">no BM</Badge>}
          {live?.source ? <Badge variant="warning">{compactText(live.source)}</Badge> : null}
          {server?.rustmaps_url || live?.rustmaps_url ? <Badge variant="secondary">RustMaps</Badge> : null}
          <Badge variant={liveStatusVariant(liveStatus?.status)}>{compactText(liveStatus?.status ?? "no_live")}</Badge>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-[1fr_340px]">
        <div className="grid gap-2 md:grid-cols-3">
          <Fact label="Local ID" value={player.id} wide />
          <Fact label="Steam ID" value={player.steam_id} />
          <Fact label="BattleMetrics" value={player.battlemetrics_player_id} />
          <Fact label="Visibility" value={player.visibility_state ?? "-"} />
          <Fact label="First seen" value={formatDateTime(player.first_seen_at)} />
          <Fact label="Last seen" value={formatDateTime(player.last_seen_at)} />
          <Fact label="Created" value={formatDateTime(player.created_at)} />
          <Fact label="Updated" value={formatDateTime(player.updated_at)} />
          <Fact label="Live source" value={liveStatus?.source ?? live?.source} />
        </div>

        <div className="rounded-md border border-border bg-background/50 p-3">
          <div className="mb-2 text-sm font-medium">Quick Links</div>
          {links.length ? (
            <div className="grid gap-2">
              {links.map((link) => (
                <a
                  key={link.href}
                  className="flex h-9 items-center justify-between gap-2 rounded-md border border-border bg-secondary px-3 text-sm text-secondary-foreground hover:bg-secondary/80"
                  href={link.href}
                  target="_blank"
                  rel="noreferrer"
                >
                  <span className="truncate">{link.label}</span>
                  <span className="text-xs text-muted-foreground">{link.source}</span>
                </a>
              ))}
            </div>
          ) : (
            <EmptyState label="No external links yet" />
          )}
        </div>
      </div>
    </div>
  );
}

function PlayerRiskEvidenceDigestPanel({ intel }: { intel: PlayerIntelDetail }) {
  const watch = intel.watch;
  const evidence = intel.team_evidence ?? [];
  const likely = intel.likely_teammates ?? [];
  const counts = intel.realtime_context?.counts ?? {};
  const totalScore = evidence.reduce((sum, item) => sum + numberFromRecord(item, "score_delta"), 0);
  const strongestScore = evidence.reduce((max, item) => Math.max(max, numberFromRecord(item, "score_delta")), 0);
  const latestEvidence = [...evidence].sort((a, b) => dateMs(b.occurred_at) - dateMs(a.occurred_at));
  const sourceCounts = countRecordsBy(evidence, "source");
  const typeCounts = countRecordsBy(evidence, "evidence_type");
  const topSource = sourceCounts[0];
  const topType = typeCounts[0];
  const topLikely = [...likely].sort((a, b) => Number(b.score ?? 0) - Number(a.score ?? 0))[0];
  const riskLevel = watch?.watched ? watch.risk_level : strongestScore >= 60 ? "suspect" : "unwatched";

  return (
    <div className="xl:col-span-2 rounded-md border border-border bg-background/45 p-3">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-sm font-medium">Risk Evidence Digest</div>
          <div className="text-xs text-muted-foreground">Operator flag, realtime pressure, relation proof and strongest team signals</div>
        </div>
        <div className="flex flex-wrap gap-1">
          <Badge variant={riskBadgeVariant(riskLevel)}>{compactText(riskLevel)}</Badge>
          <Badge variant={evidence.length ? "warning" : "outline"}>{evidence.length} proofs</Badge>
          <Badge variant={totalScore > 0 ? "warning" : "outline"}>score +{compactText(totalScore)}</Badge>
          <Badge variant={Number(counts.watched_on_server ?? 0) > 0 ? "danger" : "outline"}>{compactText(counts.watched_on_server)} watched nearby</Badge>
          <Badge variant={Number(counts.near_150m ?? 0) > 0 ? "danger" : "outline"}>{compactText(counts.near_150m)} near 150m</Badge>
        </div>
      </div>

      <div className="grid gap-3 xl:grid-cols-[1fr_380px]">
        <div className="grid gap-2 md:grid-cols-3">
          <Fact label="Watch reason" value={watch?.reason || watch?.note || "-"} wide />
          <Fact label="Risk note" value={watch?.note || "-"} />
          <Fact label="Strongest proof" value={strongestScore ? `+${strongestScore}` : "-"} />
          <Fact label="Top evidence type" value={topType ? `${topType.value} (${topType.count})` : "-"} />
          <Fact label="Top source" value={topSource ? `${topSource.value} (${topSource.count})` : "-"} />
          <Fact label="Top relation" value={topLikely ? `${compactText(topLikely.player?.display_name ?? topLikely.player?.name)} ${compactText(topLikely.score)}%` : "-"} />
          <Fact label="Same grid" value={compactText(counts.same_grid)} />
          <Fact label="Team count" value={compactText(counts.teammates)} />
          <Fact label="Live status" value={compactText(intel.live_status?.status)} />
        </div>

        <div className="rounded-md border border-border bg-background/50 p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="text-sm font-medium">Latest Proof</div>
            <Badge variant={latestEvidence.length ? "warning" : "outline"}>{latestEvidence.length}</Badge>
          </div>
          {latestEvidence.length ? (
            <div className="grid max-h-[210px] gap-2 overflow-auto">
              {latestEvidence.slice(0, 5).map((item, index) => (
                <div key={`${String(item.id ?? item.occurred_at ?? index)}-${index}`} className="rounded-md border border-border bg-background/55 p-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{compactText(item.evidence_type)}</div>
                      <div className="truncate text-xs text-muted-foreground">{compactText(item.reason)}</div>
                    </div>
                    <Badge variant={numberFromRecord(item, "score_delta") >= 40 ? "success" : "secondary"}>+{compactText(item.score_delta)}</Badge>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1 text-xs text-muted-foreground">
                    <Badge variant="outline">{compactText(item.source)}</Badge>
                    <span>{compactText(item.player_a_name || item.player_a_steam_id)}</span>
                    <span>/</span>
                    <span>{compactText(item.player_b_name || item.player_b_steam_id)}</span>
                    <span className="ml-auto">{formatDateTime(item.occurred_at)}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState label="No team evidence yet" />
          )}
        </div>
      </div>
    </div>
  );
}

function PlayerAliasHistoryPanel({ aliases, currentName }: { aliases: PlayerAlias[]; currentName?: string }) {
  const items = [...aliases].sort((a, b) => dateMs(b.last_seen_at) - dateMs(a.last_seen_at));
  const sourceCounts = items.reduce<Record<string, number>>((acc, alias) => {
    const source = compactText(alias.source);
    acc[source] = (acc[source] ?? 0) + 1;
    return acc;
  }, {});
  const sources = Object.entries(sourceCounts).sort((a, b) => b[1] - a[1]);

  return (
    <div className="xl:col-span-2 rounded-md border border-border bg-background/45 p-3">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-sm font-medium">Alias History</div>
          <div className="text-xs text-muted-foreground">Steam, BattleMetrics, sessions and realtime plugin names</div>
        </div>
        <div className="flex flex-wrap gap-1">
          <Badge variant={items.length ? "success" : "outline"}>{items.length} aliases</Badge>
          {currentName ? <Badge variant="secondary">current {compactText(currentName)}</Badge> : null}
          {sources.slice(0, 4).map(([source, count]) => (
            <Badge key={source} variant={aliasSourceVariant(source)}>
              {source} {count}
            </Badge>
          ))}
        </div>
      </div>

      {items.length ? (
        <div className="max-h-[280px] overflow-auto rounded-md border border-border">
          <Table>
            <thead>
              <tr>
                <Th>Alias</Th>
                <Th>Source</Th>
                <Th>First seen</Th>
                <Th>Last seen</Th>
                <Th>Age</Th>
              </tr>
            </thead>
            <tbody>
              {items.map((alias, index) => (
                <tr key={`${alias.alias}-${alias.source}-${index}`}>
                  <Td>
                    <div className="max-w-[320px] truncate font-medium">{compactText(alias.alias)}</div>
                  </Td>
                  <Td>
                    <Badge variant={aliasSourceVariant(alias.source)}>{compactText(alias.source)}</Badge>
                  </Td>
                  <Td>{formatDateTime(alias.first_seen_at)}</Td>
                  <Td>{formatDateTime(alias.last_seen_at)}</Td>
                  <Td>{formatRelativeTime(alias.last_seen_at)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      ) : (
        <EmptyState label="No aliases captured yet" />
      )}
    </div>
  );
}

function playerQuickLinks(player: PlayerIntel, live?: LivePlayer | null, server?: ServerIntel | null) {
  const links: Array<{ label: string; href: string; source: string }> = [];
  const add = (label: string, href: string, source: string) => {
    if (!href || links.some((item) => item.href === href)) return;
    links.push({ label, href, source });
  };
  add("Steam profile", player.profile_url || steamProfileUrl(player.steam_id), "Steam");
  add("BattleMetrics player", battleMetricsPlayerUrl(player.battlemetrics_player_id), "BM player");
  add("BattleMetrics live player", battleMetricsPlayerUrl(live?.battlemetrics_player_id), "BM live");
  add("BattleMetrics server", battleMetricsServerUrl(server?.battlemetrics_server_id ?? live?.battlemetrics_server_id), "BM server");
  add("RustMaps", server?.rustmaps_url || live?.rustmaps_url || "", "Map");
  return links;
}

function steamProfileUrl(steamId?: string) {
  return steamId ? `https://steamcommunity.com/profiles/${encodeURIComponent(steamId)}` : "";
}

function battleMetricsPlayerUrl(playerId?: string) {
  return playerId ? `https://www.battlemetrics.com/players/${encodeURIComponent(playerId)}` : "";
}

function battleMetricsServerUrl(serverId?: string) {
  return serverId ? `https://www.battlemetrics.com/servers/rust/${encodeURIComponent(serverId)}` : "";
}

function PlayerRealtimeContextPanel({
  api,
  context,
  nearbyPlayers,
  onOpenPlayer,
  onChanged,
}: {
  api: ReturnType<typeof createApiClient>;
  context?: PlayerRealtimeContext;
  nearbyPlayers: PlayerRealtimeNearbyItem[];
  onOpenPlayer?: (player: PlayerIntel) => void;
  onChanged: () => void;
}) {
  const counts = context?.counts ?? {};
  const watched = context?.watched_players ?? [];
  const sameGrid = context?.same_grid_players ?? [];
  const teammates = context?.teammates ?? [];
  const hasData = nearbyPlayers.length > 0 || watched.length > 0 || sameGrid.length > 0 || teammates.length > 0;
  const promote = useMutation({
    mutationFn: ({ liveId, riskLevel }: { liveId: string; riskLevel?: QuickRiskLevel; open: boolean }) =>
      api.promoteLivePlayer(liveId, {
        watch: Boolean(riskLevel),
        risk_level: riskLevel ?? "watch",
        reason: riskLevel ? quickRiskReason("player realtime context", riskLevel) : "Promoted from player realtime context",
        labels: ["player-intel", "realtime"],
      }),
    onSuccess: (result, variables) => {
      onChanged();
      if (variables.open && result.player?.id) {
        onOpenPlayer?.(result.player);
      }
    },
  });
  const watchPlayer = useMutation({
    mutationFn: ({ playerId, riskLevel }: { playerId: string; riskLevel: QuickRiskLevel }) =>
      api.updatePlayerWatch(playerId, {
        watched: true,
        risk_level: riskLevel,
        reason: quickRiskReason("player realtime context", riskLevel),
        labels: ["player-intel", "realtime"],
      }),
    onSuccess: () => onChanged(),
  });
  const actionBusy = promote.isPending || watchPlayer.isPending;
  const actionError = promote.error ?? watchPlayer.error;

  function canAct(item: PlayerRealtimeNearbyItem) {
    return Boolean(item.player?.id || item.live_player.id || item.live_player.steam_id || item.live_player.battlemetrics_player_id);
  }

  function openOrPromote(item: PlayerRealtimeNearbyItem) {
    if (item.player?.id) {
      onOpenPlayer?.(item.player);
      return;
    }
    if (canAct(item)) {
      promote.mutate({ liveId: item.live_player.id, open: true });
    }
  }

  function watchFromContext(item: PlayerRealtimeNearbyItem, riskLevel: QuickRiskLevel = "watch") {
    if (item.player?.id) {
      watchPlayer.mutate({ playerId: item.player.id, riskLevel });
      return;
    }
    if (canAct(item)) {
      promote.mutate({ liveId: item.live_player.id, riskLevel, open: false });
    }
  }

  return (
    <div className="xl:col-span-2 rounded-md border border-border bg-background/45 p-3">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-sm font-medium">Realtime Server Context</div>
          <div className="text-xs text-muted-foreground">{compactText(context?.source_status ?? "needs live roster")}</div>
        </div>
        <div className="flex flex-wrap gap-1">
          <Badge variant={Number(counts.server_players ?? 0) > 0 ? "success" : "outline"}>{compactText(counts.server_players)} server</Badge>
          <Badge variant={Number(counts.positioned_players ?? 0) > 0 ? "success" : "outline"}>{compactText(counts.positioned_players)} positioned</Badge>
          <Badge variant={Number(counts.teammates ?? 0) > 0 ? "success" : "outline"}>{compactText(counts.teammates)} team</Badge>
          <Badge variant={Number(counts.watched_on_server ?? 0) > 0 ? "danger" : "outline"}>{compactText(counts.watched_on_server)} watched</Badge>
          <Badge variant={Number(counts.near_150m ?? 0) > 0 ? "danger" : "outline"}>{compactText(counts.near_150m)} near 150m</Badge>
          <Badge variant={Number(counts.near_400m ?? 0) > 0 ? "warning" : "outline"}>{compactText(counts.near_400m)} near 400m</Badge>
        </div>
      </div>

      {hasData ? (
        <div className="grid gap-3 xl:grid-cols-[1fr_340px]">
          <div className="overflow-auto rounded-md border border-border">
            <Table>
              <thead>
                <tr>
                  <Th>Player</Th>
                  <Th>Range</Th>
                  <Th>Signal</Th>
                  <Th>Grid</Th>
                  <Th>Team</Th>
                  <Th></Th>
                </tr>
              </thead>
              <tbody>
                {nearbyPlayers.slice(0, 14).map((item) => {
                  const live = item.live_player;
                  return (
                    <tr key={live.id}>
                      <Td>
                        <div className="max-w-[220px] truncate font-medium">{compactText(item.player?.display_name ?? live.display_name)}</div>
                        <div className="text-xs text-muted-foreground">{compactText(live.steam_id ?? live.battlemetrics_player_id)}</div>
                      </Td>
                      <Td>{formatMeters(item.distance_to_target)}</Td>
                      <Td>
                        <Badge variant={nearbySignalVariant(item)}>{nearbySignalLabel(item)}</Badge>
                      </Td>
                      <Td>{compactText(live.map_grid)}</Td>
                      <Td>{compactText(live.team_id || live.clan_tag)}</Td>
                      <Td className="text-right">
                        <div className="flex justify-end gap-2">
                          {!item.watch?.watched ? (
                            <QuickRiskActions busy={actionBusy} canAct={canAct(item)} onSelect={(level) => watchFromContext(item, level)} />
                          ) : null}
                          <Button size="sm" variant="secondary" onClick={() => openOrPromote(item)} disabled={!canAct(item) || actionBusy}>
                            {item.player?.id ? "Intel" : "Promote"}
                          </Button>
                        </div>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
            {!nearbyPlayers.length ? <EmptyState label="No positioned nearby players yet" /> : null}
          </div>

          <div className="grid gap-3">
            <RealtimeContextMiniList
              title="Watched on server"
              items={watched}
              empty="No watched players on this server"
              tone="danger"
              busy={actionBusy}
              canAct={canAct}
              onOpen={openOrPromote}
              onWatch={watchFromContext}
            />
            <RealtimeContextMiniList
              title="Same grid"
              items={sameGrid}
              empty="No same-grid players detected"
              tone="warning"
              busy={actionBusy}
              canAct={canAct}
              onOpen={openOrPromote}
              onWatch={watchFromContext}
            />
            <RealtimeContextMiniList
              title="Current team"
              items={teammates}
              empty="No current team detected"
              tone="success"
              busy={actionBusy}
              canAct={canAct}
              onOpen={openOrPromote}
              onWatch={watchFromContext}
            />
          </div>
        </div>
      ) : (
        <EmptyState label="Realtime context appears after live server positions arrive" />
      )}
      {actionError ? <StatusLine tone="bad" text={actionError.message} /> : null}
    </div>
  );
}

function RealtimeContextMiniList({
  title,
  items,
  empty,
  tone,
  busy,
  canAct,
  onOpen,
  onWatch,
}: {
  title: string;
  items: PlayerRealtimeNearbyItem[];
  empty: string;
  tone: "danger" | "warning" | "success";
  busy?: boolean;
  canAct: (item: PlayerRealtimeNearbyItem) => boolean;
  onOpen: (item: PlayerRealtimeNearbyItem) => void;
  onWatch: (item: PlayerRealtimeNearbyItem, riskLevel: QuickRiskLevel) => void;
}) {
  return (
    <div className="rounded-md border border-border bg-background/50 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="text-sm font-medium">{title}</div>
        <Badge variant={items.length ? tone : "outline"}>{items.length}</Badge>
      </div>
      {items.length ? (
        <div className="grid max-h-36 gap-2 overflow-auto">
          {items.slice(0, 6).map((item) => (
            <div
              key={`${title}-${item.live_player.id}`}
              className="grid grid-cols-[1fr_auto] items-center gap-2 rounded-md border border-border bg-background/55 px-2 py-1 text-xs"
            >
              <span className="min-w-0">
                <span className="block truncate font-medium">{compactText(item.player?.display_name ?? item.live_player.display_name)}</span>
                <span className="block truncate text-muted-foreground">
                  {formatMeters(item.distance_to_target)} / grid {compactText(item.live_player.map_grid)}
                </span>
              </span>
              <span className="flex items-center gap-1">
                <Badge variant={nearbySignalVariant(item)}>{nearbySignalLabel(item)}</Badge>
                {!item.watch?.watched ? (
                  <QuickRiskActions busy={busy} canAct={canAct(item)} onSelect={(level) => onWatch(item, level)} />
                ) : null}
                <Button size="sm" variant="secondary" onClick={() => onOpen(item)} disabled={!canAct(item) || busy}>
                  {item.player?.id ? "Intel" : "Promote"}
                </Button>
              </span>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState label={empty} />
      )}
    </div>
  );
}

function nearbySignalVariant(item: PlayerRealtimeNearbyItem) {
  if (item.watch?.watched) return riskBadgeVariant(item.watch.risk_level);
  if (item.same_team) return "success";
  if (item.same_grid) return "warning";
  if (item.proximity_status === "near") return "danger";
  if (item.proximity_status === "close") return "warning";
  return item.live_player.is_online ? "secondary" : "outline";
}

function nearbySignalLabel(item: PlayerRealtimeNearbyItem) {
  if (item.watch?.watched) return compactText(item.watch.risk_level);
  if (item.same_team) return "team";
  if (item.same_grid) return "same grid";
  if (item.proximity_status === "near") return "near";
  if (item.proximity_status === "close") return "close";
  return item.live_player.is_online ? "online" : "recent";
}

function WatchControls({
  api,
  playerId,
  watch,
  onSaved,
}: {
  api: ReturnType<typeof createApiClient>;
  playerId: string;
  watch?: PlayerWatchState | null;
  onSaved: () => void;
}) {
  const [riskLevel, setRiskLevel] = useState(watch?.risk_level ?? "watch");
  const [reason, setReason] = useState(watch?.reason ?? "");
  const [note, setNote] = useState(watch?.note ?? "");
  const [labels, setLabels] = useState(formatLabelsInput(watch?.labels));
  const saveWatch = useMutation({
    mutationFn: (watched: boolean) =>
      api.updatePlayerWatch(playerId, {
        watched,
        risk_level: watched ? riskLevel : "ignored",
        reason,
        note,
        labels: parseLabelsInput(labels),
      }),
    onSuccess: onSaved,
  });

  useEffect(() => {
    setRiskLevel(watch?.risk_level ?? "watch");
    setReason(watch?.reason ?? "");
    setNote(watch?.note ?? "");
    setLabels(formatLabelsInput(watch?.labels));
  }, [watch?.id, watch?.risk_level, watch?.reason, watch?.note, watch?.labels]);

  return (
    <div className="grid gap-2 rounded-md border border-border bg-background/50 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={watch?.watched ? riskBadgeVariant(watch.risk_level) : "outline"}>
          {watch?.watched ? compactText(watch.risk_level) : "not watched"}
        </Badge>
        {["watch", "suspect", "hostile", "friendly"].map((level) => (
          <Button
            key={level}
            size="sm"
            variant={riskLevel === level ? "default" : "secondary"}
            onClick={() => setRiskLevel(level)}
            type="button"
          >
            {level}
          </Button>
        ))}
      </div>
      <div className="grid gap-2 md:grid-cols-2">
        <Input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Reason" />
        <Input value={labels} onChange={(event) => setLabels(event.target.value)} placeholder="Labels, comma separated" />
      </div>
      <Input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Operator note" />
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => saveWatch.mutate(true)} disabled={!playerId || saveWatch.isPending}>
          Save Watch
        </Button>
        <Button size="sm" variant="secondary" onClick={() => saveWatch.mutate(false)} disabled={!playerId || saveWatch.isPending}>
          Clear
        </Button>
        {saveWatch.error ? <span className="self-center text-xs text-destructive">{saveWatch.error.message}</span> : null}
      </div>
    </div>
  );
}

function OperatorNoteBox({
  api,
  playerId,
  onSaved,
}: {
  api: ReturnType<typeof createApiClient>;
  playerId: string;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [labels, setLabels] = useState("");
  const [severity, setSeverity] = useState<"info" | "warning">("info");
  const saveNote = useMutation({
    mutationFn: () =>
      api.addPlayerNote(playerId, {
        title,
        note,
        severity,
        labels: parseLabelsInput(labels),
      }),
    onSuccess: () => {
      setTitle("");
      setNote("");
      setLabels("");
      setSeverity("info");
      onSaved();
    },
  });

  return (
    <div className="grid gap-2 rounded-md border border-border bg-background/50 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm font-medium">Operator Note</div>
        <div className="flex flex-wrap gap-1">
          {(["info", "warning"] as const).map((level) => (
            <Button key={level} size="sm" variant={severity === level ? "default" : "secondary"} onClick={() => setSeverity(level)} type="button">
              {level}
            </Button>
          ))}
        </div>
      </div>
      <div className="grid gap-2 md:grid-cols-2">
        <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Short title" />
        <Input value={labels} onChange={(event) => setLabels(event.target.value)} placeholder="Labels, comma separated" />
      </div>
      <textarea
        className="min-h-[86px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
        value={note}
        onChange={(event) => setNote(event.target.value)}
        placeholder="Add investigation note"
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        {saveNote.error ? <span className="text-xs text-destructive">{saveNote.error.message}</span> : <span className="text-xs text-muted-foreground">Saved notes appear in Activity Timeline</span>}
        <Button size="sm" onClick={() => saveNote.mutate()} disabled={!playerId || !note.trim() || saveNote.isPending}>
          <Save className="h-4 w-4" />
          Add Note
        </Button>
      </div>
    </div>
  );
}

function PlayerDossierPanel({ data, loading }: { data?: PlayerDossier; loading: boolean }) {
  const summary = data?.summary ?? {};
  const topServers = data?.top_servers ?? [];
  const activeHours = data?.active_hours ?? [];
  const maxHourCount = Math.max(1, ...activeHours.map((item) => Number(item.count ?? 0)));

  return (
    <div className="mb-4 rounded-md border border-border bg-background/45 p-3">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-sm font-medium">Player Dossier</div>
          <div className="text-xs text-muted-foreground">{compactText(data?.source_status ?? (loading ? "loading" : "no data"))}</div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant={Number(summary.sessions ?? 0) > 0 ? "success" : "outline"}>sessions {compactText(summary.sessions)}</Badge>
          <Badge variant={Number(summary.relations ?? 0) > 0 ? "success" : "outline"}>relations {compactText(summary.relations)}</Badge>
          <Badge variant={Number(summary.evidence_events ?? 0) > 0 ? "success" : "outline"}>evidence {compactText(summary.evidence_events)}</Badge>
        </div>
      </div>
      <div className="grid gap-3 xl:grid-cols-[1fr_1.2fr]">
        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-2">
            <Fact label="Aliases" value={summary.aliases} />
            <Fact label="Servers" value={summary.unique_servers} />
            <Fact label="Total time" value={summary.total_duration} />
            <Fact label="Activity" value={summary.activity_events} />
          </div>
          <div className="rounded-md border border-border bg-background/50 p-3">
            <div className="mb-2 text-sm font-medium">Active Hours UTC</div>
            <div className="grid grid-cols-12 gap-1">
              {activeHours.map((item) => {
                const count = Number(item.count ?? 0);
                return (
                  <div key={item.hour} className="grid gap-1">
                    <div
                      className="h-9 rounded-sm border border-border bg-primary/20"
                      style={{ opacity: count > 0 ? 0.25 + (count / maxHourCount) * 0.75 : 0.12 }}
                      title={`${String(item.hour).padStart(2, "0")}:00 - ${count}`}
                    />
                    <div className="text-center text-[10px] text-muted-foreground">{item.hour}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        <div className="grid gap-3">
          <div className="rounded-md border border-border bg-background/50 p-3">
            <div className="mb-2 text-sm font-medium">Top Servers</div>
            <div className="grid max-h-[210px] gap-2 overflow-auto">
              {topServers.slice(0, 6).map((server, index) => (
                <div key={`${String(server.battlemetrics_server_id)}-${index}`} className="grid grid-cols-[1fr_auto] gap-2 rounded-md border border-border p-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{compactText(server.server_name ?? server.battlemetrics_server_id)}</div>
                    <div className="text-xs text-muted-foreground">
                      {compactText(server.session_count)} sessions / {compactText(server.total_duration)}
                    </div>
                  </div>
                  <div className="text-right text-xs text-muted-foreground">{formatDateTime(server.last_seen_at)}</div>
                </div>
              ))}
              {!topServers.length ? <EmptyState label="No cached sessions yet" /> : null}
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <NamedCountList title="Activity Types" items={data?.activity_types ?? []} nameKey="event_type" />
            <NamedCountList title="Evidence Types" items={data?.evidence_types ?? []} nameKey="evidence_type" />
            <NamedCountList title="Relation Sources" items={data?.relation_sources ?? []} nameKey="source" />
          </div>
        </div>
      </div>
    </div>
  );
}

function NamedCountList({ title, items, nameKey }: { title: string; items: Array<Record<string, unknown>>; nameKey: string }) {
  return (
    <div className="rounded-md border border-border bg-background/50 p-3">
      <div className="mb-2 text-sm font-medium">{title}</div>
      <div className="grid gap-1">
        {items.slice(0, 5).map((item, index) => (
          <div key={`${String(item[nameKey])}-${index}`} className="flex items-center justify-between gap-2 text-xs">
            <span className="truncate text-muted-foreground">{compactText(item[nameKey])}</span>
            <Badge variant="outline">{compactText(item.count)}</Badge>
          </div>
        ))}
        {!items.length ? <div className="text-xs text-muted-foreground">-</div> : null}
      </div>
    </div>
  );
}

function PlayerPositionTrailPanel({ data, loading }: { data?: PlayerPositionTrail; loading: boolean }) {
  const items = data?.items ?? [];
  const heatCells = data?.heat_cells ?? [];
  const counts = data?.counts ?? {};
  const positioned = items.filter((item) => typeof item.position?.x === "number" && typeof item.position?.z === "number");
  const trail = [...positioned].reverse();
  const maxAbs = Math.max(
    2000,
    ...positioned.flatMap((item) => [Math.abs(item.position?.x ?? 0), Math.abs(item.position?.z ?? 0)]),
  );

  return (
    <div className="mb-4 rounded-md border border-border bg-background/45 p-3">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-sm font-medium">Position Trail</div>
          <div className="text-xs text-muted-foreground">{compactText(data?.source_status ?? (loading ? "loading" : "no data"))}</div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant={Number(counts.samples ?? 0) > 0 ? "success" : "outline"}>{compactText(counts.samples)} samples</Badge>
          <Badge variant={Number(counts.grids ?? 0) > 0 ? "success" : "outline"}>{compactText(counts.grids)} grids</Badge>
          <Badge variant={Number(counts.servers ?? 0) > 0 ? "success" : "outline"}>{compactText(counts.servers)} servers</Badge>
          <Badge variant={Number(counts.heat_cells ?? 0) > 0 ? "warning" : "outline"}>{compactText(counts.heat_cells)} heat</Badge>
        </div>
      </div>

      <div className="grid gap-3 xl:grid-cols-[minmax(420px,1fr)_420px]">
        <div className="relative aspect-square min-h-[360px] overflow-hidden rounded-md border border-border bg-[linear-gradient(90deg,rgba(255,255,255,0.055)_1px,transparent_1px),linear-gradient(180deg,rgba(255,255,255,0.055)_1px,transparent_1px),linear-gradient(135deg,rgba(41,80,67,0.42),rgba(31,37,45,0.94)_55%,rgba(104,55,42,0.42))] bg-[length:10%_10%,10%_10%,100%_100%]">
          <div className="absolute left-1/2 top-0 h-full w-px bg-border/80" />
          <div className="absolute left-0 top-1/2 h-px w-full bg-border/80" />
          {trail.map((item, index) => {
            const x = (((item.position?.x ?? 0) + maxAbs) / (maxAbs * 2)) * 100;
            const y = ((maxAbs - (item.position?.z ?? 0)) / (maxAbs * 2)) * 100;
            const newest = index === trail.length - 1;
            const opacity = 0.35 + (index / Math.max(1, trail.length - 1)) * 0.65;
            return (
              <div
                key={item.id}
                className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full border border-background ${newest ? "h-4 w-4 bg-primary" : "h-2.5 w-2.5 bg-amber-300"}`}
                style={{ left: `${Math.max(1, Math.min(99, x))}%`, top: `${Math.max(1, Math.min(99, y))}%`, opacity }}
                title={`${formatDateTime(item.observed_at)} - ${compactText(item.map_grid)} - ${Math.round(item.position?.x ?? 0)}, ${Math.round(item.position?.z ?? 0)}`}
              />
            );
          })}
          <div className="absolute bottom-3 left-3 flex gap-2 rounded-md border border-border bg-background/80 px-2 py-1 text-xs text-muted-foreground backdrop-blur">
            <span>scale +/-{Math.round(maxAbs)}</span>
            <span>{positioned.length} positions</span>
          </div>
          {!positioned.length ? <div className="absolute inset-0 grid place-items-center"><EmptyState label={loading ? "Loading position trail" : "No position samples yet"} /></div> : null}
        </div>

        <div className="grid gap-3">
          <div className="rounded-md border border-border bg-background/50 p-3">
            <div className="mb-2 text-sm font-medium">Latest Positions</div>
            <div className="max-h-[220px] overflow-auto">
              <Table>
                <thead>
                  <tr>
                    <Th>At</Th>
                    <Th>Grid</Th>
                    <Th>XYZ</Th>
                  </tr>
                </thead>
                <tbody>
                  {items.slice(0, 8).map((item) => (
                    <tr key={item.id}>
                      <Td>{formatDateTime(item.observed_at)}</Td>
                      <Td>{compactText(item.map_grid)}</Td>
                      <Td>{positionText(item)}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
              {!items.length ? <EmptyState label="No snapshots yet" /> : null}
            </div>
          </div>

          <div className="rounded-md border border-border bg-background/50 p-3">
            <div className="mb-2 text-sm font-medium">Heat Cells</div>
            <div className="grid max-h-[260px] gap-2 overflow-auto">
              {heatCells.slice(0, 8).map((cell, index) => {
                const server = objectFrom(cell.server);
                const avg = objectFrom(cell.avg_position);
                return (
                  <div key={`${String(server.battlemetrics_server_id)}-${String(cell.map_grid)}-${index}`} className="rounded-md border border-border p-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{compactText(cell.map_grid || server.name || server.battlemetrics_server_id)}</div>
                        <div className="text-xs text-muted-foreground">{compactText(server.name ?? server.battlemetrics_server_id)}</div>
                      </div>
                      <Badge variant="warning">{compactText(cell.sample_count)} hits</Badge>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      avg {compactText(Math.round(Number(avg.x ?? 0)))} / {compactText(Math.round(Number(avg.z ?? 0)))} - {formatDateTime(cell.last_observed_at)}
                    </div>
                  </div>
                );
              })}
              {!heatCells.length ? <EmptyState label="No heat cells yet" /> : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function RelationGraphPanel({
  data,
  loading,
  onOpenPlayer,
}: {
  data?: PlayerRelationsGraph;
  loading: boolean;
  onOpenPlayer: (player: PlayerIntel) => void;
}) {
  const items = data?.items ?? [];
  const evidence = data?.evidence ?? [];
  const target = data?.target;

  return (
    <div className="mb-4 rounded-md border border-border bg-background/45 p-3">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-sm font-medium">Relation Graph</div>
          <div className="text-xs text-muted-foreground">{compactText(data?.source_status ?? (loading ? "loading" : "no data"))}</div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant={items.length ? "success" : "outline"}>{items.length} links</Badge>
          <Badge variant={evidence.length ? "success" : "outline"}>{evidence.length} evidence</Badge>
          {target?.current_server?.name ? <Badge variant="secondary">{compactText(target.current_server.name)}</Badge> : null}
        </div>
      </div>

      {target ? (
        <div className="grid gap-3 xl:grid-cols-[290px_1fr]">
          <div className="rounded-md border border-primary/35 bg-primary/10 p-3">
            <div className="flex items-start gap-3">
              {target.player.avatar_url ? (
                <img className="h-11 w-11 rounded-md border border-border object-cover" src={target.player.avatar_url} />
              ) : (
                <div className="grid h-11 w-11 place-items-center rounded-md border border-border bg-secondary">
                  <Crosshair className="h-4 w-4 text-muted-foreground" />
                </div>
              )}
              <div className="min-w-0">
                <div className="truncate font-semibold">{compactText(target.player.display_name ?? target.player.name)}</div>
                <div className="text-xs text-muted-foreground">{compactText(target.player.steam_id ?? target.player.battlemetrics_player_id)}</div>
                <div className="mt-2 flex flex-wrap gap-1">
                  <Badge variant={target.live_player?.is_online ? "success" : "outline"}>{target.live_player?.is_online ? "online" : "offline"}</Badge>
                  {target.watch?.watched ? <Badge variant={riskBadgeVariant(target.watch.risk_level)}>{compactText(target.watch.risk_level)}</Badge> : null}
                </div>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Fact label="Grid" value={compactText(target.live_player?.map_grid)} />
              <Fact label="Team" value={compactText(target.live_player?.team_id)} />
            </div>
          </div>

          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {items.slice(0, 12).map((item, index) => (
              <RelationNodeCard key={relationItemUIKey(item, index)} item={item} onOpenPlayer={onOpenPlayer} />
            ))}
            {!items.length ? <EmptyState label={loading ? "Loading relation graph" : "No relation links yet"} /> : null}
          </div>
        </div>
      ) : (
        <EmptyState label={loading ? "Loading relation graph" : "Resolve a player to build graph"} />
      )}

      {evidence.length ? (
        <div className="mt-4">
          <div className="mb-2 text-sm font-medium">Latest Evidence</div>
          <div className="grid max-h-[210px] gap-2 overflow-auto">
            {evidence.slice(0, 6).map((event) => (
              <div key={String(event.id)} className="grid gap-2 rounded-md border border-border bg-background/45 p-2 md:grid-cols-[140px_160px_1fr_70px]">
                <div className="text-xs text-muted-foreground">{formatDateTime(event.occurred_at)}</div>
                <div>
                  <div className="truncate text-sm font-medium">{compactText(event.evidence_type)}</div>
                  <div className="text-xs text-muted-foreground">{compactText(event.source)}</div>
                </div>
                <div className="truncate text-sm">{compactText(event.reason)}</div>
                <Badge variant={Number(event.score_delta ?? 0) >= 40 ? "success" : "secondary"}>+{compactText(event.score_delta)}</Badge>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function RelationNodeCard({ item, onOpenPlayer }: { item: PlayerRelationItem; onOpenPlayer: (player: PlayerIntel) => void }) {
  const player = item.player;
  const live = item.live_player;
  const displayName = player?.display_name ?? player?.name ?? live?.display_name;
  return (
    <div className="rounded-md border border-border bg-background/55 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">{compactText(displayName)}</div>
          <div className="text-xs text-muted-foreground">{compactText(player?.steam_id ?? live?.steam_id ?? player?.battlemetrics_player_id ?? live?.battlemetrics_player_id)}</div>
        </div>
        <Badge variant={relationScoreVariant(item.score)}>{compactText(item.score)}%</Badge>
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        <Badge variant="secondary">{compactText(item.relation_type ?? item.source)}</Badge>
        {live?.is_online ? <Badge variant="success">online</Badge> : null}
        {item.watch?.watched ? <Badge variant={riskBadgeVariant(item.watch.risk_level)}>{compactText(item.watch.risk_level)}</Badge> : null}
      </div>
      <div className="mt-2 max-h-10 overflow-hidden text-xs leading-5 text-muted-foreground">{relationReasonSummary(item.reasons)}</div>
      <div className="mt-3 flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">grid {compactText(live?.map_grid)} / team {compactText(live?.team_id)}</span>
        <Button size="sm" variant="secondary" onClick={() => player && onOpenPlayer(player)} disabled={!player?.id}>
          Intel
        </Button>
      </div>
    </div>
  );
}

function PlayerNetworkPanel({
  api,
  data,
  loading,
  onOpenPlayer,
  onChanged,
}: {
  api: ReturnType<typeof createApiClient>;
  data?: PlayerNetwork;
  loading: boolean;
  onOpenPlayer: (player: PlayerIntel) => void;
  onChanged: () => void;
}) {
  const nodes = data?.nodes ?? [];
  const counts = data?.counts ?? {};
  const promote = useMutation({
    mutationFn: ({ liveId, riskLevel }: { liveId: string; riskLevel?: QuickRiskLevel; open: boolean }) =>
      api.promoteLivePlayer(liveId, {
        watch: Boolean(riskLevel),
        risk_level: riskLevel ?? "watch",
        reason: riskLevel ? quickRiskReason("player network", riskLevel) : "Promoted from player network",
        labels: ["network"],
      }),
    onSuccess: (result, variables) => {
      onChanged();
      if (variables.open && result.player?.id) {
        onOpenPlayer(result.player);
      }
    },
  });
  const watchPlayer = useMutation({
    mutationFn: ({ playerId, riskLevel }: { playerId: string; riskLevel: QuickRiskLevel }) =>
      api.updatePlayerWatch(playerId, {
        watched: true,
        risk_level: riskLevel,
        reason: quickRiskReason("player network", riskLevel),
        labels: ["network"],
      }),
    onSuccess: onChanged,
  });
  const actionBusy = promote.isPending || watchPlayer.isPending;
  const actionError = promote.error ?? watchPlayer.error;

  function canActOnNode(node: PlayerNetworkNode) {
    return Boolean(node.player?.id || (node.live_player?.id && (node.live_player.steam_id || node.live_player.battlemetrics_player_id)));
  }

  function openOrPromoteNode(node: PlayerNetworkNode) {
    if (node.player?.id) {
      onOpenPlayer(node.player);
      return;
    }
    if (node.live_player?.id && (node.live_player.steam_id || node.live_player.battlemetrics_player_id)) {
      promote.mutate({ liveId: node.live_player.id, open: true });
    }
  }

  function watchNetworkNode(node: PlayerNetworkNode, riskLevel: QuickRiskLevel) {
    if (node.player?.id) {
      watchPlayer.mutate({ playerId: node.player.id, riskLevel });
      return;
    }
    if (node.live_player?.id && (node.live_player.steam_id || node.live_player.battlemetrics_player_id)) {
      promote.mutate({ liveId: node.live_player.id, riskLevel, open: false });
    }
  }

  return (
    <div className="mb-4 rounded-md border border-border bg-background/45 p-3">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-sm font-medium">Player Network</div>
          <div className="text-xs text-muted-foreground">{compactText(data?.source_status ?? (loading ? "loading" : "no data"))}</div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant={Number(counts.nodes ?? 0) > 0 ? "success" : "outline"}>{compactText(counts.nodes)} nodes</Badge>
          <Badge variant={Number(counts.current_team ?? 0) > 0 ? "success" : "outline"}>{compactText(counts.current_team)} current</Badge>
          <Badge variant={Number(counts.online ?? 0) > 0 ? "success" : "outline"}>{compactText(counts.online)} online</Badge>
          <Badge variant={Number(counts.watched ?? 0) > 0 ? "danger" : "outline"}>{compactText(counts.watched)} watched</Badge>
          <Badge variant={Number(counts.evidence_linked ?? 0) > 0 ? "warning" : "outline"}>{compactText(counts.evidence_linked)} evidence</Badge>
        </div>
      </div>
      <PlayerNetworkEvidenceMatrix
        nodes={nodes}
        busy={actionBusy}
        canAct={canActOnNode}
        onOpenOrPromote={openOrPromoteNode}
      />
      <div className="grid gap-2 lg:grid-cols-2 2xl:grid-cols-3">
        {nodes.slice(0, 18).map((node, index) => (
          <PlayerNetworkNodeCard
            key={node.key ?? relationItemUIKey(node, index)}
            node={node}
            busy={actionBusy}
            canAct={canActOnNode(node)}
            onOpenOrPromote={openOrPromoteNode}
            onWatch={watchNetworkNode}
          />
        ))}
      </div>
      {!nodes.length ? <EmptyState label={loading ? "Loading player network" : "No network evidence yet"} /> : null}
      {actionError ? <div className="mt-3"><StatusLine tone="bad" text={actionError.message} /></div> : null}
    </div>
  );
}

function PlayerNetworkEvidenceMatrix({
  nodes,
  busy,
  canAct,
  onOpenOrPromote,
}: {
  nodes: PlayerNetworkNode[];
  busy?: boolean;
  canAct: (node: PlayerNetworkNode) => boolean;
  onOpenOrPromote: (node: PlayerNetworkNode) => void;
}) {
  const matrix = useMemo(() => networkEvidenceMatrix(nodes), [nodes]);
  if (!nodes.length) return null;
  return (
    <div className="mb-3 grid gap-3 xl:grid-cols-[1.2fr_1fr]">
      <div className="rounded-md border border-border bg-background/50 p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="text-sm font-medium">Strongest Links</div>
          <Badge variant={matrix.strongest.length ? "warning" : "outline"}>{matrix.evidenceNodes} evidence nodes</Badge>
        </div>
        <div className="overflow-auto">
          <Table>
            <thead>
              <tr>
                <Th>Player</Th>
                <Th>Proof</Th>
                <Th>Context</Th>
                <Th></Th>
              </tr>
            </thead>
            <tbody>
              {matrix.strongest.map((node, index) => {
                const summary = objectFrom(node.evidence_summary);
                const player = node.player;
                const live = node.live_player;
                return (
                  <tr key={node.key ?? relationItemUIKey(node, index)}>
                    <Td>
                      <div className="font-medium">{compactText(player?.display_name ?? player?.name ?? live?.display_name)}</div>
                      <div className="text-xs text-muted-foreground">{compactText(player?.steam_id ?? live?.steam_id ?? player?.battlemetrics_player_id ?? live?.battlemetrics_player_id)}</div>
                    </Td>
                    <Td>
                      <Badge variant={relationScoreVariant(Number(node.score ?? 0))}>{compactText(node.score)}%</Badge>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {compactText(summary.count)} proofs / +{compactText(node.evidence_score ?? summary.score_total)}
                      </div>
                    </Td>
                    <Td>
                      <div className="max-w-[260px] truncate text-sm">{compactText(summary.latest_reason ?? reasonSummary(node.reasons))}</div>
                      <div className="text-xs text-muted-foreground">
                        {stringList(summary.servers).slice(0, 2).map(compactText).join(", ")}
                      </div>
                    </Td>
                    <Td className="text-right">
                      <Button size="sm" variant="secondary" onClick={() => onOpenOrPromote(node)} disabled={!canAct(node) || busy}>
                        {player?.id ? "Intel" : "Promote"}
                      </Button>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
          {!matrix.strongest.length ? <EmptyState label="No evidence-linked nodes yet" /> : null}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-1">
        <NetworkAggregateList title="Top Evidence Servers" items={matrix.servers} empty="No repeated servers yet" />
        <NetworkAggregateList title="Source Mix" items={matrix.sources} empty="No source mix yet" />
        <NetworkAggregateList title="Evidence Types" items={matrix.types} empty="No evidence types yet" />
      </div>
    </div>
  );
}

function NetworkAggregateList({ title, items, empty }: { title: string; items: Array<{ value: string; count: number; score: number }>; empty: string }) {
  return (
    <div className="rounded-md border border-border bg-background/50 p-3">
      <div className="mb-2 text-sm font-medium">{title}</div>
      <div className="grid gap-1">
        {items.slice(0, 5).map((item) => (
          <div key={item.value} className="grid grid-cols-[1fr_auto_auto] items-center gap-2 text-xs">
            <span className="truncate text-muted-foreground">{compactText(item.value)}</span>
            <Badge variant="outline">{item.count}</Badge>
            {item.score ? <Badge variant="warning">+{item.score}</Badge> : null}
          </div>
        ))}
        {!items.length ? <div className="text-xs text-muted-foreground">{empty}</div> : null}
      </div>
    </div>
  );
}

function PlayerNetworkNodeCard({
  node,
  busy,
  canAct,
  onOpenOrPromote,
  onWatch,
}: {
  node: PlayerNetworkNode;
  busy?: boolean;
  canAct: boolean;
  onOpenOrPromote: (node: PlayerNetworkNode) => void;
  onWatch: (node: PlayerNetworkNode, riskLevel: QuickRiskLevel) => void;
}) {
  const player = node.player;
  const live = node.live_player;
  const summary = node.evidence_summary ?? {};
  const evidence = node.evidence ?? [];
  const displayName = player?.display_name ?? player?.name ?? live?.display_name;
  const evidenceCount = Number(summary.count ?? 0);
  const evidenceScore = Number(node.evidence_score ?? summary.score_total ?? 0);
  const servers = stringList(summary.servers).slice(0, 3);
  const sources = stringList(summary.sources).slice(0, 3);
  const types = recordList(summary.types).slice(0, 3);
  const latestAt = String(summary.last_evidence_at ?? node.last_seen_at ?? node.calculated_at ?? "");
  return (
    <div className="rounded-md border border-border bg-background/55 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">{compactText(displayName)}</div>
          <div className="text-xs text-muted-foreground">
            {compactText(player?.steam_id ?? live?.steam_id ?? player?.battlemetrics_player_id ?? live?.battlemetrics_player_id)}
          </div>
        </div>
        <Badge variant={relationScoreVariant(node.score)}>{compactText(node.score)}%</Badge>
      </div>

      <div className="mt-2 flex flex-wrap gap-1">
        <Badge variant={node.is_current_team ? "success" : "secondary"}>{node.is_current_team ? "current team" : compactText(node.relation_type ?? node.source)}</Badge>
        {node.is_online || live?.is_online ? <Badge variant="success">online</Badge> : null}
        {node.watch?.watched ? <Badge variant={riskBadgeVariant(node.watch.risk_level)}>{compactText(node.watch.risk_level)}</Badge> : null}
        {evidenceCount ? <Badge variant="warning">{evidenceCount} proofs</Badge> : null}
        {evidenceScore ? <Badge variant="outline">+{compactText(evidenceScore)}</Badge> : null}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <Fact label="Grid" value={compactText(live?.map_grid)} />
        <Fact label="Team" value={compactText(live?.team_id)} />
        <Fact label="Last" value={formatDateTime(latestAt)} wide />
      </div>

      <div className="mt-3 text-xs text-muted-foreground">
        <div className="line-clamp-2">{compactText(summary.latest_reason ?? reasonSummary(node.reasons))}</div>
        {servers.length ? <div className="mt-1 truncate">servers {servers.map(compactText).join(", ")}</div> : null}
        {sources.length ? <div className="mt-1 truncate">sources {sources.map(compactText).join(", ")}</div> : null}
      </div>

      {types.length ? (
        <div className="mt-2 flex flex-wrap gap-1">
          {types.map((type) => (
            <Badge key={String(type.type)} variant="outline">
              {compactText(type.type)} {compactText(type.count)}
            </Badge>
          ))}
        </div>
      ) : null}

      {evidence.length ? (
        <div className="mt-3 grid gap-1">
          {evidence.slice(0, 2).map((event) => (
            <div key={String(event.id)} className="truncate border-t border-border pt-1 text-xs text-muted-foreground">
              {formatDateTime(String(event.occurred_at ?? ""))} - {compactText(event.evidence_type)} - {compactText(event.reason)}
            </div>
          ))}
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap justify-end gap-2">
        {!node.watch?.watched ? (
          <QuickRiskActions busy={busy} canAct={canAct} onSelect={(level) => onWatch(node, level)} />
        ) : null}
        <Button size="sm" variant="secondary" onClick={() => onOpenOrPromote(node)} disabled={!canAct || busy}>
          {player?.id ? "Intel" : "Promote"}
        </Button>
      </div>
    </div>
  );
}

function PlayerServerHistoryPanel({
  data,
  loading,
  onOpenPlayer,
}: {
  data?: PlayerServerHistory;
  loading: boolean;
  onOpenPlayer: (player: PlayerIntel) => void;
}) {
  const counts = data?.counts ?? {};
  const topServers = data?.top_servers ?? [];
  const sessions = data?.recent_sessions ?? [];
  const companions = data?.companions ?? [];
  const evidenceServers = data?.evidence_servers ?? [];
  const currentServer = data?.target?.current_server;
  return (
    <div className="mb-4 rounded-md border border-border bg-background/45 p-3">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-sm font-medium">Server History</div>
          <div className="text-xs text-muted-foreground">{compactText(data?.source_status ?? (loading ? "loading" : "no data"))}</div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant={Number(counts.top_servers ?? 0) > 0 ? "success" : "outline"}>{compactText(counts.top_servers)} servers</Badge>
          <Badge variant={Number(counts.recent_sessions ?? 0) > 0 ? "success" : "outline"}>{compactText(counts.recent_sessions)} sessions</Badge>
          <Badge variant={Number(counts.companions ?? 0) > 0 ? "warning" : "outline"}>{compactText(counts.companions)} overlaps</Badge>
          <Badge variant={Number(counts.evidence_servers ?? 0) > 0 ? "warning" : "outline"}>{compactText(counts.evidence_servers)} proof servers</Badge>
        </div>
      </div>

      {currentServer ? (
        <div className="mb-3 grid gap-2 rounded-md border border-primary/35 bg-primary/10 p-3 md:grid-cols-[1fr_auto_auto_auto]">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">{compactText(currentServer.name)}</div>
            <div className="text-xs text-muted-foreground">{compactText(currentServer.battlemetrics_server_id)}</div>
          </div>
          <Fact label="Online" value={`${compactText(currentServer.players)} / ${compactText(currentServer.max_players)}`} />
          <Fact label="Rank" value={compactText(currentServer.rank)} />
          {currentServer.rustmaps_url ? (
            <a className="self-center text-sm text-primary underline-offset-4 hover:underline" href={currentServer.rustmaps_url} target="_blank" rel="noreferrer">
              RustMaps
            </a>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-3 xl:grid-cols-[1fr_1.2fr]">
        <div className="grid gap-3">
          <div className="rounded-md border border-border bg-background/50 p-3">
            <div className="mb-2 text-sm font-medium">Top Servers</div>
            <div className="grid max-h-[260px] gap-2 overflow-auto">
              {topServers.slice(0, 8).map((server, index) => (
                <div key={`${String(server.battlemetrics_server_id)}-${index}`} className="rounded-md border border-border p-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{compactText(server.server_name ?? server.battlemetrics_server_id)}</div>
                      <div className="text-xs text-muted-foreground">{compactText(server.session_count)} sessions / {compactText(server.total_duration)}</div>
                    </div>
                    <Badge variant="outline">{formatDateTime(server.last_seen_at)}</Badge>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">{compactText(server.battlemetrics_server_id)}</div>
                </div>
              ))}
              {!topServers.length ? <EmptyState label="No cached server sessions yet" /> : null}
            </div>
          </div>

          <div className="rounded-md border border-border bg-background/50 p-3">
            <div className="mb-2 text-sm font-medium">Evidence Servers</div>
            <div className="grid max-h-[220px] gap-2 overflow-auto">
              {evidenceServers.slice(0, 8).map((item, index) => {
                const server = objectFrom(item.server);
                return (
                  <div key={`${String(server.battlemetrics_server_id)}-${index}`} className="rounded-md border border-border p-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{compactText(server.name ?? server.battlemetrics_server_id)}</div>
                        <div className="text-xs text-muted-foreground">{stringList(item.evidence_types).map(compactText).join(", ")}</div>
                      </div>
                      <Badge variant="warning">+{compactText(item.total_score_delta)}</Badge>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {compactText(item.evidence_count)} proofs / {formatDateTime(item.last_evidence_at)}
                    </div>
                  </div>
                );
              })}
              {!evidenceServers.length ? <EmptyState label="No server evidence yet" /> : null}
            </div>
          </div>
        </div>

        <div className="grid gap-3">
          <div className="rounded-md border border-border bg-background/50 p-3">
            <div className="mb-2 text-sm font-medium">Repeated Companions By Server</div>
            <div className="overflow-auto">
              <Table>
                <thead>
                  <tr>
                    <Th>Player</Th>
                    <Th>Server</Th>
                    <Th>Overlap</Th>
                    <Th>Last</Th>
                    <Th></Th>
                  </tr>
                </thead>
                <tbody>
                  {companions.slice(0, 12).map((item, index) => {
                    const player = objectFrom(item.player) as PlayerIntel;
                    const server = objectFrom(item.server);
                    return (
                      <tr key={`${String(player.id ?? player.steam_id)}-${String(server.battlemetrics_server_id)}-${index}`}>
                        <Td>
                          <div className="font-medium">{compactText(player.display_name ?? player.name)}</div>
                          <div className="text-xs text-muted-foreground">{compactText(player.steam_id ?? player.battlemetrics_player_id)}</div>
                        </Td>
                        <Td>
                          <div className="max-w-[260px] truncate">{compactText(server.name ?? server.battlemetrics_server_id)}</div>
                          <div className="text-xs text-muted-foreground">{compactText(server.battlemetrics_server_id)}</div>
                        </Td>
                        <Td>
                          <Badge variant="warning">{compactText(item.overlap_duration)}</Badge>
                          <div className="text-xs text-muted-foreground">{compactText(item.overlap_sessions)} sessions</div>
                        </Td>
                        <Td>{formatDateTime(item.last_overlap_at)}</Td>
                        <Td className="text-right">
                          <Button size="sm" variant="secondary" onClick={() => onOpenPlayer(player)} disabled={!player.id}>
                            Intel
                          </Button>
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
              {!companions.length ? <EmptyState label="No repeated companions from cached sessions yet" /> : null}
            </div>
          </div>

          <div className="rounded-md border border-border bg-background/50 p-3">
            <div className="mb-2 text-sm font-medium">Recent Cached Sessions</div>
            <div className="grid max-h-[260px] gap-2 overflow-auto">
              {sessions.slice(0, 12).map((session) => (
                <div key={String(session.id)} className="grid gap-2 rounded-md border border-border p-2 md:grid-cols-[1fr_auto_auto]">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{compactText(session.server_name ?? session.battlemetrics_server_id)}</div>
                    <div className="text-xs text-muted-foreground">
                      {formatDateTime(session.started_at)} - {formatDateTime(session.ended_at)}
                    </div>
                  </div>
                  <Badge variant="outline">{formatSeconds(Number(session.duration_seconds ?? 0))}</Badge>
                  <Badge variant="secondary">{compactText(session.source)}</Badge>
                </div>
              ))}
              {!sessions.length ? <EmptyState label="No cached sessions yet" /> : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PlayerTimelinePanel({ data, loading }: { data?: PlayerTimeline; loading: boolean }) {
  const [typeFilter, setTypeFilter] = useState<PlayerTimelineFilter>("all");
  const [searchText, setSearchText] = useState("");
  const items = data?.items ?? [];
  const counts = data?.counts ?? {};
  const filteredItems = useMemo(
    () => items.filter((item) => timelineTypeMatches(item, typeFilter) && timelineSearchMatches(item, searchText)),
    [items, searchText, typeFilter],
  );
  return (
    <div className="mb-4 rounded-md border border-border bg-background/45 p-3">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-sm font-medium">Activity Timeline</div>
          <div className="text-xs text-muted-foreground">{compactText(data?.source_status ?? (loading ? "loading" : "no data"))}</div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant={Number(counts.live ?? 0) > 0 ? "success" : "outline"}>live {compactText(counts.live)}</Badge>
          <Badge variant={Number(counts.session ?? 0) > 0 ? "success" : "outline"}>sessions {compactText(counts.session)}</Badge>
          <Badge variant={Number(counts.evidence ?? 0) > 0 ? "success" : "outline"}>evidence {compactText(counts.evidence)}</Badge>
          <Badge variant={Number(counts.activity ?? 0) > 0 ? "success" : "outline"}>activity {compactText(counts.activity)}</Badge>
        </div>
      </div>
      <div className="mb-3 grid gap-2 xl:grid-cols-[1fr_auto_auto]">
        <Input
          value={searchText}
          onChange={(event) => setSearchText(event.target.value)}
          placeholder="Search timeline by server, source, related player, grid, team, title"
        />
        <div className="flex flex-wrap gap-1">
          {(["all", "live", "session", "evidence", "activity"] as PlayerTimelineFilter[]).map((filter) => (
            <Button key={filter} size="sm" variant={typeFilter === filter ? "default" : "secondary"} onClick={() => setTypeFilter(filter)}>
              {timelineFilterLabel(filter)}
            </Button>
          ))}
        </div>
        <div className="flex items-center gap-2 rounded-md border border-border bg-background/45 px-3 py-2 text-sm text-muted-foreground">
          <SlidersHorizontal className="h-4 w-4" />
          <span>{filteredItems.length} / {items.length} shown</span>
        </div>
      </div>
      <div className="max-h-[460px] overflow-auto rounded-md border border-border">
        {filteredItems.map((item) => (
          <TimelineRow key={`${item.item_type}-${item.id}`} item={item} />
        ))}
        {!items.length ? <EmptyState label={loading ? "Loading timeline" : "No timeline data yet"} /> : null}
        {items.length && !filteredItems.length ? <EmptyState label="No timeline events match current filters" /> : null}
      </div>
    </div>
  );
}

function TimelineRow({ item }: { item: PlayerTimelineItem }) {
  return (
    <div className="grid gap-3 border-b border-border p-3 last:border-0 md:grid-cols-[150px_130px_1fr_220px]">
      <div>
        <div className="text-sm font-medium">{formatDateTime(item.occurred_at)}</div>
        <div className="mt-1 text-xs text-muted-foreground">{compactText(item.source)}</div>
      </div>
      <div className="flex flex-wrap items-start gap-1">
        <Badge variant={timelineTypeVariant(item.item_type)}>{compactText(item.item_type)}</Badge>
        {item.severity ? <Badge variant={timelineSeverityVariant(item.severity)}>{compactText(item.severity)}</Badge> : null}
      </div>
      <div className="min-w-0">
        <div className="truncate font-medium">{compactText(item.title)}</div>
        <div className="truncate text-xs text-muted-foreground">{compactText(item.subtitle)}</div>
        <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">{timelineDetailText(item)}</div>
        {item.related_player ? (
          <div className="mt-1 text-xs text-muted-foreground">
            related {compactText(item.related_player.display_name ?? item.related_player.steam_id)}
          </div>
        ) : null}
      </div>
      <div className="grid gap-1 text-xs text-muted-foreground">
        <div className="truncate">server {compactText(item.server?.name ?? item.server?.battlemetrics_server_id)}</div>
        {item.live_player ? <div className="truncate">grid {compactText(item.live_player.map_grid)} / team {compactText(item.live_player.team_id)}</div> : null}
        {item.score_delta !== undefined ? <div>score +{compactText(item.score_delta)}</div> : null}
      </div>
    </div>
  );
}

function TeamProbabilityTable({ items }: { items: TeamProbability[] }) {
  return (
    <div className="overflow-auto rounded-md border border-border">
      <Table>
        <thead>
          <tr>
            <Th>Likely teammate</Th>
            <Th>Score</Th>
            <Th>Source</Th>
            <Th>Updated</Th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.player.id ?? item.player.steam_id ?? item.player.battlemetrics_player_id}>
              <Td>
                <div className="font-medium">{compactText(item.player.display_name ?? item.player.name)}</div>
                <div className="text-xs text-muted-foreground">{compactText(item.player.steam_id ?? item.player.battlemetrics_player_id)}</div>
              </Td>
              <Td>
                <Badge variant={item.score >= 70 ? "danger" : item.score >= 40 ? "warning" : "outline"}>{item.score}%</Badge>
              </Td>
              <Td>
                <div>{compactText(item.source)}</div>
                <div className="max-w-[320px] truncate text-xs text-muted-foreground">{reasonSummary(item.reasons)}</div>
              </Td>
              <Td>{formatDateTime(item.calculated_at)}</Td>
            </tr>
          ))}
        </tbody>
      </Table>
      {!items.length ? <EmptyState label="No team probability yet" /> : null}
    </div>
  );
}

function reasonSummary(reasons: unknown) {
  const parsed = typeof reasons === "string" ? safeJSON(reasons) : reasons;
  const items = Array.isArray(parsed) ? parsed : [];
  const latest = items[items.length - 1] as Record<string, unknown> | undefined;
  return compactText(latest?.reason ?? latest?.type);
}

function stringList(value: unknown) {
  return Array.isArray(value) ? value.map((item) => String(item)).filter(Boolean) : [];
}

function recordList(value: unknown) {
  return Array.isArray(value) ? (value.filter((item) => item && typeof item === "object") as Array<Record<string, unknown>>) : [];
}

function objectFrom(value: unknown) {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function stringFromUnknown(value: unknown) {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

function serverDescription(server?: ServerIntel | null) {
  const raw = objectFrom(objectFrom(server).raw);
  const attributes = objectFrom(raw.attributes);
  const details = objectFrom(attributes.details);
  const candidates = [
    attributes.description,
    details.description,
    details.rust_description,
  ];
  return candidates.map(stringFromUnknown).find((value) => value.trim().length > 0)?.trim() ?? "";
}

function serverSnapshotSummary(snapshots: ServerSnapshot[], server?: ServerIntel | null) {
  const fallbackPlayers = Number(server?.players ?? 0);
  const players = snapshots
    .map((snapshot) => Number(snapshot.players ?? 0))
    .filter((value) => Number.isFinite(value));
  const ranks = snapshots
    .map((snapshot) => Number(snapshot.rank ?? 0))
    .filter((value) => Number.isFinite(value) && value > 0);
  const latestOnline = snapshots.length ? Number(snapshots[0].players ?? 0) : fallbackPlayers;
  const oldestOnline = snapshots.length ? Number(snapshots[snapshots.length - 1].players ?? 0) : fallbackPlayers;
  const peakPlayers = players.length ? Math.max(...players) : fallbackPlayers;
  const avgPlayers = players.length ? Math.round(players.reduce((sum, value) => sum + value, 0) / players.length) : fallbackPlayers;
  const bestRank = ranks.length ? Math.min(...ranks) : server?.rank ?? undefined;
  return {
    latestOnline,
    peakPlayers,
    avgPlayers,
    bestRank,
    deltaPlayers: latestOnline - oldestOnline,
  };
}

function formatSignedNumber(value: number) {
  if (!Number.isFinite(value) || value === 0) return "0";
  return value > 0 ? `+${value}` : String(value);
}

function decodeJwtPayload(token: string) {
  const payload = token.split(".")[1];
  if (!payload || typeof atob !== "function" || typeof TextDecoder === "undefined") return null;

  try {
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    const parsed = JSON.parse(new TextDecoder().decode(bytes));
    return objectFrom(parsed);
  } catch {
    return null;
  }
}

function profileClaim(claims: Record<string, unknown> | null, keys: string[]) {
  for (const key of keys) {
    const text = claimDisplayValue(claims?.[key]);
    if (text) return text;
  }
  return undefined;
}

function profileClaimList(claims: Record<string, unknown> | null, keys: string[]) {
  const raw = keys.map((key) => claims?.[key]).find((value) => value !== undefined && value !== null && value !== "");
  if (Array.isArray(raw)) return raw.map(claimDisplayValue).filter(Boolean);
  if (typeof raw === "string") return raw.split(/[,\s]+/).map((item) => item.trim()).filter(Boolean);
  const single = claimDisplayValue(raw);
  return single ? [single] : [];
}

function profileClaimRows(claims: Record<string, unknown> | null) {
  const hidden = new Set(["exp", "iat", "nbf"]);
  return Object.entries(claims ?? {})
    .filter(([key, value]) => !hidden.has(key) && !key.toLowerCase().includes("token") && claimDisplayValue(value))
    .slice(0, 12)
    .map(([key, value]) => ({ key, value: claimDisplayValue(value) }));
}

function claimDisplayValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "";
  if (Array.isArray(value)) return value.map(claimDisplayValue).filter(Boolean).join(", ");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function jwtTimestampMs(claims: Record<string, unknown> | null, key: string) {
  const value = claims?.[key];
  const numeric = typeof value === "number" ? value : typeof value === "string" ? Number(value) : 0;
  if (!Number.isFinite(numeric) || numeric <= 0) return 0;
  return numeric > 1_000_000_000_000 ? numeric : numeric * 1000;
}

function formatJwtTime(claims: Record<string, unknown> | null, key: string) {
  const value = jwtTimestampMs(claims, key);
  return value ? formatDateTime(new Date(value).toISOString()) : "-";
}

function ageSecondsFromDate(value: unknown) {
  const time = dateMs(value);
  if (!time) return null;
  return Math.max(0, Math.floor((Date.now() - time) / 1000));
}

function formatSeconds(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "-";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

function positionText(player: LivePlayer) {
  const pos = player.position;
  if (typeof pos?.x !== "number" && typeof pos?.z !== "number") return "-";
  return `${Math.round(pos?.x ?? 0)} / ${Math.round(pos?.y ?? 0)} / ${Math.round(pos?.z ?? 0)}`;
}

function relationReasonSummary(reasons: unknown) {
  const parsed = typeof reasons === "string" ? safeJSON(reasons) : reasons;
  const items = Array.isArray(parsed) ? parsed : [];
  if (!items.length) return "-";
  return items
    .slice(-2)
    .map((item) => {
      const entry = item as Record<string, unknown>;
      return compactText(entry.reason ?? entry.type);
    })
    .join(" / ");
}

function relationScoreVariant(score: number) {
  if (score >= 80) return "danger";
  if (score >= 50) return "warning";
  if (score >= 30) return "success";
  return "outline";
}

function relationItemUIKey(item: PlayerRelationItem, index: number) {
  return item.player?.id ?? item.player?.steam_id ?? item.live_player?.steam_id ?? item.live_player?.id ?? String(index);
}

function QuickRiskActions({
  busy,
  canAct,
  onSelect,
}: {
  busy?: boolean;
  canAct: boolean;
  onSelect: (level: QuickRiskLevel) => void;
}) {
  return (
    <div className="flex flex-wrap justify-end gap-1">
      {quickRiskLevels.map((level) => (
        <Button
          key={level}
          size="sm"
          variant={level === "hostile" ? "destructive" : level === "suspect" ? "secondary" : "ghost"}
          onClick={() => onSelect(level)}
          disabled={!canAct || busy}
        >
          {riskActionLabel(level)}
        </Button>
      ))}
    </div>
  );
}

function riskActionLabel(level: QuickRiskLevel) {
  if (level === "watch") return "Watch";
  if (level === "suspect") return "Suspect";
  return "Hostile";
}

function quickRiskReason(source: string, level: QuickRiskLevel) {
  if (level === "watch") return `Flagged from ${source}`;
  if (level === "suspect") return `Marked suspect from ${source}`;
  return `Marked hostile from ${source}`;
}

function safeJSON(value: string) {
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

function riskBadgeVariant(level?: string) {
  if (level === "hostile") return "danger";
  if (level === "suspect") return "warning";
  if (level === "friendly") return "success";
  if (level === "ignored") return "outline";
  return "default";
}

function teamRiskBadgeVariant(level?: string) {
  if (level === "hostile") return "danger";
  if (level === "suspect") return "warning";
  if (level === "watch") return "default";
  return "outline";
}

function isHighRiskTeam(team: { risk_level?: string; watched_count?: number; risk_score?: number }) {
  return team.risk_level === "hostile" || team.risk_level === "suspect" || Number(team.risk_score ?? 0) >= 55;
}

function healthStatusVariant(status?: string) {
  if (status === "ok") return "success";
  if (status === "stale") return "warning";
  if (status === "silent") return "danger";
  return "outline";
}

function liveStatusVariant(status?: string) {
  if (status === "ok") return "success";
  if (status === "recent" || status === "stale") return "warning";
  if (status === "silent") return "danger";
  return "outline";
}

function aliasSourceVariant(source?: string) {
  const value = String(source ?? "").toLowerCase();
  if (value.includes("steam")) return "success";
  if (value.includes("plugin") || value.includes("live")) return "warning";
  if (value.includes("session")) return "secondary";
  if (value.includes("battlemetrics")) return "default";
  return "outline";
}

function alertSeverityVariant(level?: string) {
  if (level === "critical") return "danger";
  if (level === "warning") return "warning";
  return "secondary";
}

function formatAgeSeconds(value?: number | null) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "-";
  if (value < 10) return "now";
  return `${formatSeconds(value)} ago`;
}

function dateMs(value: unknown) {
  if (!value || typeof value !== "string") return 0;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

function numberFromRecord(item: Record<string, unknown>, key: string) {
  const value = item[key];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function countRecordsBy(items: Array<Record<string, unknown>>, key: string) {
  const counts = items.reduce<Record<string, number>>((acc, item) => {
    const value = compactText(item[key]);
    if (value === "-") return acc;
    acc[value] = (acc[value] ?? 0) + 1;
    return acc;
  }, {});
  return Object.entries(counts)
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
}

function networkEvidenceMatrix(nodes: PlayerNetworkNode[]) {
  const servers = new Map<string, { value: string; count: number; score: number }>();
  const sources = new Map<string, { value: string; count: number; score: number }>();
  const types = new Map<string, { value: string; count: number; score: number }>();
  let evidenceNodes = 0;

  for (const node of nodes) {
    const summary = objectFrom(node.evidence_summary);
    const proofCount = numberFromRecord(summary, "count");
    const score = Number(node.evidence_score ?? summary.score_total ?? 0);
    if (proofCount > 0 || score > 0) evidenceNodes += 1;

    for (const server of stringList(summary.servers)) {
      addNetworkAggregate(servers, server, 1, score);
    }
    for (const source of stringList(summary.sources)) {
      addNetworkAggregate(sources, source, 1, score);
    }
    for (const type of recordList(summary.types)) {
      const name = compactText(type.type);
      if (name !== "-") addNetworkAggregate(types, name, numberFromRecord(type, "count") || 1, score);
    }
  }

  const strongest = [...nodes]
    .filter((node) => numberFromRecord(objectFrom(node.evidence_summary), "count") > 0 || Number(node.evidence_score ?? 0) > 0)
    .sort((a, b) => {
      const scoreA = Number(a.evidence_score ?? objectFrom(a.evidence_summary).score_total ?? 0);
      const scoreB = Number(b.evidence_score ?? objectFrom(b.evidence_summary).score_total ?? 0);
      if (scoreA !== scoreB) return scoreB - scoreA;
      return Number(b.score ?? 0) - Number(a.score ?? 0);
    })
    .slice(0, 6);

  return {
    evidenceNodes,
    strongest,
    servers: sortedNetworkAggregates(servers),
    sources: sortedNetworkAggregates(sources),
    types: sortedNetworkAggregates(types),
  };
}

function addNetworkAggregate(target: Map<string, { value: string; count: number; score: number }>, value: string, count: number, score: number) {
  const key = value.trim();
  if (!key) return;
  const current = target.get(key) ?? { value: key, count: 0, score: 0 };
  current.count += count;
  current.score += Number.isFinite(score) ? score : 0;
  target.set(key, current);
}

function sortedNetworkAggregates(values: Map<string, { value: string; count: number; score: number }>) {
  return Array.from(values.values()).sort((a, b) => b.count - a.count || b.score - a.score || a.value.localeCompare(b.value));
}

type ActivityStats = {
  total: number;
  warning: number;
  error: number;
  operatorNotes: number;
};

function activityStats(items: Array<Record<string, unknown>>) {
  return items.reduce<ActivityStats>(
    (acc, item) => {
      acc.total += 1;
      if (item.severity === "warning") acc.warning += 1;
      if (item.severity === "error" || item.severity === "critical") acc.error += 1;
      if (item.event_type === "operator_note") acc.operatorNotes += 1;
      return acc;
    },
    { total: 0, warning: 0, error: 0, operatorNotes: 0 },
  );
}

function activityOptionCounts(items: Array<Record<string, unknown>>, key: string) {
  return countRecordsBy(items, key).slice(0, 12);
}

function activitySeverityMatches(item: Record<string, unknown>, filter: ActivitySeverityFilter) {
  if (filter === "all") return true;
  if (filter === "error") return item.severity === "error" || item.severity === "critical";
  return item.severity === filter;
}

function activitySourceMatches(item: Record<string, unknown>, filter: string) {
  return filter === "all" || compactText(item.source) === filter;
}

function activityTypeMatches(item: Record<string, unknown>, filter: string) {
  return filter === "all" || compactText(item.event_type) === filter;
}

function activitySearchMatches(item: Record<string, unknown>, searchText: string) {
  const query = searchText.trim().toLowerCase();
  if (!query) return true;
  return [
    item.event_type,
    item.severity,
    item.source,
    activityPayloadTitle(item.payload),
    activityPayloadSummary(item.payload),
    payloadJSON(item.payload),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .includes(query);
}

function activityPayloadTitle(value: unknown) {
  const payload = objectFrom(value);
  return String(payload.title ?? payload.event ?? payload.reason ?? payload.type ?? "");
}

function activityPayloadSummary(value: unknown) {
  const summary = payloadSummary(value);
  if (summary) return summary;
  return payloadJSON(value);
}

function timelineTypeMatches(item: PlayerTimelineItem, filter: PlayerTimelineFilter) {
  return filter === "all" || item.item_type === filter;
}

function timelineFilterLabel(filter: PlayerTimelineFilter) {
  if (filter === "all") return "All timeline";
  if (filter === "session") return "Sessions";
  return filter;
}

function timelineSearchMatches(item: PlayerTimelineItem, searchText: string) {
  const query = searchText.trim().toLowerCase();
  if (!query) return true;
  const related = item.related_player ?? {};
  const values = [
    item.item_type,
    item.source,
    item.severity,
    item.title,
    item.subtitle,
    item.server?.name,
    item.server?.battlemetrics_server_id,
    item.live_player?.map_grid,
    item.live_player?.team_id,
    item.live_player?.server_name,
    item.live_player?.steam_id,
    item.live_player?.battlemetrics_player_id,
    related.display_name,
    related.name,
    related.steam_id,
    related.battlemetrics_player_id,
    timelineDetailText(item),
  ];
  return values
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .includes(query);
}

function timelineDetailText(item: PlayerTimelineItem) {
  const parts = [
    item.score_delta !== undefined ? `score +${compactText(item.score_delta)}` : "",
    item.session ? `session ${compactText(item.session.server_name ?? item.session.battlemetrics_server_id)} ${compactText(item.session.duration_seconds)}` : "",
    payloadSummary(item.payload),
  ].filter(Boolean);
  return compactText(parts.join(" / "));
}

function payloadSummary(value: unknown) {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    const payload = value as Record<string, unknown>;
    const labels = Array.isArray(payload.labels) ? payload.labels.map(String).filter(Boolean).join(", ") : "";
    const parts = [payload.title, payload.note, labels ? `labels ${labels}` : ""].filter(Boolean).map(String);
    if (parts.length) return parts.join(" / ");
    return payloadJSON(value);
  }
  return "";
}

function payloadJSON(value: unknown) {
  if (!value) return "";
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return "";
  }
}

function formatRelativeTime(value: unknown) {
  const time = dateMs(value);
  if (!time) return "-";
  const seconds = Math.max(0, Math.floor((Date.now() - time) / 1000));
  if (seconds < 10) return "now";
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86_400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86_400)}d ago`;
}

function formatMeters(value?: number | null) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "-";
  if (value >= 1000) {
    return `${(value / 1000).toFixed(value >= 10_000 ? 0 : 1)}km`;
  }
  return `${Math.round(value)}m`;
}

function alertProximityLabel(item: RustAlertItem) {
  if (!item.same_server_as_me) return "";
  const distance = formatMeters(item.distance_to_me);
  if (item.proximity_status === "near" && distance !== "-") return `near ${distance}`;
  if (item.proximity_status === "close" && distance !== "-") return `close ${distance}`;
  if (distance !== "-") return `${distance} away`;
  return "same server";
}

function alertStats(items: RustAlertItem[]) {
  return items.reduce(
    (acc, item) => {
      if (item.severity === "critical") acc.critical += 1;
      if (item.severity === "warning") acc.warning += 1;
      if (item.same_server_as_me) acc.sameServer += 1;
      if (isNearbyAlert(item)) acc.near += 1;
      return acc;
    },
    { critical: 0, warning: 0, sameServer: 0, near: 0 },
  );
}

function alertSeverityMatches(item: RustAlertItem, filter: AlertSeverityFilter) {
  return filter === "all" || item.severity === filter;
}

function alertScopeMatches(item: RustAlertItem, filter: AlertScopeFilter) {
  if (filter === "all") return true;
  if (filter === "same_server") return Boolean(item.same_server_as_me);
  if (filter === "near") return isNearbyAlert(item);
  return Boolean(item.live_player?.is_online);
}

function isNearbyAlert(item: RustAlertItem) {
  return item.proximity_status === "near" || item.proximity_status === "close";
}

function alertScopeLabel(filter: AlertScopeFilter) {
  if (filter === "all") return "All scope";
  if (filter === "same_server") return "Same server";
  if (filter === "near") return "Near";
  return "Online";
}

function proximityBadgeVariant(status?: string) {
  if (status === "near") return "danger";
  if (status === "close") return "warning";
  if (status === "same_server") return "danger";
  return "outline";
}

function timelineTypeVariant(type?: string) {
  if (type === "evidence") return "warning";
  if (type === "live") return "success";
  if (type === "session") return "default";
  return "secondary";
}

function timelineSeverityVariant(level?: string) {
  if (level === "error" || level === "warning") return "warning";
  if (level === "danger" || level === "critical") return "danger";
  if (level === "info") return "secondary";
  return "outline";
}

function normalizeLabels(value: unknown) {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  if (typeof value === "string") return parseLabelsInput(value);
  return [];
}

function formatLabelsInput(value: unknown) {
  return normalizeLabels(value).join(", ");
}

function parseLabelsInput(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function WatchlistSummaryPill({
  label,
  value,
  variant,
}: {
  label: string;
  value: number;
  variant: "default" | "secondary" | "outline" | "danger" | "success" | "warning";
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-background/45 px-3 py-2">
      <span className="text-sm text-muted-foreground">{label}</span>
      <Badge variant={variant}>{value}</Badge>
    </div>
  );
}

function watchlistStats(items: WatchlistItem[]) {
  return items.reduce(
    (acc, item) => {
      acc.total += 1;
      if (item.live_player?.is_online) acc.online += 1;
      if (item.watch.risk_level === "hostile") acc.hostile += 1;
      if (item.watch.risk_level === "suspect") acc.suspect += 1;
      if (item.watch.risk_level === "watch") acc.watch += 1;
      return acc;
    },
    { total: 0, online: 0, hostile: 0, suspect: 0, watch: 0 },
  );
}

function watchlistRiskMatches(item: WatchlistItem, filter: WatchlistRiskFilter) {
  return filter === "all" || item.watch.risk_level === filter;
}

function watchlistLiveMatches(item: WatchlistItem, filter: WatchlistLiveFilter) {
  if (filter === "all") return true;
  return filter === "online" ? Boolean(item.live_player?.is_online) : !item.live_player?.is_online;
}

function watchlistSearchMatches(item: WatchlistItem, searchText: string) {
  const query = searchText.trim().toLowerCase();
  if (!query) return true;
  return [
    item.player.display_name,
    item.player.name,
    item.player.steam_id,
    item.player.battlemetrics_player_id,
    item.watch.reason,
    item.watch.note,
    ...normalizeLabels(item.watch.labels),
    item.current_server?.name,
    item.live_player?.server_name,
    item.live_player?.map_grid,
    item.live_player?.team_id,
    item.live_player?.clan_tag,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .includes(query);
}

function rosterStats(items: ServerLivePlayerItem[]) {
  return items.reduce(
    (acc, item) => {
      if (item.live_player.is_online) acc.online += 1;
      if (item.watch?.watched) acc.watched += 1;
      if (item.watch?.risk_level === "hostile") acc.hostile += 1;
      if (item.watch?.risk_level === "suspect") acc.suspect += 1;
      if (hasMapPosition(item.live_player)) acc.positioned += 1;
      return acc;
    },
    { online: 0, watched: 0, hostile: 0, suspect: 0, positioned: 0 },
  );
}

function rosterTeamOptions(items: ServerLivePlayerItem[]) {
  const byTeam = new Map<string, { id: string; label: string; count: number }>();
  for (const item of items) {
    const live = item.live_player;
    const id = live.team_id || live.clan_tag || "";
    if (!id) continue;
    const label = live.clan_tag && live.team_id ? `${live.clan_tag} / ${live.team_id}` : id;
    const current = byTeam.get(id) ?? { id, label, count: 0 };
    current.count += 1;
    if (current.label === id && label !== id) current.label = label;
    byTeam.set(id, current);
  }
  return Array.from(byTeam.values()).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

function serverRosterFilterMatches(item: ServerLivePlayerItem, filter: ServerRosterFilter) {
  if (filter === "all") return true;
  if (filter === "watched") return Boolean(item.watch?.watched);
  if (filter === "online") return Boolean(item.live_player.is_online);
  if (filter === "clear") return !item.watch?.watched;
  return item.watch?.risk_level === filter;
}

function serverRosterTeamMatches(item: ServerLivePlayerItem, teamFilter: string) {
  if (teamFilter === "all") return true;
  return item.live_player.team_id === teamFilter || item.live_player.clan_tag === teamFilter;
}

function serverRosterSearchMatches(item: ServerLivePlayerItem, searchText: string) {
  const query = searchText.trim().toLowerCase();
  if (!query) return true;
  return [
    item.player?.display_name,
    item.player?.name,
    item.player?.steam_id,
    item.player?.battlemetrics_player_id,
    item.live_player.display_name,
    item.live_player.steam_id,
    item.live_player.battlemetrics_player_id,
    item.live_player.server_name,
    item.live_player.battlemetrics_server_id,
    item.live_player.team_id,
    item.live_player.clan_tag,
    item.live_player.map_grid,
    item.live_player.source,
    item.watch?.risk_level,
    item.watch?.reason,
    item.watch?.note,
    ...normalizeLabels(item.watch?.labels),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .includes(query);
}

function serverRosterFilterLabel(filter: ServerRosterFilter) {
  if (filter === "all") return "All roster";
  if (filter === "watched") return "Watched";
  if (filter === "online") return "Online";
  if (filter === "clear") return "Clear";
  return riskActionLabel(filter);
}

function TeamEvidenceTable({ items }: { items: Array<Record<string, unknown>> }) {
  return (
    <div className="overflow-auto rounded-md border border-border">
      <Table>
        <thead>
          <tr>
            <Th>Evidence</Th>
            <Th>Players</Th>
            <Th>Score</Th>
            <Th>At</Th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={String(item.id)}>
              <Td>
                <div className="font-medium">{compactText(item.evidence_type)}</div>
                <div className="text-xs text-muted-foreground">{compactText(item.reason)}</div>
              </Td>
              <Td>
                <div>{compactText(item.player_a_name || item.player_a_steam_id)}</div>
                <div className="text-xs text-muted-foreground">{compactText(item.player_b_name || item.player_b_steam_id)}</div>
              </Td>
              <Td>{compactText(item.score_delta)}</Td>
              <Td>{formatDateTime(String(item.occurred_at ?? ""))}</Td>
            </tr>
          ))}
        </tbody>
      </Table>
      {!items.length ? <EmptyState label="No raw evidence yet" /> : null}
    </div>
  );
}

function WatchlistView({
  api,
  onOpenPlayer,
}: {
  api: ReturnType<typeof createApiClient>;
  onOpenPlayer: (playerId: string) => void;
}) {
  const queryClient = useQueryClient();
  const [riskFilter, setRiskFilter] = useState<WatchlistRiskFilter>("all");
  const [liveFilter, setLiveFilter] = useState<WatchlistLiveFilter>("all");
  const [searchText, setSearchText] = useState("");
  const watchlist = useQuery({ queryKey: ["watchlist"], queryFn: api.watchlist, refetchInterval: 5_000 });
  const alerts = useQuery({ queryKey: ["rustAlerts"], queryFn: api.alerts, refetchInterval: 5_000 });
  const clearWatch = useMutation({
    mutationFn: (playerId: string) => api.updatePlayerWatch(playerId, { watched: false, risk_level: "ignored" }),
    onSuccess: () => invalidateWatchlist(),
  });
  const items = watchlist.data ?? [];
  const filteredItems = useMemo(
    () => items.filter((item) => watchlistRiskMatches(item, riskFilter) && watchlistLiveMatches(item, liveFilter) && watchlistSearchMatches(item, searchText)),
    [items, liveFilter, riskFilter, searchText],
  );
  const stats = useMemo(() => watchlistStats(items), [items]);

  function invalidateWatchlist() {
    queryClient.invalidateQueries({ queryKey: ["watchlist"] });
    queryClient.invalidateQueries({ queryKey: ["rustAlerts"] });
    queryClient.invalidateQueries({ queryKey: ["overview"] });
    queryClient.invalidateQueries({ queryKey: ["playerIntel"] });
  }

  return (
    <section className="grid gap-4">
      <Header title="Watchlist" subtitle="Flagged players, live server context and operator notes" />
      {watchlist.error || clearWatch.error ? (
        <StatusLine tone="bad" text={(watchlist.error ?? clearWatch.error)?.message ?? "Request failed"} />
      ) : null}
      <AlertsPanel
        api={api}
        title="Active Watch Alerts"
        items={alerts.data?.items ?? []}
        loading={alerts.isFetching}
        onOpenPlayer={(playerId) => onOpenPlayer(playerId)}
      />
      <Card>
        <CardHeader>
          <CardTitle>Flagged Players</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4 grid gap-3">
            <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
              <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                <WatchlistSummaryPill label="Total" value={stats.total} variant="secondary" />
                <WatchlistSummaryPill label="Hostile" value={stats.hostile} variant="danger" />
                <WatchlistSummaryPill label="Suspect" value={stats.suspect} variant="warning" />
                <WatchlistSummaryPill label="Online" value={stats.online} variant="success" />
              </div>
              <div className="flex items-center gap-2 rounded-md border border-border bg-background/45 px-3 py-2 text-sm text-muted-foreground">
                <SlidersHorizontal className="h-4 w-4" />
                <span>{filteredItems.length} shown</span>
              </div>
            </div>
            <div className="grid gap-2 xl:grid-cols-[1fr_auto_auto]">
              <Input
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                placeholder="Search player, SteamID, server, grid, team, note"
              />
              <div className="flex flex-wrap gap-1">
                {(["all", "hostile", "suspect", "watch"] as WatchlistRiskFilter[]).map((level) => (
                  <Button
                    key={level}
                    size="sm"
                    variant={riskFilter === level ? "default" : "secondary"}
                    onClick={() => setRiskFilter(level)}
                  >
                    {level === "all" ? "All risk" : riskActionLabel(level)}
                  </Button>
                ))}
              </div>
              <div className="flex flex-wrap gap-1">
                {(["all", "online", "offline"] as WatchlistLiveFilter[]).map((state) => (
                  <Button
                    key={state}
                    size="sm"
                    variant={liveFilter === state ? "default" : "secondary"}
                    onClick={() => setLiveFilter(state)}
                  >
                    {state === "all" ? "All live" : state}
                  </Button>
                ))}
              </div>
            </div>
          </div>
          <div className="overflow-auto">
            <Table>
              <thead>
                <tr>
                  <Th>Player</Th>
                  <Th>Risk</Th>
                  <Th>Live</Th>
                  <Th>Server</Th>
                  <Th>Reason</Th>
                  <Th>Labels</Th>
                  <Th>Updated</Th>
                  <Th></Th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item) => (
                  <WatchlistRow
                    key={item.watch.id}
                    api={api}
                    item={item}
                    clearing={clearWatch.isPending}
                    onOpen={() => onOpenPlayer(item.player.id ?? item.watch.player_id)}
                    onClear={() => clearWatch.mutate(item.player.id ?? item.watch.player_id)}
                    onSaved={invalidateWatchlist}
                  />
                ))}
              </tbody>
            </Table>
          </div>
          {!items.length ? <EmptyState label={watchlist.isFetching ? "Loading watchlist" : "-"} /> : null}
          {items.length && !filteredItems.length ? <EmptyState label="No players match current filters" /> : null}
        </CardContent>
      </Card>
    </section>
  );
}

function WatchlistRow({
  api,
  item,
  clearing,
  onOpen,
  onClear,
  onSaved,
}: {
  api: ReturnType<typeof createApiClient>;
  item: WatchlistItem;
  clearing: boolean;
  onOpen: () => void;
  onClear: () => void;
  onSaved: () => void;
}) {
  const live = item.live_player;
  const server = item.current_server;
  const playerId = item.player.id ?? item.watch.player_id;
  const [editing, setEditing] = useState(false);
  const [riskLevel, setRiskLevel] = useState(item.watch.risk_level || "watch");
  const [reason, setReason] = useState(item.watch.reason ?? "");
  const [note, setNote] = useState(item.watch.note ?? "");
  const [labels, setLabels] = useState(formatLabelsInput(item.watch.labels));
  const saveWatch = useMutation({
    mutationFn: (payload: { watched: boolean; risk_level: string; reason?: string; note?: string; labels?: string[] }) =>
      api.updatePlayerWatch(playerId, payload),
    onSuccess: () => {
      onSaved();
      setEditing(false);
    },
  });
  const busy = clearing || saveWatch.isPending;

  useEffect(() => {
    setRiskLevel(item.watch.risk_level || "watch");
    setReason(item.watch.reason ?? "");
    setNote(item.watch.note ?? "");
    setLabels(formatLabelsInput(item.watch.labels));
  }, [item.watch.id, item.watch.risk_level, item.watch.reason, item.watch.note, item.watch.labels]);

  function saveEdit() {
    saveWatch.mutate({
      watched: true,
      risk_level: riskLevel || "watch",
      reason,
      note,
      labels: parseLabelsInput(labels),
    });
  }

  function applyRisk(level: QuickRiskLevel) {
    saveWatch.mutate({
      watched: true,
      risk_level: level,
      reason: item.watch.reason || quickRiskReason("watchlist triage", level),
      note: item.watch.note ?? "",
      labels: normalizeLabels(item.watch.labels),
    });
  }

  return (
    <>
      <tr>
        <Td>
          <div className="flex items-center gap-3">
            {item.player.avatar_url ? (
              <img className="h-9 w-9 rounded-md border border-border object-cover" src={item.player.avatar_url} />
            ) : (
              <div className="grid h-9 w-9 place-items-center rounded-md border border-border bg-secondary">
                <Users className="h-4 w-4 text-muted-foreground" />
              </div>
            )}
            <div className="min-w-[180px]">
              <div className="font-medium">{compactText(item.player.display_name ?? item.player.name)}</div>
              <div className="text-xs text-muted-foreground">{compactText(item.player.steam_id ?? item.player.battlemetrics_player_id)}</div>
            </div>
          </div>
        </Td>
        <Td>
          <div className="grid gap-2">
            <Badge variant={riskBadgeVariant(item.watch.risk_level)}>{compactText(item.watch.risk_level)}</Badge>
            <QuickRiskActions busy={busy} canAct={Boolean(playerId)} onSelect={applyRisk} />
          </div>
        </Td>
        <Td>
          <div className="flex flex-col gap-1">
            <Badge variant={live?.is_online ? "success" : "outline"}>{live?.is_online ? "online" : "offline"}</Badge>
            <span className="text-xs text-muted-foreground">{formatDateTime(live?.last_seen_at)}</span>
          </div>
        </Td>
        <Td>
          <div className="max-w-[320px] truncate font-medium">{compactText(server?.name ?? live?.server_name)}</div>
          <div className="text-xs text-muted-foreground">
            grid {compactText(live?.map_grid)} / team {compactText(live?.team_id)}
          </div>
        </Td>
        <Td>
          <div className="max-w-[260px] truncate">{compactText(item.watch.reason)}</div>
          <div className="max-w-[260px] truncate text-xs text-muted-foreground">{compactText(item.watch.note)}</div>
        </Td>
        <Td>
          <div className="flex max-w-[240px] flex-wrap gap-1">
            {normalizeLabels(item.watch.labels).slice(0, 4).map((label) => (
              <Badge key={label} variant="outline">
                {label}
              </Badge>
            ))}
          </div>
        </Td>
        <Td>{formatDateTime(item.watch.updated_at)}</Td>
        <Td className="text-right">
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="secondary" onClick={onOpen}>
              Open
            </Button>
            <Button size="icon" variant={editing ? "default" : "secondary"} onClick={() => setEditing((value) => !value)} disabled={busy} title="Edit watch note">
              <Pencil className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="ghost" onClick={onClear} disabled={busy}>
              Clear
            </Button>
          </div>
        </Td>
      </tr>
      {editing ? (
        <tr>
          <td colSpan={8} className="border-b border-border px-3 py-3">
            <div className="grid gap-3 rounded-md border border-border bg-background/70 p-3">
              <div className="grid gap-2 xl:grid-cols-[280px_1fr_1fr]">
                <div className="flex flex-wrap gap-1">
                  {(["watch", "suspect", "hostile", "friendly"] as string[]).map((level) => (
                    <Button
                      key={level}
                      size="sm"
                      variant={riskLevel === level ? "default" : "secondary"}
                      onClick={() => setRiskLevel(level)}
                      type="button"
                    >
                      {level}
                    </Button>
                  ))}
                </div>
                <Input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Reason" />
                <Input value={labels} onChange={(event) => setLabels(event.target.value)} placeholder="Labels, comma separated" />
              </div>
              <Input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Operator note" />
              <div className="flex flex-wrap items-center justify-between gap-2">
                {saveWatch.error ? <span className="text-xs text-destructive">{saveWatch.error.message}</span> : <span className="text-xs text-muted-foreground">Last update {formatDateTime(item.watch.updated_at)}</span>}
                <div className="flex flex-wrap justify-end gap-2">
                  <Button size="sm" onClick={saveEdit} disabled={!playerId || busy}>
                    <Save className="h-4 w-4" />
                    Save
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => setEditing(false)} disabled={busy}>
                    <X className="h-4 w-4" />
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          </td>
        </tr>
      ) : null}
    </>
  );
}

function ServerContextPanel({
  api,
  context,
  loading,
  fallbackPlayers = [],
  onOpenPlayer,
  onChanged,
}: {
  api: ReturnType<typeof createApiClient>;
  context?: ServerLiveContext;
  loading?: boolean;
  fallbackPlayers?: LivePlayer[];
  onOpenPlayer: (playerId: string) => void;
  onChanged?: () => void;
}) {
  const [rosterSearch, setRosterSearch] = useState("");
  const [rosterFilter, setRosterFilter] = useState<ServerRosterFilter>("all");
  const [teamFilter, setTeamFilter] = useState("all");
  const liveItems = context?.live_players ?? fallbackPlayers.map((player) => ({ live_player: player }));
  const watched = context?.watched_players ?? [];
  const teams = context?.team_clusters ?? [];
  const activity = context?.activity ?? [];
  const rosterStatsValue = useMemo(() => rosterStats(liveItems), [liveItems]);
  const teamOptions = useMemo(() => rosterTeamOptions(liveItems), [liveItems]);
  const filteredRoster = useMemo(
    () =>
      liveItems.filter(
        (item) =>
          serverRosterFilterMatches(item, rosterFilter) &&
          serverRosterTeamMatches(item, teamFilter) &&
          serverRosterSearchMatches(item, rosterSearch),
      ),
    [liveItems, rosterFilter, rosterSearch, teamFilter],
  );
  const promote = useMutation({
    mutationFn: ({ liveId, riskLevel }: { liveId: string; riskLevel?: QuickRiskLevel; open: boolean }) =>
      api.promoteLivePlayer(liveId, {
        watch: Boolean(riskLevel),
        risk_level: riskLevel ?? "watch",
        reason: riskLevel ? quickRiskReason("live roster", riskLevel) : "Promoted from live roster",
        labels: ["live"],
      }),
    onSuccess: (result, variables) => {
      onChanged?.();
      if (variables.open && result.player?.id) {
        onOpenPlayer(result.player.id);
      }
    },
  });
  const watchPlayer = useMutation({
    mutationFn: ({ playerId, riskLevel }: { playerId: string; riskLevel: QuickRiskLevel }) =>
      api.updatePlayerWatch(playerId, {
        watched: true,
        risk_level: riskLevel,
        reason: quickRiskReason("live roster", riskLevel),
        labels: ["live"],
      }),
    onSuccess: () => onChanged?.(),
  });
  const actionBusy = promote.isPending || watchPlayer.isPending;
  const actionError = promote.error ?? watchPlayer.error;

  function hasActionIdentity(item: ServerLivePlayerItem) {
    return Boolean(item.player?.id || item.live_player.steam_id || item.live_player.battlemetrics_player_id);
  }

  function openOrPromote(item: ServerLivePlayerItem) {
    if (item.player?.id) {
      onOpenPlayer(item.player.id);
      return;
    }
    if (hasActionIdentity(item)) {
      promote.mutate({ liveId: item.live_player.id, open: true });
    }
  }

  function watchFromRoster(item: ServerLivePlayerItem, riskLevel: QuickRiskLevel = "watch") {
    if (item.player?.id) {
      watchPlayer.mutate({ playerId: item.player.id, riskLevel });
      return;
    }
    if (hasActionIdentity(item)) {
      promote.mutate({ liveId: item.live_player.id, riskLevel, open: false });
    }
  }

  return (
    <div className="grid gap-4">
      <div className="grid gap-3 md:grid-cols-5">
        <Fact label="Online" value={compactText(context?.counts?.online_players ?? liveItems.length)} />
        <Fact label="Known" value={compactText(context?.counts?.known_players ?? liveItems.length)} />
        <Fact label="Watched" value={compactText(context?.counts?.watched_players ?? watched.length)} />
        <Fact label="Teams" value={compactText(context?.counts?.teams ?? teams.length)} />
        <Fact label="Risk Teams" value={compactText(context?.counts?.high_risk_teams ?? teams.filter((team) => isHighRiskTeam(team)).length)} />
      </div>

      {watched.length ? (
        <div className="rounded-md border border-destructive/35 bg-destructive/10 p-3">
          <div className="mb-2 text-sm font-medium">Watched On This Server</div>
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {watched.map((item) => (
              <ServerPlayerCard
                key={item.live_player.id}
                item={item}
                busy={actionBusy}
                canAct={hasActionIdentity(item)}
                onOpenOrPromote={openOrPromote}
                onWatch={watchFromRoster}
              />
            ))}
          </div>
        </div>
      ) : null}

      {teams.length ? (
        <div className="rounded-md border border-border bg-background/45 p-3">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-sm font-medium">Team Clusters</div>
              <div className="text-xs text-muted-foreground">Grouped by realtime team id and sorted by threat</div>
            </div>
            <Badge variant={teams.some((team) => isHighRiskTeam(team)) ? "danger" : "outline"}>
              {teams.filter((team) => isHighRiskTeam(team)).length} high risk
            </Badge>
          </div>
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {teams.slice(0, 9).map((team) => {
              const summary = team.risk_summary ?? {};
              return (
              <div key={team.team_id} className={`rounded-md border bg-background/50 p-3 ${isHighRiskTeam(team) ? "border-destructive/45" : "border-border"}`}>
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{compactText(team.clan_tag || team.team_id)}</div>
                    <div className="text-xs text-muted-foreground">team {compactText(team.team_id)}</div>
                  </div>
                  <div className="flex flex-wrap justify-end gap-1">
                    <Badge variant={teamRiskBadgeVariant(team.risk_level)}>{compactText(team.risk_level ?? "clear")}</Badge>
                    <Badge variant="secondary">{compactText(team.member_count)} players</Badge>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                  <Fact label="Score" value={team.risk_score ?? 0} />
                  <Fact label="Watched" value={team.watched_count ?? summary.watched ?? 0} />
                  <Fact label="Online" value={team.online_count ?? summary.online ?? 0} />
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {Number(summary.hostile ?? 0) > 0 ? <Badge variant="danger">hostile {summary.hostile}</Badge> : null}
                  {Number(summary.suspect ?? 0) > 0 ? <Badge variant="warning">suspect {summary.suspect}</Badge> : null}
                  {Number(summary.watch ?? 0) > 0 ? <Badge variant="default">watch {summary.watch}</Badge> : null}
                  {Number(summary.friendly ?? 0) > 0 ? <Badge variant="success">friendly {summary.friendly}</Badge> : null}
                </div>
                <div className="mt-3 grid max-h-[260px] gap-2 overflow-auto">
                  {(team.members ?? []).slice(0, 8).map((member) => (
                    <TeamClusterMemberRow
                      key={member.live_player.id}
                      item={member}
                      busy={actionBusy}
                      canAct={hasActionIdentity(member)}
                      onOpenOrPromote={openOrPromote}
                      onWatch={watchFromRoster}
                    />
                  ))}
                </div>
              </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {liveItems.length ? (
        <div className="rounded-md border border-border bg-background/45 p-3">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-sm font-medium">Server Position Radar</div>
              <div className="text-xs text-muted-foreground">Realtime positions with watch/promote actions</div>
            </div>
            <Badge variant={liveItems.some((item) => hasMapPosition(item.live_player)) ? "success" : "outline"}>
              {liveItems.filter((item) => hasMapPosition(item.live_player)).length} positioned
            </Badge>
          </div>
          <LiveMap
            items={liveItems}
            teammateSteamIds={[]}
            onOpenPlayer={onOpenPlayer}
            onOpenOrPromote={openOrPromote}
            onWatch={watchFromRoster}
            canAct={hasActionIdentity}
            busy={actionBusy}
          />
        </div>
      ) : null}

      <div className="rounded-md border border-border bg-background/45 p-3">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-sm font-medium">Live Server Roster</div>
            <div className="text-xs text-muted-foreground">Search, filter and flag players from the current server feed</div>
          </div>
          <div className="flex items-center gap-2 rounded-md border border-border bg-background/45 px-3 py-2 text-sm text-muted-foreground">
            <SlidersHorizontal className="h-4 w-4" />
            <span>{filteredRoster.length} / {liveItems.length} shown</span>
          </div>
        </div>
        <div className="mb-3 grid gap-2 md:grid-cols-2 xl:grid-cols-5">
          <WatchlistSummaryPill label="Online" value={rosterStatsValue.online} variant="success" />
          <WatchlistSummaryPill label="Watched" value={rosterStatsValue.watched} variant={rosterStatsValue.watched ? "danger" : "outline"} />
          <WatchlistSummaryPill label="Hostile" value={rosterStatsValue.hostile} variant={rosterStatsValue.hostile ? "danger" : "outline"} />
          <WatchlistSummaryPill label="Suspect" value={rosterStatsValue.suspect} variant={rosterStatsValue.suspect ? "warning" : "outline"} />
          <WatchlistSummaryPill label="Positioned" value={rosterStatsValue.positioned} variant={rosterStatsValue.positioned ? "success" : "outline"} />
        </div>
        <div className="mb-3 grid gap-2 xl:grid-cols-[1fr_auto]">
          <Input
            value={rosterSearch}
            onChange={(event) => setRosterSearch(event.target.value)}
            placeholder="Search roster by name, SteamID, BattleMetricsID, team, clan, grid, source"
          />
          <div className="flex flex-wrap gap-1">
            {(["all", "watched", "hostile", "suspect", "online", "clear"] as ServerRosterFilter[]).map((filter) => (
              <Button key={filter} size="sm" variant={rosterFilter === filter ? "default" : "secondary"} onClick={() => setRosterFilter(filter)}>
                {serverRosterFilterLabel(filter)}
              </Button>
            ))}
          </div>
        </div>
        {teamOptions.length ? (
          <div className="mb-3 flex flex-wrap gap-1">
            <Button size="sm" variant={teamFilter === "all" ? "default" : "secondary"} onClick={() => setTeamFilter("all")}>
              All teams
            </Button>
            {teamOptions.slice(0, 8).map((team) => (
              <Button key={team.id} size="sm" variant={teamFilter === team.id ? "default" : "secondary"} onClick={() => setTeamFilter(team.id)}>
                {compactText(team.label)} ({team.count})
              </Button>
            ))}
          </div>
        ) : null}
        <div className="overflow-auto rounded-md border border-border">
        <Table>
          <thead>
            <tr>
              <Th>Player</Th>
              <Th>Risk</Th>
              <Th>Team</Th>
              <Th>Grid</Th>
              <Th>Health</Th>
              <Th>Source</Th>
              <Th>Last seen</Th>
              <Th></Th>
            </tr>
          </thead>
          <tbody>
            {filteredRoster.map((item) => (
              <ServerRosterRow
                key={item.live_player.id}
                item={item}
                busy={actionBusy}
                canAct={hasActionIdentity(item)}
                onOpenOrPromote={openOrPromote}
                onWatch={watchFromRoster}
              />
            ))}
          </tbody>
        </Table>
        {!liveItems.length ? <EmptyState label={loading ? "Loading server context" : "No live players yet"} /> : null}
        {liveItems.length && !filteredRoster.length ? <EmptyState label="No roster players match current filters" /> : null}
        </div>
      </div>
      {actionError ? <StatusLine tone="bad" text={actionError.message} /> : null}

      {activity.length ? (
        <div className="rounded-md border border-border bg-background/45 p-3">
          <div className="mb-2 text-sm font-medium">Recent Server Activity</div>
          <div className="grid max-h-[220px] gap-2 overflow-auto">
            {activity.slice(0, 8).map((event) => (
              <div key={String(event.id)} className="grid grid-cols-[145px_100px_1fr] gap-2 border-b border-border pb-2 last:border-0 last:pb-0">
                <div className="text-xs text-muted-foreground">{formatDateTime(event.occurred_at)}</div>
                <Badge variant={event.severity === "error" ? "danger" : "secondary"}>{compactText(event.source)}</Badge>
                <div className="truncate text-sm">{compactText(event.event_type)}</div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ServerPlayerCard({
  item,
  busy,
  canAct,
  onOpenOrPromote,
  onWatch,
}: {
  item: ServerLivePlayerItem;
  busy?: boolean;
  canAct: boolean;
  onOpenOrPromote: (item: ServerLivePlayerItem) => void;
  onWatch: (item: ServerLivePlayerItem, riskLevel: QuickRiskLevel) => void;
}) {
  return (
    <div className="rounded-md border border-border bg-background/60 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate font-medium">{compactText(item.player?.display_name ?? item.live_player.display_name)}</div>
          <div className="text-xs text-muted-foreground">{compactText(item.live_player.steam_id ?? item.live_player.battlemetrics_player_id)}</div>
        </div>
        <Badge variant={riskBadgeVariant(item.watch?.risk_level)}>{compactText(item.watch?.risk_level)}</Badge>
      </div>
      <div className="mt-2 text-xs text-muted-foreground">{compactText(item.watch?.reason ?? item.watch?.note)}</div>
      <div className="mt-3 flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">grid {compactText(item.live_player.map_grid)}</span>
        <div className="flex gap-2">
          {!item.watch?.watched ? (
            <QuickRiskActions busy={busy} canAct={canAct} onSelect={(level) => onWatch(item, level)} />
          ) : null}
          <Button size="sm" variant="secondary" onClick={() => onOpenOrPromote(item)} disabled={!canAct || busy}>
            {item.player?.id ? "Intel" : "Promote"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function TeamClusterMemberRow({
  item,
  busy,
  canAct,
  onOpenOrPromote,
  onWatch,
}: {
  item: ServerLivePlayerItem;
  busy?: boolean;
  canAct: boolean;
  onOpenOrPromote: (item: ServerLivePlayerItem) => void;
  onWatch: (item: ServerLivePlayerItem, riskLevel: QuickRiskLevel) => void;
}) {
  const live = item.live_player;
  return (
    <div className="rounded-md border border-border bg-background/55 p-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">{compactText(item.player?.display_name ?? live.display_name)}</div>
          <div className="truncate text-xs text-muted-foreground">{compactText(live.steam_id ?? live.battlemetrics_player_id)}</div>
        </div>
        <Badge variant={item.watch?.watched ? riskBadgeVariant(item.watch.risk_level) : live.is_online ? "success" : "outline"}>
          {item.watch?.watched ? compactText(item.watch.risk_level) : live.is_online ? "online" : "seen"}
        </Badge>
      </div>
      <div className="mt-2 grid grid-cols-3 gap-1 text-xs">
        <Fact label="Grid" value={live.map_grid} />
        <Fact label="HP" value={live.health} />
        <Fact label="Last" value={formatDateTime(live.last_seen_at)} />
      </div>
      <div className="mt-2 flex flex-wrap justify-end gap-1">
        {!item.watch?.watched ? (
          <QuickRiskActions busy={busy} canAct={canAct} onSelect={(level) => onWatch(item, level)} />
        ) : null}
        <Button size="sm" variant="secondary" onClick={() => onOpenOrPromote(item)} disabled={!canAct || busy}>
          {item.player?.id ? "Intel" : "Promote"}
        </Button>
      </div>
    </div>
  );
}

function ServerRosterRow({
  item,
  busy,
  canAct,
  onOpenOrPromote,
  onWatch,
}: {
  item: ServerLivePlayerItem;
  busy?: boolean;
  canAct: boolean;
  onOpenOrPromote: (item: ServerLivePlayerItem) => void;
  onWatch: (item: ServerLivePlayerItem, riskLevel: QuickRiskLevel) => void;
}) {
  const live = item.live_player;
  return (
    <tr>
      <Td>
        <div className="font-medium">{compactText(item.player?.display_name ?? live.display_name)}</div>
        <div className="text-xs text-muted-foreground">{compactText(live.steam_id ?? live.battlemetrics_player_id)}</div>
      </Td>
      <Td>
        {item.watch?.watched ? (
          <Badge variant={riskBadgeVariant(item.watch.risk_level)}>{compactText(item.watch.risk_level)}</Badge>
        ) : (
          <Badge variant="outline">clear</Badge>
        )}
      </Td>
      <Td>{compactText(live.team_id || live.clan_tag)}</Td>
      <Td>{compactText(live.map_grid)}</Td>
      <Td>{compactText(live.health)}</Td>
      <Td>
        <Badge variant="secondary">{compactText(live.source)}</Badge>
      </Td>
      <Td>{formatDateTime(live.last_seen_at)}</Td>
      <Td className="text-right">
        <div className="flex justify-end gap-2">
          {!item.watch?.watched ? (
            <QuickRiskActions busy={busy} canAct={canAct} onSelect={(level) => onWatch(item, level)} />
          ) : null}
          <Button size="sm" variant="secondary" onClick={() => onOpenOrPromote(item)} disabled={!canAct || busy}>
            {item.player?.id ? "Intel" : "Promote"}
          </Button>
        </div>
      </Td>
    </tr>
  );
}

function ServerDetailView({
  api,
  serverId,
  onOpenPlayer,
}: {
  api: ReturnType<typeof createApiClient>;
  serverId: string;
  onOpenPlayer: (playerId: string) => void;
}) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<ServerDetailTab>("overview");
  const detail = useQuery({
    queryKey: ["serverDetail", serverId],
    queryFn: () => api.serverDetail(serverId),
    enabled: serverId.length > 0,
    refetchInterval: 30_000,
  });
  const liveContext = useQuery({
    queryKey: ["serverLiveContext", serverId],
    queryFn: () => api.serverLiveContext(serverId),
    enabled: serverId.length > 0,
    refetchInterval: 5_000,
  });
  const snapshotsQuery = useQuery({
    queryKey: ["serverSnapshots", serverId],
    queryFn: () => api.serverSnapshots(serverId),
    enabled: serverId.length > 0 && (activeTab === "overview" || activeTab === "history"),
    refetchInterval: 60_000,
  });
  const wipesQuery = useQuery({
    queryKey: ["serverWipes", serverId],
    queryFn: () => api.serverWipes(serverId),
    enabled: serverId.length > 0 && (activeTab === "overview" || activeTab === "wipes"),
    refetchInterval: 60_000,
  });
  const mapQuery = useQuery({
    queryKey: ["serverMap", serverId],
    queryFn: () => api.serverMap(serverId),
    enabled: serverId.length > 0 && activeTab === "map",
    refetchInterval: 15_000,
  });
  const sync = useMutation({
    mutationFn: () => api.syncServer(serverId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["serverDetail", serverId] });
      queryClient.invalidateQueries({ queryKey: ["serverLiveContext", serverId] });
      queryClient.invalidateQueries({ queryKey: ["serverSnapshots", serverId] });
      queryClient.invalidateQueries({ queryKey: ["serverWipes", serverId] });
      queryClient.invalidateQueries({ queryKey: ["serverMap", serverId] });
      queryClient.invalidateQueries({ queryKey: ["trackedServers"] });
      queryClient.invalidateQueries({ queryKey: ["wipes"] });
      queryClient.invalidateQueries({ queryKey: ["activity"] });
      queryClient.invalidateQueries({ queryKey: ["overview"] });
    },
  });
  const server = detail.data?.server ?? mapQuery.data?.server ?? liveContext.data?.server;
  const snapshots = snapshotsQuery.data?.items ?? detail.data?.snapshots ?? [];
  const wipes = wipesQuery.data?.items ?? detail.data?.wipes ?? [];
  const activity = detail.data?.activity?.length ? detail.data.activity : liveContext.data?.activity ?? [];
  const settings = detail.data?.settings ?? {};
  const serverKey = server?.battlemetrics_server_id || stringFromUnknown(settings.battlemetrics_server_id) || serverId;
  const mapInfo = objectFrom(mapQuery.data?.map);
  const rustmapsUrl = stringFromUnknown(mapInfo.url) || server?.rustmaps_url || stringFromUnknown(settings.rustmaps_url);
  const sourceStatus = detail.data?.source_status ?? snapshotsQuery.data?.source_status ?? wipesQuery.data?.source_status ?? mapQuery.data?.source_status ?? liveContext.data?.source_status ?? "loading";
  const stats = serverSnapshotSummary(snapshots, server);
  const pageError = detail.error ?? liveContext.error ?? snapshotsQuery.error ?? wipesQuery.error ?? mapQuery.error ?? sync.error;

  function refreshDetail() {
    void detail.refetch();
    void liveContext.refetch();
    void snapshotsQuery.refetch();
    void wipesQuery.refetch();
    void mapQuery.refetch();
  }

  return (
    <section className="grid gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <Header title="Server Detail" subtitle={compactText(server?.name ?? serverKey)} />
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => navigate("/servers")}>
            Servers
          </Button>
          <Button variant="secondary" onClick={refreshDetail}>
            Refresh
          </Button>
          <Button onClick={() => sync.mutate()} disabled={!serverId || sync.isPending}>
            <RefreshCw className="h-4 w-4" />
            {sync.isPending ? "Syncing" : "Sync"}
          </Button>
        </div>
      </div>

      {pageError ? <StatusLine tone="bad" text={pageError.message ?? "Request failed"} /> : null}
      {sync.data ? <StatusLine tone="ok" text={`Synced ${compactText(sync.data.server?.name ?? sync.data.id)}`} /> : null}

      <Card>
        <CardContent className="grid gap-4 pt-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate text-xl font-semibold">{compactText(server?.name ?? serverKey)}</div>
              <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
                <span>{compactText(serverKey)}</span>
                <span>{compactText(server?.ip ?? server?.address)}:{compactText(server?.port)}</span>
                <span>updated {formatRelativeTime(server?.source_updated_at ?? server?.updated_at)}</span>
              </div>
            </div>
            <div className="flex flex-wrap gap-1">
              <Badge variant={server?.status === "online" ? "success" : "outline"}>{compactText(server?.status ?? "unknown")}</Badge>
              <Badge variant={sourceStatus === "ok" ? "success" : "warning"}>{compactText(sourceStatus)}</Badge>
              {server?.country ? <Badge variant="secondary">{compactText(server.country)}</Badge> : null}
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
            <Fact label="Online" value={`${formatNumber(server?.players ?? stats.latestOnline)} / ${formatNumber(server?.max_players)}`} />
            <Fact label="Peak 96" value={stats.peakPlayers} />
            <Fact label="Avg 96" value={stats.avgPlayers} />
            <Fact label="Rank" value={server?.rank ?? stats.bestRank} />
            <Fact label="Next wipe" value={formatDateTime(server?.next_wipe_at)} />
            <Fact label="Live rows" value={liveContext.data?.counts?.online_players ?? liveContext.data?.live_players?.length ?? 0} />
          </div>

          <div className="flex flex-wrap gap-2 rounded-md border border-border bg-background/45 p-2">
            {serverDetailTabs.map((tab) => (
              <Button
                key={tab.value}
                size="sm"
                variant={activeTab === tab.value ? "default" : "secondary"}
                onClick={() => setActiveTab(tab.value)}
              >
                {tab.label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {activeTab === "overview" ? (
        <ServerOverviewTab detail={detail.data} context={liveContext.data} server={server} snapshots={snapshots} wipes={wipes} />
      ) : null}
      {activeTab === "history" ? <ServerHistoryTab server={server} snapshots={snapshots} loading={detail.isFetching || snapshotsQuery.isFetching} /> : null}
      {activeTab === "wipes" ? <ServerWipesTab server={server} wipes={wipes} loading={detail.isFetching || wipesQuery.isFetching} /> : null}
      {activeTab === "players" ? (
        <Card>
          <CardHeader>
            <CardTitle>Live Players</CardTitle>
          </CardHeader>
          <CardContent>
            <ServerContextPanel
              api={api}
              context={liveContext.data}
              loading={liveContext.isFetching}
              onOpenPlayer={onOpenPlayer}
              onChanged={() => {
                refreshDetail();
                void queryClient.invalidateQueries({ queryKey: ["rustAlerts"] });
                void queryClient.invalidateQueries({ queryKey: ["watchlist"] });
                void queryClient.invalidateQueries({ queryKey: ["livePlayers"] });
              }}
            />
          </CardContent>
        </Card>
      ) : null}
      {activeTab === "map" ? <ServerMapTab server={server} context={liveContext.data} mapData={mapQuery.data} loading={mapQuery.isFetching} onOpenPlayer={onOpenPlayer} /> : null}
      {activeTab === "activity" ? <ServerActivityTab items={activity} loading={detail.isFetching || liveContext.isFetching} /> : null}
      {activeTab === "settings" ? (
        <ServerSettingsTab
          server={server}
          detail={detail.data}
          settings={settings}
          serverId={serverId}
          serverKey={serverKey}
          rustmapsUrl={rustmapsUrl}
          syncing={sync.isPending}
          onSync={() => sync.mutate()}
        />
      ) : null}
    </section>
  );
}

function ServerOverviewTab({
  detail,
  context,
  server,
  snapshots,
  wipes,
}: {
  detail?: ServerDetail;
  context?: ServerLiveContext;
  server?: ServerIntel | null;
  snapshots: ServerSnapshot[];
  wipes: ServerWipe[];
}) {
  const description = serverDescription(server);
  const latestSnapshot = snapshots[0];
  const latestWipe = wipes[0];
  const rustmapsUrl = server?.rustmaps_url || stringFromUnknown(detail?.settings?.rustmaps_url);
  const battleMetricsUrl = battleMetricsServerUrl(server?.battlemetrics_server_id);

  return (
    <div className="grid gap-4 xl:grid-cols-[1.1fr_.9fr]">
      <Card>
        <CardHeader>
          <CardTitle>Server Overview</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-2 md:grid-cols-2">
            <Fact label="BattleMetrics" value={server?.battlemetrics_server_id} wide />
            <Fact label="Address" value={server?.ip ? `${server.ip}:${compactText(server.port)}` : server?.address} />
            <Fact label="Query port" value={server?.port_query} />
            <Fact label="Map" value={server?.rust_map || server?.rust_type} />
            <Fact label="World size" value={server?.rust_world_size} />
            <Fact label="World seed" value={server?.rust_world_seed} />
            <Fact label="Last wipe" value={formatDateTime(server?.last_wipe_at)} />
            <Fact label="Next wipe" value={formatDateTime(server?.next_wipe_at)} />
            <Fact label="Tracked source" value={server?.source ?? detail?.source ?? detail?.source_status} />
            <Fact label="Updated" value={formatDateTime(server?.source_updated_at ?? server?.updated_at)} />
          </div>

          {description ? (
            <div className="rounded-md border border-border bg-background/50 p-3">
              <div className="text-xs uppercase tracking-normal text-muted-foreground">Description</div>
              <div className="mt-2 whitespace-pre-wrap text-sm leading-6">{description}</div>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-3 text-sm">
            {battleMetricsUrl ? (
              <a className="text-primary underline-offset-4 hover:underline" href={battleMetricsUrl} target="_blank" rel="noreferrer">
                Open BattleMetrics
              </a>
            ) : null}
            {rustmapsUrl ? (
              <a className="text-primary underline-offset-4 hover:underline" href={rustmapsUrl} target="_blank" rel="noreferrer">
                Open RustMaps
              </a>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Live Context</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            <div className="grid grid-cols-2 gap-2">
              <Fact label="Online rows" value={context?.counts?.online_players ?? context?.live_players?.length ?? 0} />
              <Fact label="Known" value={context?.counts?.known_players ?? context?.live_players?.length ?? 0} />
              <Fact label="Watched" value={context?.counts?.watched_players ?? context?.watched_players?.length ?? 0} />
              <Fact label="Teams" value={context?.counts?.teams ?? context?.team_clusters?.length ?? 0} />
            </div>
            <div className="rounded-md border border-border bg-background/50 p-3">
              <div className="text-sm font-medium">Source freshness</div>
              <div className="mt-1 text-xs text-muted-foreground">
                {compactText(context?.source_status ?? detail?.source_status ?? "No live source status yet")}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Latest Signals</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2">
            <Fact label="Latest snapshot" value={latestSnapshot ? `${compactText(latestSnapshot.players)} online at ${formatDateTime(latestSnapshot.captured_at)}` : "-"} wide />
            <Fact label="Latest wipe record" value={latestWipe ? `${compactText(latestWipe.wipe_type)} at ${formatDateTime(latestWipe.wipe_at)}` : "-"} wide />
            <Fact label="Activity rows" value={detail?.activity?.length ?? context?.activity?.length ?? 0} />
            <Fact label="Snapshots" value={snapshots.length} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ServerHistoryTab({
  server,
  snapshots,
  loading,
}: {
  server?: ServerIntel | null;
  snapshots: ServerSnapshot[];
  loading?: boolean;
}) {
  const stats = serverSnapshotSummary(snapshots, server);
  const rows = [...snapshots].reverse();
  const barMax = Math.max(1, server?.max_players ?? 0, ...snapshots.map((snapshot) => Number(snapshot.players ?? 0)));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Population History</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <Fact label="Samples" value={snapshots.length} />
          <Fact label="Peak online" value={stats.peakPlayers} />
          <Fact label="Average" value={stats.avgPlayers} />
          <Fact label="Best rank" value={stats.bestRank} />
          <Fact label="Delta" value={formatSignedNumber(stats.deltaPlayers)} />
        </div>

        {rows.length ? (
          <div className="grid gap-2">
            {rows.slice(-36).map((snapshot) => {
              const players = Number(snapshot.players ?? 0);
              const width = Math.max(4, Math.min(100, Math.round((players / barMax) * 100)));
              return (
                <div key={snapshot.id} className="grid gap-2 md:grid-cols-[150px_1fr_90px_70px] md:items-center">
                  <div className="text-xs text-muted-foreground">{formatDateTime(snapshot.captured_at)}</div>
                  <div className="h-8 overflow-hidden rounded-md border border-border bg-background/45">
                    <div className="h-full bg-primary/55" style={{ width: `${width}%` }} />
                  </div>
                  <div className="text-sm font-medium">{formatNumber(players)} / {formatNumber(snapshot.max_players)}</div>
                  <Badge variant={snapshot.status === "online" ? "success" : "outline"}>{compactText(snapshot.status)}</Badge>
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState label={loading ? "Loading history" : "No server snapshots yet"} />
        )}
      </CardContent>
    </Card>
  );
}

function ServerWipesTab({
  server,
  wipes,
  loading,
}: {
  server?: ServerIntel | null;
  wipes: ServerWipe[];
  loading?: boolean;
}) {
  const now = Date.now();
  const upcoming = wipes.filter((wipe) => dateMs(wipe.wipe_at) >= now).sort((a, b) => dateMs(a.wipe_at) - dateMs(b.wipe_at));
  const history = wipes.filter((wipe) => dateMs(wipe.wipe_at) < now);

  return (
    <div className="grid gap-4 xl:grid-cols-[340px_1fr]">
      <Card>
        <CardHeader>
          <CardTitle>Wipe Calendar</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          <Fact label="Next wipe from server" value={formatDateTime(server?.next_wipe_at)} wide />
          <Fact label="Last wipe from server" value={formatDateTime(server?.last_wipe_at)} wide />
          <Fact label="Upcoming records" value={upcoming.length} />
          <Fact label="History records" value={history.length} />
          <div className="rounded-md border border-border bg-background/50 p-3 text-sm text-muted-foreground">
            Wipe records combine BattleMetrics/RustMaps metadata and local tracked server history when available.
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Wipe Records</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-auto rounded-md border border-border">
            <Table>
              <thead>
                <tr>
                  <Th>When</Th>
                  <Th>Type</Th>
                  <Th>Source</Th>
                  <Th>Confidence</Th>
                  <Th>Stored</Th>
                </tr>
              </thead>
              <tbody>
                {wipes.map((wipe) => (
                  <tr key={wipe.id}>
                    <Td>{formatDateTime(wipe.wipe_at)}</Td>
                    <Td>
                      <Badge variant={dateMs(wipe.wipe_at) >= now ? "warning" : "secondary"}>{compactText(wipe.wipe_type)}</Badge>
                    </Td>
                    <Td>{compactText(wipe.source)}</Td>
                    <Td>{compactText(wipe.confidence)}</Td>
                    <Td>{formatDateTime(wipe.created_at)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
            {!wipes.length ? <EmptyState label={loading ? "Loading wipes" : "No wipe records yet"} /> : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ServerMapTab({
  server,
  context,
  mapData,
  loading,
  onOpenPlayer,
}: {
  server?: ServerIntel | null;
  context?: ServerLiveContext;
  mapData?: ServerMapDetail;
  loading?: boolean;
  onOpenPlayer: (playerId: string) => void;
}) {
  const liveItems = context?.live_players?.length ? context.live_players : mapData?.live_players ?? [];
  const positioned = liveItems.filter((item) => hasMapPosition(item.live_player));
  const mapInfo = objectFrom(mapData?.map);
  const monuments = Array.isArray(mapInfo.monuments) ? mapInfo.monuments : [];
  const rustmapsMarkers = Array.isArray(mapInfo.rustmaps_markers) ? mapInfo.rustmaps_markers : [];
  const liveMarkers = Array.isArray(mapInfo.live_markers) ? mapInfo.live_markers : mapData?.markers ?? [];
  const rustmapsUrl = stringFromUnknown(mapInfo.url) || server?.rustmaps_url || liveItems.find((item) => item.live_player.rustmaps_url)?.live_player.rustmaps_url || "";
  const thumbnailUrl = stringFromUnknown(mapInfo.thumbnail_url) || server?.rustmaps_thumbnail_url || "";

  return (
    <div className="grid gap-4 2xl:grid-cols-[minmax(0,1fr)_340px]">
      <Card>
        <CardHeader>
          <CardTitle>Map And Positions</CardTitle>
        </CardHeader>
        <CardContent>
          {positioned.length ? (
            <LiveMap items={liveItems} teammateSteamIds={[]} onOpenPlayer={onOpenPlayer} />
          ) : thumbnailUrl ? (
            <div className="overflow-hidden rounded-md border border-border bg-background/45">
              <img className="max-h-[680px] w-full object-contain" src={thumbnailUrl} alt={server?.name ?? "Rust map"} />
            </div>
          ) : (
            <EmptyState label={loading ? "Loading map metadata" : "No realtime player positions or RustMaps thumbnail yet"} />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Map Metadata</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          <div className="grid grid-cols-2 gap-2">
            <Fact label="Positioned" value={positioned.length} />
            <Fact label="Live rows" value={liveItems.length} />
            <Fact label="Live markers" value={liveMarkers.length} />
            <Fact label="Monuments" value={monuments.length} />
            <Fact label="RustMaps markers" value={rustmapsMarkers.length} />
            <Fact label="Source" value={mapData?.source_status ?? mapData?.source} />
            <Fact label="World size" value={mapInfo.size ?? server?.rust_world_size} />
            <Fact label="World seed" value={mapInfo.seed ?? server?.rust_world_seed} />
            <Fact label="Rust map" value={mapInfo.map ?? server?.rust_map ?? server?.rust_type} wide />
            <Fact label="Updated" value={formatDateTime(server?.source_updated_at ?? server?.updated_at)} wide />
          </div>
          {stringFromUnknown(mapInfo.settings_source) ? (
            <div className="rounded-md border border-border bg-background/50 p-3">
              <div className="text-xs uppercase tracking-normal text-muted-foreground">Settings source</div>
              <div className="mt-1 text-sm font-medium">{compactText(mapInfo.settings_source)}</div>
            </div>
          ) : null}
          {rustmapsUrl ? (
            <a className="text-sm text-primary underline-offset-4 hover:underline" href={rustmapsUrl} target="_blank" rel="noreferrer">
              Open full RustMaps page
            </a>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

function ServerActivityTab({ items, loading }: { items: Array<Record<string, unknown>>; loading?: boolean }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Server Activity</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-auto rounded-md border border-border">
          <Table>
            <thead>
              <tr>
                <Th>Time</Th>
                <Th>Severity</Th>
                <Th>Source</Th>
                <Th>Event</Th>
                <Th>Payload</Th>
              </tr>
            </thead>
            <tbody>
              {items.map((event, index) => (
                <tr key={String(event.id ?? `${event.occurred_at ?? "event"}-${index}`)}>
                  <Td>
                    <div>{formatDateTime(String(event.occurred_at ?? ""))}</div>
                    <div className="text-xs text-muted-foreground">{formatRelativeTime(event.occurred_at)}</div>
                  </Td>
                  <Td>
                    <Badge variant={timelineSeverityVariant(String(event.severity ?? ""))}>{compactText(event.severity)}</Badge>
                  </Td>
                  <Td>{compactText(event.source)}</Td>
                  <Td>
                    <div className="font-medium">{compactText(event.event_type)}</div>
                    <div className="text-xs text-muted-foreground">{compactText(event.entity_type)}</div>
                  </Td>
                  <Td>
                    <div className="max-w-[520px] truncate text-xs text-muted-foreground">{activityPayloadSummary(event.payload)}</div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
          {!items.length ? <EmptyState label={loading ? "Loading activity" : "No server activity yet"} /> : null}
        </div>
      </CardContent>
    </Card>
  );
}

function ServerSettingsTab({
  server,
  detail,
  settings,
  serverId,
  serverKey,
  rustmapsUrl,
  syncing,
  onSync,
}: {
  server?: ServerIntel | null;
  detail?: ServerDetail;
  settings: Record<string, unknown>;
  serverId: string;
  serverKey: string;
  rustmapsUrl: string;
  syncing?: boolean;
  onSync: () => void;
}) {
  const battleMetricsUrl = battleMetricsServerUrl(serverKey);
  const pluginReady = Boolean(settings.plugin_webhook_ready);
  const rconConfigured = Boolean(settings.rcon_configured);

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
      <Card>
        <CardHeader>
          <CardTitle>Integration Settings</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            <Fact label="Local server id" value={serverId} wide />
            <Fact label="BattleMetrics id" value={settings.battlemetrics_server_id ?? server?.battlemetrics_server_id} />
            <Fact label="Source status" value={detail?.source_status} />
            <Fact label="RustMaps URL" value={rustmapsUrl || "-"} wide />
            <Fact label="Plugin webhook" value={pluginReady ? "configured" : "missing"} />
            <Fact label="RCON" value={rconConfigured ? "configured" : "not configured"} />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={onSync} disabled={syncing}>
              <RefreshCw className="h-4 w-4" />
              {syncing ? "Syncing" : "Sync BattleMetrics"}
            </Button>
            {battleMetricsUrl ? (
              <a className="inline-flex h-10 items-center justify-center rounded-md border border-border bg-secondary px-4 text-sm font-medium text-secondary-foreground hover:bg-secondary/80" href={battleMetricsUrl} target="_blank" rel="noreferrer">
                BattleMetrics
              </a>
            ) : null}
            {rustmapsUrl ? (
              <a className="inline-flex h-10 items-center justify-center rounded-md border border-border bg-secondary px-4 text-sm font-medium text-secondary-foreground hover:bg-secondary/80" href={rustmapsUrl} target="_blank" rel="noreferrer">
                RustMaps
              </a>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Readiness</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          <div className="flex items-center justify-between gap-2 rounded-md border border-border bg-background/50 p-3">
            <span className="text-sm">BattleMetrics metadata</span>
            <Badge variant={server?.battlemetrics_server_id ? "success" : "warning"}>{server?.battlemetrics_server_id ? "ready" : "missing"}</Badge>
          </div>
          <div className="flex items-center justify-between gap-2 rounded-md border border-border bg-background/50 p-3">
            <span className="text-sm">Rust+/plugin feed</span>
            <Badge variant={pluginReady ? "success" : "warning"}>{pluginReady ? "ready" : "configure"}</Badge>
          </div>
          <div className="flex items-center justify-between gap-2 rounded-md border border-border bg-background/50 p-3">
            <span className="text-sm">RCON admin actions</span>
            <Badge variant={rconConfigured ? "success" : "outline"}>{rconConfigured ? "ready" : "planned"}</Badge>
          </div>
          <div className="rounded-md border border-border bg-background/50 p-3 text-xs text-muted-foreground">
            This page is wired for the current local backend. RCON stays disabled until server credentials are added backend-side.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ServersView({
  api,
  onOpenPlayer,
  onOpenServer,
}: {
  api: ReturnType<typeof createApiClient>;
  onOpenPlayer: (playerId: string) => void;
  onOpenServer?: (serverId: string) => void;
}) {
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const [selectedServerId, setSelectedServerId] = useState("");
  const tracked = useQuery({ queryKey: ["trackedServers"], queryFn: api.trackedServers, refetchInterval: 30_000 });
  const search = useMutation({ mutationFn: () => api.searchServers(query) });
  const track = useMutation({
    mutationFn: (id: string) => api.trackServer(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["trackedServers"] }),
  });
  const sync = useMutation({
    mutationFn: (id: string) => api.syncServer(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["trackedServers"] }),
  });
  const searchItems = search.data?.items ?? [];
  const selectedServerContext = useQuery({
    queryKey: ["serverLiveContext", selectedServerId],
    queryFn: () => api.serverLiveContext(selectedServerId),
    enabled: selectedServerId.length > 0,
    refetchInterval: 5_000,
  });
  const openServer = (server: ServerIntel) => {
    const serverId = server.id ?? server.battlemetrics_server_id;
    if (onOpenServer && server.id) {
      onOpenServer(server.id);
      return;
    }
    setSelectedServerId(serverId);
  };

  return (
    <section className="grid gap-4">
      <Header title="Servers" subtitle="BattleMetrics search, tracking, wipes and map metadata" />
      <Card>
        <CardContent className="grid gap-3 pt-4 md:grid-cols-[1fr_auto]">
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="server name, IP, tag" />
          <Button onClick={() => search.mutate()} disabled={!query || search.isPending}>
            <Search className="h-4 w-4" />
            Search
          </Button>
        </CardContent>
      </Card>
      {search.error || track.error || sync.error ? <StatusLine tone="bad" text={(search.error ?? track.error ?? sync.error)?.message ?? "Request failed"} /> : null}

      {searchItems.length > 0 ? (
        <ServerTable
          title="Search Results"
          items={searchItems}
          actionLabel="Track"
          onAction={(server) => track.mutate(server.battlemetrics_server_id)}
          onOpen={openServer}
        />
      ) : null}

      <ServerTable
        title="Tracked Servers"
        items={tracked.data ?? []}
        actionLabel="Sync"
        onAction={(server) => sync.mutate(server.id ?? server.battlemetrics_server_id)}
        onOpen={openServer}
      />

      {selectedServerId ? (
        <Card>
          <CardHeader>
            <CardTitle>Server Live Context</CardTitle>
          </CardHeader>
          <CardContent>
            <ServerContextPanel
              api={api}
              context={selectedServerContext.data}
              loading={selectedServerContext.isFetching}
              onOpenPlayer={onOpenPlayer}
              onChanged={() => {
                void selectedServerContext.refetch();
                void queryClient.invalidateQueries({ queryKey: ["rustAlerts"] });
                void queryClient.invalidateQueries({ queryKey: ["watchlist"] });
                void queryClient.invalidateQueries({ queryKey: ["overview"] });
                void queryClient.invalidateQueries({ queryKey: ["livePlayers"] });
              }}
            />
            {selectedServerContext.error ? <div className="mt-3 text-sm text-destructive">{selectedServerContext.error.message}</div> : null}
          </CardContent>
        </Card>
      ) : null}
    </section>
  );
}

function ServerTable({
  title,
  items,
  actionLabel,
  onAction,
  onOpen,
}: {
  title: string;
  items: ServerIntel[];
  actionLabel: string;
  onAction: (server: ServerIntel) => void;
  onOpen?: (server: ServerIntel) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-auto">
          <Table>
            <thead>
              <tr>
                <Th>Server</Th>
                <Th>Status</Th>
                <Th>Online</Th>
                <Th>Rank</Th>
                <Th>Map</Th>
                <Th>Next wipe</Th>
                <Th>RustMaps</Th>
                <Th></Th>
              </tr>
            </thead>
            <tbody>
              {items.map((server) => (
                <tr key={server.id ?? server.battlemetrics_server_id}>
                  <Td>
                    <div className="max-w-[360px] truncate font-medium">{compactText(server.name)}</div>
                    <div className="text-xs text-muted-foreground">{compactText(server.ip)}:{compactText(server.port)}</div>
                  </Td>
                  <Td>
                    <Badge variant={server.status === "online" ? "success" : "outline"}>{compactText(server.status)}</Badge>
                  </Td>
                  <Td>{formatNumber(server.players)} / {formatNumber(server.max_players)}</Td>
                  <Td>{compactText(server.rank)}</Td>
                  <Td>{compactText(server.rust_world_size)} / {compactText(server.rust_world_seed)}</Td>
                  <Td>{formatDateTime(server.next_wipe_at)}</Td>
                  <Td>
                    {server.rustmaps_url ? (
                      <a className="text-primary underline-offset-4 hover:underline" href={server.rustmaps_url} target="_blank" rel="noreferrer">
                        Open
                      </a>
                    ) : (
                      "-"
                    )}
                  </Td>
                  <Td className="text-right">
                    <div className="flex justify-end gap-2">
                      {onOpen ? (
                        <Button size="sm" variant="secondary" onClick={() => onOpen(server)}>
                          Open
                        </Button>
                      ) : null}
                      <Button size="sm" variant="secondary" onClick={() => onAction(server)}>
                        {actionLabel}
                      </Button>
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

function ProfileView({
  api,
  baseUrl,
  accessToken,
  initialTab = "account",
  onOpenPlayer,
  onOpenTab,
}: {
  api: ReturnType<typeof createApiClient>;
  baseUrl: string;
  accessToken: string;
  initialTab?: ProfileTab;
  onOpenPlayer: (playerId: string) => void;
  onOpenTab?: (tab: ProfileTab) => void;
}) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<ProfileTab>(initialTab);
  const [steamQuery, setSteamQuery] = useState("");
  useEffect(() => setActiveTab(initialTab), [initialTab]);
  const claims = useMemo(() => decodeJwtPayload(accessToken), [accessToken]);
  const myContext = useQuery({ queryKey: ["myLiveContext"], queryFn: api.myLiveContext, refetchInterval: 5_000 });
  const overview = useQuery({ queryKey: ["overview"], queryFn: api.overview, refetchInterval: 30_000 });
  const health = useQuery({ queryKey: ["realtimeHealth"], queryFn: api.realtimeHealth, refetchInterval: 5_000 });
  const alerts = useQuery({ queryKey: ["rustAlerts"], queryFn: api.alerts, refetchInterval: 5_000 });
  const watchlist = useQuery({ queryKey: ["watchlist"], queryFn: api.watchlist, refetchInterval: 10_000 });
  const activity = useQuery({ queryKey: ["activity"], queryFn: api.activity, refetchInterval: 10_000 });
  const integrations = useQuery({ queryKey: ["integrations"], queryFn: api.integrations });
  const connectSteam = useMutation({
    mutationFn: () => api.connectMySteam(steamQuery),
    onSuccess: () => {
      setSteamQuery("");
      queryClient.invalidateQueries({ queryKey: ["myLiveContext"] });
      queryClient.invalidateQueries({ queryKey: ["livePlayers"] });
      queryClient.invalidateQueries({ queryKey: ["realtimeHealth"] });
      queryClient.invalidateQueries({ queryKey: ["activity"] });
      queryClient.invalidateQueries({ queryKey: ["rustAlerts"] });
      queryClient.invalidateQueries({ queryKey: ["overview"] });
    },
  });
  const steam = objectFrom(myContext.data?.steam);
  const live = myContext.data?.live_player;
  const activityItems = activity.data ?? [];
  const watchItems = watchlist.data ?? [];
  const alertItems = alerts.data?.items ?? [];
  const counts = health.data?.counts ?? {};
  const accountName = compactText(
    steam.persona_name ?? live?.display_name ?? profileClaim(claims, ["email", "name", "preferred_username", "sub", "user_id"]) ?? "Operator",
  );
  function selectTab(tab: ProfileTab) {
    setActiveTab(tab);
    onOpenTab?.(tab);
  }

  return (
    <section className="grid gap-4">
      <Header title="Operator Profile" subtitle="Account binding, live identity, operator stats, history and session health" />

      <div className="grid gap-4 xl:grid-cols-[360px_1fr]">
        <div className="rounded-md border border-border bg-background/45 p-4">
          <div className="flex items-start gap-3">
            {steam.avatar_url ? (
              <img className="h-16 w-16 rounded-md border border-border object-cover" src={String(steam.avatar_url)} />
            ) : (
              <div className="grid h-16 w-16 place-items-center rounded-md border border-border bg-secondary">
                <UserCircle className="h-7 w-7 text-muted-foreground" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="truncate text-xl font-semibold">{accountName}</div>
              <div className="mt-1 truncate text-xs text-muted-foreground">{compactText(steam.steam_id ?? profileClaim(claims, ["sub", "user_id"]))}</div>
              <div className="mt-3 flex flex-wrap gap-1">
                <Badge variant={myContext.data?.connected ? "success" : "warning"}>{myContext.data?.connected ? "steam linked" : "steam setup"}</Badge>
                <Badge variant={live?.is_online ? "success" : "outline"}>{live?.is_online ? "online" : "offline"}</Badge>
                <Badge variant={healthStatusVariant(health.data?.status)}>{compactText(health.data?.status ?? "health")}</Badge>
              </div>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Fact label="API" value={baseUrl.replace(/^https?:\/\//, "")} wide />
            <Fact label="Token expires" value={formatJwtTime(claims, "exp")} />
            <Fact label="Live age" value={formatAgeSeconds(ageSecondsFromDate(live?.last_seen_at))} />
            <Fact label="Current grid" value={live?.map_grid} />
            <Fact label="Team" value={live?.team_id || live?.clan_tag} />
          </div>
        </div>

        <div className="grid gap-4">
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
            <ProfileStatPill label="Tracked Servers" value={overview.data?.tracked_servers} icon={<Server />} variant="secondary" />
            <ProfileStatPill label="Known Players" value={overview.data?.known_players} icon={<Users />} variant="secondary" />
            <ProfileStatPill label="Live Online" value={counts.live_online} icon={<Wifi />} variant={Number(counts.live_online ?? 0) ? "success" : "outline"} />
            <ProfileStatPill label="Active Alerts" value={alertItems.length} icon={<ShieldAlert />} variant={alertItems.length ? "danger" : "outline"} />
          </div>
          <div className="rounded-md border border-border bg-background/45 p-3">
            <div className="mb-3 flex flex-wrap gap-2">
              {profileTabs.map((tab) => (
                <Button key={tab.value} size="sm" variant={activeTab === tab.value ? "default" : "secondary"} onClick={() => selectTab(tab.value)}>
                  {tab.icon}
                  {tab.label}
                </Button>
              ))}
            </div>
            <div className="grid gap-2 md:grid-cols-4">
              <Fact label="Watchlist" value={watchItems.length} />
              <Fact label="Events" value={activityItems.length} />
              <Fact label="Events 5m" value={counts.events_5m} />
              <Fact label="Teammates" value={myContext.data?.teammates?.length ?? 0} />
            </div>
          </div>
        </div>
      </div>

      {myContext.error ? <StatusLine tone="bad" text={myContext.error.message} /> : null}
      {connectSteam.error ? <StatusLine tone="bad" text={connectSteam.error.message} /> : null}
      {connectSteam.data ? <StatusLine tone="ok" text={`Steam connected: ${compactText(connectSteam.data.steam_id)}`} /> : null}

      {activeTab === "account" && (
        <ProfileAccountTab claims={claims} baseUrl={baseUrl} myContext={myContext.data} integrations={integrations.data} health={health.data} />
      )}
      {activeTab === "steam" && (
        <ProfileSteamTab
          steamQuery={steamQuery}
          onSteamQuery={setSteamQuery}
          onConnect={() => connectSteam.mutate()}
          connecting={connectSteam.isPending}
          myContext={myContext.data}
          health={health.data}
        />
      )}
      {activeTab === "stats" && (
        <ProfileStatsTab
          overview={overview.data}
          health={health.data}
          watchlist={watchItems}
          alerts={alertItems}
          activity={activityItems}
          loading={overview.isFetching || health.isFetching}
        />
      )}
      {activeTab === "history" && (
        <ProfileHistoryTab activity={activityItems} watchlist={watchItems} alerts={alertItems} loading={activity.isFetching} onOpenPlayer={onOpenPlayer} />
      )}
      {activeTab === "security" && <ProfileSecurityTab claims={claims} baseUrl={baseUrl} health={health.data} />}
    </section>
  );
}

const profileTabs: Array<{ value: ProfileTab; label: string; icon: React.ReactElement }> = [
  { value: "account", label: "Account", icon: <UserCircle className="h-4 w-4" /> },
  { value: "steam", label: "Steam Link", icon: <Link2 className="h-4 w-4" /> },
  { value: "stats", label: "Stats", icon: <BarChart3 className="h-4 w-4" /> },
  { value: "history", label: "History", icon: <History className="h-4 w-4" /> },
  { value: "security", label: "Security", icon: <KeyRound className="h-4 w-4" /> },
];

function ProfileAccountTab({
  claims,
  baseUrl,
  myContext,
  integrations,
  health,
}: {
  claims: Record<string, unknown> | null;
  baseUrl: string;
  myContext?: MyLiveContext;
  integrations?: IntegrationStatus;
  health?: RealtimeHealth;
}) {
  const steam = objectFrom(myContext?.steam);
  const providers = integrations?.providers ?? [];
  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_420px]">
      <div className="rounded-md border border-border bg-background/45 p-3">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-sm font-medium">Account Identity</div>
            <div className="text-xs text-muted-foreground">JWT session, backend target and linked Steam persona</div>
          </div>
          <Badge variant={myContext?.connected ? "success" : "warning"}>{myContext?.connected ? "linked" : "needs link"}</Badge>
        </div>
        <div className="grid gap-2 md:grid-cols-3">
          <Fact label="Email" value={profileClaim(claims, ["email", "preferred_username"])} />
          <Fact label="User ID" value={profileClaim(claims, ["user_id", "sub"])} wide />
          <Fact label="Role" value={profileClaim(claims, ["role", "roles", "scope"])} />
          <Fact label="Workspace" value={profileClaim(claims, ["workspace_id", "workspace", "workspace_slug"])} />
          <Fact label="API base" value={baseUrl} wide />
          <Fact label="Issued" value={formatJwtTime(claims, "iat")} />
          <Fact label="Expires" value={formatJwtTime(claims, "exp")} />
          <Fact label="Steam" value={steam.steam_id} />
          <Fact label="Persona" value={steam.persona_name} />
        </div>
      </div>

      <div className="rounded-md border border-border bg-background/45 p-3">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="text-sm font-medium">Provider Readiness</div>
          <Badge variant={healthStatusVariant(health?.status)}>{compactText(health?.status)}</Badge>
        </div>
        <div className="grid gap-2">
          {providers.map((provider) => (
            <div key={provider.provider} className="grid grid-cols-[1fr_auto] gap-2 border-b border-border pb-2 last:border-0 last:pb-0">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{compactText(provider.provider)}</div>
                <div className="truncate text-xs text-muted-foreground">{compactText(provider.use)}</div>
              </div>
              <Badge variant={provider.configured || provider.public_mode ? "success" : "warning"}>
                {provider.configured ? "ready" : provider.public_mode ? "public" : "missing"}
              </Badge>
            </div>
          ))}
          {!providers.length ? <EmptyState label="Loading providers" /> : null}
        </div>
      </div>
    </div>
  );
}

function ProfileSteamTab({
  steamQuery,
  onSteamQuery,
  onConnect,
  connecting,
  myContext,
  health,
}: {
  steamQuery: string;
  onSteamQuery: (value: string) => void;
  onConnect: () => void;
  connecting: boolean;
  myContext?: MyLiveContext;
  health?: RealtimeHealth;
}) {
  const steam = objectFrom(myContext?.steam);
  const live = myContext?.live_player;
  const teammates = myContext?.teammates ?? [];
  return (
    <div className="grid gap-4 xl:grid-cols-[420px_1fr]">
      <div className="rounded-md border border-border bg-background/45 p-3">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-sm font-medium">Steam Account Binding</div>
            <div className="text-xs text-muted-foreground">SteamID, profile URL or vanity URL accepted by the backend resolver</div>
          </div>
          <Badge variant={myContext?.connected ? "success" : "warning"}>{myContext?.connected ? "connected" : "not connected"}</Badge>
        </div>
        <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
          <Input value={steamQuery} onChange={(event) => onSteamQuery(event.target.value)} placeholder="SteamID or profile URL" />
          <Button onClick={onConnect} disabled={!steamQuery.trim() || connecting}>
            {connecting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
            Link
          </Button>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Fact label="Steam ID" value={steam.steam_id} wide />
          <Fact label="Persona" value={steam.persona_name} />
          <Fact label="Profile" value={steam.profile_url} />
          <Fact label="Live source" value={live?.source ?? myContext?.source_status} />
          <Fact label="Feed status" value={health?.status} />
        </div>
      </div>

      <div className="grid gap-4">
        {live ? (
          <div className="rounded-md border border-border bg-background/45 p-3">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="text-sm font-medium">Current Live Identity</div>
              <Badge variant={live.is_online ? "success" : "outline"}>{live.is_online ? "online" : "offline"}</Badge>
            </div>
            <div className="grid gap-3 xl:grid-cols-[1fr_1fr]">
              <LiveFacts player={live} />
              <CurrentServerFacts live={live} />
            </div>
          </div>
        ) : (
          <EmptyState label={myContext?.connected ? "Steam is linked, but no live plugin row has matched this account yet" : "Link Steam to unlock live account context"} />
        )}

        <div className="rounded-md border border-border bg-background/45 p-3">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="text-sm font-medium">Detected Teammates</div>
            <Badge variant={teammates.length ? "success" : "outline"}>{teammates.length}</Badge>
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            {teammates.slice(0, 8).map((player) => (
              <LivePlayerCompact key={player.id} player={player} />
            ))}
          </div>
          {!teammates.length ? <EmptyState label="Team data appears after plugin/Rust+ snapshots include this account" /> : null}
        </div>
      </div>
    </div>
  );
}

function ProfileStatsTab({
  overview,
  health,
  watchlist,
  alerts,
  activity,
  loading,
}: {
  overview?: Record<string, unknown>;
  health?: RealtimeHealth;
  watchlist: WatchlistItem[];
  alerts: RustAlertItem[];
  activity: Array<Record<string, unknown>>;
  loading: boolean;
}) {
  const counts = health?.counts ?? {};
  const watchStats = watchlistStats(watchlist);
  const activitySummary = activityStats(activity);
  const sourceOptions = activityOptionCounts(activity, "source");
  const typeOptions = activityOptionCounts(activity, "event_type");
  return (
    <div className="grid gap-4">
      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-5">
        <WatchlistSummaryPill label="Watchlist" value={watchStats.total} variant={watchStats.total ? "warning" : "outline"} />
        <WatchlistSummaryPill label="Hostile" value={watchStats.hostile} variant={watchStats.hostile ? "danger" : "outline"} />
        <WatchlistSummaryPill label="Suspect" value={watchStats.suspect} variant={watchStats.suspect ? "warning" : "outline"} />
        <WatchlistSummaryPill label="Online Watched" value={watchStats.online} variant={watchStats.online ? "success" : "outline"} />
        <WatchlistSummaryPill label="Alerts" value={alerts.length} variant={alerts.length ? "danger" : "outline"} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        <div className="rounded-md border border-border bg-background/45 p-3">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="text-sm font-medium">RustControl Totals</div>
            <Badge variant={loading ? "secondary" : "outline"}>{loading ? "refreshing" : "cached"}</Badge>
          </div>
          <div className="grid gap-2 md:grid-cols-3">
            <Fact label="Tracked servers" value={overview?.tracked_servers} />
            <Fact label="Known players" value={overview?.known_players} />
            <Fact label="Team edges" value={overview?.team_edges} />
            <Fact label="Live events 1h" value={overview?.live_events_1h} />
            <Fact label="Live online" value={counts.live_online} />
            <Fact label="Live teams" value={counts.live_teams} />
            <Fact label="Live servers" value={counts.live_servers} />
            <Fact label="Events 5m" value={counts.events_5m} />
            <Fact label="Events 1h" value={counts.events_1h} />
          </div>
        </div>

        <div className="rounded-md border border-border bg-background/45 p-3">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="text-sm font-medium">Activity Mix</div>
            <Badge variant={activitySummary.error ? "danger" : activitySummary.warning ? "warning" : "outline"}>{activitySummary.total} events</Badge>
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            <Fact label="Warnings" value={activitySummary.warning} />
            <Fact label="Errors" value={activitySummary.error} />
            <Fact label="Operator notes" value={activitySummary.operatorNotes} />
            <Fact label="Shown rows" value={activity.length} />
          </div>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            <ActivityFilterChips title="Top Sources" allLabel="All sources" selected="all" items={sourceOptions} onSelect={() => undefined} />
            <ActivityFilterChips title="Top Event Types" allLabel="All types" selected="all" items={typeOptions} onSelect={() => undefined} />
          </div>
        </div>
      </div>

      <RealtimeHealthPanel health={health} loading={loading} compact />
    </div>
  );
}

function ProfileHistoryTab({
  activity,
  watchlist,
  alerts,
  loading,
  onOpenPlayer,
}: {
  activity: Array<Record<string, unknown>>;
  watchlist: WatchlistItem[];
  alerts: RustAlertItem[];
  loading: boolean;
  onOpenPlayer: (playerId: string) => void;
}) {
  const recentActivity = activity.slice(0, 12);
  const recentWatchlist = [...watchlist].sort((a, b) => dateMs(b.watch.updated_at) - dateMs(a.watch.updated_at)).slice(0, 8);
  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_420px]">
      <div className="rounded-md border border-border bg-background/45 p-3">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="text-sm font-medium">Recent Account Feed</div>
          <Badge variant={loading ? "secondary" : "outline"}>{loading ? "loading" : `${recentActivity.length} rows`}</Badge>
        </div>
        <div className="overflow-auto rounded-md border border-border">
          <Table>
            <thead>
              <tr>
                <Th>Time</Th>
                <Th>Signal</Th>
                <Th>Details</Th>
              </tr>
            </thead>
            <tbody>
              {recentActivity.map((event) => (
                <tr key={String(event.id)}>
                  <Td>
                    <div className="text-sm">{formatDateTime(event.occurred_at)}</div>
                    <div className="text-xs text-muted-foreground">{formatRelativeTime(event.occurred_at)}</div>
                  </Td>
                  <Td>
                    <div className="flex flex-wrap gap-1">
                      <Badge variant={timelineSeverityVariant(String(event.severity ?? ""))}>{compactText(event.severity)}</Badge>
                      <Badge variant="secondary">{compactText(event.source)}</Badge>
                    </div>
                  </Td>
                  <Td>
                    <div className="font-medium">{compactText(event.event_type)}</div>
                    <div className="max-w-[560px] truncate text-xs text-muted-foreground">{activityPayloadSummary(event.payload)}</div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
          {!recentActivity.length ? <EmptyState label={loading ? "Loading history" : "No account activity yet"} /> : null}
        </div>
      </div>

      <div className="grid gap-4">
        <div className="rounded-md border border-border bg-background/45 p-3">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="text-sm font-medium">Recent Watch Changes</div>
            <Badge variant={recentWatchlist.length ? "warning" : "outline"}>{recentWatchlist.length}</Badge>
          </div>
          <div className="grid gap-2">
            {recentWatchlist.map((item) => (
              <button
                key={item.watch.id}
                className="grid grid-cols-[1fr_auto] items-center gap-2 rounded-md border border-border bg-background/50 p-2 text-left hover:bg-secondary"
                onClick={() => onOpenPlayer(item.player.id ?? item.watch.player_id)}
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{compactText(item.player.display_name ?? item.player.name)}</div>
                  <div className="truncate text-xs text-muted-foreground">{compactText(item.watch.reason || item.watch.note || item.player.steam_id)}</div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Badge variant={riskBadgeVariant(item.watch.risk_level)}>{compactText(item.watch.risk_level)}</Badge>
                  <span className="text-xs text-muted-foreground">{formatRelativeTime(item.watch.updated_at)}</span>
                </div>
              </button>
            ))}
            {!recentWatchlist.length ? <EmptyState label="No watchlist changes yet" /> : null}
          </div>
        </div>

        <div className="rounded-md border border-border bg-background/45 p-3">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="text-sm font-medium">Current Alerts</div>
            <Badge variant={alerts.length ? "danger" : "outline"}>{alerts.length}</Badge>
          </div>
          <div className="grid gap-2">
            {alerts.slice(0, 6).map((alert) => (
              <button
                key={`${alert.player.id ?? alert.player.steam_id}-${alert.alert_type}`}
                className="grid grid-cols-[1fr_auto] items-center gap-2 rounded-md border border-border bg-background/50 p-2 text-left hover:bg-secondary"
                onClick={() => alert.player.id && onOpenPlayer(alert.player.id)}
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{compactText(alert.player.display_name ?? alert.player.name)}</div>
                  <div className="truncate text-xs text-muted-foreground">{compactText(alert.alert_type)} / {compactText(alert.current_server?.name)}</div>
                </div>
                <Badge variant={alertSeverityVariant(alert.severity)}>{compactText(alert.severity)}</Badge>
              </button>
            ))}
            {!alerts.length ? <EmptyState label="No active watched-player alerts" /> : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function ProfileSecurityTab({ claims, baseUrl, health }: { claims: Record<string, unknown> | null; baseUrl: string; health?: RealtimeHealth }) {
  const permissions = profileClaimList(claims, ["permissions", "perms", "scope", "roles", "role"]);
  const expiresMs = jwtTimestampMs(claims, "exp");
  const expired = expiresMs > 0 && Date.now() > expiresMs;
  return (
    <div className="grid gap-4 xl:grid-cols-[420px_1fr]">
      <div className="rounded-md border border-border bg-background/45 p-3">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div>
            <div className="text-sm font-medium">Session Security</div>
            <div className="text-xs text-muted-foreground">Token lifecycle and client-side storage status</div>
          </div>
          <Badge variant={expired ? "danger" : "success"}>{expired ? "expired" : "active"}</Badge>
        </div>
        <div className="grid gap-2">
          <Fact label="API base" value={baseUrl} wide />
          <Fact label="Token subject" value={profileClaim(claims, ["sub", "user_id"])} wide />
          <Fact label="Issued at" value={formatJwtTime(claims, "iat")} />
          <Fact label="Expires at" value={formatJwtTime(claims, "exp")} />
          <Fact label="Realtime status" value={health?.status} />
          <Fact label="Silent after" value={formatAgeSeconds(health?.silent_after_seconds)} />
        </div>
      </div>

      <div className="rounded-md border border-border bg-background/45 p-3">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div>
            <div className="text-sm font-medium">Permissions / Claims</div>
            <div className="text-xs text-muted-foreground">Decoded JWT claims only; the raw token is never shown here</div>
          </div>
          <ShieldCheck className="h-4 w-4 text-primary" />
        </div>
        <div className="mb-3 flex flex-wrap gap-1">
          {permissions.slice(0, 20).map((permission) => (
            <Badge key={permission} variant="secondary">
              {permission}
            </Badge>
          ))}
          {!permissions.length ? <Badge variant="outline">no explicit permissions claim</Badge> : null}
        </div>
        <div className="grid gap-2 md:grid-cols-2">
          {profileClaimRows(claims).map((row) => (
            <Fact key={row.key} label={row.key} value={row.value} />
          ))}
        </div>
      </div>
    </div>
  );
}

function ProfileStatPill({
  label,
  value,
  icon,
  variant,
}: {
  label: string;
  value: unknown;
  icon: React.ReactElement;
  variant: "default" | "secondary" | "outline" | "danger" | "success" | "warning";
}) {
  return (
    <div className="grid min-h-[92px] gap-3 rounded-md border border-border bg-background/45 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="[&>svg]:h-4 [&>svg]:w-4 text-muted-foreground">{icon}</span>
      </div>
      <Badge variant={variant} className="h-8 justify-center text-sm">
        {compactText(value)}
      </Badge>
    </div>
  );
}

function WipesView({ api }: { api: ReturnType<typeof createApiClient> }) {
  const wipes = useQuery({ queryKey: ["wipes"], queryFn: api.wipes, refetchInterval: 60_000 });
  return (
    <section className="grid gap-4">
      <Header title="Wipe Calendar" subtitle="Tracked wipe windows and source confidence" />
      <Card>
        <CardContent className="pt-4">
          {(wipes.data ?? []).map((wipe) => (
            <div key={String(wipe.id)} className="grid grid-cols-[180px_1fr_auto] items-center gap-3 border-b border-border py-3 last:border-0">
              <div className="text-sm font-medium">{formatDateTime(wipe.wipe_at)}</div>
              <div>
                <div className="font-medium">{compactText(wipe.server_name)}</div>
                <div className="text-xs text-muted-foreground">{compactText(wipe.source)}</div>
              </div>
              <Badge>{compactText(wipe.wipe_type)}</Badge>
            </div>
          ))}
          {!wipes.data?.length ? <EmptyState label="-" /> : null}
        </CardContent>
      </Card>
    </section>
  );
}

function ActivityView({ api }: { api: ReturnType<typeof createApiClient> }) {
  const [searchText, setSearchText] = useState("");
  const [severityFilter, setSeverityFilter] = useState<ActivitySeverityFilter>("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const activity = useQuery({ queryKey: ["activity"], queryFn: api.activity, refetchInterval: 10_000 });
  const items = activity.data ?? [];
  const filteredItems = useMemo(
    () =>
      items.filter(
        (event) =>
          activitySeverityMatches(event, severityFilter) &&
          activitySourceMatches(event, sourceFilter) &&
          activityTypeMatches(event, typeFilter) &&
          activitySearchMatches(event, searchText),
      ),
    [items, searchText, severityFilter, sourceFilter, typeFilter],
  );
  const stats = useMemo(() => activityStats(items), [items]);
  const sourceOptions = useMemo(() => activityOptionCounts(items, "source"), [items]);
  const typeOptions = useMemo(() => activityOptionCounts(items, "event_type"), [items]);

  return (
    <section className="grid gap-4">
      <Header title="Realtime Activity" subtitle="Rust+, plugin, BattleMetrics and admin events" />
      <Card>
        <CardContent className="grid gap-3 pt-4">
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-5">
            <WatchlistSummaryPill label="Total" value={stats.total} variant="secondary" />
            <WatchlistSummaryPill label="Warnings" value={stats.warning} variant={stats.warning ? "warning" : "outline"} />
            <WatchlistSummaryPill label="Errors" value={stats.error} variant={stats.error ? "danger" : "outline"} />
            <WatchlistSummaryPill label="Notes" value={stats.operatorNotes} variant={stats.operatorNotes ? "success" : "outline"} />
            <WatchlistSummaryPill label="Shown" value={filteredItems.length} variant="outline" />
          </div>

          <div className="grid gap-2 xl:grid-cols-[1fr_auto]">
            <Input
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder="Search activity by type, source, severity or payload"
            />
            <div className="flex flex-wrap gap-1">
              {(["all", "info", "warning", "error"] as ActivitySeverityFilter[]).map((level) => (
                <Button key={level} size="sm" variant={severityFilter === level ? "default" : "secondary"} onClick={() => setSeverityFilter(level)}>
                  {level === "all" ? "All severity" : level}
                </Button>
              ))}
            </div>
          </div>

          <div className="grid gap-2 xl:grid-cols-2">
            <ActivityFilterChips
              title="Sources"
              allLabel="All sources"
              selected={sourceFilter}
              items={sourceOptions}
              onSelect={setSourceFilter}
            />
            <ActivityFilterChips
              title="Event Types"
              allLabel="All types"
              selected={typeFilter}
              items={typeOptions}
              onSelect={setTypeFilter}
            />
          </div>

          <div className="overflow-auto rounded-md border border-border">
            <Table>
              <thead>
                <tr>
                  <Th>Time</Th>
                  <Th>Signal</Th>
                  <Th>Event</Th>
                  <Th>Payload</Th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((event) => (
                  <tr key={String(event.id)}>
                    <Td>
                      <div className="text-sm">{formatDateTime(event.occurred_at)}</div>
                      <div className="text-xs text-muted-foreground">{formatRelativeTime(event.occurred_at)}</div>
                    </Td>
                    <Td>
                      <div className="flex flex-wrap gap-1">
                        <Badge variant={timelineSeverityVariant(String(event.severity ?? ""))}>{compactText(event.severity)}</Badge>
                        <Badge variant="secondary">{compactText(event.source)}</Badge>
                      </div>
                    </Td>
                    <Td>
                      <div className="font-medium">{compactText(event.event_type)}</div>
                      <div className="text-xs text-muted-foreground">{compactText(activityPayloadTitle(event.payload))}</div>
                    </Td>
                    <Td>
                      <div className="max-w-[520px] whitespace-pre-wrap text-xs leading-5 text-muted-foreground">{activityPayloadSummary(event.payload)}</div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
            {!items.length ? <EmptyState label={activity.isFetching ? "Loading activity" : "-"} /> : null}
            {items.length && !filteredItems.length ? <EmptyState label="No activity events match current filters" /> : null}
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

function ActivityFilterChips({
  title,
  allLabel,
  selected,
  items,
  onSelect,
}: {
  title: string;
  allLabel: string;
  selected: string;
  items: Array<{ value: string; count: number }>;
  onSelect: (value: string) => void;
}) {
  return (
    <div className="rounded-md border border-border bg-background/45 p-3">
      <div className="mb-2 text-sm font-medium">{title}</div>
      <div className="flex flex-wrap gap-1">
        <Button size="sm" variant={selected === "all" ? "default" : "secondary"} onClick={() => onSelect("all")}>
          {allLabel}
        </Button>
        {items.slice(0, 8).map((item) => (
          <Button key={item.value} size="sm" variant={selected === item.value ? "default" : "secondary"} onClick={() => onSelect(item.value)}>
            {compactText(item.value)} ({item.count})
          </Button>
        ))}
      </div>
    </div>
  );
}

function IntegrationsView({ api, baseUrl }: { api: ReturnType<typeof createApiClient>; baseUrl: string }) {
  const integrations = useQuery({ queryKey: ["integrations"], queryFn: api.integrations });
  const health = useQuery({ queryKey: ["realtimeHealth"], queryFn: api.realtimeHealth, refetchInterval: 5_000 });
  const providers = integrations.data?.providers ?? [];
  const rustPlus = providers.find((provider) => provider.provider === "rust_plus");

  return (
    <section className="grid gap-4">
      <Header title="Integrations" subtitle="BattleMetrics, Steam, RustMaps and Rust+" />
      {integrations.error ? <StatusLine tone="bad" text={integrations.error.message} /> : null}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {providers.map((provider) => (
          <Card key={provider.provider}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between gap-2">
                <span className="truncate">{provider.label ?? provider.provider}</span>
                <Badge variant={integrationStatusVariant(provider)}>
                  {integrationStatusLabel(provider)}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm leading-6 text-muted-foreground">
              <div>{provider.use}</div>
              <div className="flex flex-wrap gap-2">
                {provider.public_mode ? <Badge variant="secondary">public</Badge> : null}
                {provider.env_configured ? <Badge variant="success">env</Badge> : <Badge variant="outline">env missing</Badge>}
                {provider.enabled ? <Badge variant="default">enabled</Badge> : <Badge variant="outline">disabled</Badge>}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <IntegrationSettingsPanel api={api} providers={providers} loading={integrations.isFetching} />
      <RustPlusIntakePanel api={api} provider={rustPlus} health={health.data} loading={health.isFetching} baseUrl={baseUrl} />
    </section>
  );
}

function IntegrationSettingsPanel({
  api,
  providers,
  loading,
}: {
  api: ReturnType<typeof createApiClient>;
  providers: IntegrationProvider[];
  loading: boolean;
}) {
  if (!providers.length) {
    return (
      <Card>
        <CardContent className="pt-4">
          <EmptyState label={loading ? "Loading integration settings" : "No integration providers returned"} />
        </CardContent>
      </Card>
    );
  }
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      {providers.map((provider) => (
        <IntegrationSettingsCard key={provider.provider} api={api} provider={provider} />
      ))}
    </div>
  );
}

function IntegrationSettingsCard({ api, provider }: { api: ReturnType<typeof createApiClient>; provider: IntegrationProvider }) {
  const queryClient = useQueryClient();
  const configSignature = useMemo(() => formatIntegrationConfig(provider.config), [provider.config]);
  const [enabled, setEnabled] = useState(Boolean(provider.enabled));
  const [secretHint, setSecretHint] = useState(provider.secret_hint ?? "");
  const [configText, setConfigText] = useState(configSignature);
  const [localError, setLocalError] = useState("");
  const saveSettings = useMutation({
    mutationFn: (payload: { enabled: boolean; secret_hint: string; config: Record<string, unknown> }) =>
      api.updateIntegration(provider.provider, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["integrations"] });
      queryClient.invalidateQueries({ queryKey: ["realtimeHealth"] });
      queryClient.invalidateQueries({ queryKey: ["overview"] });
    },
  });
  const testSettings = useMutation({
    mutationFn: () => api.testIntegration(provider.provider),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["realtimeHealth"] });
      queryClient.invalidateQueries({ queryKey: ["activity"] });
    },
  });

  useEffect(() => {
    setEnabled(Boolean(provider.enabled));
    setSecretHint(provider.secret_hint ?? "");
    setConfigText(configSignature);
    setLocalError("");
  }, [configSignature, provider.enabled, provider.provider, provider.secret_hint]);

  function onSave() {
    const parsed = parseIntegrationConfig(configText);
    if (parsed.error) {
      setLocalError(parsed.error);
      return;
    }
    setLocalError("");
    saveSettings.mutate({
      enabled,
      secret_hint: secretHint,
      config: parsed.config ?? {},
    });
  }

  const droppedSecretKeys = saveSettings.data?.dropped_secret_keys ?? [];
  const checks = testSettings.data?.checks ?? [];
  const testStatus = testSettings.data?.status;

  return (
    <Card data-testid={`integration-settings-${provider.provider}`}>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center justify-between gap-2">
          <span className="flex min-w-0 items-center gap-2">
            <KeyRound className="h-4 w-4 shrink-0 text-primary" />
            <span className="truncate">{provider.label ?? provider.provider}</span>
          </span>
          <Badge variant={integrationStatusVariant(provider)}>{integrationStatusLabel(provider)}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid gap-2 md:grid-cols-3">
          <Fact label="Provider" value={provider.provider} />
          <Fact label="Env" value={provider.env_configured ? "configured" : "missing"} />
          <Fact label="Updated" value={provider.updated_at ? formatDateTime(provider.updated_at) : "-"} />
        </div>

        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
          <label className="flex h-10 items-center gap-2 rounded-md border border-border bg-background px-3 text-sm">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(event) => setEnabled(event.target.checked)}
              className="h-4 w-4 rounded border-border accent-primary"
            />
            Enabled
          </label>
          <Input value={secretHint} onChange={(event) => setSecretHint(event.target.value)} placeholder={provider.secret_source ? `${provider.secret_source} hint` : "Secret hint"} />
        </div>

        <div className="grid gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm font-medium">Workspace config</div>
            {provider.secret_source ? <Badge variant="outline">{provider.secret_source}</Badge> : null}
          </div>
          <textarea
            data-testid={`integration-config-${provider.provider}`}
            value={configText}
            onChange={(event) => setConfigText(event.target.value)}
            spellCheck={false}
            rows={8}
            className="min-h-40 w-full resize-y rounded-md border border-input bg-background px-3 py-2 font-mono text-xs text-foreground outline-none transition-colors placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button data-testid={`integration-save-${provider.provider}`} size="sm" onClick={onSave} disabled={saveSettings.isPending}>
            <Save className="h-4 w-4" />
            Save
          </Button>
          <Button data-testid={`integration-test-${provider.provider}`} size="sm" variant="secondary" onClick={() => testSettings.mutate()} disabled={testSettings.isPending || !provider.testable}>
            <RefreshCw className={`h-4 w-4 ${testSettings.isPending ? "animate-spin" : ""}`} />
            Test
          </Button>
          <Badge variant={enabled ? "success" : "outline"}>{enabled ? "enabled" : "disabled"}</Badge>
          {testStatus ? <Badge variant={integrationCheckVariant(testStatus)}>{compactText(testStatus)}</Badge> : null}
        </div>

        {localError ? <StatusLine tone="bad" text={localError} /> : null}
        {saveSettings.error ? <StatusLine tone="bad" text={saveSettings.error.message} /> : null}
        {saveSettings.data ? <StatusLine tone="ok" text={`Saved ${compactText(saveSettings.data.provider.provider)}`} /> : null}
        {droppedSecretKeys.length ? <StatusLine tone="bad" text={`Dropped secret fields: ${droppedSecretKeys.join(", ")}`} /> : null}
        {testSettings.error ? <StatusLine tone="bad" text={testSettings.error.message} /> : null}

        {checks.length ? (
          <div className="grid gap-2">
            {checks.map((check, index) => (
              <IntegrationTestCheck key={`${provider.provider}-${index}`} check={check} />
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function integrationStatusVariant(provider: IntegrationProvider): BadgeVariant {
  const status = String(provider.status ?? "").toLowerCase();
  if (status === "not_configured") return provider.public_mode ? "secondary" : "outline";
  if (status.includes("missing") || status.includes("needs")) return "warning";
  if (status.includes("configured") || status === "available" || provider.configured) return "success";
  return provider.public_mode ? "secondary" : "outline";
}

function integrationStatusLabel(provider: IntegrationProvider) {
  if (provider.status) return compactText(provider.status);
  if (provider.configured) return "ready";
  if (provider.public_mode) return "public";
  return "missing";
}

function integrationCheckVariant(status?: string): BadgeVariant {
  const normalized = String(status ?? "").toLowerCase();
  if (normalized === "ok" || normalized === "configured" || normalized === "available") return "success";
  if (normalized === "error" || normalized === "failed") return "danger";
  if (normalized === "warning" || normalized.includes("missing") || normalized.includes("needs")) return "warning";
  return "outline";
}

function formatIntegrationConfig(value: unknown) {
  const object = objectFrom(value);
  return JSON.stringify(object, null, 2);
}

function parseIntegrationConfig(value: string): { config?: Record<string, unknown>; error?: string } {
  try {
    const parsed = JSON.parse(value || "{}") as unknown;
    if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") {
      return { error: "Config must be a JSON object." };
    }
    return { config: parsed as Record<string, unknown> };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Config must be valid JSON." };
  }
}

function IntegrationTestCheck({ check }: { check: Record<string, unknown> }) {
  const status = String(check.status ?? "unknown");
  const name = compactText(check.name);
  const message = compactText(check.message);
  const extra = Object.entries(check)
    .filter(([key]) => key !== "name" && key !== "status" && key !== "message")
    .slice(0, 4);
  return (
    <div className="rounded-md border border-border bg-background/50 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0 truncate text-sm font-medium">{name}</div>
        <Badge variant={integrationCheckVariant(status)}>{compactText(status)}</Badge>
      </div>
      <div className="mt-1 text-xs leading-5 text-muted-foreground">{message}</div>
      {extra.length ? (
        <div className="mt-2 flex flex-wrap gap-2">
          {extra.map(([key, value]) => (
            <Badge key={key} variant="outline">
              {compactText(key)}: {compactText(typeof value === "object" ? JSON.stringify(value) : value)}
            </Badge>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function RustPlusIntakePanel({
  api,
  provider,
  health,
  loading,
  baseUrl,
}: {
  api: ReturnType<typeof createApiClient>;
  provider?: IntegrationProvider;
  health?: RealtimeHealth;
  loading: boolean;
  baseUrl: string;
}) {
  const queryClient = useQueryClient();
  const apiRoot = baseUrl.replace(/\/+$/, "");
  const testEvent = useMutation({
    mutationFn: () => api.sendRustPlusTestEvent(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["realtimeHealth"] });
      queryClient.invalidateQueries({ queryKey: ["activity"] });
      queryClient.invalidateQueries({ queryKey: ["overview"] });
    },
  });
  const syntheticSnapshot = useMutation({
    mutationFn: () => api.sendRustPlusSyntheticSnapshot(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["realtimeHealth"] });
      queryClient.invalidateQueries({ queryKey: ["activity"] });
      queryClient.invalidateQueries({ queryKey: ["overview"] });
      queryClient.invalidateQueries({ queryKey: ["livePlayers"] });
      queryClient.invalidateQueries({ queryKey: ["myLiveContext"] });
      queryClient.invalidateQueries({ queryKey: ["rustAlerts"] });
      queryClient.invalidateQueries({ queryKey: ["watchlist"] });
      queryClient.invalidateQueries({ queryKey: ["servers"] });
      queryClient.invalidateQueries({ queryKey: ["serverLiveContext"] });
    },
  });
  const integration = objectFrom(health?.integrations?.rust_plus);
  const configured = Boolean(provider?.configured || integration.configured);
  const sources = (health?.sources ?? []).filter((source) => {
    const name = String(source.source ?? "").toLowerCase();
    return name.includes("rustplus") || name.includes("rust+") || name.includes("plugin") || name.includes("oxide") || name.includes("carbon") || name.includes("live_team");
  });
  const recentEvents = (health?.recent_events ?? []).filter((event) => {
    const source = String(event.source ?? "").toLowerCase();
    const type = String(event.event_type ?? "").toLowerCase();
    return source.includes("rustplus") || source.includes("plugin") || source.includes("oxide") || source.includes("carbon") || type.includes("team") || type.includes("snapshot");
  });
  const counts = health?.counts ?? {};
  const acceptedSources = ["rustplus", "oxide-plugin", "plugin", "live_team"];
  const mode = compactText(integration.mode ?? provider?.use ?? "webhook/plugin_feed");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            <Gamepad2 className="h-4 w-4 text-primary" />
            Rust+ / Plugin Intake
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={configured ? "success" : "warning"}>{configured ? "webhook ready" : "secret missing"}</Badge>
            <Button size="sm" variant="secondary" onClick={() => testEvent.mutate()} disabled={testEvent.isPending}>
              <RefreshCw className={`h-4 w-4 ${testEvent.isPending ? "animate-spin" : ""}`} />
              Send Test Event
            </Button>
            <Button size="sm" variant="secondary" onClick={() => syntheticSnapshot.mutate()} disabled={syntheticSnapshot.isPending}>
              <Radar className={`h-4 w-4 ${syntheticSnapshot.isPending ? "animate-pulse" : ""}`} />
              Full Snapshot
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        {testEvent.data ? (
          <StatusLine
            tone="ok"
            text={`Test event stored: ${compactText(testEvent.data.event_type)} at ${formatDateTime(String(testEvent.data.occurred_at ?? ""))}`}
          />
        ) : null}
        {testEvent.error ? <StatusLine tone="bad" text={testEvent.error.message} /> : null}
        {syntheticSnapshot.data ? (
          <StatusLine
            tone="ok"
            text={`Full snapshot ready: server ${compactText(syntheticSnapshot.data.battlemetrics_server_id)} / offender ${compactText(syntheticSnapshot.data.offender_steam_id)}`}
          />
        ) : null}
        {syntheticSnapshot.error ? <StatusLine tone="bad" text={syntheticSnapshot.error.message} /> : null}

        <div className="grid gap-2 md:grid-cols-4">
          <Fact label="Mode" value={mode} />
          <Fact label="Overall feed" value={health?.status ?? (loading ? "loading" : "-")} />
          <Fact label="Live online" value={counts.live_online} />
          <Fact label="Events 5m" value={counts.events_5m} />
        </div>

        <div className="grid gap-3 xl:grid-cols-2">
          <div className="rounded-md border border-border bg-background/50 p-3">
            <div className="mb-2 text-sm font-medium">Webhook Endpoints</div>
            <div className="grid gap-2 text-xs leading-5">
              <div>
                <div className="text-muted-foreground">Public server/plugin feed</div>
                <code className="mt-1 block break-all rounded-md border border-border bg-background px-2 py-1">
                  {apiRoot}/webhooks/rustcontrol/&lt;workspace_id&gt;/events
                </code>
              </div>
              <div>
                <div className="text-muted-foreground">Admin/local test feed</div>
                <code className="mt-1 block break-all rounded-md border border-border bg-background px-2 py-1">
                  {apiRoot}/api/admin/rustcontrol/plugin/events
                </code>
              </div>
            </div>
          </div>

          <div className="rounded-md border border-border bg-background/50 p-3">
            <div className="mb-2 text-sm font-medium">Intake Checklist</div>
            <div className="grid gap-2">
              <IntegrationCheck label="RUSTPLUS_WEBHOOK_SECRET" ready={configured} detail={configured ? "secret configured" : "set env before server/plugin can push events"} />
              <IntegrationCheck label="Accepted event sources" ready detail={acceptedSources.join(", ")} />
              <IntegrationCheck label="Recent Rust+/plugin traffic" ready={sources.length > 0 || recentEvents.length > 0} detail={`${sources.length} source rows / ${recentEvents.length} recent events`} />
              <IntegrationCheck label="Team probability feed" ready={Number(counts.events_5m ?? 0) > 0 || Number(counts.live_recent_5m ?? 0) > 0} detail="team/base snapshots update live context and relation evidence" />
            </div>
          </div>
        </div>

        <div className="grid gap-3 xl:grid-cols-2">
          <div className="rounded-md border border-border bg-background/50 p-3">
            <div className="mb-2 text-sm font-medium">Rust+/Plugin Sources</div>
            <div className="grid gap-2">
              {sources.slice(0, 6).map((source) => (
                <div key={String(source.source)} className="grid grid-cols-[1fr_auto] gap-2 border-b border-border pb-2 last:border-0 last:pb-0">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{compactText(source.source)}</div>
                    <div className="text-xs text-muted-foreground">
                      {compactText(source.online_players)} online / {compactText(source.events_5m)} events in 5m
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge variant={healthStatusVariant(String(source.status ?? ""))}>{compactText(source.status)}</Badge>
                    <span className="text-xs text-muted-foreground">{formatDateTime(String(source.last_seen_at ?? source.last_event_at ?? ""))}</span>
                  </div>
                </div>
              ))}
              {!sources.length ? <EmptyState label={loading ? "Loading Rust+ sources" : "No Rust+/plugin source traffic yet"} /> : null}
            </div>
          </div>

          <div className="rounded-md border border-border bg-background/50 p-3">
            <div className="mb-2 text-sm font-medium">Recent Rust+/Plugin Events</div>
            <div className="grid gap-2">
              {recentEvents.slice(0, 6).map((event) => (
                <div key={String(event.id)} className="rounded-md border border-border p-2">
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant={timelineSeverityVariant(String(event.severity ?? ""))}>{compactText(event.source)}</Badge>
                    <span className="text-xs text-muted-foreground">{formatDateTime(String(event.occurred_at ?? ""))}</span>
                  </div>
                  <div className="mt-2 truncate text-sm font-medium">{compactText(event.event_type)}</div>
                  <div className="mt-1 truncate text-xs text-muted-foreground">{activityPayloadTitle(event.payload)}</div>
                </div>
              ))}
              {!recentEvents.length ? <EmptyState label={loading ? "Loading Rust+ events" : "No recent Rust+/plugin events yet"} /> : null}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function IntegrationCheck({ label, ready, detail }: { label: string; ready: boolean; detail: string }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-md border border-border bg-background/50 p-2">
      <div className="min-w-0">
        <div className="truncate text-sm font-medium">{label}</div>
        <div className="mt-1 text-xs text-muted-foreground">{detail}</div>
      </div>
      <Badge variant={ready ? "success" : "warning"}>{ready ? "ready" : "todo"}</Badge>
    </div>
  );
}

function Header({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-normal">{title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
      </div>
      <Badge variant="outline">
        <Wifi className="mr-1 h-3.5 w-3.5" />
        realtime-ready
      </Badge>
    </div>
  );
}

function MetricCard({ label, value, icon }: { label: string; value: unknown; icon: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between pt-4">
        <div>
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className="mt-2 text-2xl font-semibold">{formatNumber(value)}</div>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-md border border-border bg-secondary text-muted-foreground">
          {icon}
        </div>
      </CardContent>
    </Card>
  );
}

function LiveFacts({ player }: { player: LivePlayer }) {
  const position = player.position;
  const coords =
    position?.x !== null && position?.x !== undefined
      ? `${Math.round(position.x)} / ${Math.round(position.y ?? 0)} / ${Math.round(position.z ?? 0)}`
      : "-";
  return (
    <div className="grid grid-cols-2 gap-2 text-sm">
      <Fact label="Team" value={player.team_id || player.clan_tag} />
      <Fact label="Grid" value={player.map_grid} />
      <Fact label="Health" value={player.health} />
      <Fact label="Sleeping" value={player.sleeping ? "yes" : "no"} />
      <Fact label="Coords" value={coords} wide />
      <Fact label="Last seen" value={formatDateTime(player.last_seen_at)} wide />
    </div>
  );
}

function LivePlayerCompact({ player }: { player: LivePlayer }) {
  return (
    <div className="rounded-md border border-border bg-background/50 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">{compactText(player.display_name)}</div>
          <div className="text-xs text-muted-foreground">{compactText(player.steam_id)}</div>
        </div>
        <Badge variant={player.is_online ? "success" : "outline"}>{player.is_online ? "online" : "offline"}</Badge>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
        <Fact label="Grid" value={player.map_grid} />
        <Fact label="HP" value={player.health} />
        <Fact label="Team" value={player.team_id} />
      </div>
    </div>
  );
}

function Fact({ label, value, wide }: { label: string; value: unknown; wide?: boolean }) {
  return (
    <div className={`rounded-md border border-border bg-background/50 p-2 ${wide ? "col-span-2" : ""}`}>
      <div className="text-[11px] uppercase tracking-normal text-muted-foreground">{label}</div>
      <div className="mt-1 truncate font-medium">{compactText(value)}</div>
    </div>
  );
}

function NavButton({ active, icon, label, onClick }: { active: boolean; icon: React.ReactElement; label: string; onClick: () => void }) {
  return (
    <button
      className={`flex h-10 items-center gap-3 rounded-md px-3 text-sm transition-colors ${
        active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary hover:text-foreground"
      }`}
      onClick={onClick}
    >
      <span className="[&>svg]:h-4 [&>svg]:w-4">{icon}</span>
      {label}
    </button>
  );
}

function StatusLine({ tone, text }: { tone: "ok" | "bad"; text: string }) {
  return (
    <div className={`rounded-md border px-3 py-2 text-sm ${tone === "ok" ? "border-emerald-400/35 bg-emerald-400/10 text-emerald-200" : "border-destructive/40 bg-destructive/10 text-destructive"}`}>
      {text}
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return <div className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">{label}</div>;
}
