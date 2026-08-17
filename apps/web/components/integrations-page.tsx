import { Cable, Database, KeyRound } from "lucide-react"

import { ConnectionBadge, PageHeader } from "@/components/page-primitives"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export function IntegrationsPage() {
  return (
    <>
      <PageHeader title="Integrations" description="Keep provider credentials on the backend. Nothing is connected yet." />
      <div className="grid gap-4 lg:grid-cols-2">
        <IntegrationCard name="BattleMetrics" description="Server search, status, online counts and wipe metadata." icon={<Database className="size-4" />} />
        <IntegrationCard name="Steam Web API" description="Player resolve, public profile, avatar and visibility." icon={<KeyRound className="size-4" />} />
      </div>
      <Card className="mt-4 rounded-2xl border-dashed border-white/[0.12] bg-transparent shadow-none">
        <CardContent className="flex items-center gap-3 p-5 text-xs text-white/40"><Cable className="size-4 shrink-0" /><span>Credentials will be stored by the Go API. The frontend will only receive connection status and safe provider metadata.</span></CardContent>
      </Card>
    </>
  )
}

function IntegrationCard({ name, description, icon }: { name: string; description: string; icon: React.ReactNode }) {
  return (
    <Card className="rounded-2xl border-white/[0.08] bg-[#171313] shadow-none"><CardHeader className="flex-row items-start justify-between space-y-0"><div className="flex items-start gap-3"><div className="grid size-8 place-items-center rounded-xl bg-white/[0.06] text-white/60">{icon}</div><div><CardTitle className="text-[15px] text-white">{name}</CardTitle><CardDescription className="mt-1 text-xs text-white/38">{description}</CardDescription></div></div><ConnectionBadge /></CardHeader><CardContent><p className="text-xs text-white/35">Connection settings will appear here when this integration is implemented.</p></CardContent></Card>
  )
}
