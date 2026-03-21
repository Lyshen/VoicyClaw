export interface RuntimeBotInfo {
  botId: string
  displayName: string
  status: "connected"
}

export type ProviderMode = "client" | "server"
export type ConversationBackendId = "local-bot" | "openclaw-gateway"

export interface ClientHelloMessage {
  type: "CLIENT_HELLO"
  clientId: string
  channelId: string
  settings: {
    conversationBackend: ConversationBackendId
    asrMode: ProviderMode
    asrProvider: string
    ttsMode: ProviderMode
    ttsProvider: string
    language: string
    openClawGateway?: {
      url: string
      token: string
    }
  }
}

export interface StartUtteranceMessage {
  type: "START_UTTERANCE"
  utteranceId: string
}

export interface CommitUtteranceMessage {
  type: "COMMIT_UTTERANCE"
  utteranceId: string
  transcript?: string
  source: "microphone" | "text"
}

export interface TextUtteranceMessage {
  type: "TEXT_UTTERANCE"
  utteranceId: string
  text: string
}

export type ClientControlMessage =
  | ClientHelloMessage
  | StartUtteranceMessage
  | CommitUtteranceMessage
  | TextUtteranceMessage

export interface SessionReadyMessage {
  type: "SESSION_READY"
  clientId: string
  channelId: string
}

export interface ChannelStateMessage {
  type: "CHANNEL_STATE"
  channelId: string
  clientCount: number
  botCount: number
  bots: RuntimeBotInfo[]
}

export interface TranscriptMessage {
  type: "TRANSCRIPT"
  utteranceId: string
  text: string
  isFinal: boolean
}

export interface BotTextMessage {
  type: "BOT_TEXT"
  utteranceId: string
  botId: string
  text: string
  isFinal: boolean
}

export interface BotPreviewMessage {
  type: "BOT_PREVIEW"
  utteranceId: string
  botId: string
  text: string
  isFinal: boolean
}

export interface AudioChunkMessage {
  type: "AUDIO_CHUNK"
  utteranceId: string
  audioBase64: string
  sampleRate: number
}

export interface PlaybackEndMessage {
  type: "AUDIO_END"
  utteranceId: string
  sampleRate: number
}

export interface NoticeMessage {
  type: "NOTICE"
  level: "info" | "error"
  message: string
}

export type ServerToClientMessage =
  | SessionReadyMessage
  | ChannelStateMessage
  | BotPreviewMessage
  | TranscriptMessage
  | BotTextMessage
  | AudioChunkMessage
  | PlaybackEndMessage
  | NoticeMessage
