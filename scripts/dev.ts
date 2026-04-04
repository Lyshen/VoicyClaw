import { runConcurrentServices, runRepoCommand } from "./runtime-shared"

await runRepoCommand(["db:generate"])
await runRepoCommand(["db:push"])

const child = runConcurrentServices(["server", "web", "mock-bot"], "dev")

await new Promise<void>((resolve, reject) => {
  child.once("error", reject)
  child.once("exit", (code, signal) => {
    if (code === 0 || signal === "SIGINT" || signal === "SIGTERM") {
      resolve()
      return
    }

    reject(
      new Error(
        `Concurrent dev services exited with ${signal ?? code ?? "unknown status"}`,
      ),
    )
  })
})
