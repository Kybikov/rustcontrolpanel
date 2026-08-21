"use client"

import Image from "next/image"
import Link from "next/link"
import { useCallback, useEffect, useRef, useState } from "react"
import {
  ArrowUpRight,
  Bookmark,
  CircleAlert,
  ExternalLink,
  Gamepad2,
  RefreshCw,
  Search,
  Trash2,
  Users,
} from "lucide-react"

import { PageHeader } from "@/components/page-primitives"
import {
  API_URL,
  apiFetch,
  type SavedSteamPlayer,
  type SteamPlayer,
} from "@/lib/api"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

export function PlayersPage() {
  const [query, setQuery] = useState("")
  const [players, setPlayers] = useState<SteamPlayer[]>([])
  const [savedPlayers, setSavedPlayers] = useState<SavedSteamPlayer[]>([])
  const [loading, setLoading] = useState(false)
  const [savingSteamID, setSavingSteamID] = useState<string | null>(null)
  const [error, setError] = useState("")
  const reconnectTimer = useRef<number | null>(null)

  const loadSavedPlayers = useCallback(async () => {
    const response = await apiFetch("/api/v1/players/saved")
    const payload = (await response.json().catch(() => null)) as {
      players?: SavedSteamPlayer[]
      error?: string
    } | null
    if (!response.ok)
      throw new Error(payload?.error ?? "Could not load saved players")
    setSavedPlayers(payload?.players ?? [])
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadSavedPlayers().catch(() => undefined)
    }, 0)
    return () => window.clearTimeout(timer)
  }, [loadSavedPlayers])

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
          payload?: { player?: SavedSteamPlayer }
        }
        const player = payload.payload?.player
        if (payload.type === "player.saved.updated" && player) {
          setSavedPlayers((current) => upsertSavedPlayer(current, player))
        }
      }
      socket.onclose = () => {
        if (active) reconnectTimer.current = window.setTimeout(connect, 3000)
      }
    }
    connect()
    return () => {
      active = false
      if (reconnectTimer.current) window.clearTimeout(reconnectTimer.current)
      socket?.close()
    }
  }, [])

  async function savePlayer(player: SteamPlayer) {
    setSavingSteamID(player.steamId)
    setError("")
    try {
      const response = await apiFetch("/api/v1/players/saved", {
        method: "POST",
        body: JSON.stringify({ steamId: player.steamId }),
      })
      const payload = (await response.json().catch(() => null)) as {
        player?: SavedSteamPlayer
        error?: string
      } | null
      if (!response.ok || !payload?.player) {
        setError(payload?.error ?? "Could not save this player")
        return
      }
      setSavedPlayers((current) => upsertSavedPlayer(current, payload.player!))
    } catch {
      setError(
        "Could not reach the API. Check the local Docker stack and try again."
      )
    } finally {
      setSavingSteamID(null)
    }
  }

  async function removeSavedPlayer(steamID: string) {
    setSavingSteamID(steamID)
    setError("")
    try {
      const response = await apiFetch(
        `/api/v1/players/saved/${encodeURIComponent(steamID)}`,
        { method: "DELETE" }
      )
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: string
        } | null
        setError(payload?.error ?? "Could not remove this player")
        return
      }
      setSavedPlayers((current) =>
        current.filter((player) => player.steamId !== steamID)
      )
    } catch {
      setError(
        "Could not reach the API. Check the local Docker stack and try again."
      )
    } finally {
      setSavingSteamID(null)
    }
  }

  async function refreshSavedPlayer(steamID: string) {
    setSavingSteamID(steamID)
    setError("")
    try {
      const response = await apiFetch(
        `/api/v1/players/saved/${encodeURIComponent(steamID)}/refresh`,
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
      setSavedPlayers((current) => upsertSavedPlayer(current, payload.player!))
    } catch {
      setError(
        "Could not reach the API. Check the local Docker stack and try again."
      )
    } finally {
      setSavingSteamID(null)
    }
  }

  async function search(event?: React.FormEvent<HTMLFormElement>) {
    event?.preventDefault()
    const value = query.trim()
    if (!value) {
      setError("Enter a SteamID64, profile link, or public profile name.")
      setPlayers([])
      return
    }

    setLoading(true)
    setError("")
    try {
      const response = await apiFetch(
        `/api/v1/players?${new URLSearchParams({ query: value }).toString()}`
      )
      const payload = (await response.json().catch(() => null)) as {
        players?: SteamPlayer[]
        error?: string
      } | null
      if (!response.ok) {
        setPlayers([])
        setError(payload?.error ?? "Could not search Steam right now.")
        return
      }
      setPlayers(payload?.players ?? [])
    } catch {
      setPlayers([])
      setError(
        "Could not reach the API. Check the local Docker stack and try again."
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <PageHeader
        title="Players"
        description="Look up public Steam profiles without sharing an API key in the browser."
      />
      <Card className="rounded-2xl border-white/[0.08] bg-[#171313] shadow-none">
        <CardContent className="p-5 sm:p-6">
          <form
            className="flex flex-col gap-3 sm:flex-row"
            onSubmit={(event) => void search(event)}
          >
            <label className="sr-only" htmlFor="steam-player-search">
              Search a Steam player
            </label>
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-white/35" />
              <Input
                id="steam-player-search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="SteamID64, steamcommunity.com profile link, or name"
                className="h-10 rounded-xl border-white/[0.08] bg-white/[0.04] pl-9 text-white placeholder:text-white/30"
                maxLength={160}
              />
            </div>
            <Button
              type="submit"
              size="lg"
              disabled={loading}
              className="rounded-xl"
            >
              {loading ? (
                <RefreshCw className="size-4 animate-spin" />
              ) : (
                <Search className="size-4" />
              )}
              {loading ? "Searching…" : "Find player"}
            </Button>
          </form>
          <p className="mt-3 text-xs leading-5 text-white/38">
            Search works for public profiles. Steam credentials stay on the
            server and are never shown to players.
          </p>
        </CardContent>
      </Card>

      <section className="mt-7">
        <div className="mb-3 flex items-end justify-between gap-4 px-1">
          <div>
            <h2 className="text-base font-semibold tracking-[-0.02em] text-white/90">
              Saved players
            </h2>
            <p className="mt-1 text-xs text-white/38">
              Public Steam presence refreshes every 30 seconds and updates this
              list live.
            </p>
          </div>
          <span className="text-xs text-white/35 tabular-nums">
            {savedPlayers.length} / 100
          </span>
        </div>
        {savedPlayers.length ? (
          <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#171313]">
            {savedPlayers.map((player) => (
              <SavedPlayerRow
                key={player.steamId}
                player={player}
                busy={savingSteamID === player.steamId}
                onRefresh={() => void refreshSavedPlayer(player.steamId)}
                onRemove={() => void removeSavedPlayer(player.steamId)}
              />
            ))}
          </div>
        ) : (
          <div className="flex min-h-36 flex-col items-center justify-center rounded-2xl border border-dashed border-white/[0.12] px-6 text-center">
            <Bookmark className="size-4 text-white/35" />
            <p className="mt-3 text-sm font-medium text-white/75">
              No saved players
            </p>
            <p className="mt-1 max-w-md text-xs leading-5 text-white/38">
              Find a public Steam profile, then save it to keep the latest
              profile data here.
            </p>
          </div>
        )}
      </section>

      {error && (
        <div
          role="alert"
          className="mt-4 flex items-start gap-3 rounded-2xl border border-red-400/20 bg-red-400/[0.08] px-4 py-3 text-sm text-red-100"
        >
          <CircleAlert className="mt-0.5 size-4 shrink-0 text-red-300" />
          <div>
            <p>{error}</p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => void search()}
              className="mt-1 h-7 rounded-lg px-1 text-red-200 hover:bg-transparent hover:text-red-100"
            >
              Try again
            </Button>
          </div>
        </div>
      )}

      {loading && <LoadingState />}
      {!loading && !error && players.length === 0 && <EmptyState />}
      {!loading && players.length > 0 && (
        <div className="mt-5 space-y-3" aria-live="polite">
          {players.map((player) => (
            <PlayerResult
              key={player.steamId}
              player={player}
              saved={savedPlayers.some(
                (saved) => saved.steamId === player.steamId
              )}
              saving={savingSteamID === player.steamId}
              onSave={() => void savePlayer(player)}
            />
          ))}
        </div>
      )}
    </>
  )
}

function PlayerResult({
  player,
  saved,
  saving,
  onSave,
}: {
  player: SteamPlayer
  saved: boolean
  saving: boolean
  onSave: () => void
}) {
  const avatar = player.avatarUrl ? (
    <Image
      src={player.avatarUrl}
      alt=""
      width={72}
      height={72}
      className="size-[72px] shrink-0 rounded-2xl bg-white/[0.06] object-cover"
    />
  ) : (
    <div className="grid size-[72px] shrink-0 place-items-center rounded-2xl bg-white/[0.06] text-white/45">
      <Users className="size-6" />
    </div>
  )
  const game = player.currentGame || "Not currently in a public game"

  return (
    <article className="flex flex-col gap-5 rounded-2xl border border-white/[0.08] bg-[#171313] p-5 sm:flex-row sm:items-start sm:p-6">
      <div className="flex min-w-0 items-start gap-4">
        {avatar}
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate text-lg font-semibold tracking-[-0.03em] text-white">
              {player.displayName || "Steam player"}
            </h2>
            <PresenceBadge presence={player.presence} />
          </div>
          <p className="mt-1 truncate font-mono text-xs text-white/38">
            {player.steamId}
          </p>
          <p className="mt-3 text-sm text-white/55">{game}</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 sm:ml-auto sm:justify-end">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={saving}
          onClick={onSave}
          className="rounded-xl border-white/[0.12] bg-transparent text-white/75 hover:bg-white/[0.06] hover:text-white"
        >
          <Bookmark className="size-3.5" />
          {saving ? "Saving…" : saved ? "Update saved" : "Save player"}
        </Button>
        <Badge
          variant="outline"
          className="rounded-full border-white/[0.12] bg-white/[0.03] text-[11px] font-normal text-white/65 capitalize"
        >
          {player.visibility} profile
        </Badge>
        {player.profileUrl && (
          <a
            href={player.profileUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-8 items-center gap-1.5 rounded-xl px-3 text-xs font-medium text-white/65 transition-colors hover:bg-white/[0.06] hover:text-white"
          >
            Open Steam <ExternalLink className="size-3.5" />
          </a>
        )}
      </div>
    </article>
  )
}

function SavedPlayerRow({
  player,
  busy,
  onRefresh,
  onRemove,
}: {
  player: SavedSteamPlayer
  busy: boolean
  onRefresh: () => void
  onRemove: () => void
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-white/[0.07] px-4 py-4 last:border-0 sm:flex-row sm:items-center sm:px-5">
      <div className="flex min-w-0 items-center gap-3">
        <div className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-xl bg-white/[0.06] text-xs font-semibold text-white/60">
          {player.avatarUrl ? (
            <Image
              src={player.avatarUrl}
              alt=""
              width={36}
              height={36}
              className="size-9 object-cover"
            />
          ) : (
            player.displayName.slice(0, 2).toUpperCase()
          )}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-medium text-white/85">
              {player.displayName || "Steam player"}
            </p>
            <PresenceBadge presence={player.presence} />
          </div>
          <p className="mt-1 truncate font-mono text-xs text-white/38">
            {player.steamId}
          </p>
        </div>
      </div>
      <div className="flex min-w-0 flex-1 items-center gap-3 sm:ml-auto sm:justify-end">
        <p className="truncate text-xs text-white/45">
          {player.currentGame || "No public game reported"}
        </p>
        <Link
          href={`/players/${player.steamId}`}
          className="inline-flex h-8 items-center gap-1.5 rounded-xl px-2.5 text-xs text-white/60 hover:bg-white/[0.06] hover:text-white"
        >
          Details
          <ArrowUpRight className="size-3.5" />
        </Link>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={busy}
          onClick={onRefresh}
          className="rounded-xl text-white/55 hover:bg-white/[0.06] hover:text-white"
        >
          <RefreshCw className={`size-3.5 ${busy ? "animate-spin" : ""}`} />
          Refresh
        </Button>
        {player.profileUrl && (
          <a
            href={player.profileUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-8 items-center gap-1.5 rounded-xl px-2.5 text-xs text-white/55 hover:bg-white/[0.06] hover:text-white"
          >
            <ExternalLink className="size-3.5" />
            Steam
          </a>
        )}
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          disabled={busy}
          onClick={onRemove}
          aria-label={`Remove ${player.displayName || player.steamId}`}
          className="rounded-xl text-white/45 hover:bg-red-400/[0.08] hover:text-red-200"
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>
    </div>
  )
}

function upsertSavedPlayer(
  current: SavedSteamPlayer[],
  player: SavedSteamPlayer
) {
  return [player, ...current.filter((item) => item.steamId !== player.steamId)]
}

function PresenceBadge({ presence }: { presence: string }) {
  const online = presence === "online"
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-white/48 capitalize">
      <span
        className={`size-1.5 rounded-full ${online ? "bg-emerald-400" : "bg-white/25"}`}
      />
      {presence}
    </span>
  )
}

function EmptyState() {
  return (
    <div className="mt-5 flex min-h-56 flex-col items-center justify-center rounded-2xl border border-dashed border-white/[0.12] px-6 text-center">
      <div className="grid size-10 place-items-center rounded-xl bg-white/[0.06] text-white/55">
        <Gamepad2 className="size-4" />
      </div>
      <p className="mt-4 text-sm font-medium text-white/80">
        Find a Steam player
      </p>
      <p className="mt-1 max-w-sm text-xs leading-5 text-white/38">
        Paste a Steam profile link, SteamID64, or a public profile name to see
        the profile basics available from Steam.
      </p>
    </div>
  )
}

function LoadingState() {
  return (
    <div className="mt-5 flex min-h-56 flex-col items-center justify-center rounded-2xl border border-white/[0.08] bg-[#171313] text-center">
      <RefreshCw className="size-5 animate-spin text-white/45" />
      <p className="mt-3 text-sm text-white/55">
        Searching Steam profile data…
      </p>
    </div>
  )
}
