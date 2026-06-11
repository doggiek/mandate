"use client"

import {
  ConnectModal,
  useCurrentAccount,
  useDisconnectWallet,
} from "@mysten/dapp-kit"
import * as React from "react"
import { Check, Copy, LogOut, Wallet } from "lucide-react"

import { Button } from "@/components/ui/button"
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
  return `${address.slice(0, 10)}...${address.slice(-8)}`
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
  const [copied, setCopied] = React.useState(false)

  React.useEffect(() => {
    if (!copied) return

    const timeout = window.setTimeout(() => setCopied(false), 1500)
    return () => window.clearTimeout(timeout)
  }, [copied])

  const copyAddress = async () => {
    if (!account) return

    await navigator.clipboard.writeText(account.address)
    setCopied(true)
  }

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
          <span className="ml-1 rounded-full border border-border bg-background/60 px-1.5 py-0.5 font-sans text-[10px] uppercase tracking-wider text-muted-foreground">
            {NETWORK_LABEL}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Wallet</DropdownMenuLabel>
          <div className="px-1.5 py-1.5">
            <div className="flex min-w-0 items-center gap-2">
              <p className="min-w-0 flex-1 truncate font-mono text-sm font-medium text-foreground">
                {formatAddress(account.address)}
              </p>
              <Button
                size="xs"
                variant="ghost"
                className="h-6 shrink-0 px-1.5 text-xs"
                onClick={copyAddress}
              >
                {copied ? <Check /> : <Copy />}
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
            <p className="mt-1 text-xs uppercase tracking-wider text-muted-foreground">
              Network / {NETWORK_LABEL}
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
