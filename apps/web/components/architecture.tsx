import { User, Cpu, FileCheck2, Boxes } from 'lucide-react'
import { SectionLabel } from '@/components/section-label'

const layers = [
  {
    icon: User,
    title: 'Owner wallet',
    tag: 'Off-chain',
    body: 'Your keys, your control. Signs mandates and retains unilateral revocation at all times.',
  },
  {
    icon: Cpu,
    title: 'Agent runtime',
    tag: 'Off-chain',
    body: 'The autonomous agent constructs transactions and submits them through the Mandate SDK.',
  },
  {
    icon: FileCheck2,
    title: 'Policy engine',
    tag: 'On-chain',
    body: 'A Sui Move policy object validates every call against budget, DeepBook-only scope, cap, and expiry rules.',
  },
  {
    icon: Boxes,
    title: 'Sui execution',
    tag: 'On-chain',
    body: 'PTBs settle on Sui only after passing policy checks, then execute real DeepBook orders and emit ActivityEvent logs.',
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
            A thin policy layer between intent and settlement
          </h2>
          <p className="mt-4 text-pretty text-lg leading-relaxed text-muted-foreground">
            Mandate sits in the transaction path as an on-chain gatekeeper.
            Built with Sui Move policy objects, PTBs, and real DeepBook execution.
          </p>
        </div>

        <div className="mt-12 flex flex-col items-stretch gap-3 lg:flex-row lg:items-center">
          {layers.map((layer, i) => (
            <div key={layer.title} className="flex items-center gap-3 lg:flex-1">
              <div className="glass flex-1 rounded-xl border border-border p-5">
                <div className="flex items-center justify-between">
                  <span className="flex size-9 items-center justify-center rounded-lg bg-primary/12 text-primary">
                    <layer.icon className="size-4.5" />
                  </span>
                  <span className="rounded-full border border-border bg-secondary px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                    {layer.tag}
                  </span>
                </div>
                <h3 className="mt-4 text-base font-medium">{layer.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  {layer.body}
                </p>
              </div>
              {i < layers.length - 1 && (
                <div
                  aria-hidden
                  className="hidden h-px w-6 shrink-0 bg-gradient-to-r from-border to-primary/50 lg:block"
                />
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
