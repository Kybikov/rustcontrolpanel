"use client"

import { FormEvent, type ReactNode, useEffect, useMemo, useState } from "react"
import {
  Check,
  KeyRound,
  MoreHorizontal,
  Plus,
  PlusCircle,
  Search,
  ShieldCheck,
  Trash2,
  UserPlus,
  UsersRound,
  X,
} from "lucide-react"

import { apiFetch, type AuthUser, type Permission, type Role } from "@/lib/api"
import { PageHeader } from "@/components/page-primitives"
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

type TeamView = "roles" | "permissions"

const resourceGroups = [
  { label: "Dashboard", key: "dashboard", permissions: ["dashboard.view"] },
  {
    label: "Servers",
    key: "servers",
    permissions: ["servers.view", "servers.search"],
  },
  {
    label: "Players",
    key: "players",
    permissions: ["players.view", "players.search"],
  },
  {
    label: "Team & users",
    key: "users",
    permissions: ["users.view", "users.create", "users.manage_access"],
  },
]

const permissionLabel: Record<string, string> = {
  "dashboard.view": "View",
  "servers.view": "View",
  "servers.search": "Search",
  "players.view": "View",
  "players.search": "Search",
  "users.view": "View",
  "users.create": "Create",
  "users.manage_access": "Manage",
}

export function TeamPage() {
  const [view, setView] = useState<TeamView>("roles")
  const [users, setUsers] = useState<AuthUser[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [permissions, setPermissions] = useState<Permission[]>([])
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null)
  const [search, setSearch] = useState("")
  const [editingRoleId, setEditingRoleId] = useState<number | null>(null)
  const [editingRolePermissions, setEditingRolePermissions] = useState<
    string[]
  >([])
  const [roleFormOpen, setRoleFormOpen] = useState(false)
  const [roleName, setRoleName] = useState("")
  const [roleDescription, setRoleDescription] = useState("")
  const [rolePermissions, setRolePermissions] = useState<string[]>([])
  const [editingUserId, setEditingUserId] = useState<number | null>(null)
  const [editingUserRoles, setEditingUserRoles] = useState<number[]>([])
  const [userFormOpen, setUserFormOpen] = useState(false)
  const [displayName, setDisplayName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [newUserRoles, setNewUserRoles] = useState<number[]>([])
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const canManage = Boolean(
    currentUser?.isSuperAdmin ||
    currentUser?.permissions.includes("users.manage_access")
  )
  const canCreateUser = Boolean(
    currentUser?.isSuperAdmin ||
    currentUser?.permissions.includes("users.create")
  )

  const filteredUsers = useMemo(() => {
    const needle = search.trim().toLowerCase()
    if (!needle) return users
    return users.filter((user) =>
      `${user.displayName} ${user.email}`.toLowerCase().includes(needle)
    )
  }, [search, users])

  const resourcesCount = useMemo(
    () =>
      new Set(permissions.map((permission) => permission.key.split(".")[0]))
        .size,
    [permissions]
  )
  const activePermissions = useMemo(
    () => roles.reduce((total, role) => total + role.permissions.length, 0),
    [roles]
  )

  async function load() {
    setLoading(true)
    setError("")
    const [meResponse, usersResponse, permissionsResponse, rolesResponse] =
      await Promise.all([
        apiFetch("/api/v1/auth/me"),
        apiFetch("/api/v1/users"),
        apiFetch("/api/v1/permissions"),
        apiFetch("/api/v1/roles"),
      ])
    if (
      !meResponse.ok ||
      !usersResponse.ok ||
      !permissionsResponse.ok ||
      !rolesResponse.ok
    ) {
      setError("You do not have access to manage team members.")
      setLoading(false)
      return
    }
    const mePayload = (await meResponse.json()) as { user: AuthUser }
    const usersPayload = (await usersResponse.json()) as { users?: AuthUser[] }
    const permissionsPayload = (await permissionsResponse.json()) as {
      permissions?: Permission[]
    }
    const rolesPayload = (await rolesResponse.json()) as { roles?: Role[] }
    setCurrentUser(mePayload.user)
    setUsers(
      (usersPayload.users ?? []).map((user) => ({
        ...user,
        roles: user.roles ?? [],
      }))
    )
    setPermissions(permissionsPayload.permissions ?? [])
    setRoles(rolesPayload.roles ?? [])
    setLoading(false)
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timer)
  }, [])

  function showNotice(message: string) {
    setError("")
    setNotice(message)
    window.setTimeout(() => setNotice(""), 3200)
  }

  async function createRole(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError("")
    const response = await apiFetch("/api/v1/roles", {
      method: "POST",
      body: JSON.stringify({
        name: roleName,
        description: roleDescription,
        permissions: rolePermissions,
      }),
    })
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as {
        error?: string
      } | null
      setError(payload?.error ?? "Could not create role")
      setSaving(false)
      return
    }
    setRoleName("")
    setRoleDescription("")
    setRolePermissions([])
    setRoleFormOpen(false)
    await load()
    showNotice("Role created")
    setSaving(false)
  }

  async function saveRolePermissions(roleId: number) {
    setSaving(true)
    setError("")
    const response = await apiFetch(`/api/v1/roles/${roleId}/permissions`, {
      method: "PATCH",
      body: JSON.stringify({ permissions: editingRolePermissions }),
    })
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as {
        error?: string
      } | null
      setError(payload?.error ?? "Could not update role")
      setSaving(false)
      return
    }
    setEditingRoleId(null)
    await load()
    showNotice("Role permissions updated")
    setSaving(false)
  }

  async function deleteRole(role: Role) {
    if (!window.confirm(`Delete the ${role.name} role?`)) return
    setSaving(true)
    const response = await apiFetch(`/api/v1/roles/${role.id}`, {
      method: "DELETE",
    })
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as {
        error?: string
      } | null
      setError(payload?.error ?? "Could not delete role")
      setSaving(false)
      return
    }
    await load()
    showNotice("Role deleted")
    setSaving(false)
  }

  async function saveUserRoles(userId: number) {
    setSaving(true)
    setError("")
    const response = await apiFetch(`/api/v1/users/${userId}/roles`, {
      method: "PATCH",
      body: JSON.stringify({ roleIds: editingUserRoles }),
    })
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as {
        error?: string
      } | null
      setError(payload?.error ?? "Could not update user roles")
      setSaving(false)
      return
    }
    setEditingUserId(null)
    await load()
    showNotice("User roles updated")
    setSaving(false)
  }

  async function createUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError("")
    const response = await apiFetch("/api/v1/users", {
      method: "POST",
      body: JSON.stringify({
        displayName,
        email,
        password,
        permissions: [],
        roleIds: newUserRoles,
      }),
    })
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as {
        error?: string
      } | null
      setError(payload?.error ?? "Could not create user")
      setSaving(false)
      return
    }
    setDisplayName("")
    setEmail("")
    setPassword("")
    setNewUserRoles([])
    setUserFormOpen(false)
    await load()
    showNotice("User created")
    setSaving(false)
  }

  function startRoleEdit(role: Role) {
    if (role.isSystem || !canManage) return
    setView("roles")
    setEditingRoleId(role.id)
    setEditingRolePermissions(role.permissions)
  }

  return (
    <>
      <PageHeader
        title="Roles & permissions"
        description="Manage team access by role, then see every resource permission at a glance."
        action={
          <div className="flex items-center gap-1 rounded-xl border border-white/[0.08] bg-[#171313] p-1">
            <Button
              type="button"
              variant={view === "roles" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setView("roles")}
            >
              <ShieldCheck className="size-3.5" /> Roles
            </Button>
            <Button
              type="button"
              variant={view === "permissions" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setView("permissions")}
            >
              <KeyRound className="size-3.5" /> Permissions
            </Button>
          </div>
        }
      />

      {error && (
        <p
          role="alert"
          className="mb-4 rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-xs text-red-200"
        >
          {error}
        </p>
      )}
      {notice && (
        <p className="mb-4 rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-xs text-emerald-200">
          {notice}
        </p>
      )}

      {view === "roles" ? (
        <RolesView
          roles={roles}
          permissions={permissions}
          canManage={canManage}
          canCreateUser={canCreateUser}
          loading={loading}
          editingRoleId={editingRoleId}
          editingRolePermissions={editingRolePermissions}
          setEditingRolePermissions={setEditingRolePermissions}
          onEditRole={startRoleEdit}
          onCancelRole={() => setEditingRoleId(null)}
          onSaveRole={saveRolePermissions}
          onDeleteRole={deleteRole}
          roleFormOpen={roleFormOpen}
          setRoleFormOpen={setRoleFormOpen}
          roleName={roleName}
          setRoleName={setRoleName}
          roleDescription={roleDescription}
          setRoleDescription={setRoleDescription}
          rolePermissions={rolePermissions}
          setRolePermissions={setRolePermissions}
          onCreateRole={createRole}
          users={filteredUsers}
          search={search}
          setSearch={setSearch}
          currentUser={currentUser}
          editingUserId={editingUserId}
          editingUserRoles={editingUserRoles}
          setEditingUserRoles={setEditingUserRoles}
          onEditUser={(user) => {
            setEditingUserId(user.id)
            setEditingUserRoles(user.roles.map((role) => role.id))
          }}
          onCancelUser={() => setEditingUserId(null)}
          onSaveUser={saveUserRoles}
          userFormOpen={userFormOpen}
          setUserFormOpen={setUserFormOpen}
          displayName={displayName}
          setDisplayName={setDisplayName}
          email={email}
          setEmail={setEmail}
          password={password}
          setPassword={setPassword}
          newUserRoles={newUserRoles}
          setNewUserRoles={setNewUserRoles}
          onCreateUser={createUser}
          saving={saving}
        />
      ) : (
        <PermissionsView
          roles={roles}
          permissions={permissions}
          resourcesCount={resourcesCount}
          activePermissions={activePermissions}
          onEditRole={startRoleEdit}
          canManage={canManage}
        />
      )}
    </>
  )
}

type RolesViewProps = {
  roles: Role[]
  permissions: Permission[]
  canManage: boolean
  canCreateUser: boolean
  loading: boolean
  editingRoleId: number | null
  editingRolePermissions: string[]
  setEditingRolePermissions: (value: string[]) => void
  onEditRole: (role: Role) => void
  onCancelRole: () => void
  onSaveRole: (roleId: number) => void
  onDeleteRole: (role: Role) => void
  roleFormOpen: boolean
  setRoleFormOpen: (value: boolean) => void
  roleName: string
  setRoleName: (value: string) => void
  roleDescription: string
  setRoleDescription: (value: string) => void
  rolePermissions: string[]
  setRolePermissions: (value: string[]) => void
  onCreateRole: (event: FormEvent<HTMLFormElement>) => void
  users: AuthUser[]
  search: string
  setSearch: (value: string) => void
  currentUser: AuthUser | null
  editingUserId: number | null
  editingUserRoles: number[]
  setEditingUserRoles: (value: number[]) => void
  onEditUser: (user: AuthUser) => void
  onCancelUser: () => void
  onSaveUser: (userId: number) => void
  userFormOpen: boolean
  setUserFormOpen: (value: boolean) => void
  displayName: string
  setDisplayName: (value: string) => void
  email: string
  setEmail: (value: string) => void
  password: string
  setPassword: (value: string) => void
  newUserRoles: number[]
  setNewUserRoles: (value: number[]) => void
  onCreateUser: (event: FormEvent<HTMLFormElement>) => void
  saving: boolean
}

function RolesView(props: RolesViewProps) {
  const canManageUsers = Boolean(
    props.currentUser?.isSuperAdmin ||
    props.currentUser?.permissions.includes("users.manage_access")
  )
  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {props.roles.map((role) => (
          <RoleCard
            key={role.id}
            role={role}
            editing={props.editingRoleId === role.id}
            permissions={props.permissions}
            canManage={props.canManage}
            editingPermissions={props.editingRolePermissions}
            setEditingPermissions={props.setEditingRolePermissions}
            onEdit={() => props.onEditRole(role)}
            onCancel={props.onCancelRole}
            onSave={() => props.onSaveRole(role.id)}
            onDelete={() => void props.onDeleteRole(role)}
            saving={props.saving}
          />
        ))}
        {props.canManage && (
          <Card className="min-h-[190px] justify-center rounded-2xl border-dashed border-white/[0.14] bg-[#171313] shadow-none">
            {props.roleFormOpen ? (
              <CardContent>
                <RoleForm
                  permissions={props.permissions}
                  name={props.roleName}
                  setName={props.setRoleName}
                  description={props.roleDescription}
                  setDescription={props.setRoleDescription}
                  selected={props.rolePermissions}
                  setSelected={props.setRolePermissions}
                  onSubmit={props.onCreateRole}
                  onCancel={() => props.setRoleFormOpen(false)}
                  saving={props.saving}
                />
              </CardContent>
            ) : (
              <CardContent className="text-center">
                <div className="mx-auto mb-3 grid size-9 place-items-center rounded-xl bg-[#2a1518] text-red-300">
                  <PlusCircle className="size-4" />
                </div>
                <p className="text-sm font-semibold text-white/85">
                  Add new role
                </p>
                <p className="mt-1 text-xs text-white/40">
                  Create a role with exactly the access it needs.
                </p>
                <Button
                  className="mt-4"
                  variant="outline"
                  size="sm"
                  onClick={() => props.setRoleFormOpen(true)}
                >
                  <Plus className="size-3.5" /> Add new role
                </Button>
              </CardContent>
            )}
          </Card>
        )}
      </div>

      <Card className="rounded-2xl border-white/[0.08] bg-[#171313] shadow-none">
        <CardHeader className="border-b border-white/[0.08] pb-5">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
            <div>
              <CardTitle className="flex items-center gap-2 text-white/90">
                <UsersRound className="size-4 text-white/50" /> Users with their
                roles
              </CardTitle>
              <CardDescription className="mt-1 text-xs text-white/40">
                Assign a role once and keep access consistent across the panel.
              </CardDescription>
            </div>
            {props.canCreateUser && (
              <Button
                size="sm"
                onClick={() => props.setUserFormOpen(!props.userFormOpen)}
              >
                {props.userFormOpen ? (
                  <X className="size-3.5" />
                ) : (
                  <UserPlus className="size-3.5" />
                )}
                {props.userFormOpen ? "Close" : "Add new user"}
              </Button>
            )}
          </div>
        </CardHeader>
        {props.userFormOpen && (
          <CardContent className="border-b border-white/[0.08] bg-white/[0.015] py-5">
            <form
              className="grid gap-3 md:grid-cols-4"
              onSubmit={props.onCreateUser}
            >
              <Input
                value={props.displayName}
                onChange={(event) => props.setDisplayName(event.target.value)}
                placeholder="Display name"
                required
              />
              <Input
                type="email"
                value={props.email}
                onChange={(event) => props.setEmail(event.target.value)}
                placeholder="Email"
                required
              />
              <Input
                type="password"
                value={props.password}
                onChange={(event) => props.setPassword(event.target.value)}
                placeholder="Temporary password"
                required
              />
              <Button type="submit" disabled={props.saving}>
                Create user
              </Button>
              <div className="md:col-span-4">
                <RolePicker
                  roles={props.roles}
                  selected={props.newUserRoles}
                  onChange={props.setNewUserRoles}
                  emptyLabel="Select roles for this user"
                />
              </div>
            </form>
          </CardContent>
        )}
        <CardContent className="p-0">
          <div className="flex items-center gap-3 border-b border-white/[0.08] px-5 py-4">
            <div className="relative max-w-xs flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-white/35" />
              <Input
                value={props.search}
                onChange={(event) => props.setSearch(event.target.value)}
                placeholder="Search user"
                className="h-8 pl-9"
              />
            </div>
            <span className="ml-auto text-xs text-white/35">
              {props.users.length} users
            </span>
          </div>
          {props.loading ? (
            <p className="px-5 py-8 text-xs text-white/40">Loading team…</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left">
                <thead className="border-b border-white/[0.08] text-[10px] tracking-[0.1em] text-white/35 uppercase">
                  <tr>
                    <th className="px-5 py-3 font-medium">User</th>
                    <th className="px-4 py-3 font-medium">Roles</th>
                    <th className="px-4 py-3 font-medium">Effective access</th>
                    <th className="px-5 py-3 text-right font-medium">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.06]">
                  {props.users.map((user) => (
                    <UserRow
                      key={user.id}
                      user={user}
                      roles={props.roles}
                      canManage={canManageUsers}
                      editing={props.editingUserId === user.id}
                      selectedRoles={props.editingUserRoles}
                      setSelectedRoles={props.setEditingUserRoles}
                      onEdit={() => props.onEditUser(user)}
                      onCancel={props.onCancelUser}
                      onSave={() => props.onSaveUser(user.id)}
                      saving={props.saving}
                    />
                  ))}
                </tbody>
              </table>
              {!props.users.length && (
                <p className="px-5 py-8 text-center text-xs text-white/40">
                  No users match your search.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function RoleCard({
  role,
  editing,
  permissions,
  canManage,
  editingPermissions,
  setEditingPermissions,
  onEdit,
  onCancel,
  onSave,
  onDelete,
  saving,
}: {
  role: Role
  editing: boolean
  permissions: Permission[]
  canManage: boolean
  editingPermissions: string[]
  setEditingPermissions: (value: string[]) => void
  onEdit: () => void
  onCancel: () => void
  onSave: () => void
  onDelete: () => void
  saving: boolean
}) {
  const metrics = [
    [
      "View",
      role.permissions.filter((permission) => permission.endsWith(".view"))
        .length,
    ],
    [
      "Search",
      role.permissions.filter((permission) => permission.endsWith(".search"))
        .length,
    ],
    [
      "Manage",
      role.permissions.filter(
        (permission) =>
          permission.endsWith(".manage") || permission.endsWith(".create")
      ).length,
    ],
    ["Total", role.permissions.length],
  ] as const
  return (
    <Card className="rounded-2xl border-white/[0.08] bg-[#171313] shadow-none">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-[15px] text-white/90">
              {role.name}
            </CardTitle>
            <CardDescription className="mt-1 text-xs text-white/40">
              {role.userCount} {role.userCount === 1 ? "user" : "users"}
            </CardDescription>
          </div>
          <div className="flex items-center gap-1">
            {role.isSystem && (
              <Badge
                variant="outline"
                className="border-white/[0.1] text-[10px] text-white/40"
              >
                System
              </Badge>
            )}
            {canManage && !role.isSystem && (
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label={`Actions for ${role.name}`}
                onClick={onEdit}
              >
                <MoreHorizontal className="size-4 text-white/45" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      {editing ? (
        <CardContent className="space-y-3 pt-0">
          <p className="text-[11px] text-white/45">
            Choose the permissions this custom role can use.
          </p>
          <PermissionPicker
            permissions={permissions}
            selected={editingPermissions}
            onChange={setEditingPermissions}
            compact
          />
          <div className="flex gap-2">
            <Button size="sm" disabled={saving} onClick={onSave}>
              <Check className="size-3.5" /> Save
            </Button>
            <Button size="sm" variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
            <Button
              size="icon-xs"
              variant="ghost"
              className="ml-auto text-red-300 hover:text-red-200"
              aria-label={`Delete ${role.name}`}
              onClick={onDelete}
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        </CardContent>
      ) : (
        <CardContent className="pt-0">
          <p className="min-h-8 text-xs leading-5 text-white/45">
            {role.description}
          </p>
          <div className="mt-4 grid grid-cols-4 divide-x divide-white/[0.08] rounded-xl border border-white/[0.06] bg-[#120f0f] py-2.5">
            {metrics.map(([label, value]) => (
              <div key={label} className="text-center">
                <p className="text-sm font-semibold text-white/85">{value}</p>
                <p className="mt-0.5 text-[10px] text-white/35">{label}</p>
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-2 text-[10px] text-white/35">
            <KeyRound className="size-3" />{" "}
            {role.permissions.length
              ? `${role.permissions.length} active permissions`
              : "No permissions assigned"}
            <span className="ml-auto">{role.slug}</span>
          </div>
        </CardContent>
      )}
    </Card>
  )
}

function PermissionsView({
  roles,
  permissions,
  resourcesCount,
  activePermissions,
  onEditRole,
  canManage,
}: {
  roles: Role[]
  permissions: Permission[]
  resourcesCount: number
  activePermissions: number
  onEditRole: (role: Role) => void
  canManage: boolean
}) {
  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          label="Roles"
          value={roles.length}
          icon={<ShieldCheck className="size-4" />}
        />
        <StatCard
          label="Resources"
          value={resourcesCount}
          icon={<KeyRound className="size-4" />}
        />
        <StatCard
          label="Active permissions"
          value={activePermissions}
          icon={<Check className="size-4" />}
        />
      </div>
      <Card className="overflow-hidden rounded-2xl border-white/[0.08] bg-[#171313] shadow-none">
        <CardHeader className="border-b border-white/[0.08] pb-5">
          <CardTitle className="text-[15px] text-white/90">
            Permission matrix
          </CardTitle>
          <CardDescription className="text-xs text-white/40">
            Overview of every role and its associated resource permissions.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full min-w-[920px] text-left">
            <thead className="border-b border-white/[0.08] bg-white/[0.015] text-xs text-white/75">
              <tr>
                <th className="w-[190px] px-5 py-4 font-medium">Resource</th>
                {roles.map((role) => (
                  <th
                    key={role.id}
                    className="min-w-[130px] px-4 py-4 font-medium"
                  >
                    <button
                      className="text-left hover:text-white"
                      onClick={() =>
                        canManage && !role.isSystem && onEditRole(role)
                      }
                    >
                      <span className="block">{role.name}</span>
                      <span className="mt-1 block text-[10px] font-normal text-white/35">
                        {role.userCount} users
                      </span>
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.07]">
              {resourceGroups.map((resource) => (
                <tr key={resource.key} className="align-top">
                  <th className="px-5 py-4 text-xs font-medium text-white/80">
                    {resource.label}
                  </th>
                  {roles.map((role) => (
                    <td key={role.id} className="px-4 py-4">
                      <div className="flex max-w-[150px] flex-wrap gap-1.5">
                        {resource.permissions
                          .filter((permission) =>
                            role.permissions.includes(permission)
                          )
                          .map((permission) => (
                            <span
                              key={permission}
                              className="inline-flex items-center gap-1 rounded-md border border-red-400/20 bg-[#3b1117] px-1.5 py-1 text-[10px] text-red-200"
                            >
                              <Check className="size-2.5" />
                              {permissionLabel[permission]}
                            </span>
                          ))}
                        {!resource.permissions.some((permission) =>
                          role.permissions.includes(permission)
                        ) && (
                          <span className="text-[10px] text-white/25">—</span>
                        )}
                      </div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
        <div className="flex flex-wrap gap-x-5 gap-y-2 border-t border-white/[0.08] px-5 py-4 text-[11px] text-white/40">
          <span className="font-medium text-white/60">Legend</span>
          <span>
            <b className="font-medium text-white/70">View</b> read access
          </span>
          <span>
            <b className="font-medium text-white/70">Search</b> server/player
            lookup
          </span>
          <span>
            <b className="font-medium text-white/70">Create</b> add users
          </span>
          <span>
            <b className="font-medium text-white/70">Manage</b> provider/access
            changes
          </span>
        </div>
      </Card>
      <div className="grid gap-3 md:grid-cols-2">
        {permissions.map((permission) => (
          <div
            key={permission.key}
            className="flex items-center justify-between rounded-xl border border-white/[0.07] bg-[#171313] px-4 py-3"
          >
            <div>
              <p className="text-xs font-medium text-white/75">
                {permission.key}
              </p>
              <p className="mt-1 text-[11px] text-white/35">
                {permission.description}
              </p>
            </div>
            <Badge
              variant="outline"
              className="border-white/[0.1] text-[10px] text-white/45"
            >
              {
                roles.filter((role) =>
                  role.permissions.includes(permission.key)
                ).length
              }{" "}
              roles
            </Badge>
          </div>
        ))}
      </div>
    </div>
  )
}

function StatCard({
  label,
  value,
  icon,
}: {
  label: string
  value: number
  icon: ReactNode
}) {
  return (
    <Card className="rounded-2xl border-white/[0.08] bg-[#171313] shadow-none">
      <CardContent className="flex items-center justify-between p-5">
        <div>
          <p className="text-2xl font-semibold tracking-[-0.04em] text-white/90">
            {value}
          </p>
          <p className="mt-1 text-xs text-white/40">{label}</p>
        </div>
        <div className="grid size-9 place-items-center rounded-xl bg-[#2a1518] text-red-300">
          {icon}
        </div>
      </CardContent>
    </Card>
  )
}

function UserRow({
  user,
  roles,
  canManage,
  editing,
  selectedRoles,
  setSelectedRoles,
  onEdit,
  onCancel,
  onSave,
  saving,
}: {
  user: AuthUser
  roles: Role[]
  canManage: boolean
  editing: boolean
  selectedRoles: number[]
  setSelectedRoles: (value: number[]) => void
  onEdit: () => void
  onCancel: () => void
  onSave: () => void
  saving: boolean
}) {
  return (
    <>
      <tr className="group align-middle">
        <td className="px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="grid size-8 shrink-0 place-items-center rounded-full bg-white/[0.08] text-[10px] font-semibold text-white/70">
              {user.displayName.slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-xs font-medium text-white/85">
                  {user.displayName}
                </p>
                {user.isSuperAdmin && (
                  <Badge className="rounded-full bg-[#3b0e14] text-[10px] text-red-200">
                    Super admin
                  </Badge>
                )}
              </div>
              <p className="mt-0.5 truncate text-[11px] text-white/35">
                {user.email}
              </p>
            </div>
          </div>
        </td>
        <td className="px-4 py-4">
          <div className="flex max-w-[260px] flex-wrap gap-1.5">
            {user.isSuperAdmin ? (
              <Badge
                variant="outline"
                className="border-red-400/20 bg-[#3b1117] text-[10px] text-red-200"
              >
                Admin
              </Badge>
            ) : user.roles.length ? (
              user.roles.map((role) => (
                <Badge
                  key={role.id}
                  variant="outline"
                  className="border-white/[0.1] text-[10px] text-white/60"
                >
                  {role.name}
                </Badge>
              ))
            ) : (
              <span className="text-[11px] text-white/30">No role</span>
            )}
          </div>
        </td>
        <td className="px-4 py-4">
          <span className="text-[11px] text-white/45">
            {user.isSuperAdmin
              ? "Full access"
              : `${user.permissions.length} permissions`}
          </span>
        </td>
        <td className="px-5 py-4 text-right">
          {canManage && !user.isSuperAdmin && (
            <Button
              variant="outline"
              size="xs"
              onClick={editing ? onCancel : onEdit}
            >
              {editing ? "Cancel" : "Manage roles"}
            </Button>
          )}
        </td>
      </tr>
      {editing && (
        <tr className="border-b border-white/[0.06] bg-white/[0.02]">
          <td colSpan={4} className="px-5 pb-4">
            <div className="flex flex-col gap-3 rounded-xl border border-white/[0.08] bg-[#120f0f] p-3 sm:flex-row sm:items-center">
              <RolePicker
                roles={roles}
                selected={selectedRoles}
                onChange={setSelectedRoles}
                emptyLabel="Select roles"
              />
              <Button size="sm" disabled={saving} onClick={onSave}>
                <Check className="size-3.5" /> Save roles
              </Button>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

function RolePicker({
  roles,
  selected,
  onChange,
  emptyLabel,
}: {
  roles: Role[]
  selected: number[]
  onChange: (value: number[]) => void
  emptyLabel: string
}) {
  function toggle(roleId: number) {
    onChange(
      selected.includes(roleId)
        ? selected.filter((id) => id !== roleId)
        : [...selected, roleId]
    )
  }
  return (
    <div className="flex flex-1 flex-wrap items-center gap-1.5">
      <span className="mr-1 text-[11px] text-white/35">
        {selected.length ? "Roles:" : emptyLabel}
      </span>
      {roles.map((role) => (
        <button
          type="button"
          key={role.id}
          onClick={() => toggle(role.id)}
          className={`rounded-md border px-2 py-1 text-[10px] transition-colors ${selected.includes(role.id) ? "border-red-400/25 bg-[#3b1117] text-red-200" : "border-white/[0.08] text-white/45 hover:bg-white/[0.05]"}`}
        >
          {selected.includes(role.id) && (
            <Check className="mr-1 inline size-2.5" />
          )}
          {role.name}
        </button>
      ))}
    </div>
  )
}

function RoleForm({
  permissions,
  name,
  setName,
  description,
  setDescription,
  selected,
  setSelected,
  onSubmit,
  onCancel,
  saving,
}: {
  permissions: Permission[]
  name: string
  setName: (value: string) => void
  description: string
  setDescription: (value: string) => void
  selected: string[]
  setSelected: (value: string[]) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  onCancel: () => void
  saving: boolean
}) {
  return (
    <form className="space-y-3" onSubmit={onSubmit}>
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-white/85">New role</p>
        <button type="button" aria-label="Close" onClick={onCancel}>
          <X className="size-4 text-white/45" />
        </button>
      </div>
      <Input
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder="Role name"
        required
      />
      <Input
        value={description}
        onChange={(event) => setDescription(event.target.value)}
        placeholder="Short description"
      />
      <PermissionPicker
        permissions={permissions}
        selected={selected}
        onChange={setSelected}
        compact
      />
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={saving}>
          Create
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  )
}

function PermissionPicker({
  permissions,
  selected,
  onChange,
  compact = false,
}: {
  permissions: Permission[]
  selected: string[]
  onChange: (value: string[]) => void
  compact?: boolean
}) {
  function toggle(permission: string) {
    onChange(
      selected.includes(permission)
        ? selected.filter((item) => item !== permission)
        : [...selected, permission]
    )
  }
  return (
    <div className="space-y-2">
      <p className="text-[10px] tracking-[0.1em] text-white/35 uppercase">
        Permissions
      </p>
      <div
        className={`flex flex-wrap gap-1.5 ${compact ? "max-h-28 overflow-y-auto" : ""}`}
      >
        {permissions.map((permission) => (
          <button
            type="button"
            key={permission.key}
            onClick={() => toggle(permission.key)}
            className={`rounded-md border px-2 py-1 text-[10px] transition-colors ${selected.includes(permission.key) ? "border-red-400/25 bg-[#3b1117] text-red-200" : "border-white/[0.08] text-white/45 hover:bg-white/[0.05]"}`}
            title={permission.description}
          >
            {selected.includes(permission.key) && (
              <Check className="mr-1 inline size-2.5" />
            )}
            {permission.key}
          </button>
        ))}
      </div>
    </div>
  )
}
