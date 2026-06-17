'use client'

import { useEffect, useState } from 'react'
import { ArrowRight, Play, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'

const ORDER_SIZE_SUI = 30
const MAX_EXECUTIONS = 16
const BUDGET_SUI = 500
const FINAL_EXECUTED_VOLUME = ORDER_SIZE_SUI * MAX_EXECUTIONS

type HeroStats = {
  executedVolume: number
  executions: number
  blocked: number
  rejected: boolean
}

function getAnimatedStats(): HeroStats {
  const cycleMs = 9000
  const elapsed = Date.now() % cycleMs
  const phase = elapsed / cycleMs
  const executionProgress = Math.min(phase / 0.72, 1)
  const executions = Math.floor(MAX_EXECUTIONS * executionProgress)
  const blocked = phase > 0.76 ? 1 : 0

  return {
    executedVolume: executions * ORDER_SIZE_SUI,
    executions,
    blocked,
    rejected: blocked === 1,
  }
}

const FINAL_STATS: HeroStats = {
  executedVolume: FINAL_EXECUTED_VOLUME,
  executions: MAX_EXECUTIONS,
  blocked: 1,
  rejected: false,
}

export function Hero() {
  const [stats, setStats] = useState<HeroStats>(FINAL_STATS)

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches

    if (prefersReducedMotion) {
      setStats(FINAL_STATS)
      return
    }

    setStats(getAnimatedStats())
    const interval = window.setInterval(() => {
      setStats(getAnimatedStats())
    }, 160)

    return () => window.clearInterval(interval)
  }, [])

  return (
    <section className="relative overflow-hidden pb-20 pt-32 sm:pb-28 sm:pt-40">
      <div className="pointer-events-none absolute inset-0 grid-faint [mask-image:radial-gradient(ellipse_60%_55%_at_50%_0%,black,transparent)]" />
      <div className="pointer-events-none absolute left-1/2 top-[-10%] -z-0 size-[640px] -translate-x-1/2 rounded-full bg-primary/12 blur-[140px]" />

      <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-4 sm:px-6 lg:grid-cols-[1.05fr_0.95fr]">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-xs text-muted-foreground backdrop-blur">
            <span className="size-1.5 rounded-full bg-primary" />
            Autonomous Agent Wallet · Sui
          </div>

          <h1 className="mt-6 text-balance text-4xl font-medium leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
            The permission layer for{' '}
            <span className="text-primary">autonomous agent</span> wallets
          </h1>

          <p className="mt-5 max-w-xl text-pretty text-xl font-medium leading-relaxed text-foreground">
            I don&apos;t delegate my wallet. I delegate a mandate.
          </p>

          <p className="mt-6 max-w-xl text-pretty text-lg leading-relaxed text-muted-foreground">
            AI agents are stuck at the approve wall. Mandate lets an owner
            sign once, grant a capped Move policy object, and let an agent
            execute real DeepBook PTBs within budget, scope, expiry, and
            revocation limits.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button
              size="lg"
              className="group bg-primary text-primary-foreground hover:bg-primary/90"
              nativeButton={false}
              render={<a href="/console" />}
            >
              Launch Console
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="border-border bg-transparent text-foreground hover:bg-card"
              nativeButton={false}
              render={<a href="#video" />}
            >
              <Play className="size-4" />
              Watch Video
            </Button>
          </div>

          <dl className="mt-12 grid max-w-lg grid-cols-3 gap-5 border-t border-border pt-6">
            {[
              { v: String(stats.executedVolume), k: 'Executed Volume' },
              { v: String(stats.executions), k: 'DeepBook Executions' },
              { v: String(stats.blocked), k: 'Blocked Actions' },
            ].map((s) => (
              <div key={s.k}>
                <dt className="font-mono text-xl font-semibold leading-none text-foreground sm:text-2xl">
                  {s.v}
                </dt>
                <dd className="mt-1 text-xs text-muted-foreground">{s.k}</dd>
              </div>
            ))}
          </dl>
        </div>

        <MandateCard stats={stats} />
      </div>
    </section>
  )
}

function MandateCard({ stats }: { stats: HeroStats }) {
  const progress = (stats.executedVolume / BUDGET_SUI) * 100

  return (
    <div className="glass relative rounded-2xl border border-border p-1.5 shadow-2xl shadow-black/40">
      <div className="rounded-xl border border-border bg-card/80 p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary/15 text-primary">
              <ShieldCheck className="size-4" />
            </span>
            <div>
              <p className="text-sm font-medium leading-none">Active mandate</p>
              <p className="mt-1 font-mono text-xs text-muted-foreground">
                0x7a3f...e9c4
              </p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs text-primary">
            <span className="size-1.5 rounded-full bg-primary" />
            Live
          </span>
        </div>

        <div className="mt-5">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Budget used</span>
            <span className="font-mono">
              {stats.executedVolume} / {BUDGET_SUI} SUI
            </span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-secondary">
            <div
              className={
                stats.rejected
                  ? 'h-full rounded-full bg-amber-300 transition-[width] duration-300'
                  : 'h-full rounded-full bg-primary transition-[width] duration-300'
              }
              style={{ width: `${progress}%` }}
            />
          </div>
          <p
            className={
              stats.rejected
                ? 'mt-2 min-h-4 text-xs text-amber-300'
                : 'mt-2 min-h-4 text-xs text-muted-foreground'
            }
          >
            {stats.rejected
              ? 'Blocked: next 30 SUI order would exceed the 500 SUI budget.'
              : `${stats.executions} DeepBook PTBs executed within policy.`}
          </p>
        </div>

        <dl className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border text-sm">
          {[
            { k: 'Agent', v: 'backend-trading-agent' },
            { k: 'Expires', v: 'in 6d 4h' },
            { k: 'Protocols', v: 'DeepBook only' },
            { k: 'Per-tx cap', v: '30 SUI' },
          ].map((row) => (
            <div key={row.k} className="bg-card px-3 py-2.5">
              <dt className="text-xs text-muted-foreground">{row.k}</dt>
              <dd className="mt-0.5 font-mono text-[13px] text-foreground">
                {row.v}
              </dd>
            </div>
          ))}
        </dl>

        <div className="mt-4 flex items-center gap-2">
          <button className="flex-1 rounded-lg border border-border bg-secondary px-3 py-2 text-sm transition-colors hover:bg-secondary/70">
            Adjust limits
          </button>
          <button className="flex-1 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive transition-colors hover:bg-destructive/20">
            Revoke
          </button>
        </div>
      </div>
    </div>
  )
}
