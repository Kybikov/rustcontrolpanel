import { existsSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import type { NextConfig } from "next"

const appRoot = path.dirname(fileURLToPath(import.meta.url))
const workspaceRoot = path.resolve(appRoot, "../..")

const nextConfig: NextConfig = {
  turbopack: {
    root: existsSync(path.join(workspaceRoot, "node_modules/next/package.json")) ? workspaceRoot : appRoot,
  },
}

export default nextConfig
