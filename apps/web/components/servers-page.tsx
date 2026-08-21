"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  CircleAlert,
  ChevronDown,
  Heart,
  Map,
  Plus,
  Radio,
  RefreshCw,
  ShieldCheck,
  Tag,
  Trash2,
  UsersRound,
} from "lucide-react"

import { PageHeader } from "@/components/page-primitives"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  API_URL,
  apiFetch,
  type CheckedRustServer,
  type WatchlistServer,
} from "@/lib/api"

type ErrorPayload = { error?: string }

export function ServersPage() {
  const [address, setAddress] = useState("")
  const [checkedServer, setCheckedServer] = useState<CheckedRustServer | null>(
    null
  )
  const [watchlist, setWatchlist] = useState<WatchlistServer[]>([])
  const [checking, setChecking] = useState(false)
  const [saving, setSaving] = useState(false)
  const [busyID, setBusyID] = useState<number | null>(null)
  const [expandedWatchID, setExpandedWatchID] = useState<number | null>(null)
  const [error, setError] = useState("")
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const loadWatchlist = useCallback(async () => {
    const response = await apiFetch("/api/v1/servers/watchlist")
    const payload = (await response.json().catch(() => null)) as
      { servers?: WatchlistServer[] } | ErrorPayload | null
    if (!response.ok)
      throw new Error(errorFrom(payload) ?? "Could not load watchlist")
    setWatchlist(payload && "servers" in payload ? (payload.servers ?? []) : [])
  }, [])

  useEffect(() => {
    let active = true
    const timer = setTimeout(() => {
      void loadWatchlist().catch((cause: unknown) => {
        if (active)
          setError(messageFrom(cause, "Could not load your watchlist"))
      })
    }, 0)
    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [loadWatchlist])

  useEffect(() => {
    let active = true
    let socket: WebSocket | null = null
    const connect = () => {
      if (!active) return
      const url = new URL(API_URL)
      url.protocol = url.protocol === "https:" ? "wss:" : "ws:"
      url.pathname = "/api/v1/realtime/ws"
      socket = new WebSocket(url.toString())
      socket.onmessage = (event) => {
        const payload = JSON.parse(event.data) as {
          type?: string
          payload?: { server?: WatchlistServer }
        }
        const server = payload.payload?.server
        if (payload.type !== "server.watchlist.updated" || !server) return
        setWatchlist((current) =>
          server.status === "removed"
            ? current.filter((item) => item.id !== server.id)
            : upsertServer(current, server)
        )
      }
      socket.onclose = () => {
        if (active) reconnectTimer.current = setTimeout(connect, 3000)
      }
    }
    connect()
    return () => {
      active = false
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current)
      socket?.close()
    }
  }, [])

  async function check(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const input = address.trim()
    if (!input) return
    setChecking(true)
    setError("")
    setCheckedServer(null)
    try {
      const response = await apiFetch("/api/v1/servers/check", {
        method: "POST",
        body: JSON.stringify({ address: input }),
      })
      const payload = (await response.json().catch(() => null)) as
        { server?: CheckedRustServer } | ErrorPayload | null
      if (!response.ok || !payload || !("server" in payload) || !payload.server)
        throw new Error(errorFrom(payload) ?? "Could not check this server")
      setCheckedServer(payload.server)
      setAddress(payload.server.address)
    } catch (cause) {
      setError(messageFrom(cause, "Could not check this server"))
    } finally {
      setChecking(false)
    }
  }

  async function addToWatchlist() {
    if (!checkedServer) return
    setSaving(true)
    setError("")
    try {
      const response = await apiFetch("/api/v1/servers/watchlist", {
        method: "POST",
        body: JSON.stringify({ address: checkedServer.address }),
      })
      const payload = (await response.json().catch(() => null)) as
        { server?: WatchlistServer } | ErrorPayload | null
      if (!response.ok || !payload || !("server" in payload) || !payload.server)
        throw new Error(errorFrom(payload) ?? "Could not save this server")
      const savedServer = payload.server
      setWatchlist((current) => upsertServer(current, savedServer))
    } catch (cause) {
      setError(messageFrom(cause, "Could not save this server"))
    } finally {
      setSaving(false)
    }
  }

  async function refresh(server: WatchlistServer) {
    setBusyID(server.id)
    setError("")
    try {
      const response = await apiFetch(
        `/api/v1/servers/watchlist/${server.id}/refresh`,
        { method: "POST" }
      )
      const payload = (await response.json().catch(() => null)) as
        { server?: WatchlistServer } | ErrorPayload | null
      if (!response.ok || !payload || !("server" in payload) || !payload.server)
        throw new Error(errorFrom(payload) ?? "Could not refresh this server")
      const refreshedServer = payload.server
      setWatchlist((current) => upsertServer(current, refreshedServer))
    } catch (cause) {
      setError(messageFrom(cause, "Could not refresh this server"))
    } finally {
      setBusyID(null)
    }
  }

  async function remove(server: WatchlistServer) {
    setBusyID(server.id)
    setError("")
    try {
      const response = await apiFetch(
        `/api/v1/servers/watchlist/${server.id}`,
        { method: "DELETE" }
      )
      if (!response.ok) {
        const payload = (await response
          .json()
          .catch(() => null)) as ErrorPayload | null
        throw new Error(errorFrom(payload) ?? "Could not remove this server")
      }
      setWatchlist((current) => current.filter((item) => item.id !== server.id))
    } catch (cause) {
      setError(messageFrom(cause, "Could not remove this server"))
    } finally {
      setBusyID(null)
    }
  }

  const alreadySaved = checkedServer
    ? watchlist.some((server) => server.address === checkedServer.address)
    : false

  return (
    <>
      <PageHeader
        title="Servers"
        description="Check a Rust server by its public IP and keep the ones you follow live."
      />
      <Card className="rounded-2xl border-white/[0.08] bg-[#171313] shadow-none">
        <CardContent className="p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-white/[0.06] text-white/65">
              <Radio className="size-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white/90">
                Check a server
              </h2>
              <p className="mt-1 text-xs leading-5 text-white/42">
                Paste its public IP or server domain with the game port from
                Rust&apos;s console or BattleMetrics. RustControl checks the
                server directly — no admin access required.
              </p>
            </div>
          </div>
          <form
            className="mt-5 flex flex-col gap-3 sm:flex-row"
            onSubmit={check}
          >
            <label className="sr-only" htmlFor="server-address">
              Server IP and port
            </label>
            <Input
              id="server-address"
              value={address}
              onChange={(event) => setAddress(event.target.value)}
              placeholder="79.137.98.23:28015 or eu2xt.warbandits.gg:28015"
              className="h-10 rounded-xl border-white/[0.08] bg-white/[0.04] font-mono text-sm text-white placeholder:text-white/28"
            />
            <Button
              type="submit"
              size="lg"
              disabled={checking || !address.trim()}
              className="rounded-xl sm:min-w-32"
            >
              {checking ? (
                <RefreshCw className="size-4 animate-spin" />
              ) : (
                <Radio className="size-4" />
              )}
              {checking ? "Checking…" : "Check live"}
            </Button>
          </form>
          <p className="mt-3 text-xs text-white/32">
            Public IPv4 and server domains are accepted. Domains are resolved on
            the backend to a public IP; the checker tries the game and query
            port once.
          </p>
        </CardContent>
      </Card>
      {error && <ErrorNotice error={error} />}
      {checkedServer && (
        <section className="mt-5" aria-live="polite">
          <CheckedServerCard
            server={checkedServer}
            saved={alreadySaved}
            saving={saving}
            onSave={() => void addToWatchlist()}
          />
        </section>
      )}
      <section className="mt-8">
        <div className="mb-3 flex items-end justify-between gap-4 px-1">
          <div>
            <h2 className="text-base font-semibold tracking-[-0.02em] text-white/90">
              Your watchlist
            </h2>
            <p className="mt-1 text-xs text-white/38">
              The API refreshes saved servers every minute and sends updates
              directly to this page.
            </p>
          </div>
          <span className="text-xs text-white/35 tabular-nums">
            {watchlist.length} / 25
          </span>
        </div>
        {watchlist.length ? (
          <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#171313]">
            {watchlist.map((server) => (
              <WatchlistRow
                key={server.id}
                server={server}
                busy={busyID === server.id}
                expanded={expandedWatchID === server.id}
                onToggleDetails={() =>
                  setExpandedWatchID((current) =>
                    current === server.id ? null : server.id
                  )
                }
                onRefresh={() => void refresh(server)}
                onRemove={() => void remove(server)}
              />
            ))}
          </div>
        ) : (
          <div className="flex min-h-44 flex-col items-center justify-center rounded-2xl border border-dashed border-white/[0.12] px-6 text-center">
            <Heart className="size-4 text-white/35" />
            <p className="mt-3 text-sm font-medium text-white/75">
              No saved servers
            </p>
            <p className="mt-1 max-w-md text-xs leading-5 text-white/38">
              Check a server above, verify it is the one you want, then add it
              here for live updates.
            </p>
          </div>
        )}
      </section>
    </>
  )
}

function CheckedServerCard({
  server,
  saved,
  saving,
  onSave,
}: {
  server: CheckedRustServer
  saved: boolean
  saving: boolean
  onSave: () => void
}) {
  return (
    <Card className="overflow-hidden rounded-2xl border-emerald-400/20 bg-[#171313] shadow-none">
      <CardContent className="p-0">
        <div className="flex flex-col gap-4 border-b border-white/[0.08] px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <ServerIdentity
            name={server.name}
            address={server.address}
            latency={server.latencyMs}
          />
          <Button
            type="button"
            disabled={saved || saving}
            onClick={onSave}
            className="rounded-xl"
          >
            {saving ? (
              <RefreshCw className="size-4 animate-spin" />
            ) : (
              <Plus className="size-4" />
            )}
            {saved ? "In watchlist" : saving ? "Saving…" : "Add to watchlist"}
          </Button>
        </div>
        <div className="grid divide-y divide-white/[0.08] sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          <Metric
            icon={UsersRound}
            label="Players"
            value={`${server.players} / ${server.maxPlayers}`}
            detail={
              server.bots
                ? `${server.bots} bot${server.bots === 1 ? "" : "s"}`
                : "No bots reported"
            }
          />
          <Metric
            icon={Map}
            label="Map"
            value={server.map || "Not reported"}
            detail={modeFromTags(server.tags) ?? "Mode not reported"}
          />
          <Metric
            icon={ShieldCheck}
            label="Server"
            value={server.vacSecured ? "VAC secured" : "VAC not reported"}
            detail={
              server.passwordProtected
                ? "Password protected"
                : server.version
                  ? `Version ${server.version}`
                  : "Version not reported"
            }
          />
        </div>
        <TechnicalDetails server={server} />
      </CardContent>
    </Card>
  )
}

function WatchlistRow({
  server,
  busy,
  expanded,
  onToggleDetails,
  onRefresh,
  onRemove,
}: {
  server: WatchlistServer
  busy: boolean
  expanded: boolean
  onToggleDetails: () => void
  onRefresh: () => void
  onRemove: () => void
}) {
  const online = server.status === "online"
  const blocked = server.status === "blocked"
  return (
    <div className="flex flex-col gap-4 border-b border-white/[0.07] px-4 py-4 last:border-0 sm:px-5 md:flex-row md:items-center">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span
            className={`size-1.5 shrink-0 rounded-full ${online ? "bg-emerald-400" : blocked ? "bg-amber-400" : "bg-red-400"}`}
          />
          <p className="truncate text-sm font-medium text-white/90">
            {online
              ? server.name || "Unnamed Rust server"
              : blocked
                ? "Public query blocked"
                : "Server unavailable"}
          </p>
        </div>
        <p className="mt-1 pl-3.5 font-mono text-xs text-white/38">
          {server.address}
        </p>
        {!online && server.error && (
          <p
            className={`mt-2 pl-3.5 text-xs ${blocked ? "text-amber-200/70" : "text-red-200/70"}`}
          >
            {server.error}
          </p>
        )}
      </div>
      <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs md:w-[310px] md:grid-cols-3">
        <Stat
          label="Players"
          value={
            online &&
            server.players !== undefined &&
            server.maxPlayers !== undefined
              ? `${server.players} / ${server.maxPlayers}`
              : "—"
          }
        />
        <Stat label="Map" value={online ? server.map || "—" : "—"} />
        <Stat
          label="Checked"
          value={server.checkedAt ? relativeTime(server.checkedAt) : "—"}
        />
      </div>
      <div className="flex shrink-0 gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={onRefresh}
          className="rounded-xl border-white/[0.12] bg-transparent text-white/75 hover:bg-white/[0.06] hover:text-white"
        >
          <RefreshCw className={`size-3.5 ${busy ? "animate-spin" : ""}`} />{" "}
          Refresh
        </Button>
        {online && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onToggleDetails}
            className="rounded-xl text-white/55 hover:bg-white/[0.06] hover:text-white"
          >
            <ChevronDown
              className={`size-3.5 transition-transform ${expanded ? "rotate-180" : ""}`}
            />
            Details
          </Button>
        )}
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          disabled={busy}
          onClick={onRemove}
          className="rounded-xl text-white/45 hover:bg-red-400/[0.08] hover:text-red-200"
          aria-label={`Remove ${server.address} from watchlist`}
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>
      {online && expanded && <TechnicalDetails server={server} compact />}
    </div>
  )
}

function TechnicalDetails({
  server,
  compact = false,
}: {
  server:
    | Pick<
        CheckedRustServer,
        | "address"
        | "queryAddress"
        | "version"
        | "protocol"
        | "gameFolder"
        | "gameName"
        | "serverKind"
        | "environment"
        | "serverSteamId"
        | "tags"
      >
    | WatchlistServer
  compact?: boolean
}) {
  const details = [
    ["Game port", server.address],
    ["Query port", server.queryAddress],
    ["Server type", server.serverKind],
    ["Operating system", server.environment],
    ["A2S protocol", server.protocol?.toString()],
    ["Game", server.gameName || server.gameFolder],
    ["Build", server.version],
    ["Steam server ID", server.serverSteamId],
  ].filter(([, value]) => value) as [string, string][]

  return (
    <div
      className={`border-t border-white/[0.08] ${compact ? "px-4 py-4 sm:px-5" : "px-5 py-4 sm:px-6"}`}
    >
      {!compact && (
        <p className="text-xs font-medium text-white/65">Technical details</p>
      )}
      <div
        className={`grid gap-x-6 gap-y-3 ${compact ? "mt-0 sm:grid-cols-3 lg:grid-cols-4" : "mt-4 sm:grid-cols-2 lg:grid-cols-4"}`}
      >
        {details.map(([label, value]) => (
          <Stat key={label} label={label} value={value} />
        ))}
      </div>
      {server.tags.length > 0 && (
        <div className="mt-4 border-t border-white/[0.07] pt-3">
          <div className="flex items-center gap-2 text-[10px] font-medium tracking-[0.12em] text-white/32 uppercase">
            <Tag className="size-3" /> Server tags
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {server.tags.map((tag) => (
              <span
                key={tag}
                className="max-w-full rounded-md border border-white/[0.08] bg-white/[0.03] px-2 py-1 font-mono text-[10px] break-all text-white/55"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function ServerIdentity({
  name,
  address,
  latency,
}: {
  name: string
  address: string
  latency: number
}) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-2">
        <span className="size-1.5 shrink-0 rounded-full bg-emerald-400" />
        <h2 className="truncate text-base font-semibold tracking-[-0.02em] text-white">
          {name || "Unnamed Rust server"}
        </h2>
      </div>
      <div className="mt-1 flex items-center gap-2 pl-3.5 text-xs text-white/42">
        <span className="font-mono">{address}</span>
        <span className="text-white/20">•</span>
        <span>{latency} ms</span>
      </div>
    </div>
  )
}
function Metric({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: typeof UsersRound
  label: string
  value: string
  detail: string
}) {
  return (
    <div className="px-5 py-4 sm:px-6">
      <div className="flex items-center gap-2 text-xs text-white/40">
        <Icon className="size-3.5" />
        {label}
      </div>
      <p className="mt-2 truncate text-sm font-semibold text-white/90">
        {value}
      </p>
      <p className="mt-1 truncate text-xs text-white/38">{detail}</p>
    </div>
  )
}
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-medium tracking-[0.12em] text-white/32 uppercase">
        {label}
      </p>
      <p className="mt-1 truncate text-xs text-white/65">{value}</p>
    </div>
  )
}
function ErrorNotice({ error }: { error: string }) {
  return (
    <div
      role="alert"
      className="mt-4 flex items-start gap-3 rounded-2xl border border-red-400/20 bg-red-400/[0.08] px-4 py-3 text-sm text-red-100"
    >
      <CircleAlert className="mt-0.5 size-4 shrink-0 text-red-300" />
      <p>{error}</p>
    </div>
  )
}
function upsertServer(current: WatchlistServer[], server: WatchlistServer) {
  const index = current.findIndex((item) => item.id === server.id)
  return index < 0
    ? [server, ...current]
    : current.map((item) => (item.id === server.id ? server : item))
}
function errorFrom(
  payload: ErrorPayload | { server?: unknown } | { servers?: unknown } | null
) {
  return payload && "error" in payload && typeof payload.error === "string"
    ? payload.error
    : null
}
function messageFrom(cause: unknown, fallback: string) {
  return cause instanceof Error && cause.message ? cause.message : fallback
}
function modeFromTags(tags: string[]) {
  const mode = tags.find((tag) => tag.startsWith("gm"))
  return mode ? `Mode: ${mode.slice(2)}` : null
}
function relativeTime(value: string) {
  const elapsed = Math.max(0, Date.now() - new Date(value).getTime())
  const seconds = Math.floor(elapsed / 1000)
  if (seconds < 10) return "just now"
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  return minutes < 60 ? `${minutes}m ago` : `${Math.floor(minutes / 60)}h ago`
}
