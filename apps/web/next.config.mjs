import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

function loadRootEnv() {
  const configDir = path.dirname(fileURLToPath(import.meta.url));
  const rootEnvPath = path.resolve(configDir, "../..", ".env.local");
  if (!fs.existsSync(rootEnvPath)) {
    return;
  }

  const raw = fs.readFileSync(rootEnvPath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const index = trimmed.indexOf("=");
    if (index === -1) {
      continue;
    }

    const key = trimmed.slice(0, index).trim();
    const value = trimmed
      .slice(index + 1)
      .trim()
      .replace(/^['"]|['"]$/g, "");
    if (key) {
      process.env[key] = value;
    }
  }
}

loadRootEnv();

/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    NEXT_PUBLIC_PACKAGE_ID: process.env.NEXT_PUBLIC_PACKAGE_ID,
    NEXT_PUBLIC_BACKEND_AGENT_ADDRESS:
      process.env.NEXT_PUBLIC_BACKEND_AGENT_ADDRESS ??
      process.env.NEXT_PUBLIC_VERIFIED_AGENT_ADDRESS,
    NEXT_PUBLIC_SUI_NETWORK: process.env.NEXT_PUBLIC_SUI_NETWORK,
    NEXT_PUBLIC_CLOCK_OBJECT_ID: process.env.NEXT_PUBLIC_CLOCK_OBJECT_ID,
    NEXT_PUBLIC_DEEPBOOK_POOL_KEY: process.env.NEXT_PUBLIC_DEEPBOOK_POOL_KEY,
    NEXT_PUBLIC_DEEPBOOK_POOL_ID: process.env.NEXT_PUBLIC_DEEPBOOK_POOL_ID,
    NEXT_PUBLIC_VERIFIED_DEEPBOOK_DIGEST:
      process.env.NEXT_PUBLIC_VERIFIED_DEEPBOOK_DIGEST,
    NEXT_PUBLIC_CURRENT_MANDATE_ID: process.env.NEXT_PUBLIC_CURRENT_MANDATE_ID,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  devIndicators: {
    position: "bottom-right",
  },
};

export default nextConfig;
