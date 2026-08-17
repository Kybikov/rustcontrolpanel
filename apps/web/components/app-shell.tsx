"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useState, type KeyboardEvent, type ReactNode } from "react"
import {
  Database,
  Gamepad2,
  LayoutDashboard,
  PanelLeft,
  Search,
  Server,
  UserRound,
  Users,
  UsersRound,
  type LucideIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { apiFetch, type AuthUser } from "@/lib/api"

type NavItem = { label: string; href: string; icon: LucideIcon; permission?: string }
type NavGroup = { label: string; items: NavItem[] }

const navGroups: NavGroup[] = [
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
    items: [
      { label: "Account", href: "/account", icon: UserRound },
      { label: "Integrations", href: "/integrations", icon: Database },
      { label: "Team", href: "/team", icon: UsersRound, permission: "users.view" },
    ],
  },
]

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [user, setUser] = useState<AuthUser | null>(null)

  useEffect(() => {
    let active = true
    apiFetch("/api/v1/auth/me")
      .then(async (response) => {
        if (!response.ok) {
          if (active) router.replace("/login")
          return
        }
        const payload = (await response.json()) as { user: AuthUser }
        if (active) setUser(payload.user)
      })
      .catch(() => {
        if (active) router.replace("/login")
      })
    return () => {
      active = false
    }
  }, [router])

  const visibleNavGroups = navGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => !item.permission || user?.isSuperAdmin || user?.permissions.includes(item.permission)),
    }))
    .filter((group) => group.items.length > 0)
  const searchableItems = visibleNavGroups.flatMap((group) => group.items)
  const matches = query.trim()
    ? searchableItems.filter((item) => item.label.toLowerCase().includes(query.trim().toLowerCase()))
    : []

  useEffect(() => {
    function handleShortcut(event: globalThis.KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault()
        const searchInput = document.querySelector<HTMLInputElement>('input[aria-label="Search pages"]')
        searchInput?.focus()
        searchInput?.select()
      }
    }

    window.addEventListener("keydown", handleShortcut)
    return () => window.removeEventListener("keydown", handleShortcut)
  }, [])

  function submitSearch(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter" || !matches[0]) return
    event.preventDefault()
    router.push(matches[0].href)
    setQuery("")
  }

  function toggleNavigation() {
    if (window.matchMedia("(max-width: 767px)").matches) {
      setCollapsed(false)
      setMobileOpen((value) => !value)
      return
    }

    setCollapsed((value) => !value)
  }

  async function logout() {
    await apiFetch("/api/v1/auth/logout", { method: "POST" }).catch(() => undefined)
    router.replace("/login")
  }

  if (!user) {
    return <div className="grid min-h-svh place-items-center bg-[#0d0b0b] text-xs text-white/40">Checking session…</div>
  }

  return (
    <div className="min-h-svh bg-[#0d0b0b] p-2 text-[#f4f0ee] md:flex md:gap-5">
      {mobileOpen && <button className="fixed inset-0 z-20 bg-black/60 md:hidden" aria-label="Close navigation" onClick={() => setMobileOpen(false)} />}
      <aside
        className={cn(
          "fixed inset-y-2 left-2 z-30 h-[calc(100vh-1rem)] shrink-0 flex-col rounded-2xl border border-white/[0.08] bg-[#120f0f] shadow-[0_18px_50px_rgba(0,0,0,0.28)] transition-[width] duration-200 md:sticky md:top-2 md:flex",
          mobileOpen ? "flex w-[238px]" : "hidden md:flex",
          collapsed ? "md:w-[68px]" : "md:w-[238px]"
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
          {visibleNavGroups.map((group) => (
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
                      onClick={() => setMobileOpen(false)}
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
                <p className="truncate text-xs font-medium text-white/80">{user.displayName}</p>
                <p className="truncate text-[10px] text-white/35">{user.isSuperAdmin ? "Super admin" : user.email}</p>
              </div>
            )}
          </div>
        </div>
      </aside>

      <main className="min-w-0 flex-1">
        <header className="sticky top-2 z-10 flex h-[52px] items-center gap-3 rounded-2xl border border-white/[0.08] bg-[#171313]/95 px-3 shadow-[0_14px_40px_rgba(0,0,0,0.18)] backdrop-blur-xl sm:px-4">
          <Button variant="ghost" size="icon-sm" className="text-white/55 hover:text-white" onClick={toggleNavigation} aria-label="Toggle navigation">
            <PanelLeft className="size-4" />
          </Button>
          <span className="hidden h-5 w-px bg-white/[0.1] sm:block" />
          <div className="relative min-w-0 max-w-sm flex-1">
            <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-white/35" />
            <Input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={submitSearch} className="h-8 border-0 bg-transparent pl-8 pr-16 text-xs text-white/80 shadow-none placeholder:text-white/35 focus-visible:ring-0" placeholder="Search pages..." aria-label="Search pages" />
            <kbd className="pointer-events-none absolute right-1 top-1/2 -translate-y-1/2 text-[10px] text-white/35">⌘K</kbd>
            {query && (
              <div className="absolute left-0 right-0 top-10 z-50 overflow-hidden rounded-xl border border-white/[0.1] bg-[#171313] p-1 shadow-2xl">
                {matches.length ? matches.map((item) => {
                  const Icon = item.icon
                  return <Link key={item.href} href={item.href} onClick={() => setQuery("")} className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-white/70 hover:bg-white/[0.06] hover:text-white"><Icon className="size-3.5" />{item.label}</Link>
                }) : <p className="px-3 py-2 text-xs text-white/40">No matching page</p>}
              </div>
            )}
          </div>
          <div className="ml-auto flex items-center">
            <Button variant="ghost" size="icon-sm" className="ml-1 rounded-full bg-white/[0.08] text-[10px] font-semibold text-white/70 hover:bg-white/[0.14] hover:text-white" onClick={logout} aria-label="Sign out">{user.displayName.slice(0, 2).toUpperCase()}</Button>
          </div>
        </header>

        <div className="mx-auto max-w-[1400px] px-1 py-6 sm:px-5 sm:py-8">{children}</div>
      </main>
    </div>
  )
}
