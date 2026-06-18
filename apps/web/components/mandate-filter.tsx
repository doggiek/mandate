"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { shortId } from "@/components/copyable-id";
import type { Mandate, MandateStatus } from "@/lib/mandate-data";
import { cn } from "@/lib/utils";

function statusDot(status: MandateStatus) {
  if (status === "active") return "bg-emerald-400";
  if (status === "revoked") return "bg-destructive";
  return "bg-muted-foreground";
}

export function MandateFilter({
  mandates,
  selectedMandateId,
  onSelectMandate,
  onClear,
  loading = false,
}: {
  mandates: Mandate[];
  selectedMandateId: string;
  onSelectMandate: (mandateId: string) => void;
  onClear: () => void;
  loading?: boolean;
}) {
  const [query, setQuery] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const selectedMandate = mandates.find(
    (mandate) => mandate.id === selectedMandateId,
  );
  const filteredMandates = React.useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return mandates.filter((mandate) => {
      if (!normalizedQuery) return true;
      return (
        mandate.label.toLowerCase().includes(normalizedQuery) ||
        mandate.id.toLowerCase().includes(normalizedQuery)
      );
    });
  }, [mandates, query]);

  React.useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative flex items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen((value) => !value)}
        className="w-[250px] justify-start overflow-hidden text-left"
      >
        <span className="truncate">
          {loading
            ? "Loading mandates..."
            : selectedMandate
              ? `${selectedMandate.label} (${shortId(selectedMandate.id)})`
              : "All mandates"}
        </span>
      </Button>
      {selectedMandateId !== "all" && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            setQuery("");
            onClear();
          }}
        >
          Clear
        </Button>
      )}
      {open && (
        <div className="absolute right-0 top-9 z-50 w-[320px] rounded-lg border border-border bg-popover p-2 text-popover-foreground shadow-xl">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Filter by label or id"
            className="mb-2"
            disabled={loading}
          />
          <div className="max-h-72 overflow-y-auto">
            {loading ? (
              <div className="px-2 py-6 text-center text-sm text-muted-foreground">
                Loading mandates...
              </div>
            ) : (
              filteredMandates.map((mandate) => (
                <button
                  key={mandate.id}
                  type="button"
                  onClick={() => {
                    onSelectMandate(mandate.id);
                    setOpen(false);
                    setQuery("");
                  }}
                  className={cn(
                    "flex w-full items-start gap-2 rounded-md px-2 py-2 text-left hover:bg-accent",
                    selectedMandateId === mandate.id && "bg-accent",
                  )}
                >
                  <span
                    className={cn(
                      "mt-1.5 size-2 shrink-0 rounded-full",
                      statusDot(mandate.status),
                    )}
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">
                      {mandate.label}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {shortId(mandate.id)} · {mandate.status}
                    </span>
                  </span>
                </button>
              ))
            )}
            {!loading && filteredMandates.length === 0 && (
              <div className="px-2 py-6 text-center text-sm text-muted-foreground">
                No mandates match this filter.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
