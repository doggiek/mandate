import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function CtaSection() {
  return (
    <section id="cta" className="relative border-t border-border py-24 sm:py-32">
      <div className="pointer-events-none absolute inset-0 grid-faint [mask-image:radial-gradient(ellipse_50%_60%_at_50%_50%,black,transparent)]" />
      <div className="pointer-events-none absolute left-1/2 top-1/2 size-[480px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 blur-[130px]" />

      <div className="relative mx-auto max-w-3xl px-4 text-center sm:px-6">
        <h2 className="text-balance text-3xl font-medium tracking-tight sm:text-5xl">
          Give agents authority,
          <br className="hidden sm:block" /> not your keys
        </h2>
        <p className="mx-auto mt-5 max-w-xl text-pretty text-lg leading-relaxed text-muted-foreground">
          Join the teams building the autonomous economy on Sui with guardrails
          that hold. Request early access to the Mandate SDK.
        </p>

        <form className="mx-auto mt-8 flex max-w-md flex-col gap-3 sm:flex-row">
          <input
            type="email"
            required
            placeholder="you@company.com"
            aria-label="Work email"
            className="h-11 flex-1 rounded-lg border border-border bg-card/70 px-4 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
          />
          <Button
            size="lg"
            className="group h-11 bg-primary text-primary-foreground hover:bg-primary/90"
            nativeButton={false}
            render={<a href="/console" />}
          >
            Request access
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
          </Button>
        </form>
        <p className="mt-4 font-mono text-xs text-muted-foreground">
          SOC 2 Type II in progress · Audited by OtterSec
        </p>
      </div>
    </section>
  )
}

export function SiteFooter() {
  return (
    <footer className="border-t border-border py-12">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 px-4 sm:flex-row sm:px-6">
        <div className="flex items-center gap-2.5">
          <span className="relative flex size-7 items-center justify-center rounded-md border border-border bg-card">
            <span className="size-2.5 rounded-[3px] bg-primary" />
          </span>
          <span className="font-mono text-sm font-medium">mandate</span>
        </div>

        <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
          {['Docs', 'SDK', 'Security', 'Pricing', 'Careers'].map((l) => (
            <a key={l} href="#" className="transition-colors hover:text-foreground">
              {l}
            </a>
          ))}
        </nav>

        <p className="font-mono text-xs text-muted-foreground">
          © {new Date().getFullYear()} Mandate Labs
        </p>
      </div>
    </footer>
  )
}
