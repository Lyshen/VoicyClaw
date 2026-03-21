import { randomUUID } from "node:crypto"
import { createServer } from "node:net"

import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest"
import { WebSocketServer } from "ws"

import { type RuntimeClient, startServerRuntime } from "./support/demo-runtime"

const defaultClientSettings = {
  conversationBackend: "openclaw-gateway" as const,
  asrMode: "client" as const,
  asrProvider: "browser",
  ttsMode: "client" as const,
  ttsProvider: "browser",
  language: "en-US",
}

describe.sequential("server + openclaw gateway integration", () => {
  let runtime: Awaited<ReturnType<typeof startServerRuntime>>
  let gateway: Awaited<ReturnType<typeof startMockOpenClawGateway>>
  let client: RuntimeClient | null = null

  beforeAll(async () => {
    gateway = await startMockOpenClawGateway()
    runtime = await startServerRuntime()
  }, 30_000)

  afterEach(async () => {
    await client?.close()
    client = null
  })

  afterAll(async () => {
    await gateway.stop()
    await runtime.stop()
  })

  it("routes a text utterance through the OpenClaw Gateway backend", async () => {
    const channelId = `gateway-${randomUUID().slice(0, 8)}`

    client = await runtime.connectClient(
      {
        ...defaultClientSettings,
        openClawGateway: {
          url: gateway.wsUrl,
          token: "test-gateway-token",
        },
      },
      { channelId },
    )

    const utteranceId = randomUUID()
    client.send({
      type: "TEXT_UTTERANCE",
      utteranceId,
      text: "hello from voice",
    })

    const partialText = await client.waitForMessage(
      (message) =>
        message.type === "BOT_TEXT" &&
        message.utteranceId === utteranceId &&
        !message.isFinal,
    )

    const finalText = await client.waitForMessage(
      (message) =>
        message.type === "BOT_TEXT" &&
        message.utteranceId === utteranceId &&
        message.isFinal,
    )

    expect(finalText.botId).toBe("openclaw-gateway")
    expect(`${partialText.text}${finalText.text}`).toMatch(
      /OpenClaw bridge reply complete\./i,
    )
    expect(gateway.turns).toContainEqual(
      expect.objectContaining({
        sessionKey: `voicyclaw:channel:${channelId}`,
        message: "hello from voice",
        idempotencyKey: utteranceId,
      }),
    )
    expect(gateway.connectRequests[0]).toMatchObject({
      auth: {
        token: "test-gateway-token",
      },
    })
    expect(gateway.connectRequests[0]).not.toHaveProperty("device")
    expect(gateway.connectRequests[0]).not.toHaveProperty("nonce")
    expect(gateway.turns[0]?.deliver).toBe(false)
  })
})

async function startMockOpenClawGateway() {
  const port = await getFreePort()
  const server = new WebSocketServer({
    port,
    host: "127.0.0.1",
  })

  const turns: Array<{
    sessionKey: string
    message: string
    idempotencyKey: string
    deliver: boolean
  }> = []
  const connectRequests: Array<Record<string, unknown>> = []
  let runIndex = 0

  server.on("connection", (socket) => {
    globalThis.setTimeout(() => {
      socket.send(
        JSON.stringify({
          type: "event",
          event: "connect.challenge",
          payload: {
            nonce: "mock-nonce",
            ts: Date.now(),
          },
        }),
      )
    }, 0)

    socket.on("message", (raw, isBinary) => {
      if (isBinary) {
        return
      }

      const frame = JSON.parse(raw.toString()) as {
        type: "req"
        id: string
        method: string
        params?: Record<string, unknown>
      }

      if (frame.type !== "req") {
        return
      }

      if (frame.method === "connect") {
        connectRequests.push((frame.params ?? {}) as Record<string, unknown>)
        socket.send(
          JSON.stringify({
            type: "res",
            id: frame.id,
            ok: true,
            payload: {
              type: "hello-ok",
              protocol: 3,
              server: {
                version: "test",
                connId: "mock-conn",
              },
              features: {
                methods: ["connect", "chat.send", "chat.abort"],
                events: ["chat", "connect.challenge"],
              },
              snapshot: {
                ts: Date.now(),
                presence: [],
              },
              auth: {
                deviceToken: "mock-device-token",
                role: "operator",
                scopes: ["operator.read", "operator.write"],
              },
              policy: {
                maxPayload: 1_000_000,
                maxBufferedBytes: 1_000_000,
                tickIntervalMs: 5_000,
              },
            },
          }),
        )
        return
      }

      if (frame.method === "chat.send") {
        const params = (frame.params ?? {}) as {
          sessionKey?: string
          message?: string
          idempotencyKey?: string
        }
        const runId = `run-${++runIndex}`

        turns.push({
          sessionKey: String(params.sessionKey ?? ""),
          message: String(params.message ?? ""),
          idempotencyKey: String(params.idempotencyKey ?? ""),
          deliver: Boolean(params.deliver),
        })

        socket.send(
          JSON.stringify({
            type: "res",
            id: frame.id,
            ok: true,
            payload: {
              status: "started",
              runId,
            },
          }),
        )

        globalThis.setTimeout(() => {
          socket.send(
            JSON.stringify({
              type: "event",
              event: "chat",
              payload: {
                runId,
                sessionKey: `agent:main:${params.sessionKey}`,
                seq: 1,
                state: "delta",
                message: {
                  content: [{ text: "OpenClaw bridge reply" }],
                },
              },
            }),
          )
        }, 10)

        globalThis.setTimeout(() => {
          socket.send(
            JSON.stringify({
              type: "event",
              event: "chat",
              payload: {
                runId,
                sessionKey: `agent:main:${params.sessionKey}`,
                seq: 2,
                state: "final",
                message: {
                  content: [{ text: "OpenClaw bridge reply complete." }],
                },
              },
            }),
          )
        }, 20)
      }
    })
  })

  return {
    wsUrl: `ws://127.0.0.1:${port}`,
    connectRequests,
    turns,
    async stop() {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error)
            return
          }

          resolve()
        })
      })
    },
  }
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
