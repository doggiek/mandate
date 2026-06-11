import { SectionLabel } from '@/components/section-label'

const steps = [
  {
    n: '01',
    title: 'Define a mandate',
    body: 'Pick an agent and set the rules: a budget ceiling, DeepBook-only protocol scope, a per-transaction cap, and an expiration time.',
  },
  {
    n: '02',
    title: 'Sign once',
    body: 'You approve the mandate from your own wallet. Mandate deploys an on-chain policy object — your keys never leave your control.',
  },
  {
    n: '03',
    title: 'Agent transacts',
    body: 'The agent submits a PTB through the mandate. Every call is checked on-chain before the DeepBook order executes.',
  },
  {
    n: '04',
    title: 'Monitor & revoke',
    body: 'Watch every On-chain ActivityEvent and use Owner revocation to block future agent actions instantly.',
  },
]

export function HowItWorks() {
  return (
    <section
      id="how-it-works"
      className="relative border-t border-border py-20 sm:py-28"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="max-w-2xl">
          <SectionLabel>How Mandate works</SectionLabel>
          <h2 className="mt-5 text-balance text-3xl font-medium tracking-tight sm:text-4xl">
            Delegated authority, enforced by the chain
          </h2>
          <p className="mt-4 text-pretty text-lg leading-relaxed text-muted-foreground">
            Four steps from intent to autonomous execution — with hard limits
            the agent can never exceed.
          </p>
        </div>

        <ol className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((s) => (
            <li key={s.n} className="relative bg-card p-6 sm:p-7">
              <span className="font-mono text-sm text-primary">{s.n}</span>
              <h3 className="mt-4 text-lg font-medium">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {s.body}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
