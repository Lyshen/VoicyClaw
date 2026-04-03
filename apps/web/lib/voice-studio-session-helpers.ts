"use client"

import type {
  ChannelStateMessage,
  ClientHelloMessage,
  ServerToClientMessage,
} from "@voicyclaw/protocol"
import type { Dispatch, SetStateAction } from "react"

import type { HostedOnboardingState } from "./hosted-onboarding-shared"
import type { OutputTurnCoordinator } from "./output-turn-coordinator"
import type { PrototypeSettings, ProviderMode } from "./prototype-settings"

export type ConnectionState =
  | "connecting"
  | "connected"
  | "disconnected"
  | "error"

export type TimelineEntry = {
  id: string
  role: "user" | "bot" | "system" | "preview"
  title: string
  text: string
  meta: string
}

type ProviderSummary = {
  id: string
  mode: ProviderMode
}

type HandleServerMessageOptions = {
  browserTtsEnabled: boolean
  language: string
  ttsMode: ProviderMode
  output: OutputTurnCoordinator | null
  botSpeechBuffer: Record<string, string>
  appendSystemMessage: (text: string) => void
  upsertEntry: (entry: TimelineEntry) => void
  setChannelState: Dispatch<SetStateAction<ChannelStateMessage | null>>
  setConnectionState: Dispatch<SetStateAction<ConnectionState>>
  setPendingReplyUtteranceId: Dispatch<SetStateAction<string | null>>
}

type BuildClientHelloMessageOptions = {
  clientId: string
  settings: PrototypeSettings
  asrProvider: ProviderSummary
  ttsProvider: ProviderSummary
}

export function createTimelineEntry(
  role: TimelineEntry["role"],
  title: string,
  text: string,
): TimelineEntry {
  return {
    id: `${role}-${crypto.randomUUID()}`,
    role,
    title,
    text,
    meta: new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    }),
  }
}

export function handleVoiceStudioServerMessage(
  message: ServerToClientMessage,
  options: HandleServerMessageOptions,
) {
  const clearPendingReply = (utteranceId: string) => {
    options.setPendingReplyUtteranceId((current) =>
      current === utteranceId ? null : current,
    )
  }

  switch (message.type) {
    case "SESSION_READY": {
      options.setConnectionState("connected")
      break
    }
    case "CHANNEL_STATE": {
      options.setChannelState(message)
      break
    }
    case "NOTICE": {
      options.appendSystemMessage(message.message)
      break
    }
    case "BOT_PREVIEW": {
      clearPendingReply(message.utteranceId)
      options.upsertEntry({
        id: `preview-${message.utteranceId}`,
        role: "preview",
        title: `${message.botId} preview`,
        text: message.text,
        meta: message.isFinal ? "preview locked" : "preview streaming",
      })
      break
    }
    case "TRANSCRIPT": {
      options.upsertEntry({
        id: `user-${message.utteranceId}`,
        role: "user",
        title: "You",
        text: message.text,
        meta: message.isFinal ? "ASR final" : "ASR interim",
      })
      break
    }
    case "BOT_TEXT": {
      clearPendingReply(message.utteranceId)
      const previous = options.botSpeechBuffer[message.utteranceId] ?? ""
      const combined = [previous, message.text]
        .filter(Boolean)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim()

      options.botSpeechBuffer[message.utteranceId] = combined

      options.upsertEntry({
        id: `bot-${message.utteranceId}`,
        role: "bot",
        title: message.botId,
        text: combined,
        meta: message.isFinal ? "bot stream complete" : "bot block streaming",
      })

      if (options.browserTtsEnabled) {
        options.output?.queueClientSpeech(
          message.utteranceId,
          message.text,
          options.language,
        )
      }
      break
    }
    case "AUDIO_CHUNK": {
      clearPendingReply(message.utteranceId)
      if (options.ttsMode === "server") {
        void options.output?.enqueueServerAudio(
          message.utteranceId,
          message.audioBase64,
          message.sampleRate,
        )
      }
      break
    }
    case "AUDIO_END": {
      if (options.ttsMode === "server") {
        options.output?.completeServerAudio(message.utteranceId)
      }
      break
    }
  }
}

export function buildClientHelloMessage({
  clientId,
  settings,
  asrProvider,
  ttsProvider,
}: BuildClientHelloMessageOptions): ClientHelloMessage {
  return {
    type: "CLIENT_HELLO",
    clientId,
    channelId: settings.channelId,
    settings: {
      conversationBackend: settings.conversationBackend,
      asrMode: asrProvider.mode,
      asrProvider: asrProvider.id,
      ttsMode: ttsProvider.mode,
      ttsProvider: ttsProvider.id,
      language: settings.language,
      openClawGateway:
        settings.conversationBackend === "openclaw-gateway"
          ? {
              url: settings.openClawGatewayUrl,
              token: settings.openClawGatewayToken,
            }
          : undefined,
    },
  }
}

export function badgeTone(state: ConnectionState) {
  switch (state) {
    case "connected":
      return "live"
    case "connecting":
      return "neutral"
    case "disconnected":
      return "warn"
    case "error":
      return "danger"
  }
}

export function getStarterTitle(onboarding: HostedOnboardingState | null) {
  return onboarding?.project.name ?? "Demo Room"
}
