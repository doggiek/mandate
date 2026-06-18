import { Play } from "lucide-react";
import { SectionLabel } from "@/components/section-label";

export function ProductDemo() {
  return (
    <section
      id="product-demo"
      className="relative border-t border-border py-20 sm:py-28"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto max-w-3xl text-center">
          <SectionLabel>Why Mandate</SectionLabel>
          <h2 className="mt-5 text-balance text-3xl font-medium tracking-tight sm:text-4xl">
            Policy-controlled DCA Mandate
          </h2>
          <p className="mt-4 text-pretty text-lg leading-relaxed text-muted-foreground">
            Move part of your income into a capped Mandate Vault. The agent can
            watch real on-chain signals and accumulate only when policy allows —
            no repeated signatures, no unlimited wallet access, and every
            attempt leaves on-chain proof.
          </p>
        </div>

        <div
          id="video"
          className="glass group mx-auto mt-12 max-w-5xl overflow-hidden rounded-2xl border border-border bg-card/75 p-2 shadow-2xl shadow-black/35 transition-colors hover:border-primary/30"
        >
          <div className="relative aspect-video overflow-hidden rounded-xl border border-border bg-[radial-gradient(circle_at_50%_30%,rgba(16,213,210,0.16),transparent_34%),linear-gradient(135deg,rgba(16,213,210,0.08),rgba(255,255,255,0.02)_34%,rgba(0,0,0,0.24))]">
            <div className="absolute inset-x-0 top-0 flex items-center justify-between border-b border-border/70 bg-background/50 px-4 py-3 backdrop-blur">
              <div className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-destructive/70" />
                <span className="size-2 rounded-full bg-amber-400/70" />
                <span className="size-2 rounded-full bg-primary/70" />
              </div>
              <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                Product Video
              </span>
            </div>

            <div className="absolute inset-0 grid place-items-center px-6 pt-12">
              <div className="flex flex-col items-center gap-5 text-center">
                <button
                  type="button"
                  className="flex size-16 items-center justify-center rounded-full border border-primary/35 bg-primary/15 text-primary shadow-2xl shadow-primary/20 transition-transform group-hover:scale-105"
                  aria-label="Play product video"
                >
                  <Play className="ml-0.5 size-7 fill-current" />
                </button>
                <div>
                  <p className="max-w-xl text-balance text-2xl font-medium leading-tight text-foreground sm:text-3xl">
                    I don&apos;t delegate my wallet. I delegate a limited
                    mandate.
                  </p>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                    See Mandate in action
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
