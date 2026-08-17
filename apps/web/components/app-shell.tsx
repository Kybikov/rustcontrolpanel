"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState, type ReactNode } from "react"
import {
  Activity,
  Bell,
  Database,
  Gamepad2,
  LayoutDashboard,
  PanelLeft,
  Search,
  Server,
  Sun,
  Users,
} from "lucide-react"
import { useTheme } from "next-themes"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

const navGroups = [
  {
    label: "Workspace",
    items: [
      { label: "Overview", href: "/", icon: LayoutDashboard },
      { label: "Servers", href: "/servers", icon: Server },
      { label: "Players", href: "/players", icon: Users },
    ],
  },
  {
    label: "System",
    items: [{ label: "Integrations", href: "/integrations", icon: Database }],
  },
] as const

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const { resolvedTheme, setTheme } = useTheme()

  return (
    <div className="min-h-svh bg-[#0d0b0b] p-2 text-[#f4f0ee] md:flex md:gap-5">
      <aside
        className={cn(
          "sticky top-2 hidden h-[calc(100vh-1rem)] shrink-0 flex-col rounded-2xl border border-white/[0.08] bg-[#120f0f] shadow-[0_18px_50px_rgba(0,0,0,0.28)] transition-[width] duration-200 md:flex",
          collapsed ? "w-[68px]" : "w-[238px]"
        )}
      >
        <div className="flex h-[60px] items-center gap-3 border-b border-white/[0.08] px-4">
          <div className="grid size-8 shrink-0 place-items-center rounded-full bg-[#d7192d] text-white">
            <Gamepad2 className="size-[17px]" />
          </div>
          {!collapsed && (
            <div className="min-w-0 leading-tight">
              <p className="truncate text-[15px] font-semibold tracking-[-0.02em]">RustControl</p>
              <p className="truncate text-[11px] text-white/45">Admin console</p>
            </div>
          )}
        </div>

        <nav className="flex-1 space-y-6 overflow-y-auto px-2 py-5">
          {navGroups.map((group) => (
            <div key={group.label}>
              {!collapsed && (
                <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/35">{group.label}</p>
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
                        "flex h-9 items-center gap-3 rounded-xl px-3 text-[13px] text-white/60 transition-colors hover:bg-white/[0.05] hover:text-white",
                        active && "bg-[#3b0e14] text-white ring-1 ring-[#7c1d29]/70",
                        collapsed && "justify-center px-0"
                      )}
                    >
                      <Icon className="size-[15px] shrink-0" />
                      {!collapsed && <span className="truncate">{item.label}</span>}
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t border-white/[0.08] p-3">
          <div className={cn("flex items-center gap-2 rounded-xl bg-white/[0.035] p-2.5", collapsed && "justify-center")}>
            <div className="grid size-7 shrink-0 place-items-center rounded-full bg-white/[0.08] text-[10px] font-semibold text-white/70">OP</div>
            {!collapsed && (
              <div className="min-w-0">
                <p className="truncate text-xs font-medium text-white/80">Operator</p>
                <p className="truncate text-[10px] text-white/35">Local workspace</p>
              </div>
            )}
          </div>
        </div>
      </aside>

      <main className="min-w-0 flex-1">
        <header className="sticky top-2 z-10 flex h-[52px] items-center gap-3 rounded-2xl border border-white/[0.08] bg-[#171313]/95 px-3 shadow-[0_14px_40px_rgba(0,0,0,0.18)] backdrop-blur-xl sm:px-4">
          <Button variant="ghost" size="icon-sm" className="text-white/55 hover:text-white" onClick={() => setCollapsed((value) => !value)} aria-label="Toggle sidebar">
            <PanelLeft className="size-4" />
          </Button>
          <span className="hidden h-5 w-px bg-white/[0.1] sm:block" />
          <div className="relative min-w-0 max-w-sm flex-1">
            <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-white/35" />
            <Input className="h-8 border-0 bg-transparent pl-8 pr-16 text-xs text-white/80 shadow-none placeholder:text-white/35 focus-visible:ring-0" placeholder="Type to search..." />
            <kbd className="pointer-events-none absolute right-1 top-1/2 -translate-y-1/2 text-[10px] text-white/35">⌘K</kbd>
          </div>
          <div className="ml-auto flex items-center gap-0.5">
            <Button variant="ghost" size="icon-sm" className="hidden text-white/55 hover:text-white sm:inline-flex" aria-label="Activity"><Activity className="size-3.5" /></Button>
            <Button variant="ghost" size="icon-sm" className="text-white/55 hover:text-white" aria-label="Notifications"><Bell className="size-3.5" /></Button>
            <Button variant="ghost" size="icon-sm" className="text-white/55 hover:text-white" aria-label="Toggle theme" onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}><Sun className="size-3.5" /></Button>
            <div className="ml-1 grid size-7 place-items-center rounded-full bg-white/[0.1] text-[10px] font-semibold text-white/70">OP</div>
          </div>
        </header>

        <div className="mx-auto max-w-[1400px] px-1 py-6 sm:px-5 sm:py-8">{children}</div>
      </main>
    </div>
  )
}
