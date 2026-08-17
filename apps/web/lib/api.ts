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

export type IntegrationStatus = {
  provider: "battlemetrics" | "steam"
  connected: boolean
  lastCheckedAt?: string
  lastError?: string
}

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080"

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
