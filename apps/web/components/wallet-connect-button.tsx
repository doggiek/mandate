"use client"

import {
  ConnectModal,
  useCurrentAccount,
  useDisconnectWallet,
} from "@mysten/dapp-kit"
import * as React from "react"
import { LogOut, Wallet } from "lucide-react"

import { Button } from "@/components/ui/button"
import { CopyableId, shortId } from "@/components/copyable-id"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { NETWORK_LABEL } from "@/lib/chain-config"
import { cn } from "@/lib/utils"

export function formatAddress(address: string) {
  return shortId(address)
}

export function WalletConnectButton({
  size = "sm",
  className,
  showNetwork = false,
}: {
  size?: "sm" | "default"
  className?: string
  showNetwork?: boolean
}) {
  const account = useCurrentAccount()
  const disconnectWallet = useDisconnectWallet()

  if (!account) {
    return (
      <ConnectModal
        trigger={
          <Button
            size={size}
            className={cn(
              "bg-primary text-primary-foreground hover:bg-primary/90",
              className
            )}
          >
            <Wallet data-icon="inline-start" />
            Connect Wallet
          </Button>
        }
      />
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            size={size}
            variant="outline"
            className={cn(
              "border-primary/25 bg-primary/10 font-mono text-primary hover:bg-primary/15",
              className
            )}
          />
        }
      >
        <Wallet data-icon="inline-start" />
        {formatAddress(account.address)}
        {showNetwork && (
          <span className="ml-1 rounded-full border border-border bg-background/60 px-1.5 py-0.5 font-sans text-[10px] tracking-wider text-muted-foreground">
            {NETWORK_LABEL}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Wallet</DropdownMenuLabel>
          <div className="px-1.5 py-1.5">
            <div className="flex min-w-0 items-center gap-2">
              <CopyableId
                value={account.address}
                label="wallet address"
                className="text-sm font-medium text-foreground"
              />
            </div>
            <p className="mt-1 text-xs tracking-wider text-muted-foreground">
              Network / {NETWORK_LABEL}
            </p>
            <p className="mt-2 text-xs leading-snug text-muted-foreground">
              Switched wallet accounts? Disconnect and reconnect to refresh the
              active account.
            </p>
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onClick={() => disconnectWallet.mutate()}
          >
            <LogOut />
            Disconnect
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
