"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { ActivityFeed } from "@/components/activity-feed";
import { MandateFilter } from "@/components/mandate-filter";
import { shortId } from "@/components/copyable-id";
import { Skeleton } from "@/components/ui/skeleton";
import { sortActivitiesByTimeDesc } from "@/lib/activity-utils";
import { useMandateStore } from "@/lib/mandate-store";
import type { ActivityKind } from "@/lib/mandate-data";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";

const KIND_FILTERS: { value: string; label: string }[] = [
  { value: "all", label: "All events" },
  { value: "tx.executed", label: "Executed" },
  { value: "tx.blocked", label: "Blocked" },
  { value: "mandate.created", label: "Created" },
  { value: "mandate.revoked", label: "Revoked" },
  { value: "mandate.withdrawn", label: "Withdrawn" },
];

const PAGE_SIZE = 20;

function ActivityListSkeleton() {
  return (
    <div className="divide-y divide-border">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="space-y-2 py-4">
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="h-4 w-56" />
            <Skeleton className="ml-auto h-3 w-14" />
          </div>
          <Skeleton className="h-3 w-3/4" />
        </div>
      ))}
    </div>
  );
}

export function ActivityView() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { activity, mandates, loading, error, isWalletScoped } =
    useMandateStore();
  const [kind, setKind] = React.useState<string>("all");
  const [mandateId, setMandateId] = React.useState("all");
  const [visibleCount, setVisibleCount] = React.useState(PAGE_SIZE);

  const selectedMandate = mandates.find((mandate) => mandate.id === mandateId);
  const queryMandateId = searchParams.get("mandateId");
  const filtered = sortActivitiesByTimeDesc(
    activity.filter((event) => {
      if (kind !== "all" && event.kind !== (kind as ActivityKind)) {
        return false;
      }

      if (mandateId !== "all" && event.mandateId !== mandateId) {
        return false;
      }

      return true;
    }),
  );
  const visibleEvents = filtered.slice(0, visibleCount);

  React.useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [kind, mandateId]);

  React.useEffect(() => {
    if (!queryMandateId) {
      return;
    }
    if (!mandates.some((mandate) => mandate.id === queryMandateId)) {
      return;
    }
    setMandateId(queryMandateId);
  }, [mandates, queryMandateId]);

  const clearMandateFilter = React.useCallback(() => {
    setMandateId("all");
    if (searchParams.get("mandateId")) {
      router.replace(pathname);
    }
  }, [pathname, router, searchParams]);

  return (
    <Card>
      <CardHeader className="border-b border-border">
        <CardTitle>Event Stream</CardTitle>
        <CardDescription>
          Immutable, attributable record of mandate activity.
        </CardDescription>
        <CardAction className="flex flex-wrap items-center gap-2">
          <MandateFilter
            mandates={mandates}
            selectedMandateId={mandateId}
            loading={loading}
            onClear={clearMandateFilter}
            onSelectMandate={(id) => {
              setMandateId(id);
              router.replace(`${pathname}?mandateId=${encodeURIComponent(id)}`);
            }}
          />
          <Select
            value={kind}
            onValueChange={(value) => value && setKind(value)}
          >
            <SelectTrigger size="sm" className="w-[170px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {KIND_FILTERS.map((f) => (
                  <SelectItem key={f.value} value={f.value}>
                    {f.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </CardAction>
      </CardHeader>
      <CardContent className="py-0">
        {selectedMandate && (
          <div className="border-b border-border py-3 text-xs text-muted-foreground">
            Showing activity for{" "}
            <span className="font-medium text-foreground">
              {selectedMandate.label}
            </span>{" "}
            <span className="font-mono">({shortId(selectedMandate.id)})</span>
          </div>
        )}
        {loading ? (
          <ActivityListSkeleton />
        ) : error ? (
          <Empty className="py-12">
            <EmptyHeader>
              <EmptyTitle>Unable to load activity</EmptyTitle>
              <EmptyDescription>{error}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : filtered.length > 0 ? (
          <>
            <ActivityFeed events={visibleEvents} />
            {visibleCount < filtered.length && (
              <div className="border-t border-border py-4 text-center">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}
                >
                  Load more
                </Button>
              </div>
            )}
          </>
        ) : (
          <Empty className="py-12">
            <EmptyHeader>
              <EmptyTitle>
                {isWalletScoped
                  ? "No on-chain activity yet."
                  : "No events match this filter."}
              </EmptyTitle>
              <EmptyDescription>
                {isWalletScoped
                  ? "Create or run a mandate to generate ActivityEvents."
                  : "Try a different event filter."}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </CardContent>
    </Card>
  );
}
