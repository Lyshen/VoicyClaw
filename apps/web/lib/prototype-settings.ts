export interface PrototypeSettings {
  serverUrl: string
  channelId: string
  language: string
  browserSpeechEnabled: boolean
  browserVoiceEnabled: boolean
  openAiAsrKey: string
  openAiTtsKey: string
}

export const SETTINGS_STORAGE_KEY = "voicyclaw.prototype.settings"

export const defaultSettings: PrototypeSettings = {
  serverUrl: process.env.NEXT_PUBLIC_VOICYCLAW_SERVER_URL ?? "http://localhost:3001",
  channelId: "demo-room",
  language: "en-US",
  browserSpeechEnabled: true,
  browserVoiceEnabled: true,
  openAiAsrKey: "",
  openAiTtsKey: ""
}

export function normalizeServerUrl(input: string) {
  try {
    const url = new URL(input || defaultSettings.serverUrl)
    return `${url.protocol}//${url.host}`
  } catch {
    return defaultSettings.serverUrl
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

export function loadPrototypeSettings() {
  if (typeof window === "undefined") {
    return defaultSettings
  }

  try {
    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY)
    if (!raw) return defaultSettings
    const parsed = JSON.parse(raw) as Partial<PrototypeSettings>
    return {
      ...defaultSettings,
      ...parsed,
      serverUrl: normalizeServerUrl(parsed.serverUrl ?? defaultSettings.serverUrl),
      channelId: sanitizeChannelId(parsed.channelId ?? defaultSettings.channelId)
    }
  } catch {
    return defaultSettings
  }
}

export function persistPrototypeSettings(settings: PrototypeSettings) {
  if (typeof window === "undefined") return

  window.localStorage.setItem(
    SETTINGS_STORAGE_KEY,
    JSON.stringify({
      ...settings,
      serverUrl: normalizeServerUrl(settings.serverUrl),
      channelId: sanitizeChannelId(settings.channelId)
    })
  )
}
