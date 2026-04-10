import type { Buffer } from "node:buffer"

import {
  type BotChannelMessage,
  type ClientHelloMessage,
  encodeAudioFrame,
  type NoticeMessage,
  type RuntimeBotInfo,
  type TtsTextMessage,
} from "@voicyclaw/protocol"
import type { FastifyBaseLogger } from "fastify"
import WebSocket from "ws"

import { AsyncIterableQueue } from "./lib/async-queue"

const RESPONSE_TIMEOUT_MS = 15_000

export interface ActiveUtterance {
  utteranceId: string
  audioChunks: Buffer[]
  sequence: number
  transcriptHint?: string
  source: "microphone" | "text"
}

export interface ClientSession {
  id: string
  channelId: string
  ws: WebSocket
  settings?: ClientHelloMessage["settings"]
  activeUtterance?: ActiveUtterance
}

interface PendingBotResponse {
  client: ClientSession
  queue: AsyncIterableQueue<BotChannelMessage>
}

export interface ConnectedBot {
  botId: string
  channelId: string
  relayAudioStart(utteranceId: string): void
  relayAudioChunk(sequence: number, payload: Buffer): void
  relayAudioEnd(utteranceId: string): void
  send(
    client: ClientSession,
    utteranceId: string,
    text: string,
  ): AsyncGenerator<BotChannelMessage>
  handleBotText(message: TtsTextMessage): void
  handleBotPreview(message: {
    utterance_id: string
    text: string
    is_final: boolean
  }): void
  disconnect(reason: string): void
  toRuntimeInfo(): RuntimeBotInfo
}

export interface RuntimeChannel {
  id: string
  clients: Map<string, ClientSession>
  bots: Map<string, ConnectedBot>
}

export interface RuntimeHealthSnapshot {
  channels: number
  connectedBots: number
  connectedClients: number
}

export interface RuntimeChannelSnapshot {
  channelId: string
  botCount: number
  clientCount: number
  bots: RuntimeBotInfo[]
}

export interface RealtimeRuntime {
  getOrCreateRuntimeChannel(channelId: string): RuntimeChannel
  getPrimaryBot(channelId: string): ConnectedBot | undefined
  createBotConnection(
    ws: WebSocket,
    botId: string,
    displayName: string,
    channelId: string,
    sessionId: string,
  ): ConnectedBot
  removeBot(channelId: string, botId: string): void
  sendJson(ws: WebSocket, payload: unknown): boolean
  broadcastChannelState(channelId: string): void
  sendNotice(
    client: ClientSession,
    level: NoticeMessage["level"],
    message: string,
  ): void
  clipTextForLog(text: string, maxLength?: number): string
  logPipeline(event: string, details: Record<string, unknown>): void
  getHealthSnapshot(): RuntimeHealthSnapshot
  getChannelSnapshot(channelId: string): RuntimeChannelSnapshot
}

export function createRealtimeRuntime(
  logger: FastifyBaseLogger,
): RealtimeRuntime {
  const runtimeChannels = new Map<string, RuntimeChannel>()

  class BotConnection implements ConnectedBot {
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
        botId: this.botId,
        botName: this.displayName,
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
        botName: this.displayName,
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

  function getOrCreateRuntimeChannel(channelId: string): RuntimeChannel {
    let runtime = runtimeChannels.get(channelId)
    if (!runtime) {
      runtime = {
        id: channelId,
        clients: new Map<string, ClientSession>(),
        bots: new Map<string, ConnectedBot>(),
      }
      runtimeChannels.set(channelId, runtime)
    }
    return runtime
  }

  function getPrimaryBot(channelId: string) {
    const runtime = runtimeChannels.get(channelId)
    if (!runtime) return undefined
    return runtime.bots.values().next().value as ConnectedBot | undefined
  }

  function createBotConnection(
    ws: WebSocket,
    botId: string,
    displayName: string,
    channelId: string,
    sessionId: string,
  ) {
    return new BotConnection(ws, botId, displayName, channelId, sessionId)
  }

  function removeBot(channelId: string, botId: string) {
    runtimeChannels.get(channelId)?.bots.delete(botId)
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
    logger.info(
      {
        scope: "voice-pipeline",
        event,
        ...details,
      },
      event,
    )
  }

  function getHealthSnapshot(): RuntimeHealthSnapshot {
    return {
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
  }

  function getChannelSnapshot(channelId: string): RuntimeChannelSnapshot {
    const runtime = getOrCreateRuntimeChannel(channelId)

    return {
      channelId,
      botCount: runtime.bots.size,
      clientCount: runtime.clients.size,
      bots: Array.from(runtime.bots.values(), (bot) => bot.toRuntimeInfo()),
    }
  }

  return {
    getOrCreateRuntimeChannel,
    getPrimaryBot,
    createBotConnection,
    removeBot,
    sendJson,
    broadcastChannelState,
    sendNotice,
    clipTextForLog,
    logPipeline,
    getHealthSnapshot,
    getChannelSnapshot,
  }
}
