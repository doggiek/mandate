export type SuiNetwork = "mainnet" | "testnet" | "devnet" | "localnet";

export const NETWORK = (process.env.NEXT_PUBLIC_SUI_NETWORK ??
  "testnet") as SuiNetwork;

export const LEGACY_DEFAULT_PACKAGE_ID =
  "0x18675445cebd947ab5f5b5e01fcd101a343f44ec76f064cb77b2e23f1f878fbc";

export const LEGACY_POLICY_PACKAGE_IDS = [
  LEGACY_DEFAULT_PACKAGE_ID,
  "0xad7bb3a9c4d29962018fc1f2a1b968b283842a2c27c55ad7b5787725733fd2e9",
];

export const PUBLIC_PACKAGE_ID =
  process.env.NEXT_PUBLIC_PACKAGE_ID?.trim() ?? "";

export const PACKAGE_ID = PUBLIC_PACKAGE_ID;

export const PACKAGE_ID_SOURCE = PUBLIC_PACKAGE_ID
  ? "NEXT_PUBLIC_PACKAGE_ID"
  : "missing";

export const IS_PUBLIC_PACKAGE_ID_CONFIGURED = Boolean(PUBLIC_PACKAGE_ID);

export const CURRENT_MANDATE_ID =
  process.env.NEXT_PUBLIC_CURRENT_MANDATE_ID ??
  "0xd9f4e6b43709b3ad6810412b91c78989a0df172b7f2393169c4c7259bd20227c";

export const CLOCK_OBJECT_ID = process.env.NEXT_PUBLIC_CLOCK_OBJECT_ID ?? "0x6";

export const DEEPBOOK_POOL_KEY =
  process.env.NEXT_PUBLIC_DEEPBOOK_POOL_KEY_DEEP_SUI ??
  process.env.NEXT_PUBLIC_DEEPBOOK_POOL_KEY ??
  "DEEP_SUI";

export const DEEPBOOK_POOL_ID =
  process.env.NEXT_PUBLIC_DEEPBOOK_POOL_ID_DEEP_SUI ??
  process.env.NEXT_PUBLIC_DEEPBOOK_POOL_ID ??
  "0x48c95963e9eac37a316b7ae04a0deb761bcdcc2b67912374d6036e7f0e9bae9f";

export const DEEPBOOK_POOL_KEY_SUI_DUSDC =
  process.env.NEXT_PUBLIC_DEEPBOOK_POOL_KEY_SUI_DBUSDC ??
  process.env.NEXT_PUBLIC_DEEPBOOK_POOL_KEY_SUI_DUSDC ??
  "SUI_DUSDC";

export const DEEPBOOK_POOL_ID_SUI_DUSDC =
  process.env.NEXT_PUBLIC_DEEPBOOK_POOL_ID_SUI_DBUSDC ??
  process.env.NEXT_PUBLIC_DEEPBOOK_POOL_ID_SUI_DUSDC ??
  "";

export const DUSDC_COIN_TYPE =
  process.env.NEXT_PUBLIC_DBUSDC_COIN_TYPE ??
  process.env.NEXT_PUBLIC_DUSDC_COIN_TYPE ??
  "";

export const VERIFIED_DEEPBOOK_DIGEST =
  process.env.NEXT_PUBLIC_VERIFIED_DEEPBOOK_DIGEST ??
  "DkV1SdVQhYw8U8ErQzkVZH225LkPqBeKtJBzkLk6PSfX";

const PUBLIC_BACKEND_AGENT_ADDRESS_VALUE =
  process.env.NEXT_PUBLIC_BACKEND_AGENT_ADDRESS?.trim();
const LEGACY_PUBLIC_AGENT_ADDRESS_VALUE =
  process.env.NEXT_PUBLIC_VERIFIED_AGENT_ADDRESS?.trim();

export const PUBLIC_BACKEND_AGENT_ADDRESS =
  PUBLIC_BACKEND_AGENT_ADDRESS_VALUE || LEGACY_PUBLIC_AGENT_ADDRESS_VALUE || "";

export const BACKEND_AGENT_ADDRESS =
  PUBLIC_BACKEND_AGENT_ADDRESS ||
  "0x91dc52b575b3cd5703be07ee65e12b5af3a25d927b16fa8f94811b7b773ad8b2";

export const BACKEND_AGENT_ADDRESS_SOURCE = PUBLIC_BACKEND_AGENT_ADDRESS_VALUE
  ? "NEXT_PUBLIC_BACKEND_AGENT_ADDRESS"
  : LEGACY_PUBLIC_AGENT_ADDRESS_VALUE
    ? "NEXT_PUBLIC_VERIFIED_AGENT_ADDRESS"
    : "fallback";

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

export const NETWORK_LABEL = NETWORK.toUpperCase();

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
