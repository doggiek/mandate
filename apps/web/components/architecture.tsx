import { Bot, FileCheck2, ShieldCheck, Wallet } from 'lucide-react'
import { SectionLabel } from '@/components/section-label'

const nodes = [
  {
    icon: Wallet,
    title: 'Owner',
    body: [
      'Owns the funds.',
      'Sets the budget, protocol scope, and expiration.',
      'Can revoke at any time.',
    ],
  },
  {
    icon: ShieldCheck,
    title: 'Mandate',
    highlight: true,
    body: ['The on-chain authority object.'],
    labels: ['Budget', 'Scope', 'Expiry', 'Per-tx limits'],
  },
  {
    icon: Bot,
    title: 'Agent',
    body: [
      'Executes autonomously.',
      'Can act within the mandate, but cannot exceed it.',
    ],
  },
  {
    icon: FileCheck2,
    title: 'Proof',
    body: [
      'Every execution, block, and revocation is recorded on-chain.',
    ],
  },
]

export function Architecture() {
  return (
    <section
      id="architecture"
      className="relative border-t border-border py-20 sm:py-28"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="max-w-2xl">
          <SectionLabel>Architecture</SectionLabel>
          <h2 className="mt-5 text-balance text-3xl font-medium tracking-tight sm:text-4xl">
            How authority flows?
          </h2>
          <p className="mt-4 text-pretty text-lg leading-relaxed text-muted-foreground">
            Mandate separates ownership, policy, execution, and proof.
            <br />
            Execution authority is delegated. Wallet ownership is not.
          </p>
        </div>

        <div className="mt-12 grid items-stretch gap-4 sm:grid-cols-2 lg:grid-cols-[1fr_44px_1fr_44px_1fr_44px_1fr] lg:gap-0">
          {nodes.map((node, index) => {
            const Icon = node.icon

            return (
              <div key={node.title} className="contents">
                <div
                  className={
                    node.highlight
                      ? 'h-full min-h-[240px] rounded-xl border border-primary/30 bg-primary/10 p-5 shadow-xl shadow-primary/5'
                      : 'h-full min-h-[240px] rounded-xl border border-border bg-card/80 p-5'
                  }
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={
                        node.highlight
                          ? 'flex size-8 items-center justify-center rounded-lg border border-primary/30 bg-primary/15 text-primary'
                          : 'flex size-8 items-center justify-center rounded-lg border border-border bg-secondary text-muted-foreground'
                      }
                    >
                      <Icon className="size-4" />
                    </span>
                    <span className="font-mono text-xs text-muted-foreground">
                      0{index + 1}
                    </span>
                  </div>

                  <h3 className="mt-4 text-base font-semibold text-foreground">
                    {node.title}
                  </h3>

                  {node.highlight ? (
                    <div className="mt-3 text-sm leading-relaxed text-muted-foreground">
                      <p>{node.body[0]}</p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {node.labels?.map((label) => (
                          <span
                            key={label}
                            className="inline-flex rounded-md border border-primary/25 bg-background/35 px-2.5 py-1 font-mono text-xs text-primary"
                          >
                            {label}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <ul className="mt-3 space-y-2 text-sm leading-relaxed text-muted-foreground">
                      {node.body.map((line) => (
                        <li key={line} className="flex gap-2.5">
                          <span className="mt-2 size-1.5 shrink-0 rounded-full bg-muted-foreground/45" />
                          <span>{line}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {index < nodes.length - 1 && (
                  <div
                    aria-hidden
                    className="hidden items-center justify-center lg:flex"
                  >
                    <span className="h-px w-7 bg-primary/45" />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
