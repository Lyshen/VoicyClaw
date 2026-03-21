import type { ClientHelloMessage } from "@voicyclaw/protocol"

export type ConversationSettings = ClientHelloMessage["settings"]
export type ConversationBackendId = NonNullable<
  ConversationSettings["conversationBackend"]
>

export interface ConversationChunk {
  utteranceId: string
  text: string
  isFinal: boolean
}

export interface ConversationTurnInput {
  channelId: string
  clientId: string
  utteranceId: string
  text: string
  language: string
  settings: ConversationSettings
}

export interface ConversationBackend {
  readonly kind: ConversationBackendId
  readonly botId: string

  sendTurn(input: ConversationTurnInput): AsyncGenerator<ConversationChunk>
}

export function getConversationBackendId(
  settings: ConversationSettings | undefined,
): ConversationBackendId {
  return settings?.conversationBackend ?? "local-bot"
}
