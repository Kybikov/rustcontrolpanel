"use client"

import { FormEvent, useEffect, useState } from "react"
import { Cable, Database, KeyRound, Plug, RefreshCw, Unplug } from "lucide-react"

import { apiFetch, type IntegrationStatus } from "@/lib/api"
import { ConnectionBadge, PageHeader } from "@/components/page-primitives"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

const definitions = [
  {
    provider: "battlemetrics" as const,
    name: "BattleMetrics",
    description: "Server search, status, online counts and wipe metadata.",
    credentialLabel: "API token",
    placeholder: "Paste BattleMetrics API token",
    icon: <Database className="size-4" />,
  },
  {
    provider: "steam" as const,
    name: "Steam Web API",
    description: "Player resolve, public profile, avatar and visibility.",
    credentialLabel: "Web API key",
    placeholder: "Paste Steam Web API key",
    icon: <KeyRound className="size-4" />,
  },
]

export function IntegrationsPage() {
  const [statuses, setStatuses] = useState<IntegrationStatus[]>([])
  const [credentials, setCredentials] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [busyProvider, setBusyProvider] = useState<string | null>(null)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")

  async function load() {
    setLoading(true)
    const response = await apiFetch("/api/v1/integrations")
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null
      setError(payload?.error ?? "Could not load integrations")
      setLoading(false)
      return
    }
    const payload = (await response.json()) as { integrations: IntegrationStatus[] }
    setStatuses(payload.integrations)
    setLoading(false)
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timer)
  }, [])

  function statusFor(provider: IntegrationStatus["provider"]) {
    return statuses.find((item) => item.provider === provider) ?? { provider, connected: false }
  }

  async function connect(event: FormEvent<HTMLFormElement>, provider: IntegrationStatus["provider"]) {
    event.preventDefault()
    const credential = credentials[provider]?.trim()
    if (!credential) {
      setError("Enter a provider credential first")
      return
    }
    setBusyProvider(provider)
    setError("")
    setNotice("")
    const response = await apiFetch(`/api/v1/integrations/${provider}`, {
      method: "POST",
      body: JSON.stringify({ credential }),
    })
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null
      setError(payload?.error ?? "Could not connect provider")
      setBusyProvider(null)
      return
    }
    setCredentials((current) => ({ ...current, [provider]: "" }))
    setNotice("Provider connected")
    await load()
    setBusyProvider(null)
  }

  async function test(provider: IntegrationStatus["provider"]) {
    setBusyProvider(provider)
    setError("")
    setNotice("")
    const response = await apiFetch(`/api/v1/integrations/${provider}/test`, { method: "POST" })
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null
      setError(payload?.error ?? "Connection test failed")
      await load()
      setBusyProvider(null)
      return
    }
    setNotice("Connection checked successfully")
    await load()
    setBusyProvider(null)
  }

  async function disconnect(provider: IntegrationStatus["provider"]) {
    setBusyProvider(provider)
    setError("")
    setNotice("")
    const response = await apiFetch(`/api/v1/integrations/${provider}`, { method: "DELETE" })
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null
      setError(payload?.error ?? "Could not disconnect provider")
      setBusyProvider(null)
      return
    }
    setNotice("Provider disconnected")
    await load()
    setBusyProvider(null)
  }

  return (
    <>
      <PageHeader title="Integrations" description="Connect providers once. Credentials stay encrypted in the Go API." />
      {error && <p role="alert" className="mb-4 rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-xs text-red-200">{error}</p>}
      {notice && <p className="mb-4 rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-xs text-emerald-200">{notice}</p>}
      <div className="grid gap-4 lg:grid-cols-2">
        {definitions.map((definition) => <IntegrationCard key={definition.provider} definition={definition} status={statusFor(definition.provider)} credential={credentials[definition.provider] ?? ""} loading={loading} busy={busyProvider === definition.provider} onCredentialChange={(value) => setCredentials((current) => ({ ...current, [definition.provider]: value }))} onConnect={(event) => void connect(event, definition.provider)} onTest={() => void test(definition.provider)} onDisconnect={() => void disconnect(definition.provider)} />)}
      </div>
      <Card className="mt-4 rounded-2xl border-dashed border-white/[0.12] bg-transparent shadow-none">
        <CardContent className="flex items-center gap-3 p-5 text-xs text-white/40"><Cable className="size-4 shrink-0" /><span>Only connection status and safe metadata leave the API. Raw tokens and keys are never returned to the browser.</span></CardContent>
      </Card>
    </>
  )
}

function IntegrationCard({ definition, status, credential, loading, busy, onCredentialChange, onConnect, onTest, onDisconnect }: { definition: (typeof definitions)[number]; status: IntegrationStatus; credential: string; loading: boolean; busy: boolean; onCredentialChange: (value: string) => void; onConnect: (event: FormEvent<HTMLFormElement>) => void; onTest: () => void; onDisconnect: () => void }) {
  return (
    <Card className="rounded-2xl border-white/[0.08] bg-[#171313] shadow-none">
      <CardHeader className="flex-row items-start justify-between space-y-0"><div className="flex items-start gap-3"><div className="grid size-8 place-items-center rounded-xl bg-white/[0.06] text-white/60">{definition.icon}</div><div><CardTitle className="text-[15px] text-white">{definition.name}</CardTitle><CardDescription className="mt-1 text-xs text-white/38">{definition.description}</CardDescription></div></div><IntegrationStatusBadge status={status} /></CardHeader>
      <CardContent>
        {loading ? <p className="text-xs text-white/35">Loading connection status…</p> : <form className="space-y-3" onSubmit={onConnect}>
          <label className="block space-y-1.5 text-xs text-white/55">{definition.credentialLabel}<Input type="password" autoComplete="new-password" value={credential} onChange={(event) => onCredentialChange(event.target.value)} placeholder={status.connected ? "Enter a new credential to reconnect" : definition.placeholder} /></label>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" size="sm" disabled={busy || !credential.trim()}><Plug className="size-3.5" />{busy ? "Connecting…" : status.connected ? "Reconnect" : "Connect"}</Button>
            {status.connected && <><Button type="button" variant="outline" size="sm" disabled={busy} onClick={onTest}><RefreshCw className="size-3.5" />Test</Button><Button type="button" variant="ghost" size="sm" disabled={busy} onClick={onDisconnect} className="text-red-300 hover:bg-red-400/[0.08] hover:text-red-200"><Unplug className="size-3.5" />Disconnect</Button></>}
          </div>
          {status.lastCheckedAt && <p className="text-[11px] text-white/30">Last checked {new Date(status.lastCheckedAt).toLocaleString()}</p>}
        </form>}
      </CardContent>
    </Card>
  )
}

function IntegrationStatusBadge({ status }: { status: IntegrationStatus }) {
  if (status.lastError) {
    return <Badge variant="outline" className="rounded-full border-red-400/20 bg-red-400/[0.06] text-[11px] font-normal text-red-300"><span className="size-1.5 rounded-full bg-red-400" />Error</Badge>
  }
  if (status.connected) return <ConnectionBadge connected />
  return <ConnectionBadge />
}
