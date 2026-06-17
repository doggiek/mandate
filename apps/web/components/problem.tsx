import { KeyRound, Infinity as InfinityIcon, EyeOff } from 'lucide-react'
import { SectionLabel } from '@/components/section-label'

const problems = [
  {
    icon: KeyRound,
    title: 'Approval wall',
    body: 'Every swap, rebalance, or strategy step waits for a human signature. The agent can reason, but it cannot keep operating.',
  },
  {
    icon: InfinityIcon,
    title: 'Over-powered agent wallet',
    body: 'Putting a private key or hot wallet behind an agent gives it too much authority. Once funded, the agent is hard to constrain or revoke safely.',
  },
  {
    icon: EyeOff,
    title: 'No audit trail',
    body: 'If execution happens off-policy, users need proof. Real DeepBook orders, blocked attempts, and revocations should be recorded as on-chain activity.',
  },
]

export function Problem() {
  return (
    <section id="problem" className="relative border-t border-border py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="max-w-2xl">
          <SectionLabel>The problem</SectionLabel>
          <h2 className="mt-5 text-balance text-3xl font-medium tracking-tight sm:text-4xl">
            Every AI agent eventually hits the same wall:
            <br />
            Please sign this transaction.
          </h2>
          <p className="mt-4 text-pretty text-lg leading-relaxed text-muted-foreground">
            Autonomous agents can reason and act, but wallets still force a
            binary choice: approve every action manually, or give the agent too
            much control.
          </p>
        </div>

        <div className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-border bg-border md:grid-cols-3">
          {problems.map((p) => (
            <div key={p.title} className="bg-card p-6 sm:p-8">
              <span className="flex size-10 items-center justify-center rounded-lg border border-primary/25 bg-primary/10 text-primary">
                <p.icon className="size-5" />
              </span>
              <h3 className="mt-5 text-lg font-medium">{p.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {p.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
