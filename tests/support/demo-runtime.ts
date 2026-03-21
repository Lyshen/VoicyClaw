import { randomUUID } from "node:crypto"
import { spawn } from "node:child_process"
import { mkdtemp, rm } from "node:fs/promises"
import { createServer } from "node:net"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { setTimeout as delay } from "node:timers/promises"

import type { ClientControlMessage, ClientHelloMessage, ServerToClientMessage } from "@voicyclaw/protocol"
import WebSocket from "ws"

type RuntimeSettings = ClientHelloMessage["settings"]

type Waiter = {
  predicate: (message: ServerToClientMessage) => boolean
  resolve: (message: ServerToClientMessage) => void
  reject: (error: Error) => void
  timeout: ReturnType<typeof setTimeout>
}

export async function startDemoRuntime() {
  const repoRoot = resolve(process.cwd())
  const tempDir = await mkdtemp(join(tmpdir(), "voicyclaw-integration-"))
  const databaseFile = join(tempDir, "voicyclaw.sqlite")
  const port = await getFreePort()
  const channelId = `integration-${randomUUID().slice(0, 8)}`
  const serverUrl = `http://127.0.0.1:${port}`

  const server = spawnTsxProcess("apps/server/src/index.ts", {
    PORT: String(port),
    VOICYCLAW_SQLITE_FILE: databaseFile
  })

  await waitFor(async () => {
    const response = await fetch(new URL("/api/health", serverUrl))
    return response.ok
  }, 20_000, `Server did not become healthy.\n\n${server.dumpLogs()}`)

  const bot = spawnTsxProcess("apps/mock-bot/src/index.ts", {
    VOICYCLAW_SERVER_URL: serverUrl,
    CHANNEL_ID: channelId,
    BOT_ID: `integration-bot-${randomUUID().slice(0, 6)}`,
    BOT_NAME: "Integration Bot"
  })

  await waitFor(async () => {
    const response = await fetch(new URL(`/api/channels/${channelId}`, serverUrl))
    if (!response.ok) return false

    const payload = (await response.json()) as { botCount?: number }
    return (payload.botCount ?? 0) >= 1
  }, 20_000, `Mock bot did not connect.\n\n${server.dumpLogs()}\n\n${bot.dumpLogs()}`)

  return {
    channelId,
    serverUrl,
    async connectClient(settings: RuntimeSettings) {
      const clientId = `test-client-${randomUUID().slice(0, 8)}`
      const wsUrl = new URL("/ws/client", serverUrl.replace(/^http/i, "ws"))
      wsUrl.searchParams.set("channelId", channelId)
      wsUrl.searchParams.set("clientId", clientId)

      const socket = new WebSocket(wsUrl)
      await waitForSocketOpen(socket, 10_000)

      const client = new RuntimeClient(socket)
      client.send({
        type: "CLIENT_HELLO",
        clientId,
        channelId,
        settings
      })
      await client.waitForMessage(
        (message) => message.type === "CHANNEL_STATE" && message.channelId === channelId
      )

      return client
    },
    async stop() {
      await bot.stop()
      await server.stop()
      await rm(tempDir, { recursive: true, force: true })
    },
    dumpLogs() {
      return [server.dumpLogs(), bot.dumpLogs()].filter(Boolean).join("\n\n")
    }
  }
}

export class RuntimeClient {
  private readonly backlog: ServerToClientMessage[] = []
  private readonly waiters: Waiter[] = []

  constructor(private readonly socket: WebSocket) {
    socket.on("message", (raw, isBinary) => {
      if (isBinary) return

      const message = JSON.parse(raw.toString()) as ServerToClientMessage
      this.backlog.push(message)
      this.flush(message)
    })

    socket.on("close", () => {
      this.rejectWaiters(new Error("Client socket closed before the expected message arrived."))
    })

    socket.on("error", (error) => {
      this.rejectWaiters(error instanceof Error ? error : new Error(String(error)))
    })
  }

  send(payload: ClientControlMessage) {
    this.socket.send(JSON.stringify(payload))
  }

  async close() {
    if (
      this.socket.readyState === WebSocket.CLOSING ||
      this.socket.readyState === WebSocket.CLOSED
    ) {
      return
    }

    await new Promise<void>((resolve) => {
      this.socket.once("close", () => resolve())
      this.socket.close()
    })
  }

  waitForMessage(
    predicate: (message: ServerToClientMessage) => boolean,
    timeoutMs = 20_000
  ) {
    const cached = this.backlog.find(predicate)
    if (cached) {
      return Promise.resolve(cached)
    }

    return new Promise<ServerToClientMessage>((resolve, reject) => {
      const timeout = globalThis.setTimeout(() => {
        const index = this.waiters.indexOf(waiter)
        if (index !== -1) {
          this.waiters.splice(index, 1)
        }
        reject(new Error(`Timed out after ${timeoutMs}ms waiting for a runtime message.`))
      }, timeoutMs)

      const waiter: Waiter = {
        predicate,
        resolve: (message) => {
          globalThis.clearTimeout(timeout)
          resolve(message)
        },
        reject: (error) => {
          globalThis.clearTimeout(timeout)
          reject(error)
        },
        timeout
      }

      this.waiters.push(waiter)
    })
  }

  private flush(message: ServerToClientMessage) {
    for (const waiter of [...this.waiters]) {
      if (!waiter.predicate(message)) continue

      const index = this.waiters.indexOf(waiter)
      if (index !== -1) {
        this.waiters.splice(index, 1)
      }
      waiter.resolve(message)
    }
  }

  private rejectWaiters(error: Error) {
    for (const waiter of this.waiters.splice(0)) {
      globalThis.clearTimeout(waiter.timeout)
      waiter.reject(error)
    }
  }
}

function spawnTsxProcess(scriptPath: string, env: Record<string, string>) {
  const repoRoot = resolve(process.cwd())
  const tsxCli = resolve(repoRoot, "node_modules", "tsx", "dist", "cli.mjs")
  const child = spawn(process.execPath, [tsxCli, scriptPath], {
    cwd: repoRoot,
    env: {
      ...process.env,
      ...env
    },
    stdio: ["ignore", "pipe", "pipe"]
  })

  const logs: string[] = []

  child.stdout?.on("data", (chunk) => {
    logs.push(chunk.toString())
  })
  child.stderr?.on("data", (chunk) => {
    logs.push(chunk.toString())
  })

  const exitPromise = new Promise<void>((resolveChild) => {
    child.once("exit", () => resolveChild())
  })

  return {
    async stop() {
      if (child.exitCode !== null) {
        await exitPromise
        return
      }

      child.kill("SIGTERM")
      const result = await Promise.race([
        exitPromise.then(() => "closed"),
        delay(3_000).then(() => "timeout")
      ])

      if (result === "timeout" && child.exitCode === null) {
        child.kill("SIGKILL")
        await exitPromise
      }
    },
    dumpLogs() {
      return logs.join("")
    }
  }
}

async function waitForSocketOpen(socket: WebSocket, timeoutMs: number) {
  if (socket.readyState === WebSocket.OPEN) {
    return
  }

  await new Promise<void>((resolve, reject) => {
    const timeout = globalThis.setTimeout(() => {
      reject(new Error(`Timed out after ${timeoutMs}ms waiting for the socket to open.`))
    }, timeoutMs)

    socket.once("open", () => {
      globalThis.clearTimeout(timeout)
      resolve()
    })
    socket.once("error", (error) => {
      globalThis.clearTimeout(timeout)
      reject(error)
    })
  })
}

async function waitFor(
  check: () => Promise<boolean>,
  timeoutMs: number,
  errorMessage: string,
  intervalMs = 200
) {
  const deadline = Date.now() + timeoutMs

  while (Date.now() < deadline) {
    try {
      if (await check()) {
        return
      }
    } catch {
      // Keep polling while the target process is still booting.
    }

    await delay(intervalMs)
  }

  throw new Error(errorMessage)
}

async function getFreePort() {
  return await new Promise<number>((resolvePort, reject) => {
    const server = createServer()
    server.listen(0, "127.0.0.1", () => {
      const address = server.address()
      if (!address || typeof address === "string") {
        server.close()
        reject(new Error("Unable to allocate a free TCP port."))
        return
      }

      const { port } = address
      server.close((error) => {
        if (error) {
          reject(error)
          return
        }

        resolvePort(port)
      })
    })
    server.on("error", reject)
  })
}
