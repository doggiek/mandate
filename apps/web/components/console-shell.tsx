"use client"

import * as React from "react"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { Button } from "@/components/ui/button"
import { AppSidebar } from "@/components/app-sidebar"
import { WalletConnectButton } from "@/components/wallet-connect-button"
import { OverviewView } from "@/components/views/overview-view"
import { MandatesView } from "@/components/views/mandates-view"
import { ActivityView } from "@/components/views/activity-view"
import { OrdersView } from "@/components/views/orders-view"
import { AutomationView } from "@/components/views/automation-view"
import { CreateMandateDialog } from "@/components/create-mandate-dialog"
import { MandateDetailSheet } from "@/components/mandate-detail-sheet"
import { MandateStoreProvider } from "@/lib/mandate-store"
import { Plus } from "lucide-react"
import { usePathname, useRouter } from "next/navigation"

export type ConsoleView =
  | "overview"
  | "automation"
  | "mandates"
  | "activity"
  | "orders"

const VIEW_TITLES: Record<ConsoleView, { title: string; subtitle: string }> = {
  overview: {
    title: "Overview",
    subtitle: "Delegated spending authority across all agents",
  },
  automation: {
    title: "Automation",
    subtitle: "Configure test runs and interval execution",
  },
  mandates: {
    title: "Mandates",
    subtitle: "Create, inspect, and revoke agent permissions",
  },
  activity: {
    title: "Activity Log",
    subtitle: "Every on-chain action attributed to a mandate",
  },
  orders: {
    title: "DeepBook Orders",
    subtitle: "Order flow executed under active mandates",
  },
}

export function ConsoleShell({
  initialView = "overview",
}: {
  initialView?: ConsoleView
}) {
  const pathname = usePathname()
  const router = useRouter()
  const [createOpen, setCreateOpen] = React.useState(false)
  const [detailId, setDetailId] = React.useState<string | null>(null)
  const [revokeRequest, setRevokeRequest] = React.useState<{
    mandateId: string
    nonce: number
  } | null>(null)

  const view = React.useMemo<ConsoleView>(() => {
    if (pathname === "/console/mandates") return "mandates"
    if (pathname === "/console/automation") return "automation"
    if (pathname === "/console/activity") return "activity"
    if (pathname === "/console/orders") return "orders"
    if (pathname === "/console/overview") return "overview"
    return initialView
  }, [initialView, pathname])
  const meta = VIEW_TITLES[view]

  return (
    <MandateStoreProvider>
      <SidebarProvider>
        <AppSidebar view={view} />
        <SidebarInset>
          <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur-md md:px-6">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-1 h-5" />
            <div className="flex min-w-0 flex-col">
              <h1 className="truncate text-sm font-semibold leading-tight">
                {meta.title}
              </h1>
              <p className="hidden truncate text-xs text-muted-foreground leading-tight sm:block">
                {meta.subtitle}
              </p>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <Button
                size="sm"
                onClick={() => setCreateOpen(true)}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <Plus data-icon="inline-start" />
                <span className="hidden sm:inline">Create Mandate</span>
                <span className="sm:hidden">Create</span>
              </Button>
              <Separator orientation="vertical" className="h-6" />
              <WalletConnectButton showNetwork />
            </div>
          </header>

          <main className="flex-1 overflow-y-auto bg-background">
            <div className="mx-auto w-full max-w-6xl px-4 py-6 md:px-6 md:py-8">
              {view === "overview" && (
                <OverviewView
                  onSelectMandate={setDetailId}
                  onCreate={() => setCreateOpen(true)}
                  onViewAll={() => router.push("/console/mandates")}
                />
              )}
              {view === "automation" && <AutomationView />}
              {view === "mandates" && (
                <MandatesView
                  onSelectMandate={setDetailId}
                  onCreate={() => setCreateOpen(true)}
                  onRevokeMandate={(mandateId) => {
                    setDetailId(mandateId)
                    setRevokeRequest({ mandateId, nonce: Date.now() })
                  }}
                />
              )}
              {view === "activity" && <ActivityView />}
              {view === "orders" && <OrdersView />}
            </div>
          </main>
        </SidebarInset>
      </SidebarProvider>

      <CreateMandateDialog open={createOpen} onOpenChange={setCreateOpen} />
      <MandateDetailSheet
        mandateId={detailId}
        startRevokeNonce={
          revokeRequest?.mandateId === detailId ? revokeRequest.nonce : undefined
        }
        onOpenChange={(open) => !open && setDetailId(null)}
      />
    </MandateStoreProvider>
  )
}
