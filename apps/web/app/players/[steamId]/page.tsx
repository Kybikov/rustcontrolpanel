import { AppShell } from "@/components/app-shell"
import { PlayerDetailPage } from "@/components/player-detail-page"

export default async function Page({
  params,
}: {
  params: Promise<{ steamId: string }>
}) {
  const { steamId } = await params
  return (
    <AppShell>
      <PlayerDetailPage steamId={steamId} />
    </AppShell>
  )
}
