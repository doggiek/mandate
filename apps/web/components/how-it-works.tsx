import { SectionLabel } from '@/components/section-label'

const steps = [
  {
    n: '01',
    title: 'Create a Mandate',
    body: 'Set budget, protocol scope, expiry, and max transaction size.',
  },
  {
    n: '02',
    title: 'Sign Once',
    body: 'Authorize the Mandate object. Your wallet keys stay with you.',
  },
  {
    n: '03',
    title: 'Agent Executes',
    body: 'The backend agent submits PTBs through the Mandate policy path.',
  },
  {
    n: '04',
    title: 'Monitor or Revoke',
    body: 'Review on-chain activity logs or revoke authority anytime.',
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
            Sign once. Execute within limits.
          </h2>
          <p className="mt-4 text-pretty text-lg leading-relaxed text-muted-foreground">
            The owner creates a capped Mandate once. After that, the agent can
            execute autonomously, but only inside the Move policy object.
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
