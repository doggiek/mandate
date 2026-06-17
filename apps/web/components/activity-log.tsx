'use client'

import { useEffect, useRef, useState } from 'react'
import { Check, X, ArrowUpRight } from 'lucide-react'
import { SectionLabel } from '@/components/section-label'
import { DEEPBOOK_POOL_KEY } from '@/lib/chain-config'
import { cn } from '@/lib/utils'

type Entry = {
  id: number
  time: string
  agent: string
  action: string
  amount: string
  protocol: string
  status: 'allowed' | 'blocked'
  reason?: string
}

const seed: Omit<Entry, 'id'>[] = [
  {
    time: '14:02:11',
    agent: 'mm-deepbook',
    action: 'authorize spend',
    amount: '0.001 SUI',
    protocol: 'DeepBook',
    status: 'allowed',
  },
  {
    time: '14:02:44',
    agent: 'mm-deepbook',
    action: `swap ${DEEPBOOK_POOL_KEY}`,
    amount: '0.001 SUI',
    protocol: 'DeepBook',
    status: 'allowed',
  },
  {
    time: '14:03:09',
    agent: 'mm-deepbook',
    action: `swap ${DEEPBOOK_POOL_KEY}`,
    amount: '0.200 SUI',
    protocol: 'DeepBook',
    status: 'blocked',
    reason: 'exceeds budget ceiling',
  },
  {
    time: '14:03:51',
    agent: 'mm-deepbook',
    action: 'ActivityEvent',
    amount: '0.001 SUI',
    protocol: 'DeepBook',
    status: 'allowed',
  },
  {
    time: '14:04:20',
    agent: 'mm-deepbook',
    action: `swap ${DEEPBOOK_POOL_KEY}`,
    amount: '0.050 SUI',
    protocol: 'DeepBook',
    status: 'blocked',
    reason: 'exceeds 0.01 SUI per-tx cap',
  },
  {
    time: '14:05:02',
    agent: 'owner-wallet',
    action: 'revoke mandate',
    amount: '0 SUI',
    protocol: 'DeepBook',
    status: 'allowed',
  },
]

export function ActivityLog() {
  const [entries, setEntries] = useState<Entry[]>([])
  const idx = useRef(0)
  const counter = useRef(0)

  useEffect(() => {
    const push = () => {
      const next = seed[idx.current % seed.length]
      counter.current += 1
      setEntries((prev) =>
        [{ ...next, id: counter.current }, ...prev].slice(0, 6),
      )
      idx.current += 1
    }
    push()
    const t = setInterval(push, 2200)
    return () => clearInterval(t)
  }, [])

  return (
    <section
      id="activity"
      className="relative border-t border-border py-20 sm:py-28"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="grid gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
          <div>
            <SectionLabel>Activity log</SectionLabel>
            <h2 className="mt-5 text-balance text-3xl font-medium tracking-tight sm:text-4xl">
              Every action produces proof
            </h2>
            <p className="mt-4 text-pretty text-lg leading-relaxed text-muted-foreground">
              Allowed actions execute. Blocked actions are recorded. Both are
              visible.
            </p>
            <ul className="mt-6 space-y-3 text-sm text-muted-foreground">
              {[
                'Execution records',
                'Policy violations',
                'Revocations',
                'On-chain history',
              ].map((item) => (
                <li key={item} className="flex items-center gap-2.5">
                  <span className="flex size-5 items-center justify-center rounded-full bg-primary/15 text-primary">
                    <Check className="size-3" />
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="glass overflow-hidden rounded-2xl border border-border">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-full bg-muted" />
                <span className="size-2.5 rounded-full bg-muted" />
                <span className="size-2.5 rounded-full bg-muted" />
              </div>
              <span className="font-mono text-xs text-muted-foreground">
                mandate · live feed
              </span>
              <span className="inline-flex items-center gap-1.5 font-mono text-xs text-primary">
                <span className="size-1.5 animate-pulse rounded-full bg-primary" />
                streaming
              </span>
            </div>

            <div className="divide-y divide-border">
              {entries.map((e) => (
                <div
                  key={e.id}
                  className="flex items-center gap-3 px-4 py-3 animate-in fade-in slide-in-from-top-2 duration-500"
                >
                  <span
                    className={cn(
                      'flex size-7 shrink-0 items-center justify-center rounded-md',
                      e.status === 'allowed'
                        ? 'bg-primary/15 text-primary'
                        : 'bg-destructive/15 text-destructive',
                    )}
                  >
                    {e.status === 'allowed' ? (
                      <Check className="size-3.5" />
                    ) : (
                      <X className="size-3.5" />
                    )}
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-muted-foreground">
                        {e.time}
                      </span>
                      <span className="truncate text-sm font-medium">
                        {e.agent}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {e.action} · {e.protocol}
                      {e.reason ? (
                        <span className="text-destructive"> — {e.reason}</span>
                      ) : null}
                    </p>
                  </div>

                  <span className="shrink-0 font-mono text-sm">{e.amount}</span>
                </div>
              ))}
            </div>

            <a
              href="#"
              className="flex items-center justify-center gap-1.5 border-t border-border px-4 py-3 text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              View full history
              <ArrowUpRight className="size-3.5" />
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}
