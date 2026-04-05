import {
  type AsrProviderId,
  type ConversationBackendId,
  getAsrProviderOption,
  getConversationBackendOption,
  getTtsProviderOption,
  type TtsProviderId,
} from "./studio-provider-catalog"

export interface StudioSettings {
  serverUrl: string
  channelId: string
  language: string
  conversationBackend: ConversationBackendId
  asrProvider: AsrProviderId
  ttsProvider: TtsProviderId
  openClawGatewayUrl: string
  openClawGatewayToken: string
}

export const STUDIO_SETTINGS_STORAGE_KEY = "voicyclaw.studio.settings"

export const defaultStudioSettings: StudioSettings = {
  serverUrl: "http://localhost:3001",
  channelId: "demo-room",
  language: "en-US",
  conversationBackend: "local-bot",
  asrProvider: "browser",
  ttsProvider: "browser",
  openClawGatewayUrl: "ws://127.0.0.1:18789",
  openClawGatewayToken: "",
}

export function getStudioSettingsStorageKey(settingsNamespace?: string) {
  return settingsNamespace
    ? `${STUDIO_SETTINGS_STORAGE_KEY}.${settingsNamespace}`
    : STUDIO_SETTINGS_STORAGE_KEY
}

export function normalizeServerUrl(input: string) {
  try {
    const url = new URL(input || defaultStudioSettings.serverUrl)
    return `${url.protocol}//${url.host}`
  } catch {
    return defaultStudioSettings.serverUrl
  }
}

export function normalizeOpenClawGatewayUrl(input: string) {
  const fallback = defaultStudioSettings.openClawGatewayUrl
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

  return cleaned || defaultStudioSettings.channelId
}

export function buildWsUrl(settings: StudioSettings) {
  const serverUrl = normalizeServerUrl(settings.serverUrl)
  return `${serverUrl.replace(/^http/i, "ws")}/ws/client?channelId=${encodeURIComponent(sanitizeChannelId(settings.channelId))}`
}

export function buildApiUrl(settings: StudioSettings, pathname: string) {
  return new URL(pathname, normalizeServerUrl(settings.serverUrl)).toString()
}

export function loadStudioSettings(
  initialSettings?: Partial<StudioSettings>,
  settingsNamespace?: string,
) {
  const defaults = {
    ...defaultStudioSettings,
    ...initialSettings,
  }

  if (typeof window === "undefined") {
    return defaults
  }

  try {
    const storageKey = getStudioSettingsStorageKey(settingsNamespace)
    let raw = window.localStorage.getItem(storageKey)

    if (!raw && settingsNamespace) {
      raw = window.localStorage.getItem(STUDIO_SETTINGS_STORAGE_KEY)
    }

    if (!raw) {
      return defaults
    }

    const parsed = JSON.parse(raw) as Partial<StudioSettings> & {
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

export function persistStudioSettings(
  settings: StudioSettings,
  settingsNamespace?: string,
) {
  if (typeof window === "undefined") {
    return
  }

  window.localStorage.setItem(
    getStudioSettingsStorageKey(settingsNamespace),
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

function normalizeAsrProvider(
  providerId: string | undefined,
  legacyBrowserSpeechEnabled?: boolean,
): AsrProviderId {
  if (providerId === "demo") return "demo"
  if (providerId === "browser") return "browser"

  return legacyBrowserSpeechEnabled === false
    ? "demo"
    : defaultStudioSettings.asrProvider
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
    : defaultStudioSettings.ttsProvider
}

function normalizeConversationBackend(
  backendId: string | undefined,
): ConversationBackendId {
  if (backendId === "openclaw-gateway") {
    return "openclaw-gateway"
  }

  return defaultStudioSettings.conversationBackend
}
