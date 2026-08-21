import { AppShell } from "@/components/app-shell"
import { ServerDetailPage } from "@/components/server-detail-page"

export default async function Page({
  params,
}: {
  params: Promise<{ serverId: string }>
}) {
  const { serverId } = await params
  return (
    <AppShell>
      <ServerDetailPage serverId={serverId} />
    </AppShell>
  )
}
