import { randomUUID } from "node:crypto"
import type { IncomingMessage } from "node:http"
import type { Duplex } from "node:stream"

import {
  isSupportedProtocolVersion,
  PROTOCOL_VERSION,
  type TtsTextMessage,
} from "@voicyclaw/protocol"
import type { FastifyBaseLogger, FastifyInstance } from "fastify"
import type WebSocket from "ws"
import { WebSocketServer } from "ws"

import { upsertBotRegistrationRecord } from "./domains/bot-registrations/service"
import {
  authorizePlatformKey,
  markPlatformKeyUsed,
} from "./domains/platform-keys/service"
import { createClientMessageHandler } from "./realtime-client-session"
import {
  type ClientSession,
  createRealtimeRuntime,
  type RuntimeChannelSnapshot,
  type RuntimeHealthSnapshot,
  DEFAULT_BOT_RESPONSE_TIMEOUT_MS,
} from "./realtime-runtime"
import {
  DEFAULT_CHANNEL_ID,
  DEFAULT_PORT,
  ensureChannelRecord,
  sanitizeId,
  titleFromChannelId,
} from "./server-shared"

export interface RealtimeGateway {
  attach(server: FastifyInstance): void
  getHealthSnapshot(): RuntimeHealthSnapshot
  getChannelSnapshot(channelId: string): RuntimeChannelSnapshot
}

type RealtimeGatewayOptions = {
  botResponseTimeoutMs?: number
}

export function createRealtimeGateway(
  logger: FastifyBaseLogger,
  options: RealtimeGatewayOptions = {},
): RealtimeGateway {
  const runtime = createRealtimeRuntime(logger, {
    botResponseTimeoutMs:
      typeof options.botResponseTimeoutMs === "number" &&
      Number.isFinite(options.botResponseTimeoutMs) &&
      options.botResponseTimeoutMs > 0
        ? Math.trunc(options.botResponseTimeoutMs)
        : DEFAULT_BOT_RESPONSE_TIMEOUT_MS,
  })
  const handleClientMessage = createClientMessageHandler(runtime)

  async function handleBotConnection(ws: WebSocket) {
    let bot: ReturnType<typeof runtime.createBotConnection> | undefined
    let greeted = false

    ws.on("message", async (raw, isBinary) => {
      if (isBinary) return

      let message: unknown
      try {
        message = JSON.parse(raw.toString())
      } catch {
        runtime.sendJson(ws, {
          type: "ERROR",
          code: "PROTOCOL_VERSION_UNSUPPORTED",
          message: "Bot messages must be JSON text frames.",
        })
        ws.close()
        return
      }

      if (!greeted) {
        const hello = message as {
          type?: string
          api_key?: string
          protocol_version?: string
        }

        if (hello.type !== "HELLO") {
          runtime.sendJson(ws, {
            type: "ERROR",
            code: "PROTOCOL_VERSION_UNSUPPORTED",
            message: "The first bot message must be HELLO.",
          })
          ws.close()
          return
        }

        if (!isSupportedProtocolVersion(hello.protocol_version ?? "")) {
          runtime.sendJson(ws, {
            type: "ERROR",
            code: "PROTOCOL_VERSION_UNSUPPORTED",
            message: `Expected protocol version ${PROTOCOL_VERSION}.`,
          })
          ws.close()
          return
        }

        const authorization = await authorizePlatformKey(hello.api_key ?? "")

        if (!authorization.ok) {
          runtime.sendJson(ws, {
            type: "ERROR",
            code: "AUTH_FAILED",
            message: "Invalid or expired API key.",
          })
          ws.close()
          return
        }

        const apiKey = authorization.key
        const project = authorization.project
        const channelId = sanitizeId(
          authorization.channelId,
          authorization.channelId,
        )
        const botId = sanitizeId(project?.botId, "local-bot")
        const botName = resolveBoundBotName({
          projectDisplayName: project?.displayName,
          keyLabel: apiKey.label,
          botId,
        })
        const channelRuntime = runtime.getOrCreateRuntimeChannel(channelId)

        if (channelRuntime.bots.has(botId)) {
          runtime.sendJson(ws, {
            type: "ERROR",
            code: "BOT_ALREADY_CONNECTED",
            message:
              "A bot is already active for this server-bound channel session.",
          })
          ws.close()
          return
        }

        const sessionId = randomUUID()

        await markPlatformKeyUsed(apiKey.id)

        await upsertBotRegistrationRecord({
          botId,
          botName,
          channelId,
          platformKeyId: apiKey.id,
          lastConnectedAt: new Date().toISOString(),
        })

        bot = runtime.createBotConnection(
          ws,
          botId,
          botName,
          channelId,
          sessionId,
        )
        channelRuntime.bots.set(botId, bot)
        greeted = true

        runtime.sendJson(ws, {
          type: "WELCOME",
          session_id: sessionId,
          channel_id: channelId,
          bot_id: botId,
          bot_name: botName,
        })
        runtime.broadcastChannelState(channelId)
        return
      }

      if (!bot) return

      const botMessage = message as { type?: string }
      if (botMessage.type === "BOT_PREVIEW") {
        bot.handleBotPreview(
          message as {
            utterance_id: string
            text: string
            is_final: boolean
          },
        )
        return
      }

      if (botMessage.type === "TTS_TEXT") {
        bot.handleBotText(message as TtsTextMessage)
      }
    })

    ws.on("close", () => {
      if (!bot) return
      bot.disconnect(`Bot ${bot.botId} disconnected`)
      runtime.removeBot(bot.channelId, bot.botId)
      runtime.broadcastChannelState(bot.channelId)
    })
  }

  function resolveBoundBotName(input: {
    projectDisplayName?: string | null
    keyLabel?: string | null
    botId: string
  }) {
    const projectDisplayName = input.projectDisplayName?.trim()
    if (projectDisplayName) {
      return projectDisplayName
    }

    const keyLabel = input.keyLabel?.trim()
    if (keyLabel) {
      return keyLabel
    }

    return titleFromChannelId(input.botId)
  }

  function attach(server: FastifyInstance) {
    const clientGateway = new WebSocketServer({ noServer: true })
    const botGateway = new WebSocketServer({ noServer: true })

    server.server.on(
      "upgrade",
      (request: IncomingMessage, socket: Duplex, head: Buffer) => {
        const url = new URL(
          request.url ?? "/",
          `http://${request.headers.host ?? `localhost:${DEFAULT_PORT}`}`,
        )

        if (url.pathname === "/ws/client") {
          clientGateway.handleUpgrade(request, socket, head, (ws) => {
            clientGateway.emit("connection", ws, request)
          })
          return
        }

        if (url.pathname === "/bot/connect") {
          botGateway.handleUpgrade(request, socket, head, (ws) => {
            botGateway.emit("connection", ws, request)
          })
          return
        }

        socket.destroy()
      },
    )

    clientGateway.on("connection", (ws, request) => {
      void handleClientConnection(ws, request)
    })

    async function handleClientConnection(
      ws: WebSocket,
      request: IncomingMessage,
    ) {
      const url = new URL(
        request.url ?? "/ws/client",
        `http://${request.headers.host ?? `localhost:${DEFAULT_PORT}`}`,
      )
      const channelId = sanitizeId(
        url.searchParams.get("channelId"),
        DEFAULT_CHANNEL_ID,
      )
      const clientId = sanitizeId(
        url.searchParams.get("clientId"),
        randomUUID(),
      )
      const channelRuntime = runtime.getOrCreateRuntimeChannel(channelId)

      const client: ClientSession = {
        id: clientId,
        channelId,
        ws,
      }

      channelRuntime.clients.set(clientId, client)

      ws.on("message", (raw, isBinary) => {
        void handleClientMessage(client, raw, isBinary)
      })

      ws.on("close", () => {
        channelRuntime.clients.delete(clientId)
        runtime.broadcastChannelState(channelId)
      })

      await ensureChannelRecord(channelId)

      runtime.sendJson(ws, {
        type: "SESSION_READY",
        clientId,
        channelId,
      })
      runtime.broadcastChannelState(channelId)
    }

    botGateway.on("connection", (ws) => {
      void handleBotConnection(ws)
    })
  }

  return {
    attach,
    getHealthSnapshot: runtime.getHealthSnapshot,
    getChannelSnapshot: runtime.getChannelSnapshot,
  }
}
