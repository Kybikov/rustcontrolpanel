import { readFile } from "node:fs/promises"
import { resolve } from "node:path"

const root = resolve(import.meta.dirname, "..")
const packageJson = JSON.parse(await readFile(resolve(root, "package.json"), "utf8"))
const lockfile = JSON.parse(await readFile(resolve(root, "package-lock.json"), "utf8"))
const releases = JSON.parse(await readFile(resolve(root, "data/releases.json"), "utf8"))

if (!Array.isArray(releases) || releases.length === 0) {
  throw new Error("data/releases.json must contain at least one release")
}

const current = releases[0]
if (current.version !== packageJson.version || current.version !== lockfile.version) {
  throw new Error(`release ${current.version} does not match package versions ${packageJson.version}/${lockfile.version}`)
}

const versions = releases.map((release) => release.version)
if (new Set(versions).size !== versions.length) {
  throw new Error("data/releases.json contains duplicate versions")
}

for (const [index, release] of releases.entries()) {
  for (const field of ["version", "date", "added", "fixed", "removed"]) {
    if (!(field in release)) {
      throw new Error(`release ${index + 1} is missing ${field}`)
    }
  }
  for (const field of ["added", "fixed", "removed"]) {
    if (!Array.isArray(release[field]) || release[field].some((item) => typeof item !== "string" || item.trim() === "")) {
      throw new Error(`release ${release.version} has invalid ${field} notes`)
    }
  }
}

console.log(`Release changelog is valid: ${current.version}`)
