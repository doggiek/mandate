import { KeyRound, Infinity as InfinityIcon, EyeOff } from 'lucide-react'
import { SectionLabel } from '@/components/section-label'

const problems = [
  {
    icon: KeyRound,
    title: 'All-or-nothing keys',
    body: 'To let an agent transact, you hand it a private key or a session that can drain the entire wallet. One prompt injection and the funds are gone.',
  },
  {
    icon: InfinityIcon,
    title: 'No spending limits',
    body: 'Approvals are unbounded by default. There is no native concept of a budget, a per-transaction cap, or an expiry that the chain enforces for you.',
  },
  {
    icon: EyeOff,
    title: 'Zero visibility',
    body: 'Once delegated, agent activity is opaque. You cannot see what was spent, where, or revoke a single agent without rotating everything.',
  },
]

export function Problem() {
  return (
    <section id="problem" className="relative border-t border-border py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="max-w-2xl">
          <SectionLabel>The problem</SectionLabel>
          <h2 className="mt-5 text-balance text-3xl font-medium tracking-tight sm:text-4xl">
            Agents need money. Giving them your keys is reckless.
          </h2>
          <p className="mt-4 text-pretty text-lg leading-relaxed text-muted-foreground">
            Autonomous agents are starting to transact on-chain — but today the
            only way to fund them breaks every principle of least privilege.
          </p>
        </div>

        <div className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-border bg-border md:grid-cols-3">
          {problems.map((p) => (
            <div key={p.title} className="bg-card p-6 sm:p-8">
              <span className="flex size-10 items-center justify-center rounded-lg border border-border bg-secondary text-muted-foreground">
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
