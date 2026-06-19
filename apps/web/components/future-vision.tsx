"use client";

import { useEffect, useRef, useState } from "react";
import { Landmark, Repeat2, TrendingUp, WalletCards } from "lucide-react";
import { SectionLabel } from "@/components/section-label";
import { cn } from "@/lib/utils";

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
  const quoteRef = useRef<HTMLDivElement>(null);
  const [hasRevealed, setHasRevealed] = useState(false);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    if (prefersReducedMotion) {
      setHasRevealed(true);
      return;
    }

    const node = quoteRef.current;
    if (!node) {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setHasRevealed(true);
          observer.disconnect();
        }
      },
      { threshold: 0.42 },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

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

        <div
          ref={quoteRef}
          className="relative mt-16 overflow-hidden py-10 text-center"
        >
          <div className="pointer-events-none absolute left-1/2 top-1/2 h-44 w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 blur-[90px]" />
          <blockquote className="relative mx-auto max-w-4xl text-balance text-xl font-normal leading-tight text-foreground sm:text-2xl">
            <p
              className={cn(
                "text-foreground/80 transition-opacity duration-700 ease-out",
                hasRevealed
                  ? "opacity-100"
                  : "opacity-0",
              )}
            >
              AI agents are stuck behind the approve wall.
            </p>
            <p className="mt-4 text-foreground">
              <span
                className={cn(
                  "inline-block text-primary transition-all duration-700 ease-out",
                  hasRevealed ? "opacity-100 blur-0" : "opacity-0 blur-sm",
                )}
                style={{ transitionDelay: hasRevealed ? "460ms" : "0ms" }}
              >
                Mandate
              </span>
              <span
                className={cn(
                  "ml-2 inline-block transition-opacity duration-700 ease-out",
                  hasRevealed ? "opacity-100" : "opacity-0",
                )}
                style={{ transitionDelay: hasRevealed ? "620ms" : "0ms" }}
              >
                removes that wall —
              </span>
            </p>
            <p
              className={cn(
                "mt-2 font-normal text-foreground/75 transition-all duration-700 ease-out",
                hasRevealed
                  ? "translate-y-0 opacity-100"
                  : "translate-y-1 opacity-0",
              )}
              style={{ transitionDelay: hasRevealed ? "1050ms" : "0ms" }}
            >
              without giving up control.
            </p>
          </blockquote>
        </div>
      </div>
    </section>
  );
}
