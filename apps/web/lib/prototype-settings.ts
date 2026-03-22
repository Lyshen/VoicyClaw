export type ProviderMode = "client" | "server"
export type AsrProviderId = "browser" | "demo"
export type TtsProviderId = "browser" | "demo"
export type ConversationBackendId = "local-bot" | "openclaw-gateway"

type ProviderOption<T extends string> = {
  id: T
  mode: ProviderMode
  label: string
  summary: string
  runtimeHint: string
}

type ConversationBackendOption = {
  id: ConversationBackendId
  label: string
  summary: string
  runtimeHint: string
}

export type ProviderGuide = {
  id: string
  label: string
  status: "next" | "planned"
  summary: string
  keyHint: string
}

export interface PrototypeSettings {
  serverUrl: string
  channelId: string
  language: string
  conversationBackend: ConversationBackendId
  asrProvider: AsrProviderId
  ttsProvider: TtsProviderId
  openClawGatewayUrl: string
  openClawGatewayToken: string
  openAiAsrKey: string
  openAiTtsKey: string
}

export const CONVERSATION_BACKEND_OPTIONS: ConversationBackendOption[] = [
  {
    id: "local-bot",
    label: "Local demo bot",
    summary:
      "Uses the current VoicyClaw inbound bot socket and the bundled mock ClawBot flow.",
    runtimeHint:
      "Best for day-to-day demo work when you want `pnpm dev` to keep everything self-contained.",
  },
  {
    id: "openclaw-gateway",
    label: "OpenClaw Gateway",
    summary:
      "VoicyClaw sends final transcript turns to a real OpenClaw Gateway over its WebSocket chat API.",
    runtimeHint:
      "Use this to test a real local OpenClaw install with a Gateway URL and token.",
  },
]

export const ASR_PROVIDER_OPTIONS: ProviderOption<AsrProviderId>[] = [
  {
    id: "browser",
    mode: "client",
    label: "Browser SpeechRecognition",
    summary:
      "Fastest zero-setup ASR path. Uses the browser or OS speech stack directly.",
    runtimeHint:
      "Best for the current English-first demo when Chrome exposes Web Speech.",
  },
  {
    id: "demo",
    mode: "server",
    label: "Demo Server ASR",
    summary:
      "Routes microphone audio through the VoicyClaw server and keeps a browser transcript assist while true server ASR is still being wired.",
    runtimeHint:
      "Use this when you want to exercise the server-owned path without waiting for a real vendor adapter.",
  },
]

export const TTS_PROVIDER_OPTIONS: ProviderOption<TtsProviderId>[] = [
  {
    id: "browser",
    mode: "client",
    label: "Browser SpeechSynthesis",
    summary:
      "Speaks the bot reply locally in the browser for the most human-readable prototype output.",
    runtimeHint:
      "Recommended when you want the answer read aloud immediately without server audio playback.",
  },
  {
    id: "demo",
    mode: "server",
    label: "Demo Server TTS",
    summary:
      "Streams demo PCM frames from the server so the OpenClaw media pipeline stays visible end to end.",
    runtimeHint:
      "Best when you want to verify the server-side audio path instead of browser speech synthesis.",
  },
]

export const ASR_PROVIDER_GUIDE: ProviderGuide[] = [
  {
    id: "openai-whisper",
    label: "OpenAI Whisper",
    status: "next",
    summary:
      "Primary server ASR target for a production-grade hosted transcript pipeline.",
    keyHint:
      "Stage an OpenAI ASR key below; server wiring is the next adapter to land.",
  },
  {
    id: "azure-speech",
    label: "Azure Speech",
    status: "planned",
    summary:
      "Enterprise speech stack with wide language coverage and strong regional options.",
    keyHint: "Will require Azure speech credentials once the adapter is added.",
  },
  {
    id: "volcengine-asr",
    label: "Volcengine ASR",
    status: "planned",
    summary:
      "Priority CN server provider for lower-latency regional speech recognition.",
    keyHint: "Will use server-side credentials managed in VoicyClaw settings.",
  },
  {
    id: "alibaba-nls",
    label: "Alibaba Cloud NLS",
    status: "planned",
    summary:
      "Additional CN server ASR provider for deployments that stay inside Alibaba Cloud.",
    keyHint:
      "Will require Alibaba Cloud key material once the adapter is wired.",
  },
]

export const TTS_PROVIDER_GUIDE: ProviderGuide[] = [
  {
    id: "openai-tts",
    label: "OpenAI TTS",
    status: "next",
    summary: "Primary server TTS target for natural hosted voice output.",
    keyHint:
      "Stage an OpenAI TTS key below; server synthesis wiring is queued next.",
  },
  {
    id: "azure-tts",
    label: "Azure Speech TTS",
    status: "planned",
    summary:
      "High-quality neural voices with enterprise routing and regional controls.",
    keyHint: "Will require Azure speech credentials once the adapter is added.",
  },
  {
    id: "volcengine-tts",
    label: "Volcengine TTS",
    status: "planned",
    summary: "Priority CN server TTS target for local-market voice output.",
    keyHint: "Will use server-side credentials managed in VoicyClaw settings.",
  },
  {
    id: "alibaba-tts",
    label: "Alibaba Cloud TTS",
    status: "planned",
    summary: "Additional CN server TTS provider for Alibaba Cloud deployments.",
    keyHint:
      "Will require Alibaba Cloud key material once the adapter is wired.",
  },
]

export const SETTINGS_STORAGE_KEY = "voicyclaw.prototype.settings"

export const defaultSettings: PrototypeSettings = {
  serverUrl: "http://localhost:3001",
  channelId: "demo-room",
  language: "en-US",
  conversationBackend: "local-bot",
  asrProvider: "browser",
  ttsProvider: "browser",
  openClawGatewayUrl: "ws://127.0.0.1:18789",
  openClawGatewayToken: "",
  openAiAsrKey: "",
  openAiTtsKey: "",
}

export function getProviderModeLabel(mode: ProviderMode) {
  return mode === "client" ? "Client provider" : "Server provider"
}

export function getAsrProviderOption(providerId: string | undefined) {
  return (
    ASR_PROVIDER_OPTIONS.find((option) => option.id === providerId) ??
    ASR_PROVIDER_OPTIONS[0]
  )
}

export function getTtsProviderOption(providerId: string | undefined) {
  return (
    TTS_PROVIDER_OPTIONS.find((option) => option.id === providerId) ??
    TTS_PROVIDER_OPTIONS[0]
  )
}

export function getConversationBackendOption(backendId: string | undefined) {
  return (
    CONVERSATION_BACKEND_OPTIONS.find((option) => option.id === backendId) ??
    CONVERSATION_BACKEND_OPTIONS[0]
  )
}

export function normalizeServerUrl(input: string) {
  try {
    const url = new URL(input || defaultSettings.serverUrl)
    return `${url.protocol}//${url.host}`
  } catch {
    return defaultSettings.serverUrl
  }
}

export function normalizeOpenClawGatewayUrl(input: string) {
  const fallback = defaultSettings.openClawGatewayUrl
  const trimmed = input.trim() || fallback
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

export function sanitizeChannelId(input: string) {
  const cleaned = input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")

  return cleaned || defaultSettings.channelId
}

export function buildWsUrl(settings: PrototypeSettings) {
  const serverUrl = normalizeServerUrl(settings.serverUrl)
  return `${serverUrl.replace(/^http/i, "ws")}/ws/client?channelId=${encodeURIComponent(sanitizeChannelId(settings.channelId))}`
}

export function buildApiUrl(settings: PrototypeSettings, pathname: string) {
  return new URL(pathname, normalizeServerUrl(settings.serverUrl)).toString()
}

function normalizeAsrProvider(
  providerId: string | undefined,
  legacyBrowserSpeechEnabled?: boolean,
): AsrProviderId {
  if (providerId === "demo") return "demo"
  if (providerId === "browser") return "browser"
  return legacyBrowserSpeechEnabled === false
    ? "demo"
    : defaultSettings.asrProvider
}

function normalizeTtsProvider(
  providerId: string | undefined,
  legacyBrowserVoiceEnabled?: boolean,
): TtsProviderId {
  if (providerId === "demo") return "demo"
  if (providerId === "browser") return "browser"
  return legacyBrowserVoiceEnabled === false
    ? "demo"
    : defaultSettings.ttsProvider
}

function normalizeConversationBackend(
  backendId: string | undefined,
): ConversationBackendId {
  if (backendId === "openclaw-gateway") {
    return "openclaw-gateway"
  }

  return defaultSettings.conversationBackend
}

export function loadPrototypeSettings(
  runtimeDefaults?: Partial<PrototypeSettings>,
) {
  const defaults = {
    ...defaultSettings,
    ...runtimeDefaults,
  }
  if (typeof window === "undefined") {
    return defaults
  }

  try {
    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY)
    if (!raw) return defaults

    const parsed = JSON.parse(raw) as Partial<PrototypeSettings> & {
      browserSpeechEnabled?: boolean
      browserVoiceEnabled?: boolean
    }

    return {
      ...defaults,
      ...parsed,
      serverUrl: normalizeServerUrl(parsed.serverUrl ?? defaults.serverUrl),
      openClawGatewayUrl: normalizeOpenClawGatewayUrl(
        parsed.openClawGatewayUrl ?? defaults.openClawGatewayUrl,
      ),
      channelId: sanitizeChannelId(parsed.channelId ?? defaults.channelId),
      conversationBackend: normalizeConversationBackend(
        parsed.conversationBackend,
      ),
      asrProvider: normalizeAsrProvider(
        parsed.asrProvider,
        parsed.browserSpeechEnabled,
      ),
      ttsProvider: normalizeTtsProvider(
        parsed.ttsProvider,
        parsed.browserVoiceEnabled,
      ),
    }
  } catch {
    return defaults
  }
}

export function persistPrototypeSettings(settings: PrototypeSettings) {
  if (typeof window === "undefined") return

  window.localStorage.setItem(
    SETTINGS_STORAGE_KEY,
    JSON.stringify({
      ...settings,
      serverUrl: normalizeServerUrl(settings.serverUrl),
      channelId: sanitizeChannelId(settings.channelId),
      conversationBackend: getConversationBackendOption(
        settings.conversationBackend,
      ).id,
      asrProvider: getAsrProviderOption(settings.asrProvider).id,
      ttsProvider: getTtsProviderOption(settings.ttsProvider).id,
      openClawGatewayUrl: normalizeOpenClawGatewayUrl(
        settings.openClawGatewayUrl,
      ),
    }),
  )
}
