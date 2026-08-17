import Link from "next/link"
import { ArrowRight, Search, Server, Users } from "lucide-react"

import { ConnectionBadge, PageHeader } from "@/components/page-primitives"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export function OverviewPage() {
  return (
    <>
      <PageHeader title="Overview" description="Start with your data sources. Live data will appear here after connection." />

      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <Card className="rounded-2xl border-white/[0.08] bg-[#171313] shadow-none">
          <CardHeader className="border-b border-white/[0.07]">
            <CardTitle className="text-[15px] text-white">Connect your sources</CardTitle>
            <CardDescription className="text-xs text-white/40">BattleMetrics and Steam are the first integrations.</CardDescription>
          </CardHeader>
          <CardContent className="divide-y divide-white/[0.07] p-0">
            <SourceRow name="BattleMetrics" description="Search Rust servers and read server details." href="/integrations" />
            <SourceRow name="Steam Web API" description="Resolve players and read public profile data." href="/integrations" />
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-white/[0.08] bg-[#171313] shadow-none">
          <CardHeader>
            <CardTitle className="text-[15px] text-white">First workspace step</CardTitle>
            <CardDescription className="text-xs text-white/40">Connect one source, then we build the next screen around real data.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/integrations" className="inline-flex h-9 items-center gap-2 rounded-xl bg-[#d7192d] px-3 text-xs font-medium text-white transition-colors hover:bg-[#ed263c]">
              Open integrations <ArrowRight className="size-3.5" />
            </Link>
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <EmptyModule icon={<Server className="size-4" />} title="Servers" description="No server data yet. Connect BattleMetrics to search and inspect Rust servers." href="/servers" action="Open servers" />
        <EmptyModule icon={<Users className="size-4" />} title="Players" description="No player data yet. Connect Steam Web API to resolve and inspect players." href="/players" action="Open players" />
      </div>
    </>
  )
}

function SourceRow({ name, description, href }: { name: string; description: string; href: string }) {
  return (
    <div className="flex items-center gap-3 px-5 py-4">
      <div className="grid size-8 shrink-0 place-items-center rounded-xl bg-white/[0.06] text-white/60"><Search className="size-3.5" /></div>
      <div className="min-w-0 flex-1"><p className="text-sm font-medium text-white/85">{name}</p><p className="truncate text-xs text-white/38">{description}</p></div>
      <ConnectionBadge />
      <Link href={href} className="hidden text-xs text-white/50 hover:text-white sm:block">Configure</Link>
    </div>
  )
}

function EmptyModule({ icon, title, description, href, action }: { icon: React.ReactNode; title: string; description: string; href: string; action: string }) {
  return (
    <Card className="rounded-2xl border-white/[0.08] bg-[#171313] shadow-none">
      <CardContent className="flex min-h-[180px] flex-col justify-between p-5">
        <div><div className="mb-4 grid size-8 place-items-center rounded-xl bg-white/[0.06] text-white/60">{icon}</div><p className="text-[15px] font-medium text-white/85">{title}</p><p className="mt-1 max-w-md text-xs leading-5 text-white/38">{description}</p></div>
        <Link href={href} className="mt-5 inline-flex w-fit items-center gap-1.5 text-xs text-white/55 hover:text-white">{action}<ArrowRight className="size-3" /></Link>
      </CardContent>
    </Card>
  )
}
