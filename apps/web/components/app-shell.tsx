"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react"
import {
  Bell,
  Check,
  Gamepad2,
  LayoutDashboard,
  LogOut,
  PanelLeft,
  Search,
  Server,
  Users,
  UsersRound,
  UserRound,
  type LucideIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { API_URL, apiFetch, type AuthUser, type Notification } from "@/lib/api"

type NavItem = {
  label: string
  href: string
  icon: LucideIcon
  permission?: string
}
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
    label: "Administration",
    items: [
      {
        label: "Team",
        href: "/team",
        icon: UsersRound,
        permission: "users.view",
      },
    ],
  },
]

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [profileOpen, setProfileOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [user, setUser] = useState<AuthUser | null>(null)
  const notificationReconnectTimer = useRef<number | null>(null)

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

  const loadNotifications = useCallback(async () => {
    const response = await apiFetch("/api/v1/notifications")
    const payload = (await response.json().catch(() => null)) as {
      notifications?: Notification[]
    } | null
    if (response.ok) setNotifications(payload?.notifications ?? [])
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadNotifications().catch(() => undefined)
    }, 0)
    return () => window.clearTimeout(timer)
  }, [loadNotifications])

  useEffect(() => {
    let active = true
    let socket: WebSocket | null = null
    const connect = () => {
      if (!active) return
      const url = new URL(API_URL)
      url.protocol = url.protocol === "https:" ? "wss:" : "ws:"
      url.pathname = "/api/v1/realtime/ws"
      socket = new WebSocket(url.toString())
      socket.onmessage = (event) => {
        const payload = JSON.parse(event.data) as {
          type?: string
          payload?: { notification?: Notification }
        }
        const notification = payload.payload?.notification
        if (payload.type === "notification.created" && notification) {
          setNotifications((current) => [
            notification,
            ...current.filter((item) => item.id !== notification.id),
          ])
        }
      }
      socket.onclose = () => {
        if (active)
          notificationReconnectTimer.current = window.setTimeout(connect, 3000)
      }
    }
    connect()
    return () => {
      active = false
      if (notificationReconnectTimer.current)
        window.clearTimeout(notificationReconnectTimer.current)
      socket?.close()
    }
  }, [])

  const visibleNavGroups = navGroups
    .map((group) => ({
      ...group,
      items: group.items.filter(
        (item) =>
          !item.permission ||
          user?.isSuperAdmin ||
          user?.permissions.includes(item.permission)
      ),
    }))
    .filter((group) => group.items.length > 0)
  const searchableItems = visibleNavGroups.flatMap((group) => group.items)
  const matches = query.trim()
    ? searchableItems.filter((item) =>
        item.label.toLowerCase().includes(query.trim().toLowerCase())
      )
    : []
  const unreadNotifications = notifications.filter(
    (notification) => !notification.readAt
  ).length

  useEffect(() => {
    function handleShortcut(event: globalThis.KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault()
        const searchInput = document.querySelector<HTMLInputElement>(
          'input[aria-label="Search pages"]'
        )
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
    setProfileOpen(false)
    await apiFetch("/api/v1/auth/logout", { method: "POST" }).catch(
      () => undefined
    )
    router.replace("/login")
  }

  async function markNotificationsRead() {
    await apiFetch("/api/v1/notifications/read", { method: "POST" }).catch(
      () => undefined
    )
    setNotifications((current) =>
      current.map((item) => ({
        ...item,
        readAt: item.readAt ?? new Date().toISOString(),
      }))
    )
  }

  if (!user) {
    return (
      <div className="grid min-h-svh place-items-center bg-[#0d0b0b] text-xs text-white/40">
        Checking session…
      </div>
    )
  }

  return (
    <div className="min-h-svh bg-[#0d0b0b] p-2 text-[#f4f0ee] md:flex md:gap-5">
      {mobileOpen && (
        <button
          className="fixed inset-0 z-20 bg-black/60 md:hidden"
          aria-label="Close navigation"
          onClick={() => setMobileOpen(false)}
        />
      )}
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
              <p className="truncate text-[15px] font-semibold tracking-[-0.02em]">
                RustControl
              </p>
              <p className="truncate text-[11px] text-white/45">
                Player companion
              </p>
            </div>
          )}
        </div>

        <nav className="flex-1 space-y-6 overflow-y-auto px-2 py-5">
          {visibleNavGroups.map((group) => (
            <div key={group.label}>
              {!collapsed && (
                <p className="mb-2 px-3 text-[10px] font-semibold tracking-[0.14em] text-white/35 uppercase">
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
                      onClick={() => setMobileOpen(false)}
                      className={cn(
                        "flex h-9 items-center gap-3 rounded-xl px-3 text-[13px] text-white/60 transition-colors hover:bg-white/[0.05] hover:text-white",
                        active &&
                          "bg-[#3b0e14] text-white ring-1 ring-[#7c1d29]/70",
                        collapsed && "justify-center px-0"
                      )}
                    >
                      <Icon className="size-[15px] shrink-0" />
                      {!collapsed && (
                        <span className="truncate">{item.label}</span>
                      )}
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>
      </aside>

      <main className="min-w-0 flex-1">
        <header className="sticky top-2 z-10 flex h-[52px] items-center gap-3 rounded-2xl border border-white/[0.08] bg-[#171313]/95 px-3 shadow-[0_14px_40px_rgba(0,0,0,0.18)] backdrop-blur-xl sm:px-4">
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-white/55 hover:text-white"
            onClick={toggleNavigation}
            aria-label="Toggle navigation"
          >
            <PanelLeft className="size-4" />
          </Button>
          <span className="hidden h-5 w-px bg-white/[0.1] sm:block" />
          <div className="relative max-w-sm min-w-0 flex-1">
            <Search className="absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-white/35" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={submitSearch}
              className="h-8 border-0 bg-transparent pr-16 pl-8 text-xs text-white/80 shadow-none placeholder:text-white/35 focus-visible:ring-0"
              placeholder="Search pages..."
              aria-label="Search pages"
            />
            <kbd className="pointer-events-none absolute top-1/2 right-1 -translate-y-1/2 text-[10px] text-white/35">
              ⌘K
            </kbd>
            {query && (
              <div className="absolute top-10 right-0 left-0 z-50 overflow-hidden rounded-xl border border-white/[0.1] bg-[#171313] p-1 shadow-2xl">
                {matches.length ? (
                  matches.map((item) => {
                    const Icon = item.icon
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setQuery("")}
                        className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-white/70 hover:bg-white/[0.06] hover:text-white"
                      >
                        <Icon className="size-3.5" />
                        {item.label}
                      </Link>
                    )
                  })
                ) : (
                  <p className="px-3 py-2 text-xs text-white/40">
                    No matching page
                  </p>
                )}
              </div>
            )}
          </div>
          <div className="relative ml-auto flex items-center gap-1">
            {(profileOpen || notificationsOpen) && (
              <button
                className="fixed inset-0 z-40 cursor-default"
                aria-label="Close account menu"
                onClick={() => {
                  setProfileOpen(false)
                  setNotificationsOpen(false)
                }}
              />
            )}
            <div className="relative">
              <Button
                variant="ghost"
                size="icon-sm"
                className="relative z-50 rounded-full text-white/55 hover:bg-white/[0.08] hover:text-white"
                onClick={() => {
                  setNotificationsOpen((value) => !value)
                  setProfileOpen(false)
                }}
                aria-label="Open notifications"
                aria-expanded={notificationsOpen}
              >
                <Bell className="size-4" />
                {unreadNotifications > 0 && (
                  <span className="absolute top-1 right-1 size-1.5 rounded-full bg-[#ef3d36]" />
                )}
              </Button>
              {notificationsOpen && (
                <NotificationsMenu
                  notifications={notifications}
                  onClose={() => setNotificationsOpen(false)}
                  onMarkRead={() => void markNotificationsRead()}
                />
              )}
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              className="relative z-50 rounded-full bg-white/[0.08] text-[10px] font-semibold text-white/70 hover:bg-white/[0.14] hover:text-white"
              onClick={() => {
                setProfileOpen((value) => !value)
                setNotificationsOpen(false)
              }}
              aria-label="Open profile menu"
              aria-expanded={profileOpen}
            >
              {user.displayName.slice(0, 2).toUpperCase()}
              <span className="absolute -right-0.5 -bottom-0.5 size-2 rounded-full border border-[#171313] bg-emerald-400" />
            </Button>
            {profileOpen && (
              <div className="absolute top-11 right-0 z-50 w-64 overflow-hidden rounded-xl border border-white/[0.1] bg-[#171313] shadow-[0_18px_50px_rgba(0,0,0,0.45)]">
                <div className="flex items-center gap-3 border-b border-white/[0.08] px-4 py-3">
                  <div className="grid size-9 shrink-0 place-items-center rounded-full bg-white/[0.1] text-xs font-semibold text-white/75">
                    {user.displayName.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-white/90">
                      {user.displayName}
                    </p>
                    <p className="truncate text-[11px] text-white/40">
                      {user.email}
                    </p>
                  </div>
                </div>
                <div className="p-1.5">
                  <Link
                    href="/account"
                    onClick={() => setProfileOpen(false)}
                    className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-white/70 hover:bg-white/[0.06] hover:text-white"
                  >
                    <UserRound className="size-3.5" /> My account
                  </Link>
                </div>
                <div className="border-t border-white/[0.08] p-1.5">
                  <button
                    onClick={() => void logout()}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-red-300 hover:bg-red-400/[0.08]"
                  >
                    <LogOut className="size-3.5" /> Sign out
                  </button>
                </div>
              </div>
            )}
          </div>
        </header>

        <div className="mx-auto max-w-[1400px] px-1 py-6 sm:px-5 sm:py-8">
          {children}
        </div>
      </main>
    </div>
  )
}

function NotificationsMenu({
  notifications,
  onClose,
  onMarkRead,
}: {
  notifications: Notification[]
  onClose: () => void
  onMarkRead: () => void
}) {
  const unread = notifications.some((notification) => !notification.readAt)
  return (
    <div className="absolute top-11 right-0 z-50 w-[min(22rem,calc(100vw-1.5rem))] overflow-hidden rounded-xl border border-white/[0.1] bg-[#171313] shadow-[0_18px_50px_rgba(0,0,0,0.45)]">
      <div className="flex items-center justify-between border-b border-white/[0.08] px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-white/90">Notifications</p>
          <p className="mt-0.5 text-[11px] text-white/40">
            Only changes from your saved servers appear here.
          </p>
        </div>
        {unread && (
          <button
            type="button"
            onClick={onMarkRead}
            className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-[11px] text-white/60 hover:bg-white/[0.06] hover:text-white"
          >
            <Check className="size-3.5" />
            Read all
          </button>
        )}
      </div>
      {notifications.length ? (
        <div className="max-h-[min(26rem,calc(100vh-7rem))] overflow-y-auto p-1.5">
          {notifications.map((notification) => {
            const content = (
              <>
                <div className="flex items-start gap-2">
                  <span
                    className={`mt-1.5 size-1.5 shrink-0 rounded-full ${notification.readAt ? "bg-white/20" : "bg-emerald-400"}`}
                  />
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-white/85">
                      {notification.title}
                    </p>
                    {notification.body && (
                      <p className="mt-1 text-[11px] leading-4 text-white/45">
                        {notification.body}
                      </p>
                    )}
                    <p className="mt-1.5 text-[10px] text-white/30">
                      {formatNotificationTime(notification.createdAt)}
                    </p>
                  </div>
                </div>
              </>
            )
            return notification.href ? (
              <Link
                key={notification.id}
                href={notification.href}
                onClick={onClose}
                className="block rounded-lg px-3 py-2.5 hover:bg-white/[0.05]"
              >
                {content}
              </Link>
            ) : (
              <div key={notification.id} className="rounded-lg px-3 py-2.5">
                {content}
              </div>
            )
          })}
        </div>
      ) : (
        <div className="px-5 py-8 text-center text-xs leading-5 text-white/40">
          When a saved server changes status, the update will appear here.
        </div>
      )}
    </div>
  )
}

function formatNotificationTime(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? "Just now" : date.toLocaleString()
}
