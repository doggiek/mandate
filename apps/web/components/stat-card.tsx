import { cn } from "@/lib/utils"
import { Card, CardContent } from "@/components/ui/card"
import type { LucideIcon } from "lucide-react"

export function StatCard({
  label,
  value,
  sublabel,
  icon: Icon,
  accent,
}: {
  label: string
  value: string
  sublabel?: string
  icon: LucideIcon
  accent?: "default" | "positive" | "warning" | "danger"
}) {
  const accentColor = {
    default: "text-primary",
    positive: "text-emerald-400",
    warning: "text-amber-400",
    danger: "text-destructive",
  }[accent ?? "default"]

  return (
    <Card className="gap-0 py-0">
      <CardContent className="flex flex-col gap-2 p-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">
            {label}
          </span>
          <Icon className={cn("size-4", accentColor)} />
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-xl font-semibold tabular-nums tracking-tight">
            {value}
          </span>
          {sublabel && (
            <span className="text-xs text-muted-foreground">{sublabel}</span>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
