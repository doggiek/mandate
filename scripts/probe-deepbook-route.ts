import fs from "node:fs";
import path from "node:path";

import dotenv from "dotenv";
import {
  deepbook,
  mainnetCoins,
  mainnetPools,
  testnetCoins,
  testnetPools,
} from "@mysten/deepbook-v3";
import { SuiGrpcClient } from "@mysten/sui/grpc";
import { Transaction } from "@mysten/sui/transactions";
import { normalizeSuiAddress } from "@mysten/sui/utils";

type Network = "testnet" | "mainnet";

type CoinConfig = {
  type: string;
  scalar: number;
  symbol: string;
};

type RouteProbe = {
  amount: number;
  quoteOutput: number;
  quoteResidual: number;
  simulateStatus: string;
  simulateOutput?: number;
  simulateResidual?: number;
  error?: string;
};

type QuantityOutQuote = {
  baseOut: number;
  quoteOut: number;
};

type DeepBookProbeClient = {
  core: {
    simulateTransaction(options: {
      transaction: Transaction;
      include?: {
        effects?: boolean;
        events?: boolean;
        balanceChanges?: boolean;
        objectTypes?: boolean;
        transaction?: boolean;
      };
    }): Promise<{
      $kind: "Transaction" | "FailedTransaction";
      Transaction?: SimulatedTransaction;
      FailedTransaction?: SimulatedTransaction;
    }>;
  };
  deepbook: {
    getBaseQuantityOut(
      poolKey: string,
      quoteQuantity: number | bigint,
    ): Promise<QuantityOutQuote>;
    getQuoteQuantityOut(
      poolKey: string,
      baseQuantity: number | bigint,
    ): Promise<QuantityOutQuote>;
    deepBook: {
      swapExactQuantity(params: {
        poolKey: string;
        amount: number | bigint;
        deepAmount: number | bigint;
        minOut: number | bigint;
        isBaseToCoin: boolean;
        baseCoin?: unknown;
        quoteCoin?: unknown;
      }): (tx: Transaction) => readonly [unknown, unknown, unknown];
    };
  };
};

type SimulatedTransaction = {
  status?: { success?: boolean; error?: unknown };
  balanceChanges?: Array<{
    coinType?: string;
    amount?: string;
  }>;
};

const SUI_COIN_TYPE = normalizeCoinType("0x2::sui::SUI");
const MIST_PER_SUI = 1_000_000_000;
const TEST_AMOUNTS = [0.001, 0.01, 0.05, 0.1, 1, 2, 5];

loadEnv();

async function main() {
  const network = readNetwork();
  const suffix = network.toUpperCase();
  const poolKey = readEnv(`NEXT_PUBLIC_DEEPBOOK_POOL_KEY_${suffix}`);
  const poolId = readEnv(`NEXT_PUBLIC_DEEPBOOK_POOL_ID_${suffix}`);
  const spendCoinType =
    readEnv(`NEXT_PUBLIC_SPEND_COIN_TYPE_${suffix}`) || SUI_COIN_TYPE;
  const buyCoinType = readEnv(`NEXT_PUBLIC_BUY_COIN_TYPE_${suffix}`);
  const configuredAmount = Number(
    readEnv(`NEXT_PUBLIC_EXECUTION_AMOUNT_${suffix}`),
  );
  const rpcUrl =
    readEnv(`NEXT_PUBLIC_SUI_RPC_${suffix}`) ??
    (network === "mainnet"
      ? "https://fullnode.mainnet.sui.io:443"
      : "https://fullnode.testnet.sui.io:443");
  const sender = normalizeSuiAddress(
    readEnv("NEXT_PUBLIC_BACKEND_AGENT_ADDRESS") ??
      readEnv("NEXT_PUBLIC_VERIFIED_AGENT_ADDRESS") ??
      "0x0",
  );

  if (!poolKey || !poolId) {
    throw new Error(
      `Missing NEXT_PUBLIC_DEEPBOOK_POOL_KEY_${suffix} or NEXT_PUBLIC_DEEPBOOK_POOL_ID_${suffix}`,
    );
  }

  if (!buyCoinType || !buyCoinType.includes("::")) {
    throw new Error(
      `NEXT_PUBLIC_BUY_COIN_TYPE_${suffix} must be the full coin type, got "${buyCoinType || "missing"}"`,
    );
  }

  const { pools, coins } =
    network === "mainnet"
      ? { pools: mainnetPools, coins: mainnetCoins }
      : { pools: testnetPools, coins: testnetCoins };
  const pool = pools[poolKey as keyof typeof pools];

  if (!pool) {
    throw new Error(`DeepBook SDK does not know pool key ${poolKey}`);
  }

  const baseCoin = coinConfig(coins[pool.baseCoin]);
  const quoteCoin = coinConfig(coins[pool.quoteCoin]);
  const normalizedSpendCoinType = normalizeCoinType(spendCoinType);
  const normalizedBuyCoinType = normalizeCoinType(buyCoinType);

  const direction =
    baseCoin.type === normalizedSpendCoinType &&
    quoteCoin.type === normalizedBuyCoinType
      ? "base_to_quote"
      : quoteCoin.type === normalizedSpendCoinType &&
          baseCoin.type === normalizedBuyCoinType
        ? "quote_to_base"
        : null;

  if (!direction) {
    throw new Error(
      [
        "Configured spend/buy coin types do not match the SDK pool sides.",
        `spend=${normalizedSpendCoinType}`,
        `buy=${normalizedBuyCoinType}`,
        `base=${baseCoin.type}`,
        `quote=${quoteCoin.type}`,
      ].join("\n"),
    );
  }

  const inputCoin = direction === "base_to_quote" ? baseCoin : quoteCoin;
  const outputCoin = direction === "base_to_quote" ? quoteCoin : baseCoin;
  const client = new SuiGrpcClient({
    network,
    baseUrl: rpcUrl,
  }).$extend(deepbook({ address: sender })) as DeepBookProbeClient;

  console.log("Mandate DeepBook route probe");
  console.log("network:", network);
  console.log("rpc:", rpcUrl);
  console.log("pool key:", poolKey);
  console.log("pool id:", poolId);
  console.log("SDK pool id:", pool.address);
  console.log("spend coin:", normalizedSpendCoinType);
  console.log("buy coin:", normalizedBuyCoinType);
  console.log(
    "direction:",
    direction === "base_to_quote"
      ? `${baseCoin.symbol} -> ${quoteCoin.symbol}`
      : `${quoteCoin.symbol} -> ${baseCoin.symbol}`,
  );
  console.log(
    "configured execution amount:",
    Number.isFinite(configuredAmount) && configuredAmount > 0
      ? `${configuredAmount} ${inputCoin.symbol}`
      : "not set",
  );
  console.log(
    "mode: SDK quote + PTB simulateTransaction; no transaction is submitted.",
  );
  console.log("");

  const probes: RouteProbe[] = [];
  for (const amount of TEST_AMOUNTS) {
    probes.push(
      await probeAmount(client, {
        poolKey,
        direction,
        amount,
        inputCoin,
        outputCoin,
        sender,
      }),
    );
  }

  console.table(
    probes.map((probe) => ({
      input: `${formatAmount(probe.amount)} ${inputCoin.symbol}`,
      quoteOutput: `${formatAmount(probe.quoteOutput)} ${outputCoin.symbol}`,
      quoteResidual: `${formatAmount(probe.quoteResidual)} ${inputCoin.symbol}`,
      simulateStatus: probe.simulateStatus,
      simulateOutput:
        probe.simulateOutput == null
          ? "-"
          : `${formatAmount(probe.simulateOutput)} ${outputCoin.symbol}`,
      simulateResidual:
        probe.simulateResidual == null
          ? "-"
          : `${formatAmount(probe.simulateResidual)} ${inputCoin.symbol}`,
      fillable:
        probe.quoteOutput > 0 || (probe.simulateOutput ?? 0) > 0
          ? "true"
          : "false",
      error: probe.error ?? "",
    })),
  );

  const recommended = probes.find(
    (probe) => probe.quoteOutput > 0 || (probe.simulateOutput ?? 0) > 0,
  );

  console.log("");
  if (recommended) {
    console.log("fillable: true");
    console.log(
      `recommended minimum amount: ${formatAmount(recommended.amount)} ${inputCoin.symbol}`,
    );
    console.log(
      `recommended env: NEXT_PUBLIC_EXECUTION_AMOUNT_${suffix}=${recommended.amount}`,
    );
  } else {
    console.log("fillable: false");
    console.log("recommended minimum amount: not found in tested range");
  }
}

async function probeAmount(
  client: DeepBookProbeClient,
  options: {
    poolKey: string;
    direction: "base_to_quote" | "quote_to_base";
    amount: number;
    inputCoin: CoinConfig;
    outputCoin: CoinConfig;
    sender: string;
  },
): Promise<RouteProbe> {
  const quote =
    options.direction === "base_to_quote"
      ? await client.deepbook.getQuoteQuantityOut(
          options.poolKey,
          options.amount,
        )
      : await client.deepbook.getBaseQuantityOut(
          options.poolKey,
          options.amount,
        );
  const quoteOutput =
    options.direction === "base_to_quote" ? quote.quoteOut : quote.baseOut;
  const quoteResidual =
    options.direction === "base_to_quote" ? quote.baseOut : quote.quoteOut;
  const simulation = await simulateSwap(client, options);

  return {
    amount: options.amount,
    quoteOutput,
    quoteResidual,
    ...simulation,
  };
}

async function simulateSwap(
  client: DeepBookProbeClient,
  options: {
    poolKey: string;
    direction: "base_to_quote" | "quote_to_base";
    amount: number;
    inputCoin: CoinConfig;
    outputCoin: CoinConfig;
    sender: string;
  },
) {
  if (options.inputCoin.type !== SUI_COIN_TYPE) {
    return {
      simulateStatus: "skipped",
      error: "PTB simulation currently only splits SUI gas for input coin.",
    };
  }

  const tx = new Transaction();
  tx.setSender(options.sender);

  const [inputCoin] = tx.splitCoins(tx.gas, [
    tx.pure.u64(BigInt(Math.round(options.amount * MIST_PER_SUI))),
  ]);
  const [baseOut, quoteOut, deepOut] =
    client.deepbook.deepBook.swapExactQuantity({
      poolKey: options.poolKey,
      amount: options.amount,
      deepAmount: 0,
      minOut: 0,
      isBaseToCoin: options.direction === "base_to_quote",
      ...(options.direction === "base_to_quote"
        ? { baseCoin: inputCoin }
        : { quoteCoin: inputCoin }),
    })(tx);

  tx.transferObjects([baseOut, quoteOut, deepOut] as never[], options.sender);

  try {
    const result = await client.core.simulateTransaction({
      transaction: tx,
      include: {
        effects: true,
        events: true,
        balanceChanges: true,
        objectTypes: true,
        transaction: true,
      },
    });
    const simulated = result.Transaction ?? result.FailedTransaction;

    if (result.$kind !== "Transaction" || simulated?.status?.success === false) {
      return {
        simulateStatus: "failed",
        error: stringifyError(simulated?.status?.error ?? simulated?.status),
      };
    }

    const outputAmount = sumPositiveBalanceChange(
      simulated,
      options.outputCoin.type,
      options.outputCoin.scalar,
    );
    const residualAmount = sumPositiveBalanceChange(
      simulated,
      options.inputCoin.type,
      options.inputCoin.scalar,
    );

    return {
      simulateStatus: "success",
      simulateOutput: outputAmount,
      simulateResidual: residualAmount,
    };
  } catch (error) {
    return {
      simulateStatus: "error",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function sumPositiveBalanceChange(
  tx: SimulatedTransaction | undefined,
  coinType: string,
  scalar: number,
) {
  return (tx?.balanceChanges ?? [])
    .filter(
      (change) =>
        normalizeCoinType(change.coinType ?? "") === coinType &&
        Number(change.amount ?? 0) > 0,
    )
    .reduce((sum, change) => sum + Number(change.amount ?? 0) / scalar, 0);
}

function coinConfig(coin: { type: string; scalar: number } | undefined) {
  if (!coin) {
    throw new Error("Pool coin metadata is missing from DeepBook SDK config");
  }

  const parts = coin.type.split("::");
  return {
    type: normalizeCoinType(coin.type),
    scalar: coin.scalar,
    symbol: parts.at(-1) ?? "Asset",
  };
}

function loadEnv() {
  const cwd = process.cwd();
  const envLocalPath = path.resolve(cwd, ".env.local");
  const envPath = path.resolve(cwd, ".env");

  if (fs.existsSync(envLocalPath)) {
    dotenv.config({ path: envLocalPath, override: false });
  }

  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath, override: false });
  }
}

function readNetwork(): Network {
  const value = (
    process.env.NEXT_PUBLIC_SUI_NETWORK ??
    process.env.NEXT_PUBLIC_NETWORK ??
    "testnet"
  )
    .trim()
    .toLowerCase();

  if (value === "testnet" || value === "mainnet") {
    return value;
  }

  throw new Error(`Unsupported NEXT_PUBLIC_SUI_NETWORK: ${value}`);
}

function readEnv(name: string) {
  return process.env[name]?.trim();
}

function normalizeCoinType(value: string) {
  const [address, moduleName, structName] = value.split("::");
  if (!address || !moduleName || !structName) {
    return value;
  }

  return `${normalizeSuiAddress(address)}::${moduleName}::${structName}`;
}

function formatAmount(value: number) {
  if (!Number.isFinite(value)) {
    return String(value);
  }

  return value.toLocaleString("en-US", {
    maximumFractionDigits: 9,
    useGrouping: false,
  });
}

function stringifyError(value: unknown) {
  if (value == null) {
    return "";
  }

  if (typeof value === "string") {
    return value;
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
