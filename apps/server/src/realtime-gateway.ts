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
  authorizePlatformKeyForChannel,
  markPlatformKeyUsed,
} from "./domains/platform-keys/service"
import { createClientMessageHandler } from "./realtime-client-session"
import {
  type ClientSession,
  createRealtimeRuntime,
  type RuntimeChannelSnapshot,
  type RuntimeHealthSnapshot,
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

export function createRealtimeGateway(
  logger: FastifyBaseLogger,
): RealtimeGateway {
  const runtime = createRealtimeRuntime(logger)
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
          bot_id?: string
          channel_id?: string
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

        const authorization = await authorizePlatformKeyForChannel(
          hello.api_key ?? "",
          hello.channel_id ?? "",
        )

        if (!authorization.ok) {
          runtime.sendJson(ws, {
            type: "ERROR",
            code:
              authorization.reason === "not-found"
                ? "AUTH_FAILED"
                : "CHANNEL_NOT_FOUND",
            message:
              authorization.reason === "not-found"
                ? "Invalid or expired API key."
                : "The provided API key does not match this channel.",
          })
          ws.close()
          return
        }

        const apiKey = authorization.key
        const channelRuntime = runtime.getOrCreateRuntimeChannel(
          apiKey.channelId,
        )
        if (channelRuntime.bots.has(hello.bot_id ?? "")) {
          runtime.sendJson(ws, {
            type: "ERROR",
            code: "BOT_ALREADY_CONNECTED",
            message:
              "A bot with the same bot_id is already active in this channel.",
          })
          ws.close()
          return
        }

        const botId = sanitizeId(hello.bot_id, "local-bot")
        const channelId = sanitizeId(hello.channel_id, DEFAULT_CHANNEL_ID)
        const botName = titleFromChannelId(botId)
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
