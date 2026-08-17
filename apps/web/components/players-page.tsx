import Link from "next/link"
import { ArrowRight, Users } from "lucide-react"

import { PageHeader } from "@/components/page-primitives"
import { Card, CardContent } from "@/components/ui/card"

export function PlayersPage() {
  return (
    <>
      <PageHeader title="Players" description="Resolve Steam players and inspect their public profile basics." />
      <Card className="rounded-2xl border-white/[0.08] bg-[#171313] shadow-none">
        <CardContent className="flex min-h-[300px] flex-col items-center justify-center p-6 text-center">
          <div className="mb-4 grid size-10 place-items-center rounded-2xl bg-white/[0.06] text-white/60"><Users className="size-4" /></div>
          <p className="text-sm font-medium text-white/85">Steam Web API is not connected</p>
          <p className="mt-2 max-w-sm text-xs leading-5 text-white/40">Connect the data source first. Player lookup and public profile details will be added here after that.</p>
          <Link href="/integrations" className="mt-5 inline-flex items-center gap-1.5 text-xs text-white/65 hover:text-white">Open integrations <ArrowRight className="size-3" /></Link>
        </CardContent>
      </Card>
    </>
  )
}
