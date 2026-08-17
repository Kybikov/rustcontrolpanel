export type AuthUser = {
  id: number
  email: string
  displayName: string
  isActive: boolean
  isSuperAdmin: boolean
  permissions: string[]
  createdAt: string
}

export type Permission = {
  key: string
  description: string
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
