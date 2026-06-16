"use client";

import { useCurrentAccount } from "@mysten/dapp-kit";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/status-badges";
import { BudgetMeter } from "@/components/budget-meter";
import { CopyableId } from "@/components/copyable-id";
import { cn } from "@/lib/utils";
import { stableExpiryLabel } from "@/lib/format";
import {
  isCurrentMandateObjectType,
  normalizeSuiAddress,
} from "@/lib/chain-config";
import type { Mandate } from "@/lib/mandate-data";
import { ChevronRight, ShieldOff } from "lucide-react";

const OLD_PACKAGE_MESSAGE =
  "This mandate was created by an older package. Create a new mandate with the latest package to revoke or test policy actions.";

export function MandateTable({
  mandates,
  onSelect,
  onRevoke,
}: {
  mandates: Mandate[];
  onSelect: (id: string) => void;
  onRevoke?: (id: string) => void;
}) {
  const account = useCurrentAccount();

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow className="border-border hover:bg-transparent">
            <TableHead className="pl-4">Mandate</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-[160px]">Budget used</TableHead>
            <TableHead className="hidden md:table-cell">Protocols</TableHead>
            <TableHead className="hidden lg:table-cell">Created</TableHead>
            <TableHead className="hidden lg:table-cell">Expires</TableHead>
            <TableHead className="w-[150px] pr-3 text-center">
              Actions
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {mandates.map((m) => {
            const isKnownOlderPackage =
              Boolean(m.objectType) &&
              !isCurrentMandateObjectType(m.objectType);
            const isOwnerWallet =
              !m.ownerAddress ||
              normalizeSuiAddress(account?.address) ===
                normalizeSuiAddress(m.ownerAddress);
            const canRevoke = !isKnownOlderPackage && isOwnerWallet;

            return (
              <TableRow
                key={m.id}
                onClick={() => onSelect(m.id)}
                className="cursor-pointer border-border"
              >
                <TableCell className="pl-4">
                  <div className="flex flex-col gap-0.5">
                    <span className="font-medium leading-tight">{m.label}</span>
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      {m.agentAddress ? (
                        <CopyableId
                          value={m.agentAddress}
                          label="agent wallet"
                        />
                      ) : (
                        <span className="truncate">Agent Wallet</span>
                      )}
                      <span className="text-border">·</span>
                      <CopyableId value={m.id} label="mandate id" />
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <StatusBadge status={m.status} />
                </TableCell>
                <TableCell>
                  <BudgetMeter spent={m.spent} budget={m.budget} />
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  <div className="flex flex-wrap gap-1">
                    {m.protocols.slice(0, 2).map((p) => (
                      <Badge
                        key={p}
                        variant="secondary"
                        className="bg-secondary font-normal text-secondary-foreground"
                      >
                        {p}
                      </Badge>
                    ))}
                    {m.protocols.length > 2 && (
                      <Badge
                        variant="secondary"
                        className="bg-secondary font-normal"
                      >
                        +{m.protocols.length - 2}
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell className="hidden lg:table-cell">
                  <span className="text-sm text-muted-foreground tabular-nums">
                    {m.createdAtDisplay ?? "-"}
                  </span>
                </TableCell>
                <TableCell className="hidden lg:table-cell">
                  <span
                    className={cn(
                      "text-sm tabular-nums",
                      m.status === "expired"
                        ? "text-muted-foreground"
                        : "text-foreground",
                    )}
                  >
                    {m.expiresLabel ?? stableExpiryLabel(m.expiresAt, m.status)}
                  </span>
                </TableCell>
                <TableCell className="pr-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    {m.status === "active" && onRevoke && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(event) => {
                          event.stopPropagation();
                          if (!canRevoke) return;
                          onRevoke(m.id);
                        }}
                        disabled={!canRevoke}
                        className="border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
                        title={
                          isKnownOlderPackage
                            ? OLD_PACKAGE_MESSAGE
                            : !isOwnerWallet
                              ? "Only the owner wallet can revoke this mandate."
                              : "Permanently revoke owner-granted agent permission"
                        }
                      >
                        <ShieldOff data-icon="inline-start" />
                        Revoke
                      </Button>
                    )}
                    <ChevronRight className="size-4 text-muted-foreground" />
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
