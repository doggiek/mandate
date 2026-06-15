import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

function loadRootEnv() {
  const configDir = path.dirname(fileURLToPath(import.meta.url))
  const rootEnvPath = path.resolve(configDir, "../..", ".env.local")
  if (!fs.existsSync(rootEnvPath)) {
    return
  }

  const raw = fs.readFileSync(rootEnvPath, "utf8")
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) {
      continue
    }

    const index = trimmed.indexOf("=")
    if (index === -1) {
      continue
    }

    const key = trimmed.slice(0, index).trim()
    const value = trimmed.slice(index + 1).trim().replace(/^['"]|['"]$/g, "")
    if (key && !process.env[key]) {
      process.env[key] = value
    }
  }
}

loadRootEnv()

/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig
