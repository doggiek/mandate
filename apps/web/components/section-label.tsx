import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function SectionLabel({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'inline-flex items-center gap-2 rounded-full border border-border bg-card/50 px-3 py-1 font-mono text-xs uppercase tracking-widest text-muted-foreground',
        className,
      )}
    >
      <span className="size-1.5 rounded-full bg-primary" />
      {children}
    </div>
  )
}
