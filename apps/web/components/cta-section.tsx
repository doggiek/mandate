import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

const COPYRIGHT_YEAR = 2026

export function CtaSection() {
  return (
    <section id="cta" className="relative border-t border-border py-24 sm:py-32">
      <div className="pointer-events-none absolute inset-0 grid-faint [mask-image:radial-gradient(ellipse_50%_60%_at_50%_50%,black,transparent)]" />
      <div className="pointer-events-none absolute left-1/2 top-1/2 size-[480px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 blur-[130px]" />

      <div className="relative mx-auto max-w-3xl px-4 text-center sm:px-6">
        <h2 className="text-balance text-3xl font-medium tracking-tight sm:text-5xl">
          Grant authority once.
          <br className="hidden sm:block" /> Let the agent execute within
          limits.
        </h2>
        <p className="mx-auto mt-5 max-w-xl text-pretty text-lg leading-relaxed text-muted-foreground">
          Mandate gives an AI agent a capped budget and protocol scope on Sui —
          then every action is enforced and recorded on-chain.
        </p>

        <div className="mt-8 flex justify-center">
          <Button
            size="lg"
            className="group bg-primary text-primary-foreground hover:bg-primary/90"
            nativeButton={false}
            render={<a href="/console" />}
          >
            Launch Console
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
          </Button>
        </div>
      </div>
    </section>
  )
}

export function SiteFooter() {
  return (
    <footer className="border-t border-border py-12">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 px-4 sm:flex-row sm:px-6">
        <div className="flex items-center gap-2.5">
          <img
            src="/brand/mandate-logo-light.png"
            alt="Mandate"
            className="h-8 w-8 rounded-lg object-contain"
          />
          <span className="text-sm font-semibold">Mandate</span>
        </div>

        <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
          {[
            { label: 'Docs', href: 'https://github.com/doggiek/mandate#readme' },
            { label: 'GitHub', href: 'https://github.com/doggiek/mandate' },
            { label: 'X', href: '#' },
          ].map((l) => (
            <a
              key={l.label}
              href={l.href}
              className="transition-colors hover:text-foreground"
            >
              {l.label}
            </a>
          ))}
        </nav>

        <p className="font-mono text-xs text-muted-foreground">
          © {COPYRIGHT_YEAR} Mandate Labs
        </p>
      </div>
    </footer>
  )
}
