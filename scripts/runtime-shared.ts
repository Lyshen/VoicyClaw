import { spawn } from "node:child_process"
import path from "node:path"

import { buildRuntimeEnvironment, resolveAppConfig } from "@voicyclaw/config"

export type RuntimeService = "server" | "web" | "mock-bot"
export type RuntimeMode = "dev" | "start"

export function getRuntimeEnvironment(
  env: NodeJS.ProcessEnv = process.env,
): NodeJS.ProcessEnv {
  return {
    ...env,
    ...buildRuntimeEnvironment(env),
  }
}

export function getServiceEnvironment(
  service: RuntimeService,
  env: NodeJS.ProcessEnv = process.env,
) {
  const runtimeEnv = getRuntimeEnvironment(env)
  const app = resolveAppConfig(runtimeEnv)

  if (service === "server") {
    return {
      ...runtimeEnv,
      PORT: String(app.serverPort),
    }
  }

  if (service === "web") {
    return {
      ...runtimeEnv,
      PORT: String(app.webPort),
    }
  }

  return runtimeEnv
}

export function runRepoCommand(
  args: string[],
  env: NodeJS.ProcessEnv = process.env,
) {
  return spawnAndWait("pnpm", args, env)
}

export function runSingleService(
  service: RuntimeService,
  mode: RuntimeMode,
  env: NodeJS.ProcessEnv = process.env,
) {
  const child = spawn("pnpm", ["--filter", getPackageName(service), mode], {
    cwd: process.cwd(),
    env: getServiceEnvironment(service, env),
    stdio: "inherit",
  })

  forwardTerminationSignals(child)
  return child
}

export function runConcurrentServices(
  services: RuntimeService[],
  mode: RuntimeMode,
  env: NodeJS.ProcessEnv = process.env,
) {
  const commands = services.map(
    (service) => `pnpm --filter ${getPackageName(service)} ${mode}`,
  )
  const concurrentlyCli = path.resolve(
    process.cwd(),
    "node_modules",
    "concurrently",
    "dist",
    "bin",
    "concurrently.js",
  )
  const child = spawn(
    process.execPath,
    [concurrentlyCli, "-k", "-c", "blue,green,magenta", ...commands],
    {
      cwd: process.cwd(),
      env: getRuntimeEnvironment(env),
      stdio: "inherit",
    },
  )

  forwardTerminationSignals(child)
  return child
}

export function runConcurrentCommands(
  commands: string[],
  env: NodeJS.ProcessEnv = process.env,
) {
  const concurrentlyCli = path.resolve(
    process.cwd(),
    "node_modules",
    "concurrently",
    "dist",
    "bin",
    "concurrently.js",
  )
  const child = spawn(
    process.execPath,
    [concurrentlyCli, "-k", "-c", "blue,green,magenta", ...commands],
    {
      cwd: process.cwd(),
      env: getRuntimeEnvironment(env),
      stdio: "inherit",
    },
  )

  forwardTerminationSignals(child)
  return child
}

function getPackageName(service: RuntimeService) {
  switch (service) {
    case "server":
      return "@voicyclaw/server"
    case "web":
      return "@voicyclaw/web"
    case "mock-bot":
      return "@voicyclaw/mock-bot"
  }
}

function forwardTerminationSignals(child: ReturnType<typeof spawn>) {
  const stopChild = (signal: NodeJS.Signals) => {
    if (!child.killed) {
      child.kill(signal)
    }
  }

  process.once("SIGINT", () => stopChild("SIGINT"))
  process.once("SIGTERM", () => stopChild("SIGTERM"))
}

function spawnAndWait(command: string, args: string[], env: NodeJS.ProcessEnv) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: process.cwd(),
      env: getRuntimeEnvironment(env),
      stdio: "inherit",
    })

    child.once("error", reject)
    child.once("exit", (code, signal) => {
      if (code === 0) {
        resolve()
        return
      }

      reject(
        new Error(
          `${command} ${args.join(" ")} exited with ${signal ?? code ?? "unknown status"}`,
        ),
      )
    })
  })
}
