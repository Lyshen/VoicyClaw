import { Buffer } from "node:buffer"

import type {
  ClientControlMessage,
  ClientHelloMessage,
} from "@voicyclaw/protocol"
import type { RawData } from "ws"

import type { ClientSession, RealtimeRuntime } from "./realtime-runtime"
import { processUtterance } from "./realtime-utterance-pipeline"

function toBuffer(data: RawData) {
  if (Array.isArray(data)) {
    return Buffer.concat(data)
  }

  if (data instanceof ArrayBuffer) {
    return Buffer.from(data)
  }

  return data
}

function backendLooksRemote(message: ClientHelloMessage) {
  return message.settings.conversationBackend === "openclaw-gateway"
    ? message.settings.openClawGateway?.url
    : undefined
}

export function createClientMessageHandler(runtime: RealtimeRuntime) {
  return async function handleClientMessage(
    client: ClientSession,
    raw: RawData,
    isBinary: boolean,
  ) {
    if (isBinary) {
      if (!client.activeUtterance) return

      const payload = toBuffer(raw)
      client.activeUtterance.audioChunks.push(payload)

      const bot = runtime.getPrimaryBot(client.channelId)
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
      runtime.sendNotice(client, "error", "The client sent invalid JSON.")
      return
    }

    switch (message.type) {
      case "CLIENT_HELLO": {
        client.settings = message.settings
        runtime.logPipeline("CLIENT_HELLO", {
          channelId: client.channelId,
          clientId: client.id,
          conversationBackend: message.settings.conversationBackend,
          asrMode: message.settings.asrMode,
          asrProvider: message.settings.asrProvider,
          ttsMode: message.settings.ttsMode,
          ttsProvider: message.settings.ttsProvider,
          language: message.settings.language,
          openClawGatewayUrl:
            message.settings.openClawGateway?.url &&
            backendLooksRemote(message),
        })

        runtime.sendJson(client.ws, {
          type: "SESSION_READY",
          clientId: client.id,
          channelId: client.channelId,
        })
        runtime.broadcastChannelState(client.channelId)
        break
      }
      case "START_UTTERANCE": {
        runtime.logPipeline("UTTERANCE_START", {
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

        runtime
          .getPrimaryBot(client.channelId)
          ?.relayAudioStart(message.utteranceId)
        break
      }
      case "COMMIT_UTTERANCE": {
        const current = client.activeUtterance
        if (!current || current.utteranceId !== message.utteranceId) {
          runtime.sendNotice(
            client,
            "error",
            "The committed utterance does not match the active microphone session.",
          )
          return
        }

        runtime.logPipeline("UTTERANCE_COMMIT", {
          channelId: client.channelId,
          clientId: client.id,
          utteranceId: message.utteranceId,
          source: message.source,
          transcriptHint: runtime.clipTextForLog(message.transcript ?? ""),
        })

        current.transcriptHint = message.transcript?.trim()
        current.source = message.source
        client.activeUtterance = undefined
        runtime
          .getPrimaryBot(client.channelId)
          ?.relayAudioEnd(message.utteranceId)
        await processUtterance(runtime, client, current)
        break
      }
      case "TEXT_UTTERANCE": {
        const text = message.text.trim()
        if (!text) {
          runtime.sendNotice(
            client,
            "error",
            "Type something before sending a text utterance.",
          )
          return
        }

        runtime.logPipeline("TEXT_UTTERANCE", {
          channelId: client.channelId,
          clientId: client.id,
          utteranceId: message.utteranceId,
          text: runtime.clipTextForLog(text),
        })

        await processUtterance(runtime, client, {
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
}
