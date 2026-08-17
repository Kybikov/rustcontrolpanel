"use client"

import { useEffect, useState } from "react"
import { Radio, Wifi, WifiOff } from "lucide-react"

import { Badge } from "@/components/ui/badge"

type ConnectionState = "connecting" | "connected" | "offline"

function realtimeURL() {
  if (process.env.NEXT_PUBLIC_REALTIME_URL) {
    return process.env.NEXT_PUBLIC_REALTIME_URL
  }

  if (typeof window === "undefined") {
    return ""
  }

  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:"
  return `${protocol}//${window.location.hostname}:8080/api/v1/realtime/ws`
}

export function RealtimeIndicator() {
  const [state, setState] = useState<ConnectionState>("connecting")

  useEffect(() => {
    const url = realtimeURL()
    const socket = new WebSocket(url)
    socket.onopen = () => setState("connected")
    socket.onclose = () => setState("offline")
    socket.onerror = () => setState("offline")

    return () => socket.close()
  }, [])

  const connected = state === "connected"
  const connecting = state === "connecting"

  return (
    <Badge
      variant="outline"
      className="gap-1.5 rounded-full border-border/70 bg-background/50 px-2.5 py-1 text-[11px] font-medium"
    >
      {connected ? (
        <Wifi className="size-3 text-emerald-400" />
      ) : connecting ? (
        <Radio className="size-3 animate-pulse text-amber-400" />
      ) : (
        <WifiOff className="size-3 text-muted-foreground" />
      )}
      <span>{connected ? "Realtime live" : connecting ? "Connecting" : "Offline"}</span>
    </Badge>
  )
}
