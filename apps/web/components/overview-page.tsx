import Link from "next/link"
import { ArrowRight, Server, Users } from "lucide-react"

import { PageHeader } from "@/components/page-primitives"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export function OverviewPage() {
  return (
    <>
      <PageHeader
        title="Overview"
        description="A personal Rust companion built around the players and servers you follow."
      />

      <div>
        <Card className="rounded-2xl border-white/[0.08] bg-[#171313] shadow-none">
          <CardHeader className="border-b border-white/[0.07]">
            <CardTitle className="text-[15px] text-white">
              Start with a player
            </CardTitle>
            <CardDescription className="text-xs text-white/40">
              Find a public Steam profile by name, profile URL or SteamID64.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-5">
            <Link
              href="/players"
              className="inline-flex h-9 items-center gap-2 rounded-xl bg-[#d7192d] px-3 text-xs font-medium text-white transition-colors hover:bg-[#ed263c]"
            >
              Find player <ArrowRight className="size-3.5" />
            </Link>
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <EmptyModule
          icon={<Server className="size-4" />}
          title="Servers"
          description="Browse public Rust server data when it is available from the provider."
          href="/servers"
          action="Open servers"
        />
        <EmptyModule
          icon={<Users className="size-4" />}
          title="Players"
          description="Look up the Steam profile basics that a player has chosen to make public."
          href="/players"
          action="Open players"
        />
      </div>
    </>
  )
}

function EmptyModule({
  icon,
  title,
  description,
  href,
  action,
}: {
  icon: React.ReactNode
  title: string
  description: string
  href: string
  action: string
}) {
  return (
    <Card className="rounded-2xl border-white/[0.08] bg-[#171313] shadow-none">
      <CardContent className="flex min-h-[180px] flex-col justify-between p-5">
        <div>
          <div className="mb-4 grid size-8 place-items-center rounded-xl bg-white/[0.06] text-white/60">
            {icon}
          </div>
          <p className="text-[15px] font-medium text-white/85">{title}</p>
          <p className="mt-1 max-w-md text-xs leading-5 text-white/38">
            {description}
          </p>
        </div>
        <Link
          href={href}
          className="mt-5 inline-flex w-fit items-center gap-1.5 text-xs text-white/55 hover:text-white"
        >
          {action}
          <ArrowRight className="size-3" />
        </Link>
      </CardContent>
    </Card>
  )
}
