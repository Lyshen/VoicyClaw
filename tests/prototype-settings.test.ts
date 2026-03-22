import { afterEach, describe, expect, it } from "vitest"

import {
  buildWsUrl,
  defaultSettings,
  loadPrototypeSettings,
  normalizeOpenClawGatewayUrl,
  normalizeServerUrl,
  persistPrototypeSettings,
  SETTINGS_STORAGE_KEY,
  sanitizeChannelId,
} from "../apps/web/lib/prototype-settings"

type MemoryStorage = {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
  removeItem: (key: string) => void
  clear: () => void
}

const originalWindow = globalThis.window

afterEach(() => {
  if (originalWindow) {
    globalThis.window = originalWindow
    return
  }

  delete (globalThis as { window?: Window }).window
})

describe("prototype settings helpers", () => {
  it("normalizes server urls and sanitizes channel ids", () => {
    expect(normalizeServerUrl("https://demo.example.com/path")).toBe(
      "https://demo.example.com",
    )
    expect(
      normalizeOpenClawGatewayUrl("https://gateway.example.com/socket"),
    ).toBe("wss://gateway.example.com/socket")
    expect(sanitizeChannelId(" Demo Room! 42 ")).toBe("demo-room-42")
    expect(
      buildWsUrl({
        ...defaultSettings,
        serverUrl: "https://demo.example.com/app",
        channelId: "Demo Room",
      }),
    ).toBe("wss://demo.example.com/ws/client?channelId=demo-room")
  })

  it("migrates legacy browser toggles from local storage", () => {
    const storage = createMemoryStorage()
    storage.setItem(
      SETTINGS_STORAGE_KEY,
      JSON.stringify({
        serverUrl: "http://localhost:3001/path",
        channelId: "Alpha Room",
        browserSpeechEnabled: false,
        browserVoiceEnabled: false,
      }),
    )
    globalThis.window = { localStorage: storage } as Window & typeof globalThis

    expect(loadPrototypeSettings()).toMatchObject({
      serverUrl: "http://localhost:3001",
      channelId: "alpha-room",
      asrProvider: "demo",
      ttsProvider: "demo",
    })
  })

  it("applies runtime defaults before reading local storage", () => {
    expect(
      loadPrototypeSettings({
        serverUrl: "https://voice.example.com/path",
        channelId: "Runtime Room",
      }),
    ).toMatchObject({
      serverUrl: "https://voice.example.com/path",
      channelId: "Runtime Room",
    })
  })

  it("persists normalized settings back to local storage", () => {
    const storage = createMemoryStorage()
    globalThis.window = { localStorage: storage } as Window & typeof globalThis

    persistPrototypeSettings({
      ...defaultSettings,
      serverUrl: "http://localhost:3001/path",
      channelId: "Team Demo",
    })

    expect(
      JSON.parse(storage.getItem(SETTINGS_STORAGE_KEY) ?? ""),
    ).toMatchObject({
      serverUrl: "http://localhost:3001",
      channelId: "team-demo",
      conversationBackend: "local-bot",
      asrProvider: "browser",
      ttsProvider: "browser",
      openClawGatewayUrl: "ws://127.0.0.1:18789",
    })
  })
})

function createMemoryStorage(): MemoryStorage {
  const store = new Map<string, string>()

  return {
    getItem(key) {
      return store.get(key) ?? null
    },
    setItem(key, value) {
      store.set(key, value)
    },
    removeItem(key) {
      store.delete(key)
    },
    clear() {
      store.clear()
    },
  }
}
