"use client"

import Link from "next/link"
import { useCallback, useEffect, useState } from "react"
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
import { apiFetch, type WatchlistServer } from "@/lib/api"

export function ServerDetailPage({ serverId }: { serverId: string }) {
  const [server, setServer] = useState<WatchlistServer | null>(null)
  const [loading, setLoading] = useState(true)
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

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timer)
  }, [load])

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

  if (loading) return <LoadingDetail />
  if (!server) return <DetailError error={error} onRetry={() => void load()} />

  const online = server.status === "online"
  const title = server.name || server.address
  const playerCount =
    online && server.players !== undefined && server.maxPlayers !== undefined
      ? `${server.players} / ${server.maxPlayers}`
      : "Not available"

  return (
    <>
      <PageHeader
        title="Server details"
        description="Stored live snapshot. More data will appear here as trusted sources become available."
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
              {server.error && !online && (
                <p className="mt-3 max-w-2xl text-sm leading-6 text-amber-100/80">
                  {server.error}
                </p>
              )}
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
          <div className="grid divide-y divide-white/[0.08] sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-4">
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
              value={formatTimestamp(server.checkedAt)}
              detail={
                server.latencyMs !== undefined
                  ? `${server.latencyMs} ms response`
                  : undefined
              }
            />
          </div>
        </CardContent>
      </Card>
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
              <SecurityRow
                label="VAC"
                value={
                  server.vacSecured === undefined
                    ? "Not reported"
                    : server.vacSecured
                      ? "Secured"
                      : "Not secured"
                }
              />
              <SecurityRow
                label="Password"
                value={
                  server.passwordProtected === undefined
                    ? "Not reported"
                    : server.passwordProtected
                      ? "Required"
                      : "Not required"
                }
              />
              <SecurityRow
                label="Saved"
                value={formatTimestamp(server.createdAt)}
              />
            </dl>
          </CardContent>
        </Card>
      </section>
      <Card className="mt-5 rounded-2xl border-white/[0.08] bg-[#171313] shadow-none">
        <CardContent className="p-5 sm:p-6">
          <div className="flex items-center gap-2">
            <Tags className="size-4 text-white/45" />
            <h2 className="text-sm font-semibold text-white">Server tags</h2>
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
              This server did not report tags in its public query.
            </p>
          )}
        </CardContent>
      </Card>
    </>
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
function SecurityRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-5">
      <dt className="text-white/45">{label}</dt>
      <dd className="text-right font-medium text-white/80">{value}</dd>
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
function LoadingDetail() {
  return (
    <div className="space-y-5">
      <div className="h-44 animate-pulse rounded-2xl border border-white/[0.08] bg-white/[0.04]" />
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="h-72 animate-pulse rounded-2xl border border-white/[0.08] bg-white/[0.04]" />
        <div className="h-72 animate-pulse rounded-2xl border border-white/[0.08] bg-white/[0.04]" />
      </div>
    </div>
  )
}
function DetailError({
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
function formatTimestamp(value?: string) {
  if (!value) return "Not reported"
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? "Not reported" : date.toLocaleString()
}
