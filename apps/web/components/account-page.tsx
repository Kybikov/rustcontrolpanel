"use client"

import { FormEvent, useEffect, useState } from "react"
import { KeyRound, Save, UserRound } from "lucide-react"

import { apiFetch, type AuthUser } from "@/lib/api"
import { PageHeader } from "@/components/page-primitives"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

export function AccountPage() {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [email, setEmail] = useState("")
  const [displayName, setDisplayName] = useState("")
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [loading, setLoading] = useState(true)
  const [savingProfile, setSavingProfile] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")

  useEffect(() => {
    let active = true
    apiFetch("/api/v1/auth/me")
      .then(async (response) => {
        if (!response.ok) return
        const payload = (await response.json()) as { user: AuthUser }
        if (!active) return
        setUser(payload.user)
        setEmail(payload.user.email)
        setDisplayName(payload.user.displayName)
        setLoading(false)
      })
      .catch(() => undefined)
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
      const payload = (await response.json().catch(() => null)) as { error?: string } | null
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
      const payload = (await response.json().catch(() => null)) as { error?: string } | null
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

  return (
    <>
      <PageHeader title="Account" description="Update your operator details and sign-in credentials." />
      {error && <p role="alert" className="mb-4 rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-xs text-red-200">{error}</p>}
      {notice && <p className="mb-4 rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-xs text-emerald-200">{notice}</p>}
      {loading ? <p className="text-xs text-white/40">Loading account…</p> : <div className="grid gap-4 lg:grid-cols-2">
        <Card className="rounded-2xl border-white/[0.08] bg-[#171313] shadow-none">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-[15px] text-white"><UserRound className="size-4 text-white/60" /> Profile</CardTitle>
            <CardDescription className="text-xs text-white/40">{user?.isSuperAdmin ? "Super admin account with full access." : "Your operator account details."}</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={saveProfile}>
              <label className="block space-y-1.5 text-xs text-white/55">Display name<Input value={displayName} onChange={(event) => setDisplayName(event.target.value)} required /></label>
              <label className="block space-y-1.5 text-xs text-white/55">Email<Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
              <Button type="submit" disabled={savingProfile}><Save className="size-3.5" />{savingProfile ? "Saving…" : "Save profile"}</Button>
            </form>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-white/[0.08] bg-[#171313] shadow-none">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-[15px] text-white"><KeyRound className="size-4 text-white/60" /> Change password</CardTitle>
            <CardDescription className="text-xs text-white/40">Use at least 12 characters. Other sessions will be revoked.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={changePassword}>
              <label className="block space-y-1.5 text-xs text-white/55">Current password<Input type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required /></label>
              <label className="block space-y-1.5 text-xs text-white/55">New password<Input type="password" minLength={12} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} required /></label>
              <label className="block space-y-1.5 text-xs text-white/55">Confirm new password<Input type="password" minLength={12} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required /></label>
              <Button type="submit" disabled={savingPassword}><KeyRound className="size-3.5" />{savingPassword ? "Changing…" : "Change password"}</Button>
            </form>
          </CardContent>
        </Card>
      </div>}
    </>
  )
}
