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

export type SavedSteamPlayer = SteamPlayer & {
  savedAt: string
  updatedAt: string
}

export type PlayerActivityPoint = {
  presence: string
  currentGame?: string
  capturedAt: string
}

export type Notification = {
  id: number
  type: string
  title: string
  body: string
  href?: string
  readAt?: string
  createdAt: string
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

export type CheckedRustServer = {
  address: string
  queryAddress: string
  name: string
  map: string
  players: number
  maxPlayers: number
  bots: number
  version: string
  tags: string[]
  vacSecured: boolean
  passwordProtected: boolean
  protocol: number
  gameFolder: string
  gameName: string
  serverKind: string
  environment: string
  serverSteamId?: string
  latencyMs: number
  checkedAt: string
}

export type WatchlistServer = {
  id: number
  address: string
  queryAddress: string
  status: "online" | "offline" | "blocked" | "unknown" | "removed"
  error?: string
  name?: string
  map?: string
  players?: number
  maxPlayers?: number
  bots?: number
  version?: string
  tags: string[]
  vacSecured?: boolean
  passwordProtected?: boolean
  protocol?: number
  gameFolder?: string
  gameName?: string
  serverKind?: string
  environment?: string
  serverSteamId?: string
  latencyMs?: number
  checkedAt?: string
  createdAt: string
}

export type ServerHistoryPoint = {
  status: string
  name?: string
  map?: string
  players?: number
  maxPlayers?: number
  latencyMs?: number
  error?: string
  checkedAt: string
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
