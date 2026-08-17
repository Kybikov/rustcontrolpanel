"use client"

import { FormEvent, useEffect, useState } from "react"
import { Check, KeyRound, Plus, Save, ShieldCheck, UserPlus } from "lucide-react"

import { apiFetch, type AuthUser, type Permission } from "@/lib/api"
import { PageHeader } from "@/components/page-primitives"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

export function TeamPage() {
  const [users, setUsers] = useState<AuthUser[]>([])
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null)
  const [permissions, setPermissions] = useState<Permission[]>([])
  const [displayName, setDisplayName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [newPermissions, setNewPermissions] = useState<string[]>([])
  const [editingUserId, setEditingUserId] = useState<number | null>(null)
  const [editingPermissions, setEditingPermissions] = useState<string[]>([])
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  async function load() {
    setLoading(true)
    const [meResponse, usersResponse, permissionsResponse] = await Promise.all([
      apiFetch("/api/v1/auth/me"),
      apiFetch("/api/v1/users"),
      apiFetch("/api/v1/permissions"),
    ])
    if (!meResponse.ok || !usersResponse.ok || !permissionsResponse.ok) {
      setError("You do not have access to manage team members.")
      setLoading(false)
      return
    }
    const mePayload = (await meResponse.json()) as { user: AuthUser }
    const usersPayload = (await usersResponse.json()) as { users: AuthUser[] }
    const permissionsPayload = (await permissionsResponse.json()) as { permissions: Permission[] }
    setCurrentUser(mePayload.user)
    setUsers(usersPayload.users)
    setPermissions(permissionsPayload.permissions)
    setLoading(false)
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timer)
  }, [])

  async function createUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError("")
    setNotice("")
    const response = await apiFetch("/api/v1/users", {
      method: "POST",
      body: JSON.stringify({ displayName, email, password, permissions: newPermissions }),
    })
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null
      setError(payload?.error ?? "Could not create user")
      setSaving(false)
      return
    }
    setDisplayName("")
    setEmail("")
    setPassword("")
    setNewPermissions([])
    setNotice("User created")
    await load()
    setSaving(false)
  }

  async function savePermissions(userId: number) {
    setSaving(true)
    setError("")
    const response = await apiFetch(`/api/v1/users/${userId}/permissions`, {
      method: "PATCH",
      body: JSON.stringify({ permissions: editingPermissions }),
    })
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null
      setError(payload?.error ?? "Could not update access")
      setSaving(false)
      return
    }
    setEditingUserId(null)
    setNotice("Access updated")
    await load()
    setSaving(false)
  }

  return (
    <>
      <PageHeader title="Team & access" description="Create operators and grant only the functions they need." />
      {error && <p role="alert" className="mb-4 rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-xs text-red-200">{error}</p>}
      {notice && <p className="mb-4 rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-xs text-emerald-200">{notice}</p>}

      <div className={currentUser?.isSuperAdmin || currentUser?.permissions.includes("users.create") ? "grid gap-4 xl:grid-cols-[0.8fr_1.2fr]" : "grid gap-4"}>
        {(currentUser?.isSuperAdmin || currentUser?.permissions.includes("users.create")) && <Card className="rounded-2xl border-white/[0.08] bg-[#171313] shadow-none">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-[15px] text-white"><UserPlus className="size-4 text-white/60" /> Create team member</CardTitle>
            <CardDescription className="text-xs text-white/40">New accounts start with no access until you select permissions.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={createUser}>
              <label className="block space-y-1.5 text-xs text-white/55">Display name<Input value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="Operator name" required /></label>
              <label className="block space-y-1.5 text-xs text-white/55">Email<Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="operator@example.com" required /></label>
              <label className="block space-y-1.5 text-xs text-white/55">Temporary password<Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Set a temporary password" required /></label>
              <PermissionPicker permissions={permissions} selected={newPermissions} onChange={setNewPermissions} />
              <Button type="submit" disabled={saving} className="w-full"><Plus className="size-3.5" />{saving ? "Creating…" : "Create user"}</Button>
            </form>
          </CardContent>
        </Card>}

        <Card className="rounded-2xl border-white/[0.08] bg-[#171313] shadow-none">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-[15px] text-white"><ShieldCheck className="size-4 text-white/60" /> Current users</CardTitle>
            <CardDescription className="text-xs text-white/40">Super admins bypass permission checks. Other users receive exactly the selected access.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? <p className="px-5 py-6 text-xs text-white/40">Loading users…</p> : <div className="divide-y divide-white/[0.07]">{users.map((user) => {
              const editing = editingUserId === user.id
              return <div key={user.id} className="px-5 py-4">
                <div className="flex items-start gap-3">
                  <div className="grid size-8 shrink-0 place-items-center rounded-full bg-white/[0.08] text-[10px] font-semibold text-white/70">{user.displayName.slice(0, 2).toUpperCase()}</div>
                  <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-medium text-white/85">{user.displayName}</p>{user.isSuperAdmin && <Badge className="rounded-full bg-[#3b0e14] text-[10px] text-red-200">Super admin</Badge>}</div><p className="mt-0.5 text-xs text-white/40">{user.email}</p></div>
                  {!user.isSuperAdmin && (currentUser?.isSuperAdmin || currentUser?.permissions.includes("users.manage_access")) && <Button variant="outline" size="sm" onClick={() => { setEditingUserId(editing ? null : user.id); setEditingPermissions(user.permissions) }}>{editing ? "Cancel" : "Edit access"}</Button>}
                </div>
                {editing ? <div className="mt-4 rounded-xl border border-white/[0.08] bg-white/[0.02] p-3"><PermissionPicker permissions={permissions} selected={editingPermissions} onChange={setEditingPermissions} /><Button size="sm" className="mt-3" disabled={saving} onClick={() => void savePermissions(user.id)}><Save className="size-3.5" />Save access</Button></div> : <div className="mt-3 flex flex-wrap gap-1.5">{user.isSuperAdmin ? <span className="text-xs text-white/45">Full access to every current and future function</span> : user.permissions.length ? user.permissions.map((permission) => <Badge key={permission} variant="outline" className="rounded-full border-white/[0.1] text-[10px] text-white/50">{permission}</Badge>) : <span className="text-xs text-white/35">No permissions assigned</span>}</div>}
              </div>
            })}</div>}
          </CardContent>
        </Card>
      </div>
    </>
  )
}

function PermissionPicker({ permissions, selected, onChange }: { permissions: Permission[]; selected: string[]; onChange: (value: string[]) => void }) {
  function toggle(permission: string) {
    onChange(selected.includes(permission) ? selected.filter((item) => item !== permission) : [...selected, permission])
  }

  return <div className="space-y-2"><p className="flex items-center gap-2 text-xs font-medium text-white/65"><KeyRound className="size-3.5" /> Permissions</p><div className="space-y-1.5">{permissions.map((permission) => <label key={permission.key} className="flex cursor-pointer items-start gap-2 rounded-lg px-2 py-1.5 hover:bg-white/[0.04]"><input type="checkbox" checked={selected.includes(permission.key)} onChange={() => toggle(permission.key)} className="mt-0.5 accent-[#d7192d]" /><span><span className="block text-xs text-white/70">{permission.key}</span><span className="block text-[11px] text-white/35">{permission.description}</span></span>{selected.includes(permission.key) && <Check className="ml-auto mt-0.5 size-3.5 text-red-300" />}</label>)}</div></div>
}
