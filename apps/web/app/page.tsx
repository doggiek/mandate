import { SiteHeader } from '@/components/site-header'
import { Hero } from '@/components/hero'
import { Problem } from '@/components/problem'
import { HowItWorks } from '@/components/how-it-works'
import { Architecture } from '@/components/architecture'
import { ActivityLog } from '@/components/activity-log'
import { SecurityControls } from '@/components/security-controls'
import { CtaSection, SiteFooter } from '@/components/cta-section'

export default function Page() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main>
        <Hero />
        <Problem />
        <HowItWorks />
        <Architecture />
        <ActivityLog />
        <SecurityControls />
        <CtaSection />
      </main>
      <SiteFooter />
    </div>
  )
}
