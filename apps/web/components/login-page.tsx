"use client"

import { FormEvent, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowRight, Gamepad2 } from "lucide-react"

import { apiFetch } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

export function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [submitting, setSubmitting] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setError("")
    try {
      const response = await apiFetch("/api/v1/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      })
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null
        setError(payload?.error ?? "Could not sign in")
        return
      }
      router.replace("/")
    } catch {
      setError("API is unavailable. Start the local stack and try again.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="grid min-h-svh place-items-center bg-[#0d0b0b] p-4 text-[#f4f0ee]">
      <Card className="w-full max-w-sm rounded-2xl border-white/[0.08] bg-[#171313] shadow-2xl">
        <CardHeader className="gap-4">
          <div className="grid size-10 place-items-center rounded-full bg-[#d7192d] text-white"><Gamepad2 className="size-5" /></div>
          <div>
            <CardTitle className="text-xl text-white">Sign in to RustControl</CardTitle>
            <CardDescription className="mt-1 text-xs text-white/40">Use your operator account to continue.</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={submit}>
            <label className="block space-y-1.5 text-xs text-white/55">Email<Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" placeholder="you@example.com" required /></label>
            <label className="block space-y-1.5 text-xs text-white/55">Password<Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" placeholder="••••••••" required /></label>
            {error && <p role="alert" className="rounded-xl border border-red-400/20 bg-red-400/10 px-3 py-2 text-xs text-red-200">{error}</p>}
            <Button type="submit" className="w-full" disabled={submitting}>{submitting ? "Signing in…" : "Sign in"}<ArrowRight className="size-3.5" /></Button>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}
