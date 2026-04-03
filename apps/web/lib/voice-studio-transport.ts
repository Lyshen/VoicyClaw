"use client"

import type { ServerToClientMessage } from "@voicyclaw/protocol"

import {
  buildWsUrl,
  type PrototypeSettings,
  type ProviderMode,
} from "./prototype-settings"
import {
  buildClientHelloMessage,
  type ConnectionState,
} from "./voice-studio-session-helpers"

type ProviderSummary = {
  id: string
  mode: ProviderMode
}

type OpenVoiceStudioSocketOptions = {
  settings: PrototypeSettings
  clientId: string
  asrProvider: ProviderSummary
  ttsProvider: ProviderSummary
  handleServerMessage: (message: ServerToClientMessage) => void
  appendSystemMessage: (text: string) => void
  setConnectionState: (state: ConnectionState) => void
  clearReplyPlaybackState: () => void
}

export function openVoiceStudioSocket({
  settings,
  clientId,
  asrProvider,
  ttsProvider,
  handleServerMessage,
  appendSystemMessage,
  setConnectionState,
  clearReplyPlaybackState,
}: OpenVoiceStudioSocketOptions) {
  const ws = new WebSocket(buildWsUrl(settings))
  ws.binaryType = "arraybuffer"
  setConnectionState("connecting")

  ws.onopen = () => {
    ws.send(
      JSON.stringify(
        buildClientHelloMessage({
          clientId,
          settings,
          asrProvider,
          ttsProvider,
        }),
      ),
    )
  }

  ws.onmessage = (event) => {
    if (typeof event.data !== "string") {
      return
    }

    try {
      handleServerMessage(JSON.parse(event.data) as ServerToClientMessage)
    } catch {
      appendSystemMessage("Received an unreadable server message.")
    }
  }

  ws.onerror = () => {
    setConnectionState("error")
    clearReplyPlaybackState()
  }

  ws.onclose = () => {
    setConnectionState("disconnected")
    clearReplyPlaybackState()
  }

  return ws
}
