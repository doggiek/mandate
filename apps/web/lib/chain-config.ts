export type SuiNetwork = "testnet" | "mainnet";

type EnvReader = (name: string) => string | undefined;

const readProcessEnv: EnvReader = (name) => process.env[name];

const DEFAULT_RPC_URLS: Record<SuiNetwork, string> = {
  testnet: "https://fullnode.testnet.sui.io:443",
  mainnet: "https://fullnode.mainnet.sui.io:443",
};

const DEFAULT_EXPLORER_URLS: Record<SuiNetwork, string> = {
  testnet: "https://testnet.suivision.xyz",
  mainnet: "https://suivision.xyz",
};

const SUI_COIN_TYPE = "0x2::sui::SUI";

function envValue(env: EnvReader, ...names: string[]) {
  for (const name of names) {
    const value = env(name)?.trim();
    if (value) {
      return value;
    }
  }

  return "";
}

function networkSuffix(network: SuiNetwork) {
  return network.toUpperCase();
}

export function getSuiNetwork(env: EnvReader = readProcessEnv): SuiNetwork {
  const raw = (
    env("NEXT_PUBLIC_SUI_NETWORK") ??
    env("NEXT_PUBLIC_NETWORK") ??
    "testnet"
  )
    .trim()
    .toLowerCase();

  return raw === "mainnet" ? "mainnet" : "testnet";
}

export const NETWORK = getSuiNetwork();

export function getSuiNetworkLabel(
  network: SuiNetwork = NETWORK,
): "Testnet" | "Mainnet" {
  return network === "mainnet" ? "Mainnet" : "Testnet";
}

export const NETWORK_LABEL = getSuiNetworkLabel();

export function getRpcUrl(
  network: SuiNetwork = NETWORK,
  env: EnvReader = readProcessEnv,
) {
  return (
    envValue(env, `NEXT_PUBLIC_SUI_RPC_${networkSuffix(network)}`) ||
    DEFAULT_RPC_URLS[network]
  );
}

export function getExplorerBaseUrl(
  network: SuiNetwork = NETWORK,
  env: EnvReader = readProcessEnv,
) {
  return (
    envValue(env, `NEXT_PUBLIC_EXPLORER_BASE_URL_${networkSuffix(network)}`) ||
    DEFAULT_EXPLORER_URLS[network]
  ).replace(/\/$/, "");
}

export function getPackageId(
  network: SuiNetwork = NETWORK,
  env: EnvReader = readProcessEnv,
) {
  const suffix = networkSuffix(network);
  const legacyFallbacks = network === "testnet" ? ["NEXT_PUBLIC_PACKAGE_ID", "PACKAGE_ID"] : [];
  return envValue(
    env,
    `NEXT_PUBLIC_PACKAGE_ID_${suffix}`,
    `PACKAGE_ID_${suffix}`,
    ...legacyFallbacks,
  );
}

export function getPackageIdSource(
  network: SuiNetwork = NETWORK,
  env: EnvReader = readProcessEnv,
) {
  const suffix = networkSuffix(network);
  const legacyFallbacks = network === "testnet" ? ["NEXT_PUBLIC_PACKAGE_ID", "PACKAGE_ID"] : [];
  const candidates = [
    `NEXT_PUBLIC_PACKAGE_ID_${suffix}`,
    `PACKAGE_ID_${suffix}`,
    ...legacyFallbacks,
  ];

  return candidates.find((name) => Boolean(env(name)?.trim())) ?? "missing";
}

export type ActiveDeepBookRouteConfig = {
  routeId: "deep_momentum_buy";
  poolKey: string;
  poolId: string;
  spendCoinType: string;
  buyCoinType: string;
  configured: boolean;
  unavailableReason?: string;
};

export type TestUsdcRouteConfig = {
  routeId: "sui_momentum_buy";
  poolKey: string;
  poolId: string;
  coinType: string;
  configured: boolean;
  unavailableReason: string;
};

export function getActiveDeepBookRouteConfig(
  network: SuiNetwork = NETWORK,
  env: EnvReader = readProcessEnv,
): ActiveDeepBookRouteConfig {
  const suffix = networkSuffix(network);
  const allowLegacyFallback = network === "testnet";
  const poolKey =
    envValue(
      env,
      `NEXT_PUBLIC_DEEPBOOK_POOL_KEY_${suffix}`,
      ...(allowLegacyFallback
        ? [
            "NEXT_PUBLIC_DEEPBOOK_POOL_KEY_DEEP_SUI",
            "NEXT_PUBLIC_DEEPBOOK_POOL_KEY",
          ]
        : []),
    ) || (network === "testnet" ? "DEEP_SUI" : "");
  const poolId = envValue(
    env,
    `NEXT_PUBLIC_DEEPBOOK_POOL_ID_${suffix}`,
    ...(allowLegacyFallback
      ? [
          "NEXT_PUBLIC_DEEPBOOK_POOL_ID_DEEP_SUI",
          "NEXT_PUBLIC_DEEPBOOK_POOL_ID",
        ]
      : []),
  );
  const spendCoinType =
    envValue(env, `NEXT_PUBLIC_SPEND_COIN_TYPE_${suffix}`) || SUI_COIN_TYPE;
  const buyCoinType = envValue(env, `NEXT_PUBLIC_BUY_COIN_TYPE_${suffix}`);
  const configured = Boolean(poolKey && poolId && spendCoinType);

  return {
    routeId: "deep_momentum_buy",
    poolKey,
    poolId,
    spendCoinType,
    buyCoinType,
    configured,
    unavailableReason: configured
      ? undefined
      : "Route is not configured for current network.",
  };
}

export function getTokenConfig(
  network: SuiNetwork = NETWORK,
  env: EnvReader = readProcessEnv,
) {
  const route = getActiveDeepBookRouteConfig(network, env);
  return {
    spendCoinType: route.spendCoinType,
    buyCoinType: route.buyCoinType,
    spendSymbol: route.spendCoinType === SUI_COIN_TYPE ? "SUI" : "Asset",
    buySymbol: "DEEP",
  };
}

export function getTestUsdcRouteConfig(
  env: EnvReader = readProcessEnv,
): TestUsdcRouteConfig {
  const poolKey =
    envValue(
      env,
      "NEXT_PUBLIC_DEEPBOOK_POOL_KEY_SUI_DBUSDC",
      "NEXT_PUBLIC_DEEPBOOK_POOL_KEY_SUI_DUSDC",
    ) || "SUI_DUSDC";
  const poolId = envValue(
    env,
    "NEXT_PUBLIC_DEEPBOOK_POOL_ID_SUI_DBUSDC",
    "NEXT_PUBLIC_DEEPBOOK_POOL_ID_SUI_DUSDC",
  );
  const coinType = envValue(
    env,
    "NEXT_PUBLIC_DBUSDC_COIN_TYPE",
    "NEXT_PUBLIC_DUSDC_COIN_TYPE",
  );

  return {
    routeId: "sui_momentum_buy",
    poolKey,
    poolId,
    coinType,
    configured: Boolean(poolId && coinType),
    unavailableReason: "USDC route unavailable on the current DeepBook network.",
  };
}

export const LEGACY_DEFAULT_PACKAGE_ID =
  "0x18675445cebd947ab5f5b5e01fcd101a343f44ec76f064cb77b2e23f1f878fbc";

export const LEGACY_POLICY_PACKAGE_IDS = [
  LEGACY_DEFAULT_PACKAGE_ID,
  "0xad7bb3a9c4d29962018fc1f2a1b968b283842a2c27c55ad7b5787725733fd2e9",
];

export const PUBLIC_PACKAGE_ID = getPackageId();

export const PACKAGE_ID = PUBLIC_PACKAGE_ID;

export const PACKAGE_ID_SOURCE = getPackageIdSource();

export const IS_PUBLIC_PACKAGE_ID_CONFIGURED = Boolean(PUBLIC_PACKAGE_ID);

export const CURRENT_MANDATE_ID =
  process.env.NEXT_PUBLIC_CURRENT_MANDATE_ID ?? "";

export const CLOCK_OBJECT_ID = process.env.NEXT_PUBLIC_CLOCK_OBJECT_ID ?? "0x6";

const ACTIVE_DEEPBOOK_ROUTE = getActiveDeepBookRouteConfig();

export const DEEPBOOK_POOL_KEY = ACTIVE_DEEPBOOK_ROUTE.poolKey;

export const DEEPBOOK_POOL_ID = ACTIVE_DEEPBOOK_ROUTE.poolId;

const TEST_USDC_ROUTE = getTestUsdcRouteConfig();

export const DEEPBOOK_POOL_KEY_SUI_DUSDC = TEST_USDC_ROUTE.poolKey;

export const DEEPBOOK_POOL_ID_SUI_DUSDC = TEST_USDC_ROUTE.poolId;

export const DUSDC_COIN_TYPE = TEST_USDC_ROUTE.coinType;

export const VERIFIED_DEEPBOOK_DIGEST =
  process.env.NEXT_PUBLIC_VERIFIED_DEEPBOOK_DIGEST ?? "";

const PUBLIC_BACKEND_AGENT_ADDRESS_VALUE =
  process.env.NEXT_PUBLIC_BACKEND_AGENT_ADDRESS?.trim();
const LEGACY_PUBLIC_AGENT_ADDRESS_VALUE =
  process.env.NEXT_PUBLIC_VERIFIED_AGENT_ADDRESS?.trim();

export const PUBLIC_BACKEND_AGENT_ADDRESS =
  PUBLIC_BACKEND_AGENT_ADDRESS_VALUE || LEGACY_PUBLIC_AGENT_ADDRESS_VALUE || "";

export const BACKEND_AGENT_ADDRESS = PUBLIC_BACKEND_AGENT_ADDRESS;

export const BACKEND_AGENT_ADDRESS_SOURCE = PUBLIC_BACKEND_AGENT_ADDRESS_VALUE
  ? "NEXT_PUBLIC_BACKEND_AGENT_ADDRESS"
  : LEGACY_PUBLIC_AGENT_ADDRESS_VALUE
    ? "NEXT_PUBLIC_VERIFIED_AGENT_ADDRESS"
    : "missing";

export const IS_BACKEND_AGENT_ADDRESS_CONFIGURED = Boolean(
  PUBLIC_BACKEND_AGENT_ADDRESS,
);

export function formatConfigId(
  value: string,
  prefixLength = 6,
  suffixLength = 4,
) {
  return `${value.slice(0, prefixLength)}...${value.slice(-suffixLength)}`;
}

export const IS_LEGACY_POLICY_PACKAGE_ID = LEGACY_POLICY_PACKAGE_IDS.some(
  (packageId) =>
    IS_PUBLIC_PACKAGE_ID_CONFIGURED &&
    normalizeSuiAddress(PACKAGE_ID) === normalizeSuiAddress(packageId),
);

export function normalizeSuiAddress(value?: string | null) {
  const raw = value?.trim().toLowerCase();
  if (!raw) {
    return "";
  }

  const withoutPrefix = raw.startsWith("0x") ? raw.slice(2) : raw;
  const normalized = withoutPrefix.replace(/^0+/, "") || "0";
  return `0x${normalized}`;
}

export function mandatePackageFromObjectType(objectType?: string | null) {
  return objectType?.split("::")[0] ?? "";
}

export function currentMandateObjectType(packageId = PACKAGE_ID) {
  return `${packageId}::mandate::Mandate`;
}

export function currentAssetMandateObjectType(
  coinType: string,
  packageId = PACKAGE_ID,
) {
  return `${packageId}::mandate::AssetMandate<${coinType}>`;
}

export function isCurrentMandateObjectType(objectType?: string | null) {
  if (
    !objectType?.endsWith("::mandate::Mandate") &&
    !objectType?.includes("::mandate::AssetMandate<")
  ) {
    return false;
  }

  return (
    normalizeSuiAddress(mandatePackageFromObjectType(objectType)) ===
    normalizeSuiAddress(PACKAGE_ID)
  );
}
