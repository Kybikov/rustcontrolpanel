"use client"

import Link from "next/link"
import { useState } from "react"
import {
  ArrowUpRight,
  CircleAlert,
  RefreshCw,
  Search,
  Server,
  UsersRound,
} from "lucide-react"

import { PageHeader } from "@/components/page-primitives"
import { apiFetch, type RustServer, type ServerSearchResult } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

const pageSize = 12

export function ServersPage() {
  const [query, setQuery] = useState("")
  const [result, setResult] = useState<ServerSearchResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState("")

  async function search(page = 1, append = false) {
    if (append) setLoadingMore(true)
    else setLoading(true)
    setError("")

    try {
      const params = new URLSearchParams({
        page: String(page),
        perPage: String(pageSize),
      })
      const normalizedQuery = query.trim()
      if (normalizedQuery) params.set("query", normalizedQuery)

      const response = await apiFetch(`/api/v1/servers?${params.toString()}`)
      const payload = (await response.json().catch(() => null)) as
        ServerSearchResult | { error?: string } | null
      if (!response.ok) {
        setError(errorFromPayload(payload) ?? "Could not load servers")
        return
      }

      const nextResult = payload as ServerSearchResult
      setResult((current) =>
        append && current
          ? {
              ...nextResult,
              servers: [...current.servers, ...nextResult.servers],
            }
          : nextResult
      )
    } catch {
      setError(
        "Could not reach the API. Check that the local Docker stack is running and try again."
      )
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void search()
  }

  return (
    <>
      <PageHeader
        title="Servers"
        description="Live Rust server search and basic server data from BattleMetrics."
      />
      <Card className="rounded-2xl border-white/[0.08] bg-[#171313] shadow-none">
        <CardContent className="p-5 sm:p-6">
          <form className="flex flex-col gap-3 sm:flex-row" onSubmit={submit}>
            <label className="sr-only" htmlFor="server-search">
              Search Rust servers
            </label>
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-white/35" />
              <Input
                id="server-search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by server name, for example Rustoria"
                className="h-10 rounded-xl border-white/[0.08] bg-white/[0.04] pl-9 text-white placeholder:text-white/30"
              />
            </div>
            <Button
              type="submit"
              size="lg"
              disabled={loading || loadingMore}
              className="rounded-xl"
            >
              {loading ? (
                <RefreshCw className="size-4 animate-spin" />
              ) : (
                <Search className="size-4" />
              )}
              {loading ? "Searching…" : "Search servers"}
            </Button>
          </form>
          <p className="mt-3 text-xs leading-5 text-white/38">
            Leave the search blank to browse the currently most-populated Rust
            servers.
          </p>
        </CardContent>
      </Card>

      {error && (
        <div
          role="alert"
          className="mt-4 flex items-start gap-3 rounded-2xl border border-red-400/20 bg-red-400/[0.08] px-4 py-3 text-sm text-red-100"
        >
          <CircleAlert className="mt-0.5 size-4 shrink-0 text-red-300" />
          <div className="min-w-0 flex-1">
            <p>{error}</p>
            <p className="mt-1 text-xs text-red-200/75">
              The provider is managed by the server. Try again shortly.
            </p>
          </div>
        </div>
      )}

      {!result && !loading && !error && <EmptySearchState />}

      {loading && !result && <LoadingState />}

      {result && (
        <section aria-live="polite" className="mt-5">
          <div className="mb-3 flex items-center justify-between gap-4 px-1">
            <p className="text-sm text-white/65">
              {result.servers.length
                ? `${result.servers.length} server${result.servers.length === 1 ? "" : "s"} loaded`
                : "No servers found"}
            </p>
            {result.servers.length > 0 && (
              <p className="text-xs text-white/35">Sorted by players online</p>
            )}
          </div>
          {result.servers.length > 0 ? (
            <ServerResults servers={result.servers} />
          ) : (
            <EmptyResultState onRetry={() => void search()} />
          )}
          {result.hasMore && result.servers.length > 0 && (
            <div className="mt-4 flex justify-center">
              <Button
                type="button"
                variant="outline"
                disabled={loadingMore}
                onClick={() => void search(result.page + 1, true)}
                className="rounded-xl border-white/[0.12] bg-transparent text-white hover:bg-white/[0.06]"
              >
                {loadingMore && <RefreshCw className="size-4 animate-spin" />}
                {loadingMore ? "Loading…" : "Load more"}
              </Button>
            </div>
          )}
        </section>
      )}
    </>
  )
}

function ServerResults({ servers }: { servers: RustServer[] }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#171313]">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 border-b border-white/[0.08] px-4 py-3 text-[11px] font-medium tracking-[0.12em] text-white/35 uppercase sm:grid-cols-[minmax(0,1fr)_110px_130px_24px] sm:px-5">
        <span>Server</span>
        <span className="hidden sm:block">Map</span>
        <span className="hidden sm:block">Players</span>
        <span aria-hidden="true" />
      </div>
      <div className="divide-y divide-white/[0.07]">
        {servers.map((server) => (
          <ServerRow key={server.id} server={server} />
        ))}
      </div>
    </div>
  )
}

function ServerRow({ server }: { server: RustServer }) {
  const online = server.status.toLowerCase() === "online"
  const playerCount = `${server.players.toLocaleString()} / ${server.maxPlayers.toLocaleString()}`

  return (
    <Link
      href={`/servers/${encodeURIComponent(server.id)}`}
      className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-4 transition-colors outline-none hover:bg-white/[0.035] focus-visible:bg-white/[0.06] sm:grid-cols-[minmax(0,1fr)_110px_130px_24px] sm:px-5"
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span
            className={`size-1.5 shrink-0 rounded-full ${online ? "bg-emerald-400" : "bg-white/25"}`}
          />
          <p className="truncate text-sm font-medium text-white/90">
            {server.name || "Unnamed Rust server"}
          </p>
        </div>
        <p className="mt-1 truncate pl-3.5 text-xs text-white/38">
          {server.address || `${server.ip}:${server.port}`}
        </p>
      </div>
      <p className="hidden truncate text-xs text-white/55 sm:block">
        {server.map || "—"}
      </p>
      <div className="hidden items-center gap-2 text-xs text-white/65 sm:flex">
        <UsersRound className="size-3.5 text-white/35" />
        <span>{playerCount}</span>
      </div>
      <ArrowUpRight className="size-4 text-white/35" />
    </Link>
  )
}

function EmptySearchState() {
  return (
    <div className="mt-5 flex min-h-56 flex-col items-center justify-center rounded-2xl border border-dashed border-white/[0.12] px-6 text-center">
      <div className="grid size-10 place-items-center rounded-xl bg-white/[0.06] text-white/55">
        <Server className="size-4" />
      </div>
      <p className="mt-4 text-sm font-medium text-white/80">
        Search live Rust servers
      </p>
      <p className="mt-1 max-w-sm text-xs leading-5 text-white/38">
        Use a name to narrow the result, or search without a phrase to see the
        servers with the most players online.
      </p>
    </div>
  )
}

function LoadingState() {
  return (
    <div className="mt-5 flex min-h-56 flex-col items-center justify-center rounded-2xl border border-white/[0.08] bg-[#171313] text-center">
      <RefreshCw className="size-5 animate-spin text-white/45" />
      <p className="mt-3 text-sm text-white/55">Loading live server data…</p>
    </div>
  )
}

function EmptyResultState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex min-h-56 flex-col items-center justify-center rounded-2xl border border-white/[0.08] bg-[#171313] px-6 text-center">
      <Server className="size-5 text-white/40" />
      <p className="mt-3 text-sm font-medium text-white/75">
        No matching servers
      </p>
      <p className="mt-1 text-xs text-white/38">
        Try a shorter search phrase or browse all currently populated servers.
      </p>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onRetry}
        className="mt-3 rounded-xl text-white/65 hover:bg-white/[0.06] hover:text-white"
      >
        Try again
      </Button>
    </div>
  )
}

function errorFromPayload(
  payload: ServerSearchResult | { error?: string } | null
) {
  if (payload && "error" in payload && typeof payload.error === "string")
    return payload.error
  return null
}
