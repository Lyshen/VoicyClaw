import { cp, mkdir, rm } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, "..")
const deployDir = path.join(repoRoot, "deploy")
const configDir = path.join(repoRoot, "config")
const distDir = path.join(repoRoot, "dist", "deploy")
const distConfigDir = path.join(distDir, "config")

await rm(distDir, { recursive: true, force: true })
await mkdir(distDir, { recursive: true })
await mkdir(distConfigDir, { recursive: true })

for (const fileName of [
  "docker-compose.yml",
  "docker.env.example",
  "README.md",
]) {
  await cp(path.join(deployDir, fileName), path.join(distDir, fileName))
}

await cp(
  path.join(configDir, "voicyclaw.example.yaml"),
  path.join(distConfigDir, "voicyclaw.example.yaml"),
)

console.log("Prepared deploy bundle in dist/deploy")
