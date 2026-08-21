"use client"

import Image from "next/image"
import Link from "next/link"
import { useCallback, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import {
  ArrowLeft,
  CircleAlert,
  Clock3,
  ExternalLink,
  Gamepad2,
  History,
  RefreshCw,
  ShieldCheck,
  UserRound,
} from "lucide-react"

import { PageHeader } from "@/components/page-primitives"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  apiFetch,
  type PlayerActivityPoint,
  type SavedSteamPlayer,
} from "@/lib/api"

const tabs = ["overview", "activity", "steam"] as const
type Tab = (typeof tabs)[number]

export function PlayerDetailPage({ steamId }: { steamId: string }) {
  const router = useRouter()
  const params = useSearchParams()
  const activeTab = params.get("tab")
  const tab: Tab = tabs.includes(activeTab as Tab)
    ? (activeTab as Tab)
    : "overview"
  const [player, setPlayer] = useState<SavedSteamPlayer | null>(null)
  const [history, setHistory] = useState<PlayerActivityPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [historyLoading, setHistoryLoading] = useState(false)
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

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true)
    try {
      const response = await apiFetch(
        `/api/v1/players/saved/${encodeURIComponent(steamId)}/history`
      )
      const payload = (await response.json().catch(() => null)) as {
        history?: PlayerActivityPoint[]
      } | null
      if (response.ok) setHistory(payload?.history ?? [])
    } finally {
      setHistoryLoading(false)
    }
  }, [steamId])

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timer)
  }, [load])

  useEffect(() => {
    if (tab !== "activity") return
    const timer = window.setTimeout(() => void loadHistory(), 0)
    return () => window.clearTimeout(timer)
  }, [loadHistory, tab])

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
      if (tab === "activity") void loadHistory()
    } catch {
      setError(
        "Could not reach the API. Check the local Docker stack and try again."
      )
    } finally {
      setRefreshing(false)
    }
  }

  function selectTab(next: Tab) {
    router.replace(
      next === "overview"
        ? `/players/${steamId}`
        : `/players/${steamId}?tab=${next}`,
      { scroll: false }
    )
  }

  if (loading) return <LoadingState />
  if (!player) return <ErrorState error={error} onRetry={() => void load()} />

  const online = player.presence === "online"
  return (
    <>
      <PageHeader
        title="Player details"
        description="Live public Steam profile data and recorded activity for this saved player."
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
      {error && <ErrorNotice error={error} />}

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
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-sm text-white/65 transition-colors hover:bg-white/[0.06] hover:text-white"
                >
                  Open Steam
                  <ExternalLink className="size-3.5" />
                </a>
              )}
            </div>
          </div>
          <nav
            aria-label="Player detail sections"
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

      {tab === "overview" && <Overview player={player} />}
      {tab === "activity" && (
        <Activity history={history} loading={historyLoading} />
      )}
      {tab === "steam" && <Steam player={player} />}
    </>
  )
}

function Overview({ player }: { player: SavedSteamPlayer }) {
  return (
    <>
      <section className="mt-5 grid divide-y divide-white/[0.08] overflow-hidden rounded-2xl border border-white/[0.08] bg-[#171313] sm:grid-cols-3 sm:divide-x sm:divide-y-0">
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
      </section>
      <section className="mt-5 grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
        <Card className="rounded-2xl border-white/[0.08] bg-[#171313] shadow-none">
          <CardContent className="p-0">
            <div className="border-b border-white/[0.08] px-5 py-4 sm:px-6">
              <h2 className="text-sm font-semibold text-white">Live status</h2>
              <p className="mt-1 text-xs text-white/40">
                Only public Steam fields are stored for this player.
              </p>
            </div>
            <dl className="divide-y divide-white/[0.07] px-5 sm:px-6">
              <DataRow label="Presence" value={capitalize(player.presence)} />
              <DataRow
                label="Current game"
                value={player.currentGame || "Not reported"}
              />
              <DataRow label="Last sync" value={formatTime(player.updatedAt)} />
            </dl>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-white/[0.08] bg-[#171313] shadow-none">
          <CardContent className="p-5 sm:p-6">
            <div className="flex items-center gap-2">
              <History className="size-4 text-white/45" />
              <h2 className="text-sm font-semibold text-white">Live updates</h2>
            </div>
            <p className="mt-3 text-sm leading-6 text-white/55">
              RustControl refreshes saved public profiles every 30 seconds.
              Presence or game changes are saved to Activity and delivered live
              to the application.
            </p>
          </CardContent>
        </Card>
      </section>
    </>
  )
}

function Activity({
  history,
  loading,
}: {
  history: PlayerActivityPoint[]
  loading: boolean
}) {
  return (
    <section className="mt-5 overflow-hidden rounded-2xl border border-white/[0.08] bg-[#171313]">
      {loading ? (
        <div className="h-52 animate-pulse bg-white/[0.04]" />
      ) : history.length ? (
        history.map((point, index) => (
          <div
            key={`${point.capturedAt}-${index}`}
            className="grid gap-3 border-b border-white/[0.07] px-5 py-4 last:border-0 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-white/85">
                {point.currentGame || "No public game reported"}
              </p>
              <p className="mt-1 text-xs text-white/40">
                Public Steam activity snapshot
              </p>
            </div>
            <p className="text-xs text-white/60 capitalize">{point.presence}</p>
            <p className="text-xs text-white/40 tabular-nums">
              {formatTime(point.capturedAt)}
            </p>
          </div>
        ))
      ) : (
        <div className="px-6 py-10 text-center">
          <p className="text-sm font-medium text-white/75">
            Activity history is starting
          </p>
          <p className="mt-1 text-xs leading-5 text-white/40">
            The first real Steam activity snapshot will appear after the next
            profile refresh.
          </p>
        </div>
      )}
    </section>
  )
}

function Steam({ player }: { player: SavedSteamPlayer }) {
  return (
    <section className="mt-5 grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
      <Card className="rounded-2xl border-white/[0.08] bg-[#171313] shadow-none">
        <CardContent className="p-0">
          <div className="border-b border-white/[0.08] px-5 py-4 sm:px-6">
            <h2 className="text-sm font-semibold text-white">
              Public Steam identity
            </h2>
            <p className="mt-1 text-xs text-white/40">
              Fields returned by the linked public Steam profile.
            </p>
          </div>
          <dl className="divide-y divide-white/[0.07] px-5 sm:px-6">
            <DataRow label="Steam ID" value={player.steamId} mono />
            <DataRow label="Visibility" value={capitalize(player.visibility)} />
            <DataRow
              label="Last logoff"
              value={formatTime(player.lastLogoffAt)}
            />
            <DataRow
              label="Profile created"
              value={formatTime(player.profileCreatedAt)}
            />
            <DataRow label="Saved" value={formatTime(player.savedAt)} />
          </dl>
        </CardContent>
      </Card>
      <Card className="rounded-2xl border-white/[0.08] bg-[#171313] shadow-none">
        <CardContent className="p-5 sm:p-6">
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-4 text-white/45" />
            <h2 className="text-sm font-semibold text-white">Data scope</h2>
          </div>
          <p className="mt-3 text-sm leading-6 text-white/55">
            Steam controls profile visibility. RustControl only uses public
            profile data and never receives a Steam password.
          </p>
        </CardContent>
      </Card>
    </section>
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
    <div className="flex items-center justify-between gap-4 py-3 text-sm max-[420px]:flex-col max-[420px]:items-start">
      <dt className="text-white/45">{label}</dt>
      <dd
        className={`min-w-0 truncate text-right text-white/80 max-[420px]:max-w-full max-[420px]:text-left ${mono ? "font-mono text-xs" : ""}`}
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

function capitalize(value?: string) {
  if (!value) return "Not reported"
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function formatTime(value?: string) {
  if (!value) return "Not reported"
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? "Not reported" : date.toLocaleString()
}
