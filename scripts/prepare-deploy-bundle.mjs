import { cp, mkdir, rm } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, "..")
const deployDir = path.join(repoRoot, "deploy")
const distDir = path.join(repoRoot, "dist", "deploy")

await rm(distDir, { recursive: true, force: true })
await mkdir(distDir, { recursive: true })

for (const fileName of [
  "docker-compose.yml",
  "docker.env.example",
  "README.md",
]) {
  await cp(path.join(deployDir, fileName), path.join(distDir, fileName))
}

console.log("Prepared deploy bundle in dist/deploy")
