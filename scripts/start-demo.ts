import { runConcurrentServices } from "./runtime-shared"

const child = runConcurrentServices(["server", "web", "mock-bot"], "start")

await new Promise<void>((resolve, reject) => {
  child.once("error", reject)
  child.once("exit", (code, signal) => {
    if (code === 0 || signal === "SIGINT" || signal === "SIGTERM") {
      resolve()
      return
    }

    reject(
      new Error(
        `Concurrent demo services exited with ${signal ?? code ?? "unknown status"}`,
      ),
    )
  })
})
