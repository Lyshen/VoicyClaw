import type { ClientHelloMessage } from "@voicyclaw/protocol"

import type { OrchestrationDerivation } from "../orchestration"

export type ConversationSettings = ClientHelloMessage["settings"]
export type ConversationBackendId = NonNullable<
  ConversationSettings["conversationBackend"]
>

export interface ConversationChunk {
  utteranceId: string
  botId?: string
  botName?: string
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
  orchestration?: OrchestrationDerivation
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
