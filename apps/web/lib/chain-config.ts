export type SuiNetwork = "mainnet" | "testnet" | "devnet" | "localnet"

export const NETWORK = (
  process.env.NEXT_PUBLIC_SUI_NETWORK ?? "testnet"
) as SuiNetwork

export const PACKAGE_ID =
  process.env.NEXT_PUBLIC_PACKAGE_ID ??
  process.env.PACKAGE_ID ??
  "0x18675445cebd947ab5f5b5e01fcd101a343f44ec76f064cb77b2e23f1f878fbc"

export const CURRENT_MANDATE_ID =
  process.env.NEXT_PUBLIC_CURRENT_MANDATE_ID ??
  "0xd9f4e6b43709b3ad6810412b91c78989a0df172b7f2393169c4c7259bd20227c"

export const CLOCK_OBJECT_ID =
  process.env.NEXT_PUBLIC_CLOCK_OBJECT_ID ?? "0x6"

export const DEEPBOOK_POOL_KEY =
  process.env.NEXT_PUBLIC_DEEPBOOK_POOL_KEY ?? "DEEP_SUI"

export const DEEPBOOK_POOL_ID =
  process.env.NEXT_PUBLIC_DEEPBOOK_POOL_ID ??
  "0x48c95963e9eac37a316b7ae04a0deb761bcdcc2b67912374d6036e7f0e9bae9f"

export const VERIFIED_DEEPBOOK_DIGEST =
  process.env.NEXT_PUBLIC_VERIFIED_DEEPBOOK_DIGEST ??
  "DkV1SdVQhYw8U8ErQzkVZH225LkPqBeKtJBzkLk6PSfX"

export const VERIFIED_AGENT_ADDRESS =
  process.env.NEXT_PUBLIC_VERIFIED_AGENT_ADDRESS ??
  "0x91dc52b575b3cd5703be07ee65e12b5af3a25d927b16fa8f94811b7b773ad8b2"

export const AGENT_WALLET_ADDRESS =
  process.env.NEXT_PUBLIC_AGENT_WALLET_ADDRESS ?? VERIFIED_AGENT_ADDRESS

export function formatConfigId(value: string, prefixLength = 6, suffixLength = 4) {
  return `${value.slice(0, prefixLength)}...${value.slice(-suffixLength)}`
}

export const NETWORK_LABEL = NETWORK.toUpperCase()

export function normalizeSuiAddress(value?: string | null) {
  const raw = value?.trim().toLowerCase()
  if (!raw) {
    return ""
  }

  const withoutPrefix = raw.startsWith("0x") ? raw.slice(2) : raw
  const normalized = withoutPrefix.replace(/^0+/, "") || "0"
  return `0x${normalized}`
}

export function mandatePackageFromObjectType(objectType?: string | null) {
  return objectType?.split("::")[0] ?? ""
}

export function currentMandateObjectType(packageId = PACKAGE_ID) {
  return `${packageId}::mandate::Mandate`
}

export function isCurrentMandateObjectType(objectType?: string | null) {
  if (!objectType?.endsWith("::mandate::Mandate")) {
    return false
  }

  return (
    normalizeSuiAddress(mandatePackageFromObjectType(objectType)) ===
    normalizeSuiAddress(PACKAGE_ID)
  )
}
