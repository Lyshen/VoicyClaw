import { existsSync, lstatSync, mkdirSync, symlinkSync } from "node:fs"
import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(scriptDir, "..")
const candidates = [
  process.env.VOICYCLAW_WEB_STANDALONE_ENTRY,
  path.join(
    repoRoot,
    "apps",
    "web",
    ".next",
    "standalone",
    "apps",
    "web",
    "server.js",
  ),
  path.join(repoRoot, "apps", "web", ".next", "standalone", "server.js"),
  path.join(repoRoot, "apps", "web", "server.js"),
  path.join(repoRoot, "server.js"),
].filter(Boolean)

const entry = candidates.find((candidate) => existsSync(candidate))

if (!entry) {
  throw new Error(
    "Unable to find the Next standalone server. Run `pnpm build` before starting the built web runtime.",
  )
}

ensureLocalStandaloneAssets(repoRoot, entry)
await import(pathToFileURL(entry).href)

function ensureLocalStandaloneAssets(rootDir, standaloneEntry) {
  const standaloneAppDir = path.dirname(standaloneEntry)
  const standaloneNextDir = path.join(standaloneAppDir, ".next")
  const standaloneStaticDir = path.join(standaloneNextDir, "static")
  const standalonePublicDir = path.join(standaloneAppDir, "public")
  const sourceStaticDir = path.join(rootDir, "apps", "web", ".next", "static")
  const sourcePublicDir = path.join(rootDir, "apps", "web", "public")

  linkDirectory(sourceStaticDir, standaloneStaticDir)
  linkDirectory(sourcePublicDir, standalonePublicDir)
}

function linkDirectory(sourceDir, targetDir) {
  if (!existsSync(sourceDir) || existsSync(targetDir)) {
    return
  }

  mkdirSync(path.dirname(targetDir), { recursive: true })

  try {
    symlinkSync(sourceDir, targetDir, "dir")
  } catch (error) {
    if (error && typeof error === "object" && "code" in error) {
      const code = error.code
      if (code === "EEXIST") {
        return
      }
    }

    if (existsSync(targetDir) && lstatSync(targetDir).isSymbolicLink()) {
      return
    }

    throw error
  }
}
