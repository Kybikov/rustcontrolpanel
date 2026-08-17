"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"
import {
  Activity,
  Bell,
  ChevronRight,
  CircleHelp,
  Command,
  Database,
  Gamepad2,
  LayoutDashboard,
  Map,
  Menu,
  PanelLeft,
  Radio,
  Search,
  Server,
  Settings2,
  ShieldAlert,
  Sun,
  Users,
} from "lucide-react"
import { useTheme } from "next-themes"

import { RealtimeIndicator } from "@/components/realtime-indicator"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"

const navGroups = [
  {
    label: "Control room",
    items: [
      { label: "Overview", href: "/", icon: LayoutDashboard },
      { label: "Servers", href: "/servers", icon: Server },
      { label: "Players", href: "/players", icon: Users },
      { label: "Live map", href: "/map", icon: Map },
    ],
  },
  {
    label: "Investigation",
    items: [
      { label: "Activity feed", href: "/activity", icon: Activity },
      { label: "Alerts", href: "/alerts", icon: ShieldAlert, count: 8 },
      { label: "Wipe calendar", href: "/wipes", icon: Radio },
    ],
  },
  {
    label: "System",
    items: [
      { label: "Integrations", href: "/integrations", icon: Database },
      { label: "Settings", href: "/settings", icon: Settings2 },
    ],
  },
] as const

const servers = [
  { name: "EU Facepunch 2", region: "Frankfurt · Vanilla", online: "218 / 250", trend: "+12", state: "online" },
  { name: "Rustoria Main", region: "London · 2x Modded", online: "164 / 200", trend: "+4", state: "online" },
  { name: "Atlas PvP Monthly", region: "Warsaw · Community", online: "87 / 150", trend: "-8", state: "degraded" },
  { name: "Northstar Sandbox", region: "Helsinki · Test shard", online: "0 / 100", trend: "—", state: "offline" },
]

const activity = [
  { title: "Wipe detected", detail: "EU Facepunch 2 · Map wipe", time: "2m ago", tone: "warning" },
  { title: "Player joined", detail: "Kobalt entered Rustoria Main", time: "5m ago", tone: "success" },
  { title: "Server recovered", detail: "Atlas PvP Monthly · 182ms latency", time: "12m ago", tone: "info" },
  { title: "Integration warning", detail: "BattleMetrics sync is 9m stale", time: "18m ago", tone: "danger" },
]

const chartBars = [42, 58, 48, 76, 65, 88, 69, 92, 78, 95, 72, 84]

export function DashboardShell() {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const { resolvedTheme, setTheme } = useTheme()

  return (
    <div className="min-h-svh bg-background text-foreground">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-20 hidden border-r border-sidebar-border bg-sidebar transition-[width] duration-200 lg:flex lg:flex-col",
          collapsed ? "w-[76px]" : "w-[252px]"
        )}
      >
        <div className="flex h-16 items-center gap-3 border-b border-sidebar-border px-5">
          <div className="grid size-8 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
            <Gamepad2 className="size-4" />
          </div>
          {!collapsed && (
            <div className="min-w-0 leading-tight">
              <p className="truncate text-sm font-semibold tracking-tight">Rust Control</p>
              <p className="truncate text-[11px] text-muted-foreground">Operations console</p>
            </div>
          )}
        </div>

        <nav className="flex-1 space-y-6 overflow-y-auto p-3">
          {navGroups.map((group) => (
            <div key={group.label}>
              {!collapsed && (
                <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/70">
                  {group.label}
                </p>
              )}
              <div className="space-y-1">
                {group.items.map((item) => {
                  const Icon = item.icon
                  const active = pathname === item.href
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      title={collapsed ? item.label : undefined}
                      className={cn(
                        "flex h-9 items-center gap-3 rounded-xl px-3 text-sm text-sidebar-foreground/75 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                        active && "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm",
                        collapsed && "justify-center px-0"
                      )}
                    >
                      <Icon className="size-4 shrink-0" />
                      {!collapsed && <span className="min-w-0 flex-1 truncate">{item.label}</span>}
                      {!collapsed && "count" in item && (
                        <span className="rounded-full bg-destructive/15 px-1.5 py-0.5 text-[10px] text-destructive">
                          {item.count}
                        </span>
                      )}
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t border-sidebar-border p-3">
          <div className={cn("rounded-2xl bg-sidebar-accent/60 p-3", collapsed && "grid place-items-center p-2")}>
            <div className="flex items-center gap-2">
              <div className="relative grid size-8 place-items-center rounded-full bg-emerald-500/15 text-emerald-400">
                <span className="absolute right-0 top-0 size-2 rounded-full border-2 border-sidebar bg-emerald-400" />
                <span className="text-xs font-semibold">AK</span>
              </div>
              {!collapsed && (
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium">Admin Kybikov</p>
                  <p className="truncate text-[11px] text-muted-foreground">Operator · Level 4</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </aside>

      <main className={cn("min-h-svh transition-[padding] duration-200", collapsed ? "lg:pl-[76px]" : "lg:pl-[252px]")}>
        <header className="sticky top-0 z-10 flex h-16 items-center gap-3 border-b border-border/70 bg-background/85 px-4 backdrop-blur-xl sm:px-6">
          <Button variant="ghost" size="icon" className="hidden lg:inline-flex" onClick={() => setCollapsed((value) => !value)} aria-label="Toggle sidebar">
            <PanelLeft className="size-4" />
          </Button>
          <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open menu">
            <Menu className="size-4" />
          </Button>
          <Separator orientation="vertical" className="hidden h-5 lg:block" />
          <div className="relative min-w-0 max-w-md flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="h-9 border-border/60 bg-muted/30 pl-9 pr-20 text-sm" placeholder="Search players, servers, events..." />
            <kbd className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded-md border border-border/70 bg-background px-1.5 py-0.5 text-[10px] text-muted-foreground">⌘ K</kbd>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <RealtimeIndicator />
            <Button variant="ghost" size="icon" className="hidden sm:inline-flex" aria-label="Notifications"><Bell className="size-4" /></Button>
            <Button variant="ghost" size="icon" aria-label="Toggle theme" onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}>
              <Sun className="size-4" />
            </Button>
            <div className="hidden size-8 place-items-center rounded-full bg-muted text-xs font-semibold sm:grid">AK</div>
          </div>
        </header>

        <div className="mx-auto max-w-[1700px] space-y-6 p-4 sm:p-6 xl:p-8">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground"><span>Control room</span><ChevronRight className="size-3" /><span className="text-foreground">Overview</span></div>
              <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Good evening, Admin</h1>
              <p className="mt-1 text-sm text-muted-foreground">The fleet is stable. Here&apos;s what needs your attention.</p>
            </div>
            <div className="flex items-center gap-2"><Button variant="outline" size="sm" className="gap-2"><CircleHelp className="size-3.5" />Runbook</Button><Button size="sm" className="gap-2"><Command className="size-3.5" />Quick action</Button></div>
          </div>

          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Tracked servers" value="24" change="+3 this week" icon={<Server className="size-4" />} tone="blue" />
            <MetricCard label="Players online" value="1,248" change="+8.4% vs. yesterday" icon={<Users className="size-4" />} tone="green" />
            <MetricCard label="Open alerts" value="08" change="2 high priority" icon={<ShieldAlert className="size-4" />} tone="red" />
            <MetricCard label="Next wipe window" value="03:42:18" change="EU Facepunch 2" icon={<Radio className="size-4" />} tone="amber" />
          </section>

          <section className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(320px,0.7fr)]">
            <Card className="min-w-0"><CardHeader className="flex-row items-start justify-between space-y-0"><div><CardTitle>Fleet activity</CardTitle><CardDescription>Concurrent players across tracked servers</CardDescription></div><Button variant="outline" size="sm">Last 24h</Button></CardHeader><CardContent><div className="mb-6 flex items-end gap-3"><span className="text-3xl font-semibold tracking-tight">1,248</span><Badge variant="outline" className="mb-1 border-emerald-500/25 bg-emerald-500/10 text-emerald-400">+8.4%</Badge></div><div className="flex h-44 items-end gap-1.5 border-b border-border/70 px-1 pb-0 sm:gap-3">{chartBars.map((height, index) => <div key={index} className="group relative flex h-full flex-1 items-end"><div className="absolute inset-x-0 bottom-0 hidden h-px bg-border/40 group-hover:block" /><div className="w-full rounded-t-md bg-gradient-to-t from-primary/25 to-primary transition-[height] group-hover:from-primary/50" style={{ height: `${height}%` }} /></div>)}</div><div className="mt-3 flex justify-between text-[11px] text-muted-foreground"><span>00:00</span><span>04:00</span><span>08:00</span><span>12:00</span><span>16:00</span><span>Now</span></div></CardContent></Card>
            <Card><CardHeader><div className="flex items-center justify-between"><div><CardTitle>System health</CardTitle><CardDescription>Last checked just now</CardDescription></div><div className="grid size-9 place-items-center rounded-xl bg-emerald-500/10 text-emerald-400"><Activity className="size-4" /></div></div></CardHeader><CardContent className="space-y-5"><HealthRow label="API gateway" value="42ms" state="Operational" /><HealthRow label="PostgreSQL" value="18ms" state="Operational" /><HealthRow label="Redis stream" value="6ms" state="Operational" /><HealthRow label="BattleMetrics" value="9m stale" state="Degraded" degraded /><Separator /><div className="flex items-center justify-between text-xs text-muted-foreground"><span>Uptime (30 days)</span><span className="font-medium text-foreground">99.98%</span></div></CardContent></Card>
          </section>

          <section className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.8fr)]">
            <Card className="min-w-0"><CardHeader className="flex-row items-start justify-between space-y-0"><div><CardTitle>Tracked servers</CardTitle><CardDescription>Live operational status of your fleet</CardDescription></div><Button variant="ghost" size="sm" className="text-muted-foreground">View all</Button></CardHeader><CardContent className="px-0"><div className="overflow-x-auto"><table className="w-full min-w-[560px] text-sm"><thead className="border-y border-border/60 bg-muted/20 text-left text-[11px] uppercase tracking-wide text-muted-foreground"><tr><th className="px-6 py-3 font-medium">Server</th><th className="px-3 py-3 font-medium">Players</th><th className="px-3 py-3 font-medium">24h trend</th><th className="px-6 py-3 text-right font-medium">Status</th></tr></thead><tbody>{servers.map((server) => <tr key={server.name} className="border-b border-border/50 last:border-0"><td className="px-6 py-4"><div className="flex items-center gap-3"><span className={cn("size-2 rounded-full", server.state === "online" ? "bg-emerald-400" : server.state === "degraded" ? "bg-amber-400" : "bg-muted-foreground/50")} /><div><p className="font-medium">{server.name}</p><p className="text-xs text-muted-foreground">{server.region}</p></div></div></td><td className="px-3 py-4 font-mono text-xs">{server.online}</td><td className={cn("px-3 py-4 font-mono text-xs", server.trend.startsWith("+") ? "text-emerald-400" : server.trend.startsWith("-") ? "text-rose-400" : "text-muted-foreground")}>{server.trend}</td><td className="px-6 py-4 text-right"><StatusBadge state={server.state} /></td></tr>)}</tbody></table></div></CardContent></Card>
            <Card><CardHeader className="flex-row items-start justify-between space-y-0"><div><CardTitle>Recent activity</CardTitle><CardDescription>Unified event stream</CardDescription></div><Button variant="ghost" size="icon-sm" aria-label="Activity menu"><Menu className="size-4" /></Button></CardHeader><CardContent><div className="space-y-5">{activity.map((item) => <div key={item.title} className="flex gap-3"><span className={cn("mt-1.5 size-2 shrink-0 rounded-full", item.tone === "success" ? "bg-emerald-400" : item.tone === "warning" ? "bg-amber-400" : item.tone === "danger" ? "bg-rose-400" : "bg-sky-400")} /><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><p className="text-sm font-medium">{item.title}</p><span className="shrink-0 text-[11px] text-muted-foreground">{item.time}</span></div><p className="mt-0.5 truncate text-xs text-muted-foreground">{item.detail}</p></div></div>)}</div><Button variant="outline" className="mt-6 w-full" size="sm">Open activity feed</Button></CardContent></Card>
          </section>

          <footer className="flex flex-col justify-between gap-2 border-t border-border/60 pt-5 text-xs text-muted-foreground sm:flex-row"><span>Rust Control · Foundation build</span><span className="flex items-center gap-1.5"><span className="size-1.5 rounded-full bg-emerald-400" />API contract ready · v0.1.0</span></footer>
        </div>
      </main>
    </div>
  )
}

function MetricCard({ label, value, change, icon, tone }: { label: string; value: string; change: string; icon: React.ReactNode; tone: "blue" | "green" | "red" | "amber" }) {
  const tones = { blue: "bg-sky-500/10 text-sky-400", green: "bg-emerald-500/10 text-emerald-400", red: "bg-rose-500/10 text-rose-400", amber: "bg-amber-500/10 text-amber-400" }
  return <Card size="sm"><CardContent className="space-y-4"><div className="flex items-start justify-between"><div className={cn("grid size-9 place-items-center rounded-xl", tones[tone])}>{icon}</div><span className="text-[11px] text-muted-foreground">vs last week</span></div><div><p className="text-2xl font-semibold tracking-tight">{value}</p><p className="mt-1 text-sm text-muted-foreground">{label}</p></div><p className="text-xs text-muted-foreground"><span className={cn(tone === "red" ? "text-rose-400" : "text-emerald-400")}>{change}</span></p></CardContent></Card>
}

function HealthRow({ label, value, state, degraded = false }: { label: string; value: string; state: string; degraded?: boolean }) {
  return <div className="flex items-center gap-3"><span className={cn("size-2 rounded-full", degraded ? "bg-amber-400" : "bg-emerald-400")} /><span className="flex-1 text-sm">{label}</span><span className="font-mono text-[11px] text-muted-foreground">{value}</span><span className={cn("text-[11px]", degraded ? "text-amber-400" : "text-emerald-400")}>{state}</span></div>
}

function StatusBadge({ state }: { state: string }) {
  const label = state === "online" ? "Operational" : state === "degraded" ? "Degraded" : "Offline"
  return <Badge variant="outline" className={cn("rounded-full text-[11px]", state === "online" ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-400" : state === "degraded" ? "border-amber-500/25 bg-amber-500/10 text-amber-400" : "text-muted-foreground")}>{label}</Badge>
}
