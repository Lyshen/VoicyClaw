import type {
  ConversationBackend,
  ConversationChunk,
  ConversationSettings,
  ConversationTurnInput,
} from "./conversation-backend"
import {
  type OpenClawConnectStrategy,
  OpenClawGatewaySocket,
} from "./openclaw-gateway-socket"

const OPENCLAW_SESSION_PREFIX = "voicyclaw"

export class OpenClawGatewayConversationBackend implements ConversationBackend {
  readonly kind = "openclaw-gateway" as const
  readonly botId = "openclaw-gateway"

  constructor(private readonly settings: ConversationSettings) {}

  async *sendTurn(
    input: ConversationTurnInput,
  ): AsyncGenerator<ConversationChunk> {
    const config = resolveOpenClawGatewayConfig(this.settings)
    const sessionKey = buildOpenClawSessionKey(input.channelId)
    const gateway = new OpenClawGatewaySocket(
      config,
      resolveOpenClawConnectStrategy(config),
    )

    let runId: string | undefined
    let emittedText = false
    let streamedText = ""

    try {
      await gateway.connect()

      const result = (await gateway.request("chat.send", {
        sessionKey,
        message: input.text,
        deliver: false,
        idempotencyKey: input.utteranceId,
      })) as Record<string, unknown> | undefined

      runId = extractRunId(result)

      for await (const event of gateway.chatEvents()) {
        if (runId && event.runId !== runId) {
          continue
        }
        if (!runId && !sessionKeysMatch(sessionKey, event.sessionKey)) {
          continue
        }

        if (event.state === "error") {
          throw new Error(
            event.errorMessage ||
              "OpenClaw returned a chat error for this turn.",
          )
        }

        if (event.state === "aborted") {
          break
        }

        const text = extractTextFromUnknown(event.message)
        const chunkText = toIncrementalText(streamedText, text)

        if (event.state === "delta") {
          if (!chunkText) {
            continue
          }

          streamedText = text
          emittedText = true

          yield {
            utteranceId: input.utteranceId,
            text: chunkText,
            isFinal: false,
          }
          continue
        }

        if (chunkText) {
          streamedText = text
          emittedText = true
        }

        yield {
          utteranceId: input.utteranceId,
          text: chunkText,
          isFinal: true,
        }
        return
      }

      if (!emittedText) {
        throw new Error(
          "OpenClaw completed the turn without a readable assistant message.",
        )
      }

      yield {
        utteranceId: input.utteranceId,
        text: "",
        isFinal: true,
      }
    } finally {
      await gateway.close()
    }
  }
}

export function resolveOpenClawGatewayConfig(settings: ConversationSettings) {
  const url = normalizeOpenClawGatewayUrl(settings.openClawGateway?.url)
  const token = settings.openClawGateway?.token?.trim()

  if (!token) {
    throw new Error(
      "OpenClaw Gateway mode requires a Gateway token in settings.",
    )
  }

  return {
    url,
    token,
  }
}

function resolveOpenClawConnectStrategy(config: { token: string }) {
  return {
    kind: "shared-token",
    token: config.token,
  } satisfies OpenClawConnectStrategy
}

export function normalizeOpenClawGatewayUrl(input: string | undefined) {
  const fallback = "ws://127.0.0.1:18789"
  const trimmed = input?.trim() || fallback
  const candidate =
    /^wss?:\/\//i.test(trimmed) || /^https?:\/\//i.test(trimmed)
      ? trimmed
      : `ws://${trimmed}`

  try {
    const url = new URL(candidate)
    if (url.protocol === "http:") {
      url.protocol = "ws:"
    } else if (url.protocol === "https:") {
      url.protocol = "wss:"
    }

    return `${url.protocol}//${url.host}${url.pathname === "/" ? "" : url.pathname.replace(/\/$/, "")}`
  } catch {
    return fallback
  }
}

export function buildOpenClawSessionKey(channelId: string) {
  return `${OPENCLAW_SESSION_PREFIX}:channel:${channelId}`
}

export function extractTextFromUnknown(value: unknown, depth = 0): string {
  if (depth > 6 || value == null) {
    return ""
  }

  if (typeof value === "string") {
    return normalizeExtractedText(value)
  }

  if (Array.isArray(value)) {
    return normalizeExtractedText(
      value
        .map((item) => extractTextFromUnknown(item, depth + 1))
        .filter(Boolean)
        .join(" "),
    )
  }

  if (typeof value !== "object") {
    return ""
  }

  const record = value as Record<string, unknown>
  const preferredKeys = [
    "text",
    "delta",
    "content",
    "message",
    "parts",
    "output",
    "result",
    "summary",
    "final",
  ]

  const prioritized = preferredKeys
    .map((key) => extractTextFromUnknown(record[key], depth + 1))
    .filter(Boolean)
    .join(" ")

  if (prioritized) {
    return normalizeExtractedText(prioritized)
  }

  return normalizeExtractedText(
    Object.values(record)
      .map((item) => extractTextFromUnknown(item, depth + 1))
      .filter(Boolean)
      .join(" "),
  )
}

function normalizeExtractedText(text: string) {
  return text.replace(/\s+/g, " ").trim()
}

export function toIncrementalText(previousText: string, nextText: string) {
  if (!nextText) {
    return ""
  }

  if (!previousText) {
    return nextText
  }

  if (nextText.startsWith(previousText)) {
    return nextText.slice(previousText.length)
  }

  return nextText
}

function extractRunId(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return undefined
  }

  const direct = (payload as { runId?: unknown }).runId
  if (typeof direct === "string" && direct.trim()) {
    return direct
  }

  const nested = (payload as { payload?: { runId?: unknown } }).payload?.runId
  if (typeof nested === "string" && nested.trim()) {
    return nested
  }

  return undefined
}

function sessionKeysMatch(
  requestedSessionKey: string,
  eventSessionKey: string,
) {
  if (!requestedSessionKey || !eventSessionKey) {
    return false
  }

  if (requestedSessionKey === eventSessionKey) {
    return true
  }

  return eventSessionKey.endsWith(`:${requestedSessionKey}`)
}
