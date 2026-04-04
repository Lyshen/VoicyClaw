export type ProviderMode = "client" | "server"
export type AsrProviderId = "browser" | "demo"
export type TtsProviderId =
  | "browser"
  | "demo"
  | "azure-tts"
  | "azure-streaming-tts"
  | "google-tts"
  | "google-batched-tts"
  | "tencent-tts"
  | "tencent-streaming-tts"
  | "volcengine-tts"
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
  {
    id: "azure-tts",
    mode: "server",
    label: "Azure Speech TTS (Unary)",
    summary:
      "Sends the full bot reply to Azure Speech once, then streams PCM audio chunks back from the server.",
    runtimeHint:
      "Use this when you want the simplest Azure Speech path with official server-side streaming audio output.",
  },
  {
    id: "azure-streaming-tts",
    mode: "server",
    label: "Azure Speech TTS (Segmented)",
    summary:
      "Batches the bot text stream into sentence-ish Azure Speech requests so playback can start earlier without changing the shared server pipeline.",
    runtimeHint:
      "Use this when you want Azure to feel closer to a realtime voice path, while keeping the batching logic isolated inside the provider adapter.",
  },
  {
    id: "google-tts",
    mode: "server",
    label: "Google Cloud TTS (Streaming)",
    summary:
      "Uses Google Chirp 3 HD bidirectional streaming from the VoicyClaw server and returns raw PCM for browser playback.",
    runtimeHint:
      "Use this when you want the best Google realtime voice path with Chirp 3 HD streaming voices.",
  },
  {
    id: "google-batched-tts",
    mode: "server",
    label: "Google Cloud TTS (Batched)",
    summary:
      "Uses Google unary Text-to-Speech with sentence batching in the server for lower-cost WaveNet or Neural2 style playback.",
    runtimeHint:
      "Use this when you want cheaper Google voices with good conversational pacing, without changing the shared server pipeline.",
  },
  {
    id: "tencent-tts",
    mode: "server",
    label: "Tencent Cloud TTS (Unary Streaming)",
    summary:
      "Sends the full bot reply into Tencent Cloud's one-way websocket TTS API and streams raw PCM audio back from the server.",
    runtimeHint:
      "Use this when you want Tencent Cloud's official streaming-audio output path without changing the shared server pipeline.",
  },
  {
    id: "tencent-streaming-tts",
    mode: "server",
    label: "Tencent Cloud TTS (Bidirectional)",
    summary:
      "Uses Tencent Cloud's bidirectional websocket TTS API so text can stream in while PCM audio streams back out.",
    runtimeHint:
      "Use this when you want the closest Tencent Cloud match to a realtime voice path.",
  },
  {
    id: "volcengine-tts",
    mode: "server",
    label: "Volcengine TTS",
    summary:
      "Streams bidirectional Volcengine speech audio from the VoicyClaw server for CN-market low-latency playback.",
    runtimeHint:
      "Requires server-side Volcengine credentials loaded from config/voicyclaw.local.yaml or VOICYCLAW_VOLCENGINE_* environment variables.",
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
    id: "openai-tts-planned",
    label: "OpenAI TTS",
    status: "planned",
    summary:
      "Alternative hosted voice path once we broaden beyond browser, demo, Azure, and Google.",
    keyHint: "Will require an OpenAI API key once that adapter is added.",
  },
  {
    id: "volcengine-tts",
    label: "Volcengine TTS",
    status: "next",
    summary:
      "Available now as a server provider when the backend is configured with Volcengine credentials.",
    keyHint:
      "Use config/voicyclaw.local.yaml or set VOICYCLAW_VOLCENGINE_* env vars; env vars override YAML.",
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
}

export function getProviderModeLabel(mode: ProviderMode) {
  return mode === "client" ? "Client provider" : "Server provider"
}

export function getPrototypeSettingsStorageKey(storageNamespace?: string) {
  return storageNamespace
    ? `${SETTINGS_STORAGE_KEY}.${storageNamespace}`
    : SETTINGS_STORAGE_KEY
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
  if (providerId === "azure-tts") return "azure-tts"
  if (providerId === "azure-streaming-tts") return "azure-streaming-tts"
  if (providerId === "google-tts") return "google-tts"
  if (providerId === "google-batched-tts") return "google-batched-tts"
  if (providerId === "tencent-tts") return "tencent-tts"
  if (providerId === "tencent-streaming-tts") return "tencent-streaming-tts"
  if (providerId === "demo") return "demo"
  if (providerId === "browser") return "browser"
  if (providerId === "volcengine-tts") return "volcengine-tts"
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
  storageNamespace?: string,
) {
  const defaults = {
    ...defaultSettings,
    ...runtimeDefaults,
  }
  if (typeof window === "undefined") {
    return defaults
  }

  try {
    const raw = window.localStorage.getItem(
      getPrototypeSettingsStorageKey(storageNamespace),
    )
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
  persistPrototypeSettingsWithNamespace(settings)
}

export function persistPrototypeSettingsWithNamespace(
  settings: PrototypeSettings,
  storageNamespace?: string,
) {
  if (typeof window === "undefined") return

  window.localStorage.setItem(
    getPrototypeSettingsStorageKey(storageNamespace),
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
