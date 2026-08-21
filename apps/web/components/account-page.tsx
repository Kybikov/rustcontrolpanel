"use client"

import { FormEvent, useEffect, useState } from "react"
import {
  ExternalLink,
  KeyRound,
  Link2,
  LoaderCircle,
  Save,
  Unlink,
  UserRound,
} from "lucide-react"

import { apiFetch, type AuthUser, type SteamAccount } from "@/lib/api"
import { PageHeader } from "@/components/page-primitives"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"

export function AccountPage() {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [steam, setSteam] = useState<SteamAccount | null>(null)
  const [email, setEmail] = useState("")
  const [displayName, setDisplayName] = useState("")
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [loading, setLoading] = useState(true)
  const [savingProfile, setSavingProfile] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)
  const [linkingSteam, setLinkingSteam] = useState(false)
  const [disconnectingSteam, setDisconnectingSteam] = useState(false)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")

  useEffect(() => {
    let active = true

    async function loadAccount() {
      try {
        const [userResponse, steamResponse] = await Promise.all([
          apiFetch("/api/v1/auth/me"),
          apiFetch("/api/v1/auth/steam"),
        ])
        if (!active || !userResponse.ok) return

        const userPayload = (await userResponse.json()) as { user: AuthUser }
        setUser(userPayload.user)
        setEmail(userPayload.user.email)
        setDisplayName(userPayload.user.displayName)

        if (steamResponse.ok) {
          const steamPayload = (await steamResponse.json()) as {
            steam: SteamAccount | null
          }
          if (active) setSteam(steamPayload.steam)
        }

        const result = new URLSearchParams(window.location.search).get("steam")
        if (result === "connected") {
          setNotice(
            "Steam account connected. Rust+ pairing will use this account."
          )
        }
        if (result === "error") {
          setError("Steam link was not completed. Try again from this page.")
        }
        if (result) window.history.replaceState({}, "", "/account")
      } catch {
        if (active)
          setError("Could not load account details. Try refreshing the page.")
      } finally {
        if (active) setLoading(false)
      }
    }

    void loadAccount()
    return () => {
      active = false
    }
  }, [])

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSavingProfile(true)
    setError("")
    setNotice("")
    const response = await apiFetch("/api/v1/auth/profile", {
      method: "PATCH",
      body: JSON.stringify({ email, displayName }),
    })
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as {
        error?: string
      } | null
      setError(payload?.error ?? "Could not update account")
      setSavingProfile(false)
      return
    }
    const payload = (await response.json()) as { user: AuthUser }
    setUser(payload.user)
    setEmail(payload.user.email)
    setDisplayName(payload.user.displayName)
    setNotice("Account details updated")
    setSavingProfile(false)
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError("")
    setNotice("")
    if (newPassword !== confirmPassword) {
      setError("New passwords do not match")
      return
    }
    setSavingPassword(true)
    const response = await apiFetch("/api/v1/auth/password", {
      method: "POST",
      body: JSON.stringify({ currentPassword, newPassword }),
    })
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as {
        error?: string
      } | null
      setError(payload?.error ?? "Could not change password")
      setSavingPassword(false)
      return
    }
    setCurrentPassword("")
    setNewPassword("")
    setConfirmPassword("")
    setNotice("Password changed. Other sessions were signed out.")
    setSavingPassword(false)
  }

  async function connectSteam() {
    setLinkingSteam(true)
    setError("")
    setNotice("")
    try {
      const response = await apiFetch("/api/v1/auth/steam/link", {
        method: "POST",
      })
      const payload = (await response.json().catch(() => null)) as {
        error?: string
        url?: string
      } | null
      if (!response.ok || !payload?.url) {
        setError(payload?.error ?? "Could not start Steam linking")
        setLinkingSteam(false)
        return
      }
      window.location.assign(payload.url)
    } catch {
      setError("Could not reach Steam linking. Try again shortly.")
      setLinkingSteam(false)
    }
  }

  async function disconnectSteam() {
    setDisconnectingSteam(true)
    setError("")
    setNotice("")
    try {
      const response = await apiFetch("/api/v1/auth/steam", {
        method: "DELETE",
      })
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: string
        } | null
        setError(payload?.error ?? "Could not disconnect Steam account")
        return
      }
      setSteam(null)
      setNotice("Steam account disconnected from RustControl.")
    } catch {
      setError("Could not disconnect Steam account. Try again shortly.")
    } finally {
      setDisconnectingSteam(false)
    }
  }

  return (
    <>
      <PageHeader
        title="Account"
        description="Your profile, sign-in credentials, and player identity."
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
      {loading ? (
        <p className="text-xs text-white/40">Loading account…</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="rounded-2xl border-white/[0.08] bg-[#171313] shadow-none">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-[15px] text-white">
                <UserRound className="size-4 text-white/60" /> Profile
              </CardTitle>
              <CardDescription className="text-xs text-white/40">
                {user?.isSuperAdmin
                  ? "Super admin account with full access."
                  : "Your RustControl account details."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={saveProfile}>
                <label className="block space-y-1.5 text-xs text-white/55">
                  Display name
                  <Input
                    value={displayName}
                    onChange={(event) => setDisplayName(event.target.value)}
                    required
                  />
                </label>
                <label className="block space-y-1.5 text-xs text-white/55">
                  Email
                  <Input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                  />
                </label>
                <Button type="submit" disabled={savingProfile}>
                  {savingProfile ? (
                    <LoaderCircle className="animate-spin" />
                  ) : (
                    <Save />
                  )}
                  {savingProfile ? "Saving…" : "Save profile"}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-white/[0.08] bg-[#171313] shadow-none">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-[15px] text-white">
                <KeyRound className="size-4 text-white/60" /> Change password
              </CardTitle>
              <CardDescription className="text-xs text-white/40">
                Use at least 12 characters. Other sessions will be revoked.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={changePassword}>
                <label className="block space-y-1.5 text-xs text-white/55">
                  Current password
                  <Input
                    type="password"
                    value={currentPassword}
                    onChange={(event) => setCurrentPassword(event.target.value)}
                    required
                  />
                </label>
                <label className="block space-y-1.5 text-xs text-white/55">
                  New password
                  <Input
                    type="password"
                    minLength={12}
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    required
                  />
                </label>
                <label className="block space-y-1.5 text-xs text-white/55">
                  Confirm new password
                  <Input
                    type="password"
                    minLength={12}
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    required
                  />
                </label>
                <Button type="submit" disabled={savingPassword}>
                  {savingPassword ? (
                    <LoaderCircle className="animate-spin" />
                  ) : (
                    <KeyRound />
                  )}
                  {savingPassword ? "Changing…" : "Change password"}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-white/[0.08] bg-[#171313] shadow-none lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-[15px] text-white">
                <Link2 className="size-4 text-white/60" /> Steam account
              </CardTitle>
              <CardDescription className="max-w-2xl text-xs leading-5 text-white/40">
                Connect your Steam identity once. Steam handles sign-in
                directly; RustControl never receives your password. This is the
                account used for your future Rust+ servers.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 border-t border-white/[0.08] pt-5 sm:flex-row sm:items-center sm:justify-between">
              {steam ? (
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white/90">
                    Steam account connected
                  </p>
                  <p className="mt-1 text-xs text-white/42">
                    SteamID64 {steam.steamId} · linked{" "}
                    {formatLinkedAt(steam.linkedAt)}
                  </p>
                </div>
              ) : (
                <div>
                  <p className="text-sm font-medium text-white/90">
                    No Steam account connected
                  </p>
                  <p className="mt-1 text-xs text-white/42">
                    Needed before pairing personal Rust+ servers.
                  </p>
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                {steam?.profileUrl && (
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-xl"
                    onClick={() =>
                      window.open(
                        steam.profileUrl,
                        "_blank",
                        "noopener,noreferrer"
                      )
                    }
                  >
                    Open Steam <ExternalLink />
                  </Button>
                )}
                {steam ? (
                  <Button
                    type="button"
                    variant="destructive"
                    disabled={disconnectingSteam}
                    onClick={() => void disconnectSteam()}
                  >
                    {disconnectingSteam ? (
                      <LoaderCircle className="animate-spin" />
                    ) : (
                      <Unlink />
                    )}
                    {disconnectingSteam ? "Disconnecting…" : "Disconnect"}
                  </Button>
                ) : (
                  <Button
                    type="button"
                    disabled={linkingSteam}
                    onClick={() => void connectSteam()}
                  >
                    {linkingSteam ? (
                      <LoaderCircle className="animate-spin" />
                    ) : (
                      <Link2 />
                    )}
                    {linkingSteam ? "Opening Steam…" : "Connect Steam"}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  )
}

function formatLinkedAt(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "recently"
  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date)
}
