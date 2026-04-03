import { Buffer } from "node:buffer"
import { randomUUID } from "node:crypto"
import type { IncomingMessage } from "node:http"
import type { Duplex } from "node:stream"

import cors from "@fastify/cors"
import { DemoASRProvider } from "@voicyclaw/asr"
import {
  type BotChannelMessage,
  type ClientControlMessage,
  type ClientHelloMessage,
  encodeAudioFrame,
  isSupportedProtocolVersion,
  type NoticeMessage,
  PROTOCOL_VERSION,
  type RuntimeBotInfo,
  type TtsTextMessage,
} from "@voicyclaw/protocol"
import type { FastifyRequest } from "fastify"
import Fastify from "fastify"
import type { RawData } from "ws"
import WebSocket, { WebSocketServer } from "ws"
import type {
  ConversationBackend,
  ConversationTurnInput,
} from "./backends/conversation-backend"
import { getConversationBackendId } from "./backends/conversation-backend"
import { OpenClawGatewayConversationBackend } from "./backends/openclaw-gateway"
import {
  createPlatformKey,
  ensureChannel,
  findPlatformKeyByToken,
  touchPlatformKey,
  upsertBotRegistration,
} from "./db"
import { bootstrapHostedResources } from "./hosted-resources"
import { AsyncIterableQueue } from "./lib/async-queue"
import { createRuntimeTTSProvider } from "./tts-provider"

const DEFAULT_PORT = Number(process.env.PORT ?? 3001)
const DEFAULT_CHANNEL_ID = "demo-room"
const DEFAULT_CHANNEL_NAME = "Demo Room"
const RESPONSE_TIMEOUT_MS = 15_000

interface ActiveUtterance {
  utteranceId: string
  audioChunks: Buffer[]
  sequence: number
  transcriptHint?: string
  source: "microphone" | "text"
}

interface ClientSession {
  id: string
  channelId: string
  ws: WebSocket
  settings?: ClientHelloMessage["settings"]
  activeUtterance?: ActiveUtterance
}

interface RuntimeChannel {
  id: string
  clients: Map<string, ClientSession>
  bots: Map<string, BotConnection>
}

interface PendingBotResponse {
  client: ClientSession
  queue: AsyncIterableQueue<BotChannelMessage>
}

class BotConnection {
  readonly pending = new Map<string, PendingBotResponse>()

  constructor(
    readonly ws: WebSocket,
    readonly botId: string,
    readonly displayName: string,
    readonly channelId: string,
    readonly sessionId: string,
  ) {}

  relayAudioStart(utteranceId: string) {
    sendJson(this.ws, {
      type: "AUDIO_START",
      session_id: this.sessionId,
      utterance_id: utteranceId,
    })
  }

  relayAudioChunk(sequence: number, payload: Buffer) {
    if (this.ws.readyState !== WebSocket.OPEN) return
    this.ws.send(encodeAudioFrame(sequence, payload))
  }

  relayAudioEnd(utteranceId: string) {
    sendJson(this.ws, {
      type: "AUDIO_END",
      session_id: this.sessionId,
      utterance_id: utteranceId,
    })
  }

  async *send(
    client: ClientSession,
    utteranceId: string,
    text: string,
  ): AsyncGenerator<BotChannelMessage> {
    const queue = new AsyncIterableQueue<BotChannelMessage>()
    const timeout = globalThis.setTimeout(() => {
      queue.error(
        new Error(
          `Bot ${this.botId} did not respond within ${RESPONSE_TIMEOUT_MS}ms`,
        ),
      )
    }, RESPONSE_TIMEOUT_MS)

    logPipeline("BOT_REQUEST_SENT", {
      channelId: this.channelId,
      clientId: client.id,
      botId: this.botId,
      utteranceId,
      text: clipTextForLog(text),
    })

    this.pending.set(utteranceId, {
      client,
      queue,
    })

    if (
      !sendJson(this.ws, {
        type: "STT_RESULT",
        session_id: this.sessionId,
        utterance_id: utteranceId,
        text,
        is_final: true,
      })
    ) {
      globalThis.clearTimeout(timeout)
      this.pending.delete(utteranceId)
      queue.error(new Error(`Bot ${this.botId} is not connected`))
    }

    try {
      for await (const chunk of queue) {
        yield chunk
      }
    } finally {
      globalThis.clearTimeout(timeout)
      this.pending.delete(utteranceId)
    }
  }

  handleBotText(message: TtsTextMessage) {
    const pending = this.pending.get(message.utterance_id)
    if (!pending) return

    pending.queue.push({
      utteranceId: message.utterance_id,
      text: message.text,
      isFinal: message.is_final,
    })

    if (message.is_final) {
      pending.queue.close()
    }
  }

  handleBotPreview(message: {
    utterance_id: string
    text: string
    is_final: boolean
  }) {
    const pending = this.pending.get(message.utterance_id)
    if (!pending) return

    logPipeline("BOT_PREVIEW_FORWARD", {
      channelId: pending.client.channelId,
      clientId: pending.client.id,
      botId: this.botId,
      utteranceId: message.utterance_id,
      isFinal: message.is_final,
      text: clipTextForLog(message.text),
    })

    sendJson(pending.client.ws, {
      type: "BOT_PREVIEW",
      utteranceId: message.utterance_id,
      botId: this.botId,
      text: message.text,
      isFinal: message.is_final,
    })
  }

  disconnect(reason: string) {
    for (const pending of this.pending.values()) {
      pending.queue.error(new Error(reason))
    }
    this.pending.clear()
  }

  toRuntimeInfo(): RuntimeBotInfo {
    return {
      botId: this.botId,
      displayName: this.displayName,
      status: "connected",
    }
  }
}

const runtimeChannels = new Map<string, RuntimeChannel>()

function getOrCreateRuntimeChannel(channelId: string): RuntimeChannel {
  let runtime = runtimeChannels.get(channelId)
  if (!runtime) {
    runtime = {
      id: channelId,
      clients: new Map<string, ClientSession>(),
      bots: new Map<string, BotConnection>(),
    }
    runtimeChannels.set(channelId, runtime)
  }
  return runtime
}

function getPrimaryBot(channelId: string) {
  const runtime = runtimeChannels.get(channelId)
  if (!runtime) return undefined
  return runtime.bots.values().next().value as BotConnection | undefined
}

class LocalBotConversationBackend implements ConversationBackend {
  readonly kind = "local-bot" as const

  constructor(
    private readonly bot: BotConnection,
    private readonly client: ClientSession,
  ) {}

  get botId() {
    return this.bot.botId
  }

  sendTurn(input: ConversationTurnInput) {
    return this.bot.send(this.client, input.utteranceId, input.text)
  }
}

function getRequestBaseUrl(request: FastifyRequest) {
  const host = request.headers.host ?? `localhost:${DEFAULT_PORT}`
  return `${request.protocol}://${host}`
}

function toWsUrl(httpUrl: string) {
  return httpUrl.replace(/^http/i, "ws")
}

function sanitizeId(input: string | null | undefined, fallback: string) {
  const cleaned = (input ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")

  return cleaned || fallback
}

function titleFromChannelId(channelId: string) {
  return channelId
    .split(/[-_]/g)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ")
}

function ensureChannelRecord(channelId: string) {
  ensureChannel(
    channelId,
    channelId === DEFAULT_CHANNEL_ID
      ? DEFAULT_CHANNEL_NAME
      : titleFromChannelId(channelId),
  )
}

function sendJson(ws: WebSocket, payload: unknown) {
  if (ws.readyState !== WebSocket.OPEN) {
    return false
  }

  ws.send(JSON.stringify(payload))
  return true
}

function broadcastChannelState(channelId: string) {
  const runtime = getOrCreateRuntimeChannel(channelId)
  const message = {
    type: "CHANNEL_STATE",
    channelId,
    clientCount: runtime.clients.size,
    botCount: runtime.bots.size,
    bots: Array.from(runtime.bots.values(), (bot) => bot.toRuntimeInfo()),
  } satisfies {
    type: "CHANNEL_STATE"
    channelId: string
    clientCount: number
    botCount: number
    bots: RuntimeBotInfo[]
  }

  for (const client of runtime.clients.values()) {
    sendJson(client.ws, message)
  }
}

function sendNotice(
  client: ClientSession,
  level: NoticeMessage["level"],
  message: string,
) {
  sendJson(client.ws, {
    type: "NOTICE",
    level,
    message,
  } satisfies NoticeMessage)
}

function clipTextForLog(text: string, maxLength = 120) {
  const normalized = text.replace(/\s+/g, " ").trim()
  if (normalized.length <= maxLength) {
    return normalized
  }

  return `${normalized.slice(0, Math.max(0, maxLength - 3))}...`
}

function logPipeline(event: string, details: Record<string, unknown>) {
  fastify.log.info(
    {
      scope: "voice-pipeline",
      event,
      ...details,
    },
    event,
  )
}

function toBuffer(data: RawData) {
  if (Array.isArray(data)) {
    return Buffer.concat(data)
  }

  if (data instanceof ArrayBuffer) {
    return Buffer.from(data)
  }

  return data
}

async function* bufferIterable(chunks: Buffer[]) {
  for (const chunk of chunks) {
    yield chunk
  }
}

async function* forwardBotText(
  client: ClientSession,
  backend: ConversationBackend,
  utteranceId: string,
  source: AsyncGenerator<BotChannelMessage>,
) {
  for await (const message of source) {
    logPipeline("BOT_TEXT_FORWARD", {
      channelId: client.channelId,
      clientId: client.id,
      botId: backend.botId,
      backend: backend.kind,
      utteranceId,
      isFinal: message.isFinal,
      text: clipTextForLog(message.text),
    })

    sendJson(client.ws, {
      type: "BOT_TEXT",
      utteranceId,
      botId: backend.botId,
      text: message.text,
      isFinal: message.isFinal,
    })

    yield message.text
  }
}

function getConversationBackendForClient(client: ClientSession) {
  const backendId = getConversationBackendId(client.settings)
  if (backendId === "openclaw-gateway") {
    return new OpenClawGatewayConversationBackend(
      client.settings ?? {
        conversationBackend: "openclaw-gateway",
        asrMode: "client",
        asrProvider: "browser",
        ttsMode: "client",
        ttsProvider: "browser",
        language: "en-US",
      },
    )
  }

  const bot = getPrimaryBot(client.channelId)
  if (!bot) {
    return null
  }

  return new LocalBotConversationBackend(bot, client)
}

async function resolveTranscript(
  client: ClientSession,
  utterance: ActiveUtterance,
) {
  const directTranscript = utterance.transcriptHint?.trim()
  const useClientTranscript =
    utterance.source === "text" ||
    (client.settings?.asrMode === "client" && Boolean(directTranscript))

  if (useClientTranscript) {
    if (directTranscript) {
      logPipeline("ASR_CLIENT_TRANSCRIPT", {
        channelId: client.channelId,
        clientId: client.id,
        utteranceId: utterance.utteranceId,
        source: utterance.source,
        asrMode: client.settings?.asrMode ?? "unknown",
        asrProvider: client.settings?.asrProvider ?? "unknown",
        text: clipTextForLog(directTranscript),
      })

      sendJson(client.ws, {
        type: "TRANSCRIPT",
        utteranceId: utterance.utteranceId,
        text: directTranscript,
        isFinal: true,
      })
    }

    return directTranscript ?? ""
  }

  const asr = new DemoASRProvider({
    latencyMs: 120,
    resolveTranscript: () => utterance.transcriptHint || "",
  })

  let transcript = ""

  for await (const chunk of asr.transcribe(
    bufferIterable(utterance.audioChunks),
  )) {
    transcript = chunk.text.trim()
    logPipeline("ASR_SERVER_TRANSCRIPT", {
      channelId: client.channelId,
      clientId: client.id,
      utteranceId: utterance.utteranceId,
      source: utterance.source,
      asrMode: client.settings?.asrMode ?? "unknown",
      asrProvider: client.settings?.asrProvider ?? "unknown",
      isFinal: chunk.isFinal,
      audioChunkCount: utterance.audioChunks.length,
      text: clipTextForLog(chunk.text),
    })

    sendJson(client.ws, {
      type: "TRANSCRIPT",
      utteranceId: utterance.utteranceId,
      text: chunk.text,
      isFinal: chunk.isFinal,
    })
  }

  return transcript
}

async function processUtterance(
  client: ClientSession,
  utterance: ActiveUtterance,
) {
  const transcript = await resolveTranscript(client, utterance)

  if (!transcript) {
    sendNotice(
      client,
      "error",
      "This utterance ended without a transcript. Try typed text or browser speech recognition.",
    )
    return
  }

  const backend = getConversationBackendForClient(client)
  if (!backend) {
    sendNotice(
      client,
      "error",
      "No ClawBot is connected to this channel yet. Start the local bot to complete the loop.",
    )
    return
  }

  try {
    logPipeline("BACKEND_REQUEST_SENT", {
      channelId: client.channelId,
      clientId: client.id,
      utteranceId: utterance.utteranceId,
      backend: backend.kind,
      botId: backend.botId,
      text: clipTextForLog(transcript),
    })

    const botStream = backend.sendTurn({
      channelId: client.channelId,
      clientId: client.id,
      utteranceId: utterance.utteranceId,
      text: transcript,
      language: client.settings?.language ?? "en-US",
      settings: client.settings ?? {
        conversationBackend: "local-bot",
        asrMode: "client",
        asrProvider: "browser",
        ttsMode: "client",
        ttsProvider: "browser",
        language: "en-US",
      },
    })
    const textStream = forwardBotText(
      client,
      backend,
      utterance.utteranceId,
      botStream,
    )

    if (client.settings?.ttsMode === "client") {
      logPipeline("TTS_CLIENT_MODE_SELECTED", {
        channelId: client.channelId,
        clientId: client.id,
        utteranceId: utterance.utteranceId,
        backend: backend.kind,
        ttsProvider: client.settings.ttsProvider,
      })

      for await (const _text of textStream) {
        // Final bot text still streams to the browser while client TTS owns playback.
      }
      return
    }

    const tts = createRuntimeTTSProvider(client.settings)
    let audioChunkCount = 0
    let audioBytes = 0

    for await (const audioChunk of tts.adapter.synthesize(textStream, {
      language: client.settings?.language,
      sampleRate: tts.sampleRate,
    })) {
      audioChunkCount += 1
      audioBytes += audioChunk.byteLength
      logPipeline("TTS_AUDIO_CHUNK", {
        channelId: client.channelId,
        clientId: client.id,
        utteranceId: utterance.utteranceId,
        chunkIndex: audioChunkCount,
        bytes: audioChunk.byteLength,
        sampleRate: tts.sampleRate,
        ttsProvider: tts.providerId,
      })

      sendJson(client.ws, {
        type: "AUDIO_CHUNK",
        utteranceId: utterance.utteranceId,
        audioBase64: audioChunk.toString("base64"),
        sampleRate: tts.sampleRate,
      })
    }

    logPipeline("TTS_AUDIO_END", {
      channelId: client.channelId,
      clientId: client.id,
      utteranceId: utterance.utteranceId,
      chunkCount: audioChunkCount,
      audioBytes,
      sampleRate: tts.sampleRate,
      ttsProvider: tts.providerId,
    })

    sendJson(client.ws, {
      type: "AUDIO_END",
      utteranceId: utterance.utteranceId,
      sampleRate: tts.sampleRate,
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown bot pipeline failure"
    logPipeline("BACKEND_REQUEST_FAILED", {
      channelId: client.channelId,
      clientId: client.id,
      utteranceId: utterance.utteranceId,
      backend: backend.kind,
      botId: backend.botId,
      message,
    })
    sendNotice(client, "error", message)
  }
}

async function handleClientMessage(
  client: ClientSession,
  raw: RawData,
  isBinary: boolean,
) {
  if (isBinary) {
    if (!client.activeUtterance) return

    const payload = toBuffer(raw)
    client.activeUtterance.audioChunks.push(payload)

    const bot = getPrimaryBot(client.channelId)
    if (bot) {
      bot.relayAudioChunk(client.activeUtterance.sequence, payload)
      client.activeUtterance.sequence += 1
    }
    return
  }

  let message: ClientControlMessage
  try {
    message = JSON.parse(raw.toString()) as ClientControlMessage
  } catch {
    sendNotice(client, "error", "The client sent invalid JSON.")
    return
  }

  switch (message.type) {
    case "CLIENT_HELLO": {
      client.settings = message.settings
      logPipeline("CLIENT_HELLO", {
        channelId: client.channelId,
        clientId: client.id,
        conversationBackend: message.settings.conversationBackend,
        asrMode: message.settings.asrMode,
        asrProvider: message.settings.asrProvider,
        ttsMode: message.settings.ttsMode,
        ttsProvider: message.settings.ttsProvider,
        language: message.settings.language,
        openClawGatewayUrl:
          message.settings.openClawGateway?.url && backendLooksRemote(message),
      })

      sendJson(client.ws, {
        type: "SESSION_READY",
        clientId: client.id,
        channelId: client.channelId,
      })
      broadcastChannelState(client.channelId)
      break
    }
    case "START_UTTERANCE": {
      logPipeline("UTTERANCE_START", {
        channelId: client.channelId,
        clientId: client.id,
        utteranceId: message.utteranceId,
      })

      client.activeUtterance = {
        utteranceId: message.utteranceId,
        audioChunks: [],
        sequence: 0,
        transcriptHint: undefined,
        source: "microphone",
      }

      getPrimaryBot(client.channelId)?.relayAudioStart(message.utteranceId)
      break
    }
    case "COMMIT_UTTERANCE": {
      const current = client.activeUtterance
      if (!current || current.utteranceId !== message.utteranceId) {
        sendNotice(
          client,
          "error",
          "The committed utterance does not match the active microphone session.",
        )
        return
      }

      logPipeline("UTTERANCE_COMMIT", {
        channelId: client.channelId,
        clientId: client.id,
        utteranceId: message.utteranceId,
        source: message.source,
        transcriptHint: clipTextForLog(message.transcript ?? ""),
      })

      current.transcriptHint = message.transcript?.trim()
      current.source = message.source
      client.activeUtterance = undefined
      getPrimaryBot(client.channelId)?.relayAudioEnd(message.utteranceId)
      await processUtterance(client, current)
      break
    }
    case "TEXT_UTTERANCE": {
      const text = message.text.trim()
      if (!text) {
        sendNotice(
          client,
          "error",
          "Type something before sending a text utterance.",
        )
        return
      }

      logPipeline("TEXT_UTTERANCE", {
        channelId: client.channelId,
        clientId: client.id,
        utteranceId: message.utteranceId,
        text: clipTextForLog(text),
      })

      await processUtterance(client, {
        utteranceId: message.utteranceId,
        audioChunks: [],
        sequence: 0,
        transcriptHint: text,
        source: "text",
      })
      break
    }
  }
}

function backendLooksRemote(message: ClientHelloMessage) {
  return message.settings.conversationBackend === "openclaw-gateway"
    ? message.settings.openClawGateway?.url
    : undefined
}

async function handleBotConnection(ws: WebSocket, _request: Request) {
  let bot: BotConnection | undefined
  let greeted = false

  ws.on("message", async (raw, isBinary) => {
    if (isBinary) return

    let message: unknown
    try {
      message = JSON.parse(raw.toString())
    } catch {
      sendJson(ws, {
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
        sendJson(ws, {
          type: "ERROR",
          code: "PROTOCOL_VERSION_UNSUPPORTED",
          message: "The first bot message must be HELLO.",
        })
        ws.close()
        return
      }

      if (!isSupportedProtocolVersion(hello.protocol_version ?? "")) {
        sendJson(ws, {
          type: "ERROR",
          code: "PROTOCOL_VERSION_UNSUPPORTED",
          message: `Expected protocol version ${PROTOCOL_VERSION}.`,
        })
        ws.close()
        return
      }

      const apiKey = findPlatformKeyByToken(hello.api_key ?? "")

      if (!apiKey) {
        sendJson(ws, {
          type: "ERROR",
          code: "AUTH_FAILED",
          message: "Invalid or expired API key.",
        })
        ws.close()
        return
      }

      if (apiKey.channelId !== hello.channel_id) {
        sendJson(ws, {
          type: "ERROR",
          code: "CHANNEL_NOT_FOUND",
          message: "The provided API key does not match this channel.",
        })
        ws.close()
        return
      }

      const runtime = getOrCreateRuntimeChannel(apiKey.channelId)
      if (runtime.bots.has(hello.bot_id ?? "")) {
        sendJson(ws, {
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

      touchPlatformKey(apiKey.id)

      upsertBotRegistration({
        botId,
        botName,
        channelId,
        platformKeyId: apiKey.id,
        lastConnectedAt: new Date().toISOString(),
      })

      bot = new BotConnection(ws, botId, botName, channelId, sessionId)
      runtime.bots.set(botId, bot)
      greeted = true

      sendJson(ws, {
        type: "WELCOME",
        session_id: sessionId,
        channel_id: channelId,
        bot_id: botId,
      })
      broadcastChannelState(channelId)
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
    const runtime = runtimeChannels.get(bot.channelId)
    runtime?.bots.delete(bot.botId)
    broadcastChannelState(bot.channelId)
  })
}

function attachRealtimeGateways(server: ReturnType<typeof Fastify>) {
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
    const url = new URL(
      request.url ?? "/ws/client",
      `http://${request.headers.host ?? `localhost:${DEFAULT_PORT}`}`,
    )
    const channelId = sanitizeId(
      url.searchParams.get("channelId"),
      DEFAULT_CHANNEL_ID,
    )
    const clientId = sanitizeId(url.searchParams.get("clientId"), randomUUID())
    const runtime = getOrCreateRuntimeChannel(channelId)

    ensureChannelRecord(channelId)

    const client: ClientSession = {
      id: clientId,
      channelId,
      ws,
    }

    runtime.clients.set(clientId, client)
    sendJson(ws, {
      type: "SESSION_READY",
      clientId,
      channelId,
    })
    broadcastChannelState(channelId)

    ws.on("message", (raw, isBinary) => {
      void handleClientMessage(client, raw, isBinary)
    })

    ws.on("close", () => {
      runtime.clients.delete(clientId)
      broadcastChannelState(channelId)
    })
  })

  botGateway.on("connection", (ws, request) => {
    void handleBotConnection(ws, request as unknown as Request)
  })
}

const fastify = Fastify({ logger: true })

await fastify.register(cors, {
  origin: true,
  credentials: false,
})

fastify.get("/api/health", async () => {
  return {
    ok: true,
    protocolVersion: PROTOCOL_VERSION,
    channels: runtimeChannels.size,
    connectedBots: Array.from(runtimeChannels.values()).reduce(
      (total, runtime) => total + runtime.bots.size,
      0,
    ),
    connectedClients: Array.from(runtimeChannels.values()).reduce(
      (total, runtime) => total + runtime.clients.size,
      0,
    ),
  }
})

fastify.get("/api/channels/:channelId", async (request) => {
  const channelId = sanitizeId(
    (request.params as { channelId: string }).channelId,
    DEFAULT_CHANNEL_ID,
  )
  const runtime = getOrCreateRuntimeChannel(channelId)

  return {
    channelId,
    botCount: runtime.bots.size,
    clientCount: runtime.clients.size,
    bots: Array.from(runtime.bots.values(), (bot) => bot.toRuntimeInfo()),
  }
})

fastify.post("/api/hosted/bootstrap", async (request, reply) => {
  const body =
    (request.body as {
      provider?: string
      providerSubject?: string
      email?: string | null
      displayName?: string | null
      firstName?: string | null
      fullName?: string | null
      username?: string | null
    } | null) ?? {}

  const provider = body.provider === "clerk" ? "clerk" : null
  const providerSubject = body.providerSubject?.trim()

  if (!provider || !providerSubject) {
    reply.code(400)
    return {
      ok: false,
      message: "provider and providerSubject are required",
    }
  }

  return bootstrapHostedResources({
    provider,
    providerSubject,
    email: body.email,
    displayName: body.displayName,
    firstName: body.firstName,
    fullName: body.fullName,
    username: body.username,
  })
})

fastify.post("/api/keys", async (request, reply) => {
  const body =
    (request.body as { channelId?: string; label?: string } | null) ?? {}
  const channelId = sanitizeId(body.channelId, DEFAULT_CHANNEL_ID)
  ensureChannelRecord(channelId)
  const key = createPlatformKey(channelId, body.label)
  const baseUrl = getRequestBaseUrl(request)

  reply.code(201)
  return {
    apiKey: key.token,
    channelId,
    channelName: titleFromChannelId(channelId),
    wsUrl: `${toWsUrl(baseUrl)}/bot/connect`,
    protocolVersion: PROTOCOL_VERSION,
  }
})

fastify.post("/api/bot/register", async (request, reply) => {
  const body =
    (request.body as {
      apiKey?: string
      botId?: string
      botName?: string
      channelId?: string
    } | null) ?? {}

  const apiKey = body.apiKey?.trim()
  const botId = sanitizeId(body.botId, "local-bot")
  const channelId = sanitizeId(body.channelId, DEFAULT_CHANNEL_ID)

  if (!apiKey) {
    reply.code(400)
    return {
      ok: false,
      message: "apiKey is required",
    }
  }

  const keyRecord = findPlatformKeyByToken(apiKey)

  if (!keyRecord || keyRecord.channelId !== channelId) {
    reply.code(401)
    return {
      ok: false,
      message: "API key is invalid for this channel",
    }
  }

  const botName = body.botName?.trim() || titleFromChannelId(botId)
  ensureChannelRecord(channelId)

  upsertBotRegistration({
    botId,
    botName,
    channelId,
    platformKeyId: keyRecord.id,
  })

  return {
    ok: true,
    botId,
    botName,
    channelId,
    wsUrl: `${toWsUrl(getRequestBaseUrl(request))}/bot/connect`,
    protocolVersion: PROTOCOL_VERSION,
  }
})

attachRealtimeGateways(fastify)
ensureChannelRecord(DEFAULT_CHANNEL_ID)

await fastify.listen({
  port: DEFAULT_PORT,
  host: "0.0.0.0",
})
