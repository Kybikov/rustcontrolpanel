"use client"

import { type FormEvent, type ReactNode, useEffect, useState } from "react"
import Image from "next/image"
import {
  Clock3,
  ExternalLink,
  Gamepad2,
  KeyRound,
  Link2,
  LoaderCircle,
  Save,
  Unlink,
  UserRound,
  UsersRound,
} from "lucide-react"

import {
  apiFetch,
  type AuthUser,
  type SteamAccount,
  type SteamAccountProfile,
} from "@/lib/api"
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
  const [steamProfile, setSteamProfile] = useState<SteamAccountProfile | null>(
    null
  )
  const [steamProfileError, setSteamProfileError] = useState("")
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
        const [userResponse, steamResponse, steamProfileResponse] =
          await Promise.all([
            apiFetch("/api/v1/auth/me"),
            apiFetch("/api/v1/auth/steam"),
            apiFetch("/api/v1/auth/steam/profile"),
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
        if (steamProfileResponse.ok) {
          const steamProfilePayload = (await steamProfileResponse.json()) as {
            profile: SteamAccountProfile
          }
          if (active) setSteamProfile(steamProfilePayload.profile)
        } else if (steamResponse.ok) {
          const steamProfilePayload = (await steamProfileResponse
            .json()
            .catch(() => null)) as { error?: string } | null
          if (active)
            setSteamProfileError(
              steamProfilePayload?.error ?? "Live Steam data is unavailable."
            )
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
      setSteamProfile(null)
      setSteamProfileError("")
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
            <CardContent className="border-t border-white/[0.08] py-0">
              {steam ? (
                <div>
                  {steamProfile ? (
                    <div className="grid border-b border-white/[0.08] sm:grid-cols-[minmax(0,1fr)_auto]">
                      <div className="flex min-w-0 items-center gap-3 py-5">
                        {steamProfile.avatarUrl ? (
                          <Image
                            src={steamProfile.avatarUrl}
                            alt=""
                            width={48}
                            height={48}
                            className="size-12 rounded-full border border-white/10 object-cover"
                          />
                        ) : (
                          <div className="grid size-12 shrink-0 place-items-center rounded-full border border-white/10 bg-white/[0.06] text-white/50">
                            <UserRound className="size-5" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="truncate text-base font-semibold text-white">
                            {steamProfile.displayName || "Steam player"}
                          </p>
                          <p className="mt-0.5 text-xs text-white/45">
                            {steamPresenceLabel(steamProfile.presence)} ·
                            SteamID64 {steam.steamId}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 border-t border-white/[0.08] py-3 sm:border-t-0 sm:border-l sm:pl-5">
                        {(steamProfile.profileUrl || steam.profileUrl) && (
                          <Button
                            type="button"
                            variant="outline"
                            className="rounded-xl"
                            onClick={() =>
                              window.open(
                                steamProfile.profileUrl || steam.profileUrl,
                                "_blank",
                                "noopener,noreferrer"
                              )
                            }
                          >
                            Open Steam <ExternalLink />
                          </Button>
                        )}
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
                      </div>
                    </div>
                  ) : (
                    <div className="grid border-b border-white/[0.08] sm:grid-cols-[minmax(0,1fr)_auto]">
                      <div className="py-5">
                        <p className="text-sm font-medium text-white/90">
                          Steam account connected
                        </p>
                        <p className="mt-1 text-xs text-white/42">
                          SteamID64 {steam.steamId} · linked{" "}
                          {formatLinkedAt(steam.linkedAt)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 border-t border-white/[0.08] py-3 sm:border-t-0 sm:border-l sm:pl-5">
                        {steam.profileUrl && (
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
                      </div>
                    </div>
                  )}

                  {steamProfile ? (
                    <dl className="grid divide-y divide-white/[0.08] border-b border-white/[0.08] sm:grid-cols-3 sm:divide-x sm:divide-y-0">
                      <SteamFact
                        icon={<Clock3 />}
                        label="Time in Rust"
                        value={formatRustPlaytime(steamProfile)}
                      />
                      <SteamFact
                        icon={<UsersRound />}
                        label="Friends playing Rust"
                        value={formatFriendsPlayingRust(steamProfile)}
                      />
                      <SteamFact
                        icon={<Gamepad2 />}
                        label="Steam status"
                        value={steamCurrentStatus(steamProfile)}
                      />
                    </dl>
                  ) : steamProfileError ? (
                    <p className="border-b border-white/[0.08] py-4 text-xs text-white/45">
                      {steamProfileError}
                    </p>
                  ) : null}

                  <div className="flex min-h-14 items-center py-3">
                    <p className="text-xs text-white/42">
                      Linked {formatLinkedAt(steam.linkedAt)}
                      {steamProfile?.profileCreatedAt
                        ? ` · Steam since ${formatLinkedAt(steamProfile.profileCreatedAt)}`
                        : ""}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-4 py-5 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-medium text-white/90">
                      No Steam account connected
                    </p>
                    <p className="mt-1 text-xs text-white/42">
                      Needed before pairing personal Rust+ servers.
                    </p>
                  </div>
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
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </>
  )
}

function SteamFact({
  icon,
  label,
  value,
}: {
  icon: ReactNode
  label: string
  value: string
}) {
  return (
    <div className="flex min-h-20 min-w-0 items-center gap-2.5 py-4 first:pt-4 last:pb-4 sm:px-5 sm:py-4 sm:first:pl-0 sm:last:pr-0">
      <span className="text-white/38 [&>svg]:size-4">{icon}</span>
      <div className="min-w-0">
        <dt className="text-[11px] text-white/42">{label}</dt>
        <dd className="mt-0.5 truncate text-sm font-medium text-white/88">
          {value}
        </dd>
      </div>
    </div>
  )
}

function formatRustPlaytime(profile: SteamAccountProfile) {
  if (profile.rustPlaytimeStatus === "private") return "Private in Steam"
  if (profile.rustPlaytimeStatus === "not_owned") return "Rust not in library"
  if (
    profile.rustPlaytimeStatus !== "available" ||
    profile.rustPlaytimeMinutes === null
  ) {
    return "Unavailable now"
  }
  const hours = Math.floor(profile.rustPlaytimeMinutes / 60)
  const minutes = profile.rustPlaytimeMinutes % 60
  return hours > 0
    ? `${hours.toLocaleString()} h ${minutes} min`
    : `${minutes} min`
}

function formatFriendsPlayingRust(profile: SteamAccountProfile) {
  if (profile.friendsStatus === "private") return "Private in Steam"
  if (
    profile.friendsStatus !== "available" ||
    profile.friendsPlayingRust === null
  ) {
    return "Unavailable now"
  }
  return profile.friendsPlayingRust === 1
    ? "1 friend online"
    : `${profile.friendsPlayingRust} friends online`
}

function steamCurrentStatus(profile: SteamAccountProfile) {
  return profile.currentGame || steamPresenceLabel(profile.presence)
}

function steamPresenceLabel(presence: string) {
  const labels: Record<string, string> = {
    online: "Online",
    busy: "Busy",
    away: "Away",
    snooze: "Snooze",
    offline: "Offline",
  }
  return labels[presence] ?? "Online"
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
