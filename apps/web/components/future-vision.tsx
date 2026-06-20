import { Landmark, Repeat2, TrendingUp, WalletCards } from "lucide-react";
import { SectionLabel } from "@/components/section-label";

const agentTypes = [
  {
    icon: TrendingUp,
    title: "Trading Agents",
    body: "Execute capped market actions through approved protocols.",
  },
  {
    icon: Repeat2,
    title: "Yield Agents",
    body: "Rebalance positions while respecting owner-defined limits.",
  },
  {
    icon: Landmark,
    title: "Treasury Agents",
    body: "Move treasury funds only within scoped policy rules.",
  },
  {
    icon: WalletCards,
    title: "Payment Agents",
    body: "Route recurring payments without unlimited wallet access.",
  },
];

export function FutureVision() {
  return (
    <section
      id="future-vision"
      className="relative border-t border-border py-20 sm:py-28"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="grid gap-12 lg:grid-cols-[0.86fr_1.14fr] lg:items-start">
          <div className="max-w-2xl">
            <SectionLabel>Future vision</SectionLabel>
            <h2 className="mt-5 text-balance text-3xl font-medium tracking-tight sm:text-4xl">
              The future is autonomous.
              <br className="hidden sm:block" /> The permissions should be too.
            </h2>
            <div className="mt-4 space-y-3 text-pretty text-lg leading-relaxed text-muted-foreground">
              <p>Mandate starts with DCA.</p>
              <p>
                But the same policy layer can secure any autonomous agent on
                Sui.
              </p>
            </div>
          </div>

          <div className="grid gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-2">
            {agentTypes.map((agent) => (
              <div key={agent.title} className="bg-card p-6 sm:p-7">
                <span className="flex size-10 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary">
                  <agent.icon className="size-5" />
                </span>
                <h3 className="mt-5 text-lg font-medium">{agent.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {agent.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
