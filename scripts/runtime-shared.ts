import { spawn } from "node:child_process"
import path from "node:path"

import {
  buildRuntimeEnvironment,
  resolveAppConfig,
} from "../packages/config/src/index.ts"

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
  return runCommand("pnpm", args, env)
}

export function runCommand(
  command: string,
  args: string[],
  env: NodeJS.ProcessEnv = process.env,
) {
  return spawnAndWait(command, args, env)
}

export function runSingleService(
  service: RuntimeService,
  mode: RuntimeMode,
  env: NodeJS.ProcessEnv = process.env,
) {
  const child = spawnService(service, mode, env)
  forwardTerminationSignals([child])
  return child
}

export function runServiceGroup(
  services: RuntimeService[],
  mode: RuntimeMode,
  env: NodeJS.ProcessEnv = process.env,
) {
  const children = services.map((service) => ({
    service,
    child: spawnService(service, mode, env),
  }))

  forwardTerminationSignals(children.map(({ child }) => child))

  return new Promise<void>((resolve, reject) => {
    let settled = false
    let remaining = children.length

    const fail = (message: string) => {
      if (settled) {
        return
      }

      settled = true
      stopChildren(children.map(({ child }) => child))
      reject(new Error(message))
    }

    for (const { service, child } of children) {
      child.once("error", (error) => {
        fail(
          `${service} ${mode} failed to start: ${
            error instanceof Error ? error.message : String(error)
          }`,
        )
      })

      child.once("exit", (code, signal) => {
        remaining -= 1

        const cleanExit =
          code === 0 || signal === "SIGINT" || signal === "SIGTERM"
        if (!cleanExit) {
          fail(
            `${service} ${mode} exited with ${signal ?? code ?? "unknown status"}`,
          )
          return
        }

        if (remaining === 0 && !settled) {
          settled = true
          resolve()
        }
      })
    }
  })
}

function spawnService(
  service: RuntimeService,
  mode: RuntimeMode,
  env: NodeJS.ProcessEnv,
) {
  const command = resolveServiceCommand(service, mode)

  return spawn(command.command, command.args, {
    cwd: process.cwd(),
    env: getServiceEnvironment(service, env),
    stdio: "inherit",
  })
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

function resolveServiceCommand(service: RuntimeService, mode: RuntimeMode) {
  if (mode === "dev") {
    return {
      command: "pnpm",
      args: ["--filter", getPackageName(service), "dev"],
    }
  }

  switch (service) {
    case "server":
      return {
        command: process.execPath,
        args: [path.resolve(process.cwd(), "apps/server/dist/index.js")],
      }
    case "web":
      return {
        command: process.execPath,
        args: [path.resolve(process.cwd(), "scripts/start-web-standalone.mjs")],
      }
    case "mock-bot":
      return {
        command: process.execPath,
        args: [path.resolve(process.cwd(), "apps/mock-bot/dist/index.js")],
      }
  }
}

function forwardTerminationSignals(children: Array<ReturnType<typeof spawn>>) {
  const stopChild = (signal: NodeJS.Signals) => {
    stopChildren(children, signal)
  }

  process.once("SIGINT", () => stopChild("SIGINT"))
  process.once("SIGTERM", () => stopChild("SIGTERM"))
}

function stopChildren(
  children: Array<ReturnType<typeof spawn>>,
  signal: NodeJS.Signals = "SIGTERM",
) {
  for (const child of children) {
    if (!child.killed) {
      child.kill(signal)
    }
  }
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
