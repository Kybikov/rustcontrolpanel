"use client"

import Image from "next/image"
import Link from "next/link"
import { useCallback, useEffect, useState } from "react"
import {
  ArrowLeft,
  CircleAlert,
  Clock3,
  ExternalLink,
  Gamepad2,
  RefreshCw,
  ShieldCheck,
  UserRound,
} from "lucide-react"

import { PageHeader } from "@/components/page-primitives"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { apiFetch, type SavedSteamPlayer } from "@/lib/api"

export function PlayerDetailPage({ steamId }: { steamId: string }) {
  const [player, setPlayer] = useState<SavedSteamPlayer | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const response = await apiFetch(
        `/api/v1/players/saved/${encodeURIComponent(steamId)}`
      )
      const payload = (await response.json().catch(() => null)) as {
        player?: SavedSteamPlayer
        error?: string
      } | null
      if (!response.ok || !payload?.player) {
        setError(payload?.error ?? "Could not load this saved player")
        return
      }
      setPlayer(payload.player)
    } catch {
      setError(
        "Could not reach the API. Check the local Docker stack and try again."
      )
    } finally {
      setLoading(false)
    }
  }, [steamId])

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timer)
  }, [load])

  async function refresh() {
    setRefreshing(true)
    setError("")
    try {
      const response = await apiFetch(
        `/api/v1/players/saved/${encodeURIComponent(steamId)}/refresh`,
        { method: "POST" }
      )
      const payload = (await response.json().catch(() => null)) as {
        player?: SavedSteamPlayer
        error?: string
      } | null
      if (!response.ok || !payload?.player) {
        setError(payload?.error ?? "Could not refresh this player")
        return
      }
      setPlayer(payload.player)
    } catch {
      setError(
        "Could not reach the API. Check the local Docker stack and try again."
      )
    } finally {
      setRefreshing(false)
    }
  }

  if (loading) return <LoadingState />
  if (!player) return <ErrorState error={error} onRetry={() => void load()} />

  const online = player.presence === "online"
  return (
    <>
      <PageHeader
        title="Player details"
        description="Live public Steam profile data for a player you saved."
        action={
          <Link
            href="/players"
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-white/[0.12] px-3 text-sm text-white/75 transition-colors hover:bg-white/[0.06] hover:text-white"
          >
            <ArrowLeft className="size-4" />
            Players
          </Link>
        }
      />
      {error && (
        <div
          role="alert"
          className="mb-5 flex items-start gap-3 rounded-2xl border border-red-400/20 bg-red-400/[0.08] px-4 py-3 text-sm text-red-100"
        >
          <CircleAlert className="mt-0.5 size-4 shrink-0 text-red-300" />
          {error}
        </div>
      )}
      <Card className="overflow-hidden rounded-2xl border-white/[0.08] bg-[#171313] shadow-none">
        <CardContent className="p-0">
          <div className="flex flex-col gap-5 border-b border-white/[0.08] px-5 py-5 sm:flex-row sm:items-start sm:justify-between sm:px-6">
            <div className="flex min-w-0 items-center gap-4">
              {player.avatarUrl ? (
                <Image
                  src={player.avatarUrl}
                  alt=""
                  width={72}
                  height={72}
                  className="size-[72px] shrink-0 rounded-2xl bg-white/[0.06] object-cover"
                />
              ) : (
                <div className="grid size-[72px] shrink-0 place-items-center rounded-2xl bg-white/[0.06] text-white/45">
                  <UserRound className="size-6" />
                </div>
              )}
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-xs text-white/50">
                  <span
                    className={`size-1.5 rounded-full ${online ? "bg-emerald-400" : "bg-white/25"}`}
                  />
                  <span className="capitalize">{player.presence}</span>
                </div>
                <h2 className="mt-2 truncate text-xl font-semibold tracking-[-0.03em] text-white sm:text-2xl">
                  {player.displayName || "Steam player"}
                </h2>
                <p className="mt-1 truncate font-mono text-xs text-white/42">
                  {player.steamId}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={refreshing}
                onClick={() => void refresh()}
                className="rounded-xl border-white/[0.12] bg-transparent text-white hover:bg-white/[0.06]"
              >
                <RefreshCw
                  className={`size-4 ${refreshing ? "animate-spin" : ""}`}
                />
                {refreshing ? "Refreshing…" : "Refresh now"}
              </Button>
              {player.profileUrl && (
                <a
                  href={player.profileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-sm text-white/65 hover:bg-white/[0.06] hover:text-white"
                >
                  Open Steam
                  <ExternalLink className="size-3.5" />
                </a>
              )}
            </div>
          </div>
          <div className="grid divide-y divide-white/[0.08] sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            <Fact
              icon={Gamepad2}
              label="Current activity"
              value={player.currentGame || "No public game reported"}
            />
            <Fact
              icon={Clock3}
              label="Last Steam sync"
              value={formatTime(player.updatedAt)}
            />
            <Fact
              icon={ShieldCheck}
              label="Profile visibility"
              value={player.visibility || "Not reported"}
            />
          </div>
        </CardContent>
      </Card>
      <section className="mt-5 grid gap-5 lg:grid-cols-2">
        <Card className="rounded-2xl border-white/[0.08] bg-[#171313] shadow-none">
          <CardContent className="p-0">
            <div className="border-b border-white/[0.08] px-5 py-4 sm:px-6">
              <h2 className="text-sm font-semibold text-white">
                Public Steam identity
              </h2>
              <p className="mt-1 text-xs text-white/40">
                Only fields Steam exposes for this profile.
              </p>
            </div>
            <dl className="divide-y divide-white/[0.07] px-5 sm:px-6">
              <DataRow label="Steam ID" value={player.steamId} mono />
              <DataRow
                label="Last logoff"
                value={formatTime(player.lastLogoffAt)}
              />
              <DataRow
                label="Profile created"
                value={formatTime(player.profileCreatedAt)}
              />
              <DataRow
                label="Saved in RustControl"
                value={formatTime(player.savedAt)}
              />
            </dl>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-white/[0.08] bg-[#171313] shadow-none">
          <CardContent className="p-5 sm:p-6">
            <h2 className="text-sm font-semibold text-white">
              What updates live
            </h2>
            <p className="mt-2 max-w-prose text-sm leading-6 text-white/55">
              RustControl refreshes the public Steam status and current game
              every minute, then updates this profile and the saved-player list
              through WebSocket.
            </p>
            <p className="mt-4 max-w-prose text-xs leading-5 text-white/38">
              Playtime, friend list and private profile fields are only
              available for the owner’s linked Steam account when Steam permits
              them.
            </p>
          </CardContent>
        </Card>
      </section>
    </>
  )
}

function Fact({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Gamepad2
  label: string
  value: string
}) {
  return (
    <div className="min-w-0 px-5 py-4 sm:px-6">
      <div className="flex items-center gap-2 text-xs text-white/40">
        <Icon className="size-3.5" />
        {label}
      </div>
      <p className="mt-2 truncate text-sm font-medium text-white/85">{value}</p>
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
function LoadingState() {
  return (
    <div className="space-y-5">
      <div className="h-44 animate-pulse rounded-2xl border border-white/[0.08] bg-white/[0.04]" />
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="h-64 animate-pulse rounded-2xl border border-white/[0.08] bg-white/[0.04]" />
        <div className="h-64 animate-pulse rounded-2xl border border-white/[0.08] bg-white/[0.04]" />
      </div>
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
        {error || "Could not load this saved player"}
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
          href="/players"
          className="inline-flex h-8 items-center rounded-xl px-3 text-xs text-white/65 hover:bg-white/[0.06] hover:text-white"
        >
          Back to players
        </Link>
      </div>
    </div>
  )
}
function formatTime(value?: string) {
  if (!value) return "Not reported"
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? "Not reported" : date.toLocaleString()
}
