import { Search, Server } from "lucide-react"

import { PageHeader } from "@/components/page-primitives"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

export function ServersPage() {
  return (
    <>
      <PageHeader title="Servers" description="Search and inspect Rust servers from BattleMetrics." action={<Button size="sm" disabled>Connect BattleMetrics</Button>} />
      <Card className="rounded-2xl border-white/[0.08] bg-[#171313] shadow-none">
        <CardContent className="p-5">
          <div className="relative max-w-xl"><Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-white/35" /><Input className="h-9 border-white/[0.1] bg-white/[0.03] pl-8 text-xs placeholder:text-white/30" placeholder="Search by server name, address or BattleMetrics ID" disabled /></div>
          <div className="flex min-h-[280px] flex-col items-center justify-center text-center"><div className="mb-3 grid size-10 place-items-center rounded-2xl bg-white/[0.05] text-white/45"><Server className="size-4" /></div><p className="text-sm font-medium text-white/75">Server search is ready for the first integration</p><p className="mt-1 max-w-sm text-xs leading-5 text-white/35">Connect BattleMetrics next. We will then add the real search request and a compact server detail view.</p></div>
        </CardContent>
      </Card>
    </>
  )
}
