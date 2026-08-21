"use client"

import { BellRing, LoaderCircle, Volume2, VolumeX } from "lucide-react"
import { useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import { apiFetch } from "@/lib/api"
import { setNotificationSoundEnabled } from "@/lib/notification-sound"

type PushState = "loading" | "enabled" | "disabled" | "blocked" | "unsupported"

export function PushAlertsControl({
  soundEnabled,
  onSoundChange,
}: {
  soundEnabled: boolean
  onSoundChange: (enabled: boolean) => void
}) {
  const [pushState, setPushState] = useState<PushState>(() =>
    supportsPush() ? "loading" : "unsupported"
  )
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState("")

  useEffect(() => {
    let active = true
    if (!supportsPush()) return
    navigator.serviceWorker
      .register("/sw.js")
      .then(async (registration) => {
        const subscription = await registration.pushManager.getSubscription()
        if (!active) return
        if (Notification.permission === "denied") {
          setPushState("blocked")
          return
        }
        setPushState(subscription ? "enabled" : "disabled")
      })
      .catch(() => {
        if (active) setPushState("unsupported")
      })
    return () => {
      active = false
    }
  }, [])

  async function togglePush() {
    if (pushState === "unsupported" || pushState === "blocked") return
    setBusy(true)
    setMessage("")
    try {
      const registration = await navigator.serviceWorker.ready
      const existing = await registration.pushManager.getSubscription()
      if (existing) {
        await apiFetch("/api/v1/push/subscriptions", {
          method: "DELETE",
          body: JSON.stringify({ endpoint: existing.endpoint }),
        })
        await existing.unsubscribe()
        setPushState("disabled")
        return
      }

      const permission = await Notification.requestPermission()
      if (permission !== "granted") {
        setPushState(permission === "denied" ? "blocked" : "disabled")
        return
      }
      const configResponse = await apiFetch("/api/v1/push/config")
      const config = (await configResponse.json().catch(() => null)) as {
        publicKey?: string
        error?: string
      } | null
      if (!configResponse.ok || !config?.publicKey) {
        setMessage(config?.error ?? "Push delivery is unavailable right now.")
        setPushState("disabled")
        return
      }
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: decodeBase64URL(config.publicKey),
      })
      const response = await apiFetch("/api/v1/push/subscriptions", {
        method: "POST",
        body: JSON.stringify(subscription),
      })
      if (!response.ok) {
        await subscription.unsubscribe()
        const payload = (await response.json().catch(() => null)) as {
          error?: string
        } | null
        setMessage(payload?.error ?? "Could not enable push delivery.")
        setPushState("disabled")
        return
      }
      setPushState("enabled")
    } catch {
      setMessage("Could not change push alerts on this device.")
    } finally {
      setBusy(false)
    }
  }

  async function toggleSound() {
    const next = !soundEnabled
    await setNotificationSoundEnabled(next)
    onSoundChange(next)
  }

  const pushLabel =
    pushState === "enabled"
      ? "Push alerts on"
      : pushState === "blocked"
        ? "Push blocked"
        : pushState === "unsupported"
          ? "Push unavailable"
          : "Enable push alerts"

  return (
    <div className="border-b border-white/[0.08] px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant={pushState === "enabled" ? "secondary" : "outline"}
          disabled={
            busy || pushState === "blocked" || pushState === "unsupported"
          }
          onClick={() => void togglePush()}
          className="rounded-xl"
        >
          {busy ? (
            <LoaderCircle className="size-3.5 animate-spin" />
          ) : (
            <BellRing className="size-3.5" />
          )}
          {pushLabel}
        </Button>
        <Button
          type="button"
          size="sm"
          variant={soundEnabled ? "secondary" : "outline"}
          onClick={() => void toggleSound()}
          className="rounded-xl"
        >
          {soundEnabled ? (
            <Volume2 className="size-3.5" />
          ) : (
            <VolumeX className="size-3.5" />
          )}
          Sound
        </Button>
      </div>
      {pushState === "enabled" && (
        <p className="mt-2 text-[11px] leading-4 text-white/40">
          This device receives status changes even when RustControl is closed.
        </p>
      )}
      {pushState === "blocked" && (
        <p className="mt-2 text-[11px] leading-4 text-amber-200/75">
          Allow notifications for this site in your browser settings to enable
          push alerts.
        </p>
      )}
      {message && (
        <p className="mt-2 text-[11px] leading-4 text-red-200/85">{message}</p>
      )}
    </div>
  )
}

function decodeBase64URL(value: string) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/")
  const padding = "=".repeat((4 - (base64.length % 4)) % 4)
  const raw = atob(base64 + padding)
  return Uint8Array.from(raw, (character) => character.charCodeAt(0))
}

function supportsPush() {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  )
}
