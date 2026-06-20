"use client";

import { useState } from "react";
import { Play } from "lucide-react";
import { SectionLabel } from "@/components/section-label";

export function ProductDemo() {
  const [playing, setPlaying] = useState(false);

  return (
    <section
      id="product-demo"
      className="relative border-t border-border py-20 sm:py-28"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        {/* HEADER */}
        <div className="mx-auto max-w-3xl text-center">
          <SectionLabel>Product Video</SectionLabel>

          <h2 className="mt-5 text-3xl font-medium tracking-tight sm:text-4xl">
            Execution Policy for Autonomous Agents
          </h2>

          <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
            AI agents don’t fail on reasoning — they fail on permissions.
            Mandate replaces repeated approvals with a single constrained
            execution policy on Sui.
          </p>
        </div>

        {/* VIDEO FRAME */}
        <div className="mx-auto mt-12 max-w-5xl overflow-hidden rounded-2xl border border-border bg-card/75 p-2 shadow-2xl shadow-black/35">
          <div className="relative aspect-video overflow-hidden rounded-xl border border-border bg-black">
            {/* top bar */}
            <div className="absolute inset-x-0 top-0 z-30 flex items-center justify-between border-b border-border/70 bg-background/40 px-4 py-3 backdrop-blur">
              <div className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-red-500/70" />
                <span className="size-2 rounded-full bg-yellow-400/70" />
                <span className="size-2 rounded-full bg-green-400/70" />
              </div>
              <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                Product Video
              </span>
            </div>

            {/* POSTER LAYER */}
            {!playing && (
              <div className="absolute inset-0 z-20 grid place-items-center bg-gradient-to-br from-black via-black/90 to-black/80">
                {/* CENTER WRAPPER（关键修复点） */}
                <div className="flex flex-col items-center text-center">
                  {/* PERFECT CENTER BUTTON */}
                  <button
                    onClick={() => setPlaying(true)}
                    className="
                      flex h-16 w-16 items-center justify-center
                      rounded-full border border-primary/40
                      bg-primary/10 text-primary
                      shadow-2xl shadow-primary/20
                      transition-transform hover:scale-105
                    "
                  >
                    <Play className="ml-0.5 h-7 w-7 fill-current" />
                  </button>

                  <div className="mt-6">
                    <p className="text-2xl font-medium text-white sm:text-3xl">
                      I don’t give agents my wallet.
                    </p>
                    <p className="text-2xl font-medium text-white/80 sm:text-3xl">
                      I give them a Mandate.
                    </p>
                    <p className="mt-3 text-sm text-muted-foreground">
                      See autonomous execution in action
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* IFRAME */}
            {playing && (
              <iframe
                className="absolute inset-0 z-10 h-full w-full"
                src="https://www.youtube.com/embed/0ri2MwXb2GI?autoplay=1&rel=0&modestbranding=1"
                title="Mandate Demo Video"
                allow="autoplay; encrypted-media; fullscreen"
                allowFullScreen
              />
            )}

            {/* CLOSE BUTTON（对齐播放按钮视觉体系） */}
            {playing && (
              <button
                onClick={() => setPlaying(false)}
                className="
                  absolute right-4 top-4 z-40
                  flex h-10 w-10 items-center justify-center
                  rounded-full bg-white/10 text-white
                  backdrop-blur
                  hover:bg-white/20
                "
              >
                ✕
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
