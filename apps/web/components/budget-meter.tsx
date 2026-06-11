import { cn } from "@/lib/utils"
import { formatUsd } from "@/lib/format"

export function BudgetMeter({
  spent,
  budget,
  className,
  showLabel = true,
}: {
  spent: number
  budget: number
  className?: string
  showLabel?: boolean
}) {
  const pct = budget > 0 ? Math.min(100, (spent / budget) * 100) : 0
  const tone =
    pct >= 95
      ? "bg-destructive"
      : pct >= 80
        ? "bg-amber-400"
        : "bg-primary"

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {showLabel && (
        <div className="flex items-center justify-between text-xs">
          <span className="font-medium tabular-nums">
            {formatUsd(spent, { compact: true })}
          </span>
          <span className="text-muted-foreground tabular-nums">
            {formatUsd(budget, { compact: true })}
          </span>
        </div>
      )}
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full transition-all", tone)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
