"use client"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import {
  Activity,
  BookOpen,
  LayoutDashboard,
  ScrollText,
  ShieldCheck,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { ConsoleView } from "@/components/console-shell"

const NAV: { view: ConsoleView; label: string; icon: typeof LayoutDashboard }[] = [
  { view: "overview", label: "Overview", icon: LayoutDashboard },
  { view: "mandates", label: "Mandates", icon: ShieldCheck },
  { view: "activity", label: "Activity Log", icon: ScrollText },
  { view: "orders", label: "DeepBook Orders", icon: BookOpen },
]

export function AppSidebar({
  view,
  onNavigate,
}: {
  view: ConsoleView
  onNavigate: (v: ConsoleView) => void
}) {
  return (
    <Sidebar collapsible="icon" className="border-sidebar-border">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-2.5 px-1.5 py-1.5">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <ShieldCheck className="size-4.5" />
          </div>
          <div className="flex min-w-0 flex-col group-data-[collapsible=icon]:hidden">
            <span className="truncate text-sm font-semibold leading-tight">
              Mandate
            </span>
            <span className="truncate text-xs text-muted-foreground leading-tight">
              Console · Sui
            </span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Platform</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV.map((item) => (
                <SidebarMenuItem key={item.view}>
                  <SidebarMenuButton
                    isActive={view === item.view}
                    tooltip={item.label}
                    onClick={() => onNavigate(item.view)}
                  >
                    <item.icon />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <div
          className={cn(
            "flex items-center gap-2 rounded-lg px-2 py-2",
            "group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
          )}
        >
          <span className="relative flex size-2 shrink-0">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400/60" />
            <span className="relative inline-flex size-2 rounded-full bg-emerald-400" />
          </span>
          <div className="flex min-w-0 flex-col group-data-[collapsible=icon]:hidden">
            <span className="truncate text-xs font-medium">Mainnet</span>
            <span className="truncate text-[11px] text-muted-foreground">
              <Activity className="mr-1 inline size-3 align-[-1px]" />
              Indexer synced
            </span>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
