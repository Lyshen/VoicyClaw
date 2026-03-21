import { spawn } from "node:child_process"
import { randomUUID } from "node:crypto"
import { mkdtemp, rm } from "node:fs/promises"
import { createServer } from "node:net"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { setTimeout as delay } from "node:timers/promises"

import type {
  ClientControlMessage,
  ClientHelloMessage,
  OpenClawServerMessage,
  ServerToClientMessage,
} from "@voicyclaw/protocol"
import WebSocket from "ws"

type RuntimeSettings = ClientHelloMessage["settings"]

type Waiter<TMessage> = {
  predicate: (message: TMessage) => boolean
  resolve: (message: TMessage) => void
  reject: (error: Error) => void
  timeout: ReturnType<typeof setTimeout>
}

type IssuedKeyPayload = {
  apiKey: string
  channelId: string
  channelName: string
  wsUrl: string
  protocolVersion: string
}

type BotRegistrationPayload = {
  ok: boolean
  botId: string
  botName: string
  channelId: string
  wsUrl: string
  protocolVersion: string
}

type ClosableSocket = {
  close: () => Promise<void>
}

export async function startServerRuntime() {
  const tempDir = await mkdtemp(join(tmpdir(), "voicyclaw-integration-"))
  const databaseFile = join(tempDir, "voicyclaw.sqlite")
  const port = await getFreePort()
  const serverUrl = `http://127.0.0.1:${port}`

  const server = spawnTsxProcess("apps/server/src/index.ts", {
    PORT: String(port),
    VOICYCLAW_SQLITE_FILE: databaseFile,
  })

  await waitFor(
    async () => {
      const response = await fetch(new URL("/api/health", serverUrl))
      return response.ok
    },
    20_000,
    `Server did not become healthy.\n\n${server.dumpLogs()}`,
  )

  return {
    serverUrl,
    async issueKey(channelId: string, label = "Integration key") {
      const response = await fetch(new URL("/api/keys", serverUrl), {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          channelId,
          label,
        }),
      })

      if (!response.ok) {
        throw new Error(`Unable to issue platform key: ${response.status}`)
      }

      return (await response.json()) as IssuedKeyPayload
    },
    async registerBot(input: {
      apiKey: string
      botId: string
      channelId: string
      botName?: string
    }) {
      const response = await fetch(new URL("/api/bot/register", serverUrl), {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          apiKey: input.apiKey,
          botId: input.botId,
          botName: input.botName,
          channelId: input.channelId,
        }),
      })

      if (!response.ok) {
        throw new Error(`Unable to register bot: ${response.status}`)
      }

      return (await response.json()) as BotRegistrationPayload
    },
    async connectClient(
      settings: RuntimeSettings,
      options?: {
        channelId?: string
        clientId?: string
      },
    ) {
      const channelId =
        options?.channelId ?? `test-channel-${randomUUID().slice(0, 8)}`
      const clientId =
        options?.clientId ?? `test-client-${randomUUID().slice(0, 8)}`
      const client = await openClientSocket(serverUrl, channelId, clientId)

      client.send({
        type: "CLIENT_HELLO",
        clientId,
        channelId,
        settings,
      })

      await client.waitForMessage(
        (message) =>
          message.type === "CHANNEL_STATE" && message.channelId === channelId,
      )

      return client
    },
    async connectClientRaw(
      channelId: string,
      clientId = `test-client-${randomUUID().slice(0, 8)}`,
    ) {
      return await openClientSocket(serverUrl, channelId, clientId)
    },
    async connectBotRaw() {
      const wsUrl = new URL(
        "/bot/connect",
        serverUrl.replace(/^http/i, "ws"),
      ).toString()
      return await openJsonSocket<OpenClawServerMessage>(wsUrl)
    },
    async stop() {
      await server.stop()
      await rm(tempDir, { recursive: true, force: true })
    },
    dumpLogs() {
      return server.dumpLogs()
    },
  }
}

export async function startDemoRuntime() {
  const runtime = await startServerRuntime()
  const channelId = `integration-${randomUUID().slice(0, 8)}`

  const bot = spawnTsxProcess("apps/mock-bot/src/index.ts", {
    VOICYCLAW_SERVER_URL: runtime.serverUrl,
    CHANNEL_ID: channelId,
    BOT_ID: `integration-bot-${randomUUID().slice(0, 6)}`,
    BOT_NAME: "Integration Bot",
  })

  await waitFor(
    async () => {
      const response = await fetch(
        new URL(`/api/channels/${channelId}`, runtime.serverUrl),
      )
      if (!response.ok) return false

      const payload = (await response.json()) as { botCount?: number }
      return (payload.botCount ?? 0) >= 1
    },
    20_000,
    `Mock bot did not connect.\n\n${runtime.dumpLogs()}\n\n${bot.dumpLogs()}`,
  )

  return {
    channelId,
    serverUrl: runtime.serverUrl,
    async connectClient(settings: RuntimeSettings) {
      return await runtime.connectClient(settings, { channelId })
    },
    async stop() {
      await bot.stop()
      await runtime.stop()
    },
    dumpLogs() {
      return [runtime.dumpLogs(), bot.dumpLogs()].filter(Boolean).join("\n\n")
    },
  }
}

export class JsonSocket<TMessage> implements ClosableSocket {
  private readonly backlog: TMessage[] = []
  private readonly waiters: Waiter<TMessage>[] = []

  constructor(protected readonly socket: WebSocket) {
    socket.on("message", (raw, isBinary) => {
      if (isBinary) {
        return
      }

      let message: TMessage
      try {
        message = JSON.parse(raw.toString()) as TMessage
      } catch {
        return
      }

      this.backlog.push(message)
      this.flush(message)
    })

    socket.on("close", () => {
      this.rejectWaiters(
        new Error("Socket closed before the expected message arrived."),
      )
    })

    socket.on("error", (error) => {
      this.rejectWaiters(
        error instanceof Error ? error : new Error(String(error)),
      )
    })
  }

  sendJson(payload: unknown) {
    this.socket.send(JSON.stringify(payload))
  }

  sendRaw(payload: string | Buffer | ArrayBuffer) {
    this.socket.send(payload)
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

  async waitForClose(timeoutMs = 10_000) {
    if (this.socket.readyState === WebSocket.CLOSED) {
      return
    }

    await new Promise<void>((resolve, reject) => {
      const timeout = globalThis.setTimeout(() => {
        reject(
          new Error(
            `Timed out after ${timeoutMs}ms waiting for the socket to close.`,
          ),
        )
      }, timeoutMs)

      this.socket.once("close", () => {
        globalThis.clearTimeout(timeout)
        resolve()
      })
      this.socket.once("error", (error) => {
        globalThis.clearTimeout(timeout)
        reject(error)
      })
    })
  }

  waitForMessage(
    predicate: (message: TMessage) => boolean,
    timeoutMs = 20_000,
  ) {
    const cached = this.backlog.find(predicate)
    if (cached) {
      return Promise.resolve(cached)
    }

    return new Promise<TMessage>((resolve, reject) => {
      const timeout = globalThis.setTimeout(() => {
        const index = this.waiters.indexOf(waiter)
        if (index !== -1) {
          this.waiters.splice(index, 1)
        }
        reject(
          new Error(
            `Timed out after ${timeoutMs}ms waiting for a runtime message.`,
          ),
        )
      }, timeoutMs)

      const waiter: Waiter<TMessage> = {
        predicate,
        resolve: (message) => {
          globalThis.clearTimeout(timeout)
          resolve(message)
        },
        reject: (error) => {
          globalThis.clearTimeout(timeout)
          reject(error)
        },
        timeout,
      }

      this.waiters.push(waiter)
    })
  }

  private flush(message: TMessage) {
    for (const waiter of [...this.waiters]) {
      if (!waiter.predicate(message)) {
        continue
      }

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

export class RuntimeClient extends JsonSocket<ServerToClientMessage> {
  send(payload: ClientControlMessage) {
    this.sendJson(payload)
  }
}

async function openClientSocket(
  serverUrl: string,
  channelId: string,
  clientId: string,
) {
  const wsUrl = new URL("/ws/client", serverUrl.replace(/^http/i, "ws"))
  wsUrl.searchParams.set("channelId", channelId)
  wsUrl.searchParams.set("clientId", clientId)

  const socket = new WebSocket(wsUrl)
  await waitForSocketOpen(socket, 10_000)
  return new RuntimeClient(socket)
}

async function openJsonSocket<TMessage>(url: string) {
  const socket = new WebSocket(url)
  await waitForSocketOpen(socket, 10_000)
  return new JsonSocket<TMessage>(socket)
}

function spawnTsxProcess(scriptPath: string, env: Record<string, string>) {
  const repoRoot = resolve(process.cwd())
  const tsxCli = resolve(repoRoot, "node_modules", "tsx", "dist", "cli.mjs")
  const child = spawn(process.execPath, [tsxCli, scriptPath], {
    cwd: repoRoot,
    env: {
      ...process.env,
      ...env,
    },
    stdio: ["ignore", "pipe", "pipe"],
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
        delay(3_000).then(() => "timeout"),
      ])

      if (result === "timeout" && child.exitCode === null) {
        child.kill("SIGKILL")
        await exitPromise
      }
    },
    dumpLogs() {
      return logs.join("")
    },
  }
}

async function waitForSocketOpen(socket: WebSocket, timeoutMs: number) {
  if (socket.readyState === WebSocket.OPEN) {
    return
  }

  await new Promise<void>((resolve, reject) => {
    const timeout = globalThis.setTimeout(() => {
      reject(
        new Error(
          `Timed out after ${timeoutMs}ms waiting for the socket to open.`,
        ),
      )
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
  intervalMs = 200,
) {
  const deadline = Date.now() + timeoutMs

  while (Date.now() < deadline) {
    try {
      if (await check()) {
        return
      }
    } catch {
      await delay(intervalMs)
      continue
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
