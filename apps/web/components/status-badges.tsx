import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import type {
  ActivityKind,
  ExecutionStatus,
  MandateStatus,
} from "@/lib/mandate-data"

const STATUS_STYLES: Record<MandateStatus, string> = {
  active:
    "border-emerald-500/25 bg-emerald-500/10 text-emerald-400",
  expired: "border-muted-foreground/20 bg-muted text-muted-foreground",
  revoked: "border-destructive/30 bg-destructive/10 text-destructive",
}

const STATUS_LABEL: Record<MandateStatus, string> = {
  active: "Active",
  expired: "Expired",
  revoked: "Revoked",
}

export function StatusBadge({ status }: { status: MandateStatus }) {
  return (
    <Badge
      variant="outline"
      className={cn("gap-1.5 font-medium", STATUS_STYLES[status])}
    >
      <span
        className={cn(
          "size-1.5 rounded-full",
          status === "active" && "bg-emerald-400",
          status === "expired" && "bg-muted-foreground",
          status === "revoked" && "bg-destructive"
        )}
      />
      {STATUS_LABEL[status]}
    </Badge>
  )
}

const ORDER_STYLES: Record<ExecutionStatus, string> = {
  executed: "border-emerald-500/25 bg-emerald-500/10 text-emerald-400",
  success: "border-emerald-500/25 bg-emerald-500/10 text-emerald-400",
  failed: "border-destructive/30 bg-destructive/10 text-destructive",
}

export function OrderStatusBadge({ status }: { status: ExecutionStatus }) {
  return (
    <Badge variant="outline" className={cn("font-medium capitalize", ORDER_STYLES[status])}>
      {status === "failed" ? "Failed" : "Executed"}
    </Badge>
  )
}

const ACTIVITY_STYLES: Record<ActivityKind, { label: string; className: string }> = {
  "tx.executed": {
    label: "Executed",
    className: "border-emerald-500/25 bg-emerald-500/10 text-emerald-400",
  },
  "tx.blocked": {
    label: "Blocked",
    className: "border-destructive/30 bg-destructive/10 text-destructive",
  },
  "mandate.created": {
    label: "Created",
    className: "border-sky-500/25 bg-sky-500/10 text-sky-400",
  },
  "mandate.revoked": {
    label: "Revoked",
    className: "border-destructive/30 bg-destructive/10 text-destructive",
  },
}

export function ActivityBadge({ kind }: { kind: ActivityKind }) {
  const { label, className } = ACTIVITY_STYLES[kind]
  return (
    <Badge variant="outline" className={cn("font-medium", className)}>
      {label}
    </Badge>
  )
}
