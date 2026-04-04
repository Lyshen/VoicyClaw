import { resolveAppConfig } from "@voicyclaw/config"

import { getRuntimeEnvironment, runConcurrentCommands } from "./runtime-shared"

const runtimeEnv = getRuntimeEnvironment()
const app = resolveAppConfig(runtimeEnv)
const tsxCli = "./node_modules/tsx/dist/cli.mjs"

const child = runConcurrentCommands([
  `PORT=${app.serverPort} node ${tsxCli} apps/server/src/index.ts`,
  `PORT=${app.webPort} pnpm --filter @voicyclaw/web start`,
  `node ${tsxCli} apps/mock-bot/src/index.ts`,
])

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
