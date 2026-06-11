"use client"

import { useCurrentAccount } from "@mysten/dapp-kit"
import type * as React from "react"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { CopyableId } from "@/components/copyable-id"
import { NETWORK_LABEL } from "@/lib/chain-config"

function SummaryItem({
  label,
  value,
}: {
  label: string
  value: React.ReactNode
}) {
  return (
    <div className="rounded-lg border border-border bg-background/60 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="mt-1 min-w-0 truncate font-mono text-sm font-medium text-foreground">
        {value}
      </div>
    </div>
  )
}

export function WalletSummary() {
  const account = useCurrentAccount()

  return (
    <Card className="border-primary/15 bg-card/80">
      <CardHeader className="border-b border-border">
        <CardTitle>Wallet Summary</CardTitle>
        <CardDescription>
          Wallet connection state for the configured console network.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 p-4">
        <div className="grid gap-3 md:grid-cols-3">
          <SummaryItem
            label="dApp Connected Account"
            value={
              account ? (
                <CopyableId
                  value={account.address}
                  label="wallet address"
                  className="text-foreground"
                />
              ) : (
                "Not connected"
              )
            }
          />
          <SummaryItem label="Network" value={NETWORK_LABEL} />
          <SummaryItem
            label="Connection Status"
            value={account ? "Connected" : "Disconnected"}
          />
        </div>
        {account && (
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
            Mandate uses the currently connected account. If you switched
            accounts in Slush, disconnect and reconnect.
          </div>
        )}
      </CardContent>
    </Card>
  )
}
