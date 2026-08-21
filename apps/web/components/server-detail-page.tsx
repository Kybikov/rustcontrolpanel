"use client"

import Link from "next/link"
import { useCallback, useEffect, useState } from "react"
import {
  ArrowLeft,
  CircleAlert,
  Copy,
  Map,
  RefreshCw,
  Server,
  Trophy,
  UsersRound,
} from "lucide-react"

import { PageHeader } from "@/components/page-primitives"
import { apiFetch, type RustServer } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

export function ServerDetailPage({ serverId }: { serverId: string }) {
  const [server, setServer] = useState<RustServer | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [copied, setCopied] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const response = await apiFetch(
        `/api/v1/servers/${encodeURIComponent(serverId)}`
      )
      const payload = (await response.json().catch(() => null)) as {
        server?: RustServer
        error?: string
      } | null
      if (!response.ok || !payload?.server) {
        setError(payload?.error ?? "Could not load this server")
        return
      }
      setServer(payload.server)
    } catch {
      setError(
        "Could not reach the API. Check that the local Docker stack is running and try again."
      )
    } finally {
      setLoading(false)
    }
  }, [serverId])

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timer)
  }, [load])

  async function copyAddress() {
    if (!server?.address) return
    await navigator.clipboard.writeText(server.address)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1600)
  }

  if (loading) return <LoadingDetail />
  if (error || !server)
    return <DetailError error={error} onRetry={() => void load()} />

  const online = server.status.toLowerCase() === "online"
  const address = server.address || `${server.ip}:${server.port}`
  const playerCount = `${server.players.toLocaleString()} / ${server.maxPlayers.toLocaleString()}`

  return (
    <>
      <PageHeader
        title="Server details"
        description="Live basic data provided by BattleMetrics."
        action={
          <Link
            href="/servers"
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-white/[0.12] px-3 text-sm text-white/75 transition-colors hover:bg-white/[0.06] hover:text-white"
          >
            <ArrowLeft className="size-4" />
            All servers
          </Link>
        }
      />
      <Card className="rounded-2xl border-white/[0.08] bg-[#171313] shadow-none">
        <CardContent className="p-5 sm:p-6">
          <div className="flex flex-col justify-between gap-5 border-b border-white/[0.08] pb-5 sm:flex-row sm:items-start">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span
                  className={`size-2 rounded-full ${online ? "bg-emerald-400" : "bg-white/25"}`}
                />
                <span className="text-xs font-medium text-white/50 capitalize">
                  {server.status || "Unknown"}
                </span>
              </div>
              <h2 className="mt-3 text-xl font-semibold tracking-[-0.03em] break-words text-white sm:text-2xl">
                {server.name || "Unnamed Rust server"}
              </h2>
              <p className="mt-2 text-sm text-white/45">
                {server.description || "No server description was provided."}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-3 rounded-xl bg-white/[0.04] px-4 py-3">
              <UsersRound className="size-5 text-white/45" />
              <div>
                <p className="text-lg font-semibold text-white tabular-nums">
                  {playerCount}
                </p>
                <p className="text-xs text-white/40">players online</p>
              </div>
            </div>
          </div>

          <dl className="grid divide-y divide-white/[0.07] sm:grid-cols-2 sm:divide-x sm:divide-y-0">
            <DetailItem icon={<Server className="size-4" />} label="Address">
              <div className="flex items-center gap-2">
                <span className="truncate font-mono text-xs text-white/80">
                  {address}
                </span>
                {server.address && (
                  <button
                    type="button"
                    onClick={() => void copyAddress()}
                    className="rounded-md p-1 text-white/40 transition-colors outline-none hover:bg-white/[0.07] hover:text-white focus-visible:ring-2 focus-visible:ring-white/40"
                    aria-label="Copy server address"
                  >
                    <Copy className="size-3.5" />
                  </button>
                )}
              </div>
              {copied && (
                <span className="mt-1 block text-[11px] text-emerald-300">
                  Address copied
                </span>
              )}
            </DetailItem>
            <DetailItem icon={<Map className="size-4" />} label="Map">
              {server.map || "Not provided"}
              {server.mapSize ? (
                <span className="ml-2 text-xs text-white/35">
                  {server.mapSize.toLocaleString()} size
                </span>
              ) : null}
            </DetailItem>
            <DetailItem
              icon={<Trophy className="size-4" />}
              label="BattleMetrics rank"
            >
              {server.rank
                ? `#${server.rank.toLocaleString()}`
                : "Not provided"}
            </DetailItem>
            <DetailItem
              icon={<RefreshCw className="size-4" />}
              label="Last seen"
            >
              {formatTimestamp(server.lastSeenAt)}
            </DetailItem>
          </dl>
          {server.wipeAt && (
            <p className="mt-5 rounded-xl bg-white/[0.04] px-4 py-3 text-xs text-white/55">
              Last wipe reported by BattleMetrics:{" "}
              <span className="font-medium text-white/80">
                {formatTimestamp(server.wipeAt)}
              </span>
            </p>
          )}
        </CardContent>
      </Card>
    </>
  )
}

function DetailItem({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="min-w-0 py-4 sm:px-5 sm:first:pl-0 sm:last:pr-0">
      <dt className="flex items-center gap-2 text-xs text-white/40">
        {icon}
        {label}
      </dt>
      <dd className="mt-2 min-w-0 text-sm text-white/80">{children}</dd>
    </div>
  )
}

function LoadingDetail() {
  return (
    <div className="flex min-h-72 flex-col items-center justify-center rounded-2xl border border-white/[0.08] bg-[#171313] text-center">
      <RefreshCw className="size-5 animate-spin text-white/45" />
      <p className="mt-3 text-sm text-white/55">Loading server details…</p>
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
        {error || "Could not load this server"}
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

function formatTimestamp(value?: string) {
  if (!value) return "Not provided"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Not provided"
  return date.toLocaleString()
}
