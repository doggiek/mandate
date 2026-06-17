import { Wallet, Network, Timer, Ban } from 'lucide-react'
import { SectionLabel } from '@/components/section-label'

const controls = [
  {
    icon: Wallet,
    title: 'Budget',
    body: 'Cap total spend over the life of a Mandate. Once the ceiling is hit, the agent stops.',
    detail: 'maxBudget: 500 SUI',
  },
  {
    icon: Network,
    title: 'Protocol',
    body: 'Scope the agent to approved execution routes. Everything else is rejected by policy.',
    detail: 'allow: [DeepBook]',
  },
  {
    icon: Timer,
    title: 'Expiration',
    body: 'Mandates are time-boxed. Authority lapses automatically at expiry.',
    detail: 'expiresAt: 7d',
  },
  {
    icon: Ban,
    title: 'Revocation',
    body: 'Revoke a Mandate from the Owner wallet and block future agent actions.',
    detail: 'revoke(mandateId)',
  },
]

export function SecurityControls() {
  return (
    <section
      id="security"
      className="relative border-t border-border py-20 sm:py-28"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="max-w-2xl">
          <SectionLabel>Security controls</SectionLabel>
          <h2 className="mt-5 text-balance text-3xl font-medium tracking-tight sm:text-4xl">
            Four limits. One mandate.
          </h2>
          <p className="mt-4 text-pretty text-lg leading-relaxed text-muted-foreground">
            Budget, protocol, expiration and revocation are enforced by Move
            objects. Not UI promises.
          </p>
        </div>

        <div className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-border bg-border md:grid-cols-2">
          {controls.map((c) => (
            <div key={c.title} className="group bg-card p-6 sm:p-8">
              <div className="flex items-start justify-between gap-4">
                <span className="flex size-10 items-center justify-center rounded-lg border border-border bg-secondary text-primary">
                  <c.icon className="size-5" />
                </span>
                <code className="rounded-md border border-border bg-background/60 px-2.5 py-1 font-mono text-xs text-muted-foreground">
                  {c.detail}
                </code>
              </div>
              <h3 className="mt-5 text-lg font-medium">{c.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {c.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
