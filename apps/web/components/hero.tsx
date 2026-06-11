import { ArrowRight, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function Hero() {
  return (
    <section className="relative overflow-hidden pb-20 pt-32 sm:pb-28 sm:pt-40">
      {/* faint grid + radial glow */}
      <div className="pointer-events-none absolute inset-0 grid-faint [mask-image:radial-gradient(ellipse_60%_55%_at_50%_0%,black,transparent)]" />
      <div className="pointer-events-none absolute left-1/2 top-[-10%] -z-0 size-[640px] -translate-x-1/2 rounded-full bg-primary/12 blur-[140px]" />

      <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-4 sm:px-6 lg:grid-cols-[1.05fr_0.95fr]">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-xs text-muted-foreground backdrop-blur">
            <span className="size-1.5 rounded-full bg-primary" />
            Now live on Sui mainnet
          </div>

          <h1 className="mt-6 text-balance text-4xl font-medium leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
            The permission layer for{' '}
            <span className="text-primary">autonomous agent</span> wallets
          </h1>

          <p className="mt-6 max-w-xl text-pretty text-lg leading-relaxed text-muted-foreground">
            Mandate lets you grant AI agents precise, revocable spending
            authority on Sui. Set budget ceilings, restrict protocols, and
            execute real DeepBook PTBs without ever handing over your keys.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button
              size="lg"
              className="group bg-primary text-primary-foreground hover:bg-primary/90"
              nativeButton={false}
              render={<a href="/console" />}
            >
              Request access
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="border-border bg-transparent text-foreground hover:bg-card"
              nativeButton={false}
              render={<a href="/console" />}
            >
              Read the docs
            </Button>
          </div>

          <dl className="mt-12 grid max-w-md grid-cols-3 gap-6 border-t border-border pt-6">
            {[
              { v: '0', k: 'Keys exposed' },
              { v: '<400ms', k: 'Authorization' },
              { v: '100%', k: 'On-chain enforced' },
            ].map((s) => (
              <div key={s.k}>
                <dt className="font-mono text-xl text-foreground">{s.v}</dt>
                <dd className="mt-1 text-xs text-muted-foreground">{s.k}</dd>
              </div>
            ))}
          </dl>
        </div>

        <MandateCard />
      </div>
    </section>
  )
}

function MandateCard() {
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
                0x7a3f…e9c4
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
            <span className="font-mono">142.5 / 500 SUI</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-secondary">
            <div className="h-full w-[28%] rounded-full bg-primary" />
          </div>
        </div>

        <dl className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border text-sm">
          {[
            { k: 'Agent', v: 'yield-optimizer-v2' },
            { k: 'Expires', v: 'in 6d 4h' },
            { k: 'Protocols', v: 'DeepBook only' },
            { k: 'Per-tx cap', v: '0.01 SUI' },
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
