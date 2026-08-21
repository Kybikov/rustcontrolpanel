"use client"

import Link from "next/link"
import { useCallback, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import {
  ArrowLeft,
  CircleAlert,
  Clock3,
  Copy,
  Map,
  Radio,
  RefreshCw,
  Server,
  ShieldCheck,
  Tags,
  UsersRound,
} from "lucide-react"

import { PageHeader } from "@/components/page-primitives"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  apiFetch,
  type ServerHistoryPoint,
  type WatchlistServer,
} from "@/lib/api"

const tabs = ["overview", "map", "history"] as const
type Tab = (typeof tabs)[number]

export function ServerDetailPage({ serverId }: { serverId: string }) {
  const router = useRouter()
  const params = useSearchParams()
  const tab = tabs.includes(params.get("tab") as Tab)
    ? (params.get("tab") as Tab)
    : "overview"
  const [server, setServer] = useState<WatchlistServer | null>(null)
  const [history, setHistory] = useState<ServerHistoryPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState("")
  const [copied, setCopied] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const response = await apiFetch(
        `/api/v1/servers/watchlist/${encodeURIComponent(serverId)}`
      )
      const payload = (await response.json().catch(() => null)) as {
        server?: WatchlistServer
        error?: string
      } | null
      if (!response.ok || !payload?.server) {
        setError(payload?.error ?? "Could not load this saved server")
        return
      }
      setServer(payload.server)
    } catch {
      setError(
        "Could not reach the API. Check the local Docker stack and try again."
      )
    } finally {
      setLoading(false)
    }
  }, [serverId])

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true)
    try {
      const response = await apiFetch(
        `/api/v1/servers/watchlist/${encodeURIComponent(serverId)}/history`
      )
      const payload = (await response.json().catch(() => null)) as {
        history?: ServerHistoryPoint[]
      } | null
      if (response.ok) setHistory(payload?.history ?? [])
    } finally {
      setHistoryLoading(false)
    }
  }, [serverId])

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timer)
  }, [load])
  useEffect(() => {
    if (tab !== "history") return
    const timer = window.setTimeout(() => void loadHistory(), 0)
    return () => window.clearTimeout(timer)
  }, [loadHistory, tab])

  async function refresh() {
    if (!server) return
    setRefreshing(true)
    setError("")
    try {
      const response = await apiFetch(
        `/api/v1/servers/watchlist/${server.id}/refresh`,
        { method: "POST" }
      )
      const payload = (await response.json().catch(() => null)) as {
        server?: WatchlistServer
        error?: string
      } | null
      if (!response.ok || !payload?.server) {
        setError(payload?.error ?? "Could not refresh this server")
        return
      }
      setServer(payload.server)
      if (tab === "history") void loadHistory()
    } catch {
      setError(
        "Could not reach the API. Check the local Docker stack and try again."
      )
    } finally {
      setRefreshing(false)
    }
  }

  async function copyAddress() {
    if (!server?.address) return
    await navigator.clipboard.writeText(server.address)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1600)
  }
  function selectTab(next: Tab) {
    router.replace(
      next === "overview"
        ? `/servers/${serverId}`
        : `/servers/${serverId}?tab=${next}`,
      { scroll: false }
    )
  }

  if (loading) return <LoadingState />
  if (!server) return <ErrorState error={error} onRetry={() => void load()} />
  const online = server.status === "online"
  const title = server.name || server.address
  return (
    <>
      <PageHeader
        title="Server details"
        description="Live state, map data and recorded history for this saved server."
        action={
          <Link
            href="/servers"
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-white/[0.12] px-3 text-sm text-white/75 transition-colors hover:bg-white/[0.06] hover:text-white"
          >
            <ArrowLeft className="size-4" />
            Servers
          </Link>
        }
      />
      {error && <ErrorNotice error={error} />}
      <Card className="overflow-hidden rounded-2xl border-white/[0.08] bg-[#171313] shadow-none">
        <CardContent className="p-0">
          <div className="flex flex-col gap-5 border-b border-white/[0.08] px-5 py-5 sm:flex-row sm:items-start sm:justify-between sm:px-6">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-xs text-white/50">
                <span
                  className={`size-1.5 rounded-full ${online ? "bg-emerald-400" : server.status === "blocked" ? "bg-amber-400" : "bg-red-400"}`}
                />
                <span className="capitalize">{server.status}</span>
              </div>
              <h2 className="mt-3 text-xl font-semibold tracking-[-0.03em] break-words text-white sm:text-2xl">
                {title}
              </h2>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-white/45">
                <span className="font-mono text-xs text-white/65">
                  {server.address}
                </span>
                <button
                  type="button"
                  onClick={() => void copyAddress()}
                  className="rounded-md p-1 text-white/40 transition-colors hover:bg-white/[0.07] hover:text-white focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:outline-none"
                  aria-label="Copy server address"
                >
                  <Copy className="size-3.5" />
                </button>
                {copied && (
                  <span className="text-xs text-emerald-300">
                    Address copied
                  </span>
                )}
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              disabled={refreshing}
              onClick={() => void refresh()}
              className="shrink-0 rounded-xl border-white/[0.12] bg-transparent text-white hover:bg-white/[0.06]"
            >
              <RefreshCw
                className={`size-4 ${refreshing ? "animate-spin" : ""}`}
              />
              {refreshing ? "Refreshing…" : "Refresh now"}
            </Button>
          </div>
          <nav
            aria-label="Server detail sections"
            className="flex overflow-x-auto border-b border-white/[0.08] px-3"
          >
            {tabs.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => selectTab(item)}
                className={`h-11 shrink-0 border-b-2 px-3 text-xs font-medium capitalize transition-colors ${tab === item ? "border-[#ef3d36] text-white" : "border-transparent text-white/45 hover:text-white/75"}`}
              >
                {item}
              </button>
            ))}
          </nav>
        </CardContent>
      </Card>
      {tab === "overview" && <Overview server={server} online={online} />}
      {tab === "map" && <MapSection server={server} />}
      {tab === "history" && (
        <HistorySection history={history} loading={historyLoading} />
      )}
    </>
  )
}

function Overview({
  server,
  online,
}: {
  server: WatchlistServer
  online: boolean
}) {
  const playerCount =
    online && server.players !== undefined && server.maxPlayers !== undefined
      ? `${server.players} / ${server.maxPlayers}`
      : "Not available"
  return (
    <>
      <section className="mt-5 grid divide-y divide-white/[0.08] overflow-hidden rounded-2xl border border-white/[0.08] bg-[#171313] sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-4">
        <Fact
          icon={UsersRound}
          label="Players"
          value={playerCount}
          detail={server.bots ? `${server.bots} bots reported` : undefined}
        />
        <Fact icon={Map} label="Map" value={server.map || "Not reported"} />
        <Fact
          icon={Radio}
          label="Query port"
          value={portFromAddress(server.queryAddress)}
        />
        <Fact
          icon={Clock3}
          label="Last checked"
          value={formatTime(server.checkedAt)}
          detail={
            server.latencyMs !== undefined
              ? `${server.latencyMs} ms response`
              : undefined
          }
        />
      </section>
      <section className="mt-5 grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
        <Card className="rounded-2xl border-white/[0.08] bg-[#171313] shadow-none">
          <CardContent className="p-0">
            <div className="border-b border-white/[0.08] px-5 py-4 sm:px-6">
              <h2 className="text-sm font-semibold text-white">
                Server identity
              </h2>
              <p className="mt-1 text-xs text-white/40">
                Fields returned by the server’s public A2S query.
              </p>
            </div>
            <dl className="divide-y divide-white/[0.07] px-5 sm:px-6">
              <DataRow label="Game" value={server.gameName || "Not reported"} />
              <DataRow
                label="Game folder"
                value={server.gameFolder || "Not reported"}
                mono
              />
              <DataRow
                label="Version"
                value={server.version || "Not reported"}
                mono
              />
              <DataRow
                label="Protocol"
                value={server.protocol?.toString() || "Not reported"}
                mono
              />
              <DataRow
                label="Server type"
                value={server.serverKind || "Not reported"}
              />
              <DataRow
                label="Environment"
                value={server.environment || "Not reported"}
              />
              <DataRow
                label="Steam server ID"
                value={server.serverSteamId || "Not reported"}
                mono
              />
            </dl>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-white/[0.08] bg-[#171313] shadow-none">
          <CardContent className="p-5 sm:p-6">
            <div className="flex items-center gap-2">
              <ShieldCheck className="size-4 text-white/45" />
              <h2 className="text-sm font-semibold text-white">
                Access & security
              </h2>
            </div>
            <dl className="mt-4 space-y-4 text-sm">
              <DataRow
                label="VAC"
                value={
                  server.vacSecured === undefined
                    ? "Not reported"
                    : server.vacSecured
                      ? "Secured"
                      : "Not secured"
                }
              />
              <DataRow
                label="Password"
                value={
                  server.passwordProtected === undefined
                    ? "Not reported"
                    : server.passwordProtected
                      ? "Required"
                      : "Not required"
                }
              />
              <DataRow label="Saved" value={formatTime(server.createdAt)} />
            </dl>
          </CardContent>
        </Card>
      </section>
    </>
  )
}
function MapSection({ server }: { server: WatchlistServer }) {
  return (
    <section className="mt-5 grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
      <Card className="rounded-2xl border-white/[0.08] bg-[#171313] shadow-none">
        <CardContent className="p-5 sm:p-6">
          <div className="flex items-center gap-2">
            <Map className="size-4 text-white/45" />
            <h2 className="text-sm font-semibold text-white">Reported map</h2>
          </div>
          <p className="mt-4 text-xl font-semibold tracking-[-0.02em] break-words text-white">
            {server.map || "Map was not reported"}
          </p>
          <p className="mt-2 max-w-prose text-sm leading-6 text-white/50">
            This is the exact map label from the server’s A2S response. A visual
            map preview needs a matching external source such as RustLabs; it is
            intentionally not fabricated here.
          </p>
        </CardContent>
      </Card>
      <Card className="rounded-2xl border-white/[0.08] bg-[#171313] shadow-none">
        <CardContent className="p-5 sm:p-6">
          <div className="flex items-center gap-2">
            <Tags className="size-4 text-white/45" />
            <h2 className="text-sm font-semibold text-white">
              Map & mode tags
            </h2>
          </div>
          {server.tags.length ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {server.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-lg border border-white/[0.1] bg-white/[0.03] px-2.5 py-1 text-xs text-white/60"
                >
                  {tag}
                </span>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm text-white/45">
              This server did not report tags.
            </p>
          )}
        </CardContent>
      </Card>
    </section>
  )
}
function HistorySection({
  history,
  loading,
}: {
  history: ServerHistoryPoint[]
  loading: boolean
}) {
  return (
    <section className="mt-5 overflow-hidden rounded-2xl border border-white/[0.08] bg-[#171313]">
      {loading ? (
        <div className="h-52 animate-pulse bg-white/[0.04]" />
      ) : history.length ? (
        <div>
          {history.map((point, index) => (
            <div
              key={`${point.checkedAt}-${index}`}
              className="grid gap-3 border-b border-white/[0.07] px-5 py-4 last:border-0 sm:grid-cols-[1fr_auto_auto_auto]"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-white/85">
                  {point.name || point.status}
                </p>
                <p className="mt-1 text-xs text-white/40">
                  {point.map || point.error || "No map reported"}
                </p>
              </div>
              <p className="text-xs text-white/55 capitalize">{point.status}</p>
              <p className="text-xs text-white/55 tabular-nums">
                {point.players !== undefined && point.maxPlayers !== undefined
                  ? `${point.players} / ${point.maxPlayers}`
                  : "—"}
              </p>
              <p className="text-xs text-white/40 tabular-nums">
                {formatTime(point.checkedAt)}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <div className="px-6 py-10 text-center">
          <p className="text-sm font-medium text-white/75">
            History starts with the next check
          </p>
          <p className="mt-1 text-xs leading-5 text-white/40">
            RustControl now stores real server status, player count, map and
            latency after each refresh.
          </p>
        </div>
      )}
    </section>
  )
}
function Fact({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: typeof Server
  label: string
  value: string
  detail?: string
}) {
  return (
    <div className="min-w-0 px-5 py-4 sm:px-6">
      <div className="flex items-center gap-2 text-xs text-white/40">
        <Icon className="size-3.5" />
        {label}
      </div>
      <p className="mt-2 truncate text-sm font-medium text-white/85 tabular-nums">
        {value}
      </p>
      {detail && <p className="mt-1 text-xs text-white/38">{detail}</p>}
    </div>
  )
}
function DataRow({
  label,
  value,
  mono = false,
}: {
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-6 py-3 text-sm">
      <dt className="text-white/45">{label}</dt>
      <dd
        className={`min-w-0 truncate text-right text-white/80 ${mono ? "font-mono text-xs" : ""}`}
      >
        {value}
      </dd>
    </div>
  )
}
function ErrorNotice({ error }: { error: string }) {
  return (
    <div
      role="alert"
      className="mb-5 flex items-start gap-3 rounded-2xl border border-red-400/20 bg-red-400/[0.08] px-4 py-3 text-sm text-red-100"
    >
      <CircleAlert className="mt-0.5 size-4 shrink-0 text-red-300" />
      {error}
    </div>
  )
}
function LoadingState() {
  return (
    <div className="space-y-5">
      <div className="h-44 animate-pulse rounded-2xl border border-white/[0.08] bg-white/[0.04]" />
      <div className="h-72 animate-pulse rounded-2xl border border-white/[0.08] bg-white/[0.04]" />
    </div>
  )
}
function ErrorState({
  error,
  onRetry,
}: {
  error: string
  onRetry: () => void
}) {
  return (
    <div className="flex min-h-72 flex-col items-center justify-center rounded-2xl border border-red-400/20 bg-red-400/[0.05] px-6 text-center">
      <CircleAlert className="size-5 text-red-300" />
      <p className="mt-3 text-sm font-medium text-red-100">
        {error || "Could not load this saved server"}
      </p>
      <div className="mt-4 flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onRetry}
          className="rounded-xl border-white/[0.12] bg-transparent text-white hover:bg-white/[0.06]"
        >
          Try again
        </Button>
        <Link
          href="/servers"
          className="inline-flex h-8 items-center rounded-xl px-3 text-xs text-white/65 hover:bg-white/[0.06] hover:text-white"
        >
          Back to servers
        </Link>
      </div>
    </div>
  )
}
function portFromAddress(address: string) {
  const separator = address.lastIndexOf(":")
  return separator === -1 ? "Not reported" : address.slice(separator + 1)
}
function formatTime(value?: string) {
  if (!value) return "Not reported"
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? "Not reported" : date.toLocaleString()
}
