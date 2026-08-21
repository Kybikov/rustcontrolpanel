import type { ReactNode } from "react"

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string
  description: string
  action?: ReactNode
}) {
  return (
    <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div className="min-w-0">
        <p className="mb-2 text-[11px] font-medium tracking-[0.15em] text-white/35 uppercase">
          Rust Control
        </p>
        <h1 className="text-2xl font-semibold tracking-[-0.04em] text-white sm:text-[28px]">
          {title}
        </h1>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-white/45">
          {description}
        </p>
      </div>
      {action && <div className="w-full shrink-0 sm:w-auto">{action}</div>}
    </div>
  )
}

export function ConnectionBadge({
  connected = false,
}: {
  connected?: boolean
}) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "rounded-full border-white/[0.12] bg-white/[0.03] text-[11px] font-normal",
        connected ? "text-emerald-300" : "text-white/45"
      )}
    >
      <span
        className={cn(
          "size-1.5 rounded-full",
          connected ? "bg-emerald-400" : "bg-white/25"
        )}
      />
      {connected ? "Connected" : "Not connected"}
    </Badge>
  )
}
