import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ArrowLeft, ArrowRight, BookOpen, ExternalLink } from "lucide-react";
import { docsPages } from "@/lib/docs-content";

export const metadata: Metadata = {
  title: "Docs | Mandate",
  description:
    "Product documentation for Mandate, a programmable permission layer for autonomous agent wallets on Sui.",
};

function renderInline(text: string) {
  const urlPattern = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlPattern);

  return parts.map((part, index) => {
    if (part.match(urlPattern)) {
      return (
        <a
          key={`${part}-${index}`}
          href={part}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-primary underline-offset-4 hover:underline"
        >
          {part}
          <ExternalLink className="size-3" />
        </a>
      );
    }

    return <span key={`${part}-${index}`}>{part}</span>;
  });
}

function MarkdownBlock({ content }: { content: string }) {
  const lines = content.trim().split("\n");
  const blocks: ReactNode[] = [];
  let listItems: string[] = [];

  const flushList = () => {
    if (listItems.length === 0) return;
    blocks.push(
      <ul
        key={`list-${blocks.length}`}
        className="my-5 space-y-2 text-sm leading-relaxed text-muted-foreground"
      >
        {listItems.map((item) => (
          <li key={item} className="flex gap-3">
            <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />
            <span>{renderInline(item)}</span>
          </li>
        ))}
      </ul>,
    );
    listItems = [];
  };

  lines.forEach((line) => {
    const trimmed = line.trim();

    if (!trimmed) {
      flushList();
      return;
    }

    if (trimmed.startsWith("- ")) {
      listItems.push(trimmed.slice(2));
      return;
    }

    flushList();

    if (trimmed.startsWith("# ")) {
      blocks.push(
        <h2
          key={`h2-${blocks.length}`}
          className="mt-0 text-2xl font-semibold tracking-tight text-foreground"
        >
          {trimmed.slice(2)}
        </h2>,
      );
      return;
    }

    if (/^\d+\.\s/.test(trimmed)) {
      blocks.push(
        <h3
          key={`step-${blocks.length}`}
          className="mt-7 text-lg font-semibold text-foreground"
        >
          {trimmed}
        </h3>,
      );
      return;
    }

    blocks.push(
      <p
        key={`p-${blocks.length}`}
        className="my-4 text-sm leading-7 text-muted-foreground"
      >
        {renderInline(trimmed)}
      </p>,
    );
  });

  flushList();
  return <>{blocks}</>;
}

export default function DocsPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="pointer-events-none fixed inset-0 grid-faint [mask-image:radial-gradient(ellipse_60%_45%_at_50%_0%,black,transparent)]" />
      <div className="pointer-events-none fixed left-1/2 top-[-14rem] size-[520px] -translate-x-1/2 rounded-full bg-primary/10 blur-[140px]" />

      <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <a
            href="/"
            className="flex items-center gap-3 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            <img
              src="/brand/mandate-logo-light.png"
              alt="Mandate"
              className="h-8 w-8 rounded-lg object-contain"
            />
            <span className="font-semibold text-foreground">Mandate Docs</span>
          </a>
          <a
            href="/console"
            className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Launch Console
            <ArrowRight className="size-4" />
          </a>
        </div>
      </header>

      <div className="relative mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[240px_1fr] lg:py-14">
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-2xl border border-border bg-card/70 p-3">
            <div className="mb-2 flex items-center gap-2 px-3 py-2 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
              <BookOpen className="size-3.5 text-primary" />
              Docs
            </div>
            <nav className="space-y-1">
              {docsPages.map((page) => (
                <a
                  key={page.id}
                  href={`#${page.id}`}
                  className="block rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                >
                  {page.title}
                </a>
              ))}
            </nav>
          </div>
        </aside>

        <div className="space-y-6">
          <section className="rounded-2xl border border-border bg-card/70 p-6 sm:p-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background/60 px-3 py-1 text-xs uppercase tracking-[0.18em] text-muted-foreground">
              <span className="size-1.5 rounded-full bg-primary" />
              Product Docs
            </div>
            <h1 className="mt-5 max-w-3xl text-3xl font-semibold tracking-tight sm:text-5xl">
              Programmable permission layer for autonomous agent wallets.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground">
              Mandate lets users sign once, define constrained execution
              policies, and let agents execute within on-chain limits.
            </p>
          </section>

          {docsPages.map((page) => (
            <section
              key={page.id}
              id={page.id}
              className="scroll-mt-24 rounded-2xl border border-border bg-card/70 p-6 sm:p-8"
            >
              <p className="mb-5 text-sm text-muted-foreground">
                {page.description}
              </p>
              <div className="max-w-3xl">
                <MarkdownBlock content={page.content} />
              </div>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
