export type AuthUser = {
  id: number
  email: string
  displayName: string
  isActive: boolean
  isSuperAdmin: boolean
  permissions: string[]
  roles: RoleSummary[]
  createdAt: string
}

export type RoleSummary = {
  id: number
  name: string
  slug: string
}

export type Role = {
  id: number
  name: string
  slug: string
  description: string
  isSystem: boolean
  userCount: number
  permissions: string[]
}

export type Permission = {
  key: string
  description: string
}

export type SteamPlayer = {
  steamId: string
  displayName: string
  profileUrl: string
  avatarUrl?: string
  visibility: "public" | "private" | "limited"
  presence: string
  currentGame?: string
  lastLogoffAt?: string
  profileCreatedAt?: string
}

export type SteamAccount = {
  steamId: string
  profileUrl: string
  linkedAt: string
}

export type SteamAccountProfile = SteamPlayer & {
  rustPlaytimeMinutes: number | null
  rustPlaytimeStatus: "available" | "not_owned" | "private" | "unavailable"
  friendsPlayingRust: number | null
  friendsStatus: "available" | "private" | "unavailable"
}

export type RustServer = {
  id: string
  name: string
  address: string
  ip: string
  port: number
  players: number
  maxPlayers: number
  rank?: number
  status: string
  map?: string
  mapSize?: number
  description?: string
  wipeAt?: string
  lastSeenAt?: string
}

export type ServerSearchResult = {
  servers: RustServer[]
  page: number
  perPage: number
  hasMore: boolean
}

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080"

export function apiFetch(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers)
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json")
  }
  return fetch(`${API_URL}${path}`, {
    ...init,
    headers,
    credentials: "include",
  })
}
