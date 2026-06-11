"use client"

import { useCurrentAccount } from "@mysten/dapp-kit"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { formatAddress } from "@/components/wallet-connect-button"
import { NETWORK_LABEL } from "@/lib/chain-config"

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-background/60 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 truncate font-mono text-sm font-medium text-foreground">
        {value}
      </p>
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
      <CardContent className="grid gap-3 p-4 md:grid-cols-3">
        <SummaryItem
          label="Connected Wallet"
          value={account ? formatAddress(account.address) : "Not connected"}
        />
        <SummaryItem label="Network" value={NETWORK_LABEL} />
        <SummaryItem
          label="Connection Status"
          value={account ? "Connected" : "Disconnected"}
        />
      </CardContent>
    </Card>
  )
}
