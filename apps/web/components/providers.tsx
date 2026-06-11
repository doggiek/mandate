"use client"

import "@mysten/dapp-kit/dist/index.css"

import * as React from "react"
import { SuiClientProvider, WalletProvider } from "@mysten/dapp-kit"
import { getJsonRpcFullnodeUrl } from "@mysten/sui/jsonRpc"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { NETWORK } from "@/lib/chain-config"

const networks = {
  [NETWORK]: {
    url: getJsonRpcFullnodeUrl(NETWORK),
    network: NETWORK,
  },
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = React.useState(() => new QueryClient())

  return (
    <QueryClientProvider client={queryClient}>
      <SuiClientProvider
        networks={networks}
        defaultNetwork={NETWORK}
      >
        <WalletProvider autoConnect>{children}</WalletProvider>
      </SuiClientProvider>
    </QueryClientProvider>
  )
}
