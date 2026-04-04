import type { RuntimeMode, RuntimeService } from "./runtime-shared"
import { runSingleService } from "./runtime-shared"

const service = process.argv[2] as RuntimeService | undefined
const mode = process.argv[3] as RuntimeMode | undefined

if (
  !service ||
  !mode ||
  !["server", "web", "mock-bot"].includes(service) ||
  !["dev", "start"].includes(mode)
) {
  throw new Error(
    "Usage: tsx scripts/run-service.ts <server|web|mock-bot> <dev|start>",
  )
}

const child = runSingleService(service, mode)

await new Promise<void>((resolve, reject) => {
  child.once("error", reject)
  child.once("exit", (code, signal) => {
    if (code === 0 || signal === "SIGINT" || signal === "SIGTERM") {
      resolve()
      return
    }

    reject(
      new Error(
        `${service} ${mode} exited with ${signal ?? code ?? "unknown status"}`,
      ),
    )
  })
})
