import { execFileSync } from "node:child_process"
import { readdir } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, "..")
const releaseDir = path.join(repoRoot, "dist", "release")
const tarballName = await findLatestTarball(releaseDir)
const tarballPath = path.join(releaseDir, tarballName)
const entries = execFileSync("tar", ["-tzf", tarballPath], {
  cwd: repoRoot,
  encoding: "utf8",
})
  .split("\n")
  .filter(Boolean)

const disallowedEntries = entries.filter((entry) =>
  /(?:^|\/)[^/]+\.test\.ts$/.test(entry),
)

if (disallowedEntries.length > 0) {
  throw new Error(
    `Plugin tarball contains test files:\n${disallowedEntries.join("\n")}`,
  )
}

const requiredEntries = [
  "package/index.ts",
  "package/openclaw.plugin.json",
  "package/src/channel.ts",
  "package/src/config.ts",
  "package/src/dispatch.ts",
  "package/src/gateway.ts",
  "package/src/protocol.ts",
  "package/src/runtime.ts",
  "package/src/socket-client.ts",
]

const missingEntries = requiredEntries.filter(
  (entry) => !entries.includes(entry),
)

if (missingEntries.length > 0) {
  throw new Error(
    `Plugin tarball is missing required files:\n${missingEntries.join("\n")}`,
  )
}

console.log(`Verified plugin tarball ${tarballName}`)

async function findLatestTarball(directory) {
  const names = (await readdir(directory))
    .filter((name) => /^voicyclaw-voicyclaw-.*\.tgz$/.test(name))
    .sort()

  const tarballName = names.at(-1)
  if (!tarballName) {
    throw new Error(`No plugin tarball found in ${directory}`)
  }

  return tarballName
}
