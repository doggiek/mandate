import "dotenv/config";

import {
  recordBlockedAction,
  type AgentRunResult,
  type SuiNetwork,
} from "../apps/web/lib/server/agent-runner";

function env(name: string, fallbackName?: string) {
  const value = process.env[name] ?? (fallbackName ? process.env[fallbackName] : undefined);
  if (!value?.trim()) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value.trim();
}

function optionalEnv(name: string, fallbackName?: string) {
  return process.env[name]?.trim() || (fallbackName ? process.env[fallbackName]?.trim() : undefined);
}

function activeNetwork(): SuiNetwork {
  return (optionalEnv("NEXT_PUBLIC_SUI_NETWORK", "NEXT_PUBLIC_NETWORK") ?? "testnet")
    .toLowerCase() === "mainnet"
    ? "mainnet"
    : "testnet";
}

function activeRpcUrl(network: SuiNetwork) {
  const suffix = network.toUpperCase();
  return (
    optionalEnv("SUI_RPC_URL") ??
    optionalEnv(`NEXT_PUBLIC_SUI_RPC_${suffix}`) ??
    (network === "mainnet"
      ? "https://fullnode.mainnet.sui.io:443"
      : "https://fullnode.testnet.sui.io:443")
  );
}

function activePackageId(network: SuiNetwork) {
  const suffix = network.toUpperCase();
  return (
    optionalEnv("PACKAGE_ID") ??
    optionalEnv(`NEXT_PUBLIC_PACKAGE_ID_${suffix}`) ??
    env("NEXT_PUBLIC_PACKAGE_ID")
  );
}

function printSummary(result: AgentRunResult) {
  console.log("========================================");
  console.log("Mandate DeepBook Demo");
  console.log("========================================");
  console.log("");
  console.log("Digest:");
  console.log(result.digest);
  console.log("");
  console.log("Status:");
  console.log(result.status);
  console.log("");
  console.log("Activity Event:");
  console.log(result.activityEventFound ? "FOUND" : "NOT FOUND");
  console.log("");
  console.log("DeepBook Pool Mutation:");
  console.log("NOT FOUND");
  console.log("");
  console.log("Balance Change:");
  console.log(result.balanceChangeSui);
  console.log("");
  console.log("Gas Fee:");
  console.log(result.gasFeeSui);
  console.log("");
  console.log("Blocked Reason:");
  console.log(result.blockedReason ?? "-");
  console.log("");
  console.log("========================================");
}

async function main() {
  const network = activeNetwork();
  const result = await recordBlockedAction({
    agentPrivateKey: env("BACKEND_AGENT_PRIVATE_KEY", "AGENT_PRIVATE_KEY"),
    expectedAgentAddress: optionalEnv(
      "NEXT_PUBLIC_BACKEND_AGENT_ADDRESS",
      "NEXT_PUBLIC_VERIFIED_AGENT_ADDRESS",
    ),
    packageId: activePackageId(network),
    mandateId: env("MANDATE_ID"),
    routeId: optionalEnv("ROUTE_ID") ?? "deep_momentum_buy",
    network,
    rpcUrl: activeRpcUrl(network),
    amountSui: optionalEnv("AMOUNT_SUI") ?? "0.001",
    reason: optionalEnv("BLOCK_REASON") ?? "blocked_by_policy",
    dusdcCoinType: optionalEnv(
      "NEXT_PUBLIC_DBUSDC_COIN_TYPE",
      "NEXT_PUBLIC_DUSDC_COIN_TYPE",
    ),
  });
  printSummary(result);
}

main().catch((error) => {
  if (process.env.DEBUG_STACK === "1") {
    console.error(error);
    process.exit(1);
  }

  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
