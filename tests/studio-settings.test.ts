import { afterEach, describe, expect, it } from "vitest"

import {
  buildWsUrl,
  defaultStudioSettings,
  getStudioSettingsStorageKey,
  loadStudioSettings,
  normalizeOpenClawGatewayUrl,
  normalizeServerUrl,
  persistStudioSettings,
  STUDIO_SETTINGS_STORAGE_KEY,
  sanitizeChannelId,
} from "../apps/web/lib/studio-settings"

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

describe("studio settings helpers", () => {
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
        ...defaultStudioSettings,
        serverUrl: "https://demo.example.com/app",
        channelId: "Demo Room",
      }),
    ).toBe("wss://demo.example.com/ws/client?channelId=demo-room")
  })

  it("migrates legacy browser toggles from local storage", () => {
    const storage = createMemoryStorage()
    storage.setItem(
      STUDIO_SETTINGS_STORAGE_KEY,
      JSON.stringify({
        serverUrl: "http://localhost:3001/path",
        channelId: "Alpha Room",
        browserSpeechEnabled: false,
        browserVoiceEnabled: false,
      }),
    )
    globalThis.window = { localStorage: storage } as Window & typeof globalThis

    expect(loadStudioSettings()).toMatchObject({
      serverUrl: "http://localhost:3001",
      channelId: "alpha-room",
      asrProvider: "demo",
      ttsProvider: "demo",
    })
  })

  it("applies runtime defaults before reading local storage", () => {
    expect(
      loadStudioSettings({
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

    persistStudioSettings({
      ...defaultStudioSettings,
      serverUrl: "http://localhost:3001/path",
      channelId: "Team Demo",
    })

    expect(
      JSON.parse(storage.getItem(STUDIO_SETTINGS_STORAGE_KEY) ?? ""),
    ).toMatchObject({
      serverUrl: "http://localhost:3001",
      channelId: "team-demo",
      conversationBackend: "local-bot",
      asrProvider: "browser",
      ttsProvider: "browser",
      openClawGatewayUrl: "ws://127.0.0.1:18789",
    })
  })

  it("keeps Volcengine server TTS selections round-trippable", () => {
    const storage = createMemoryStorage()
    storage.setItem(
      STUDIO_SETTINGS_STORAGE_KEY,
      JSON.stringify({
        ttsProvider: "volcengine-tts",
      }),
    )
    globalThis.window = { localStorage: storage } as Window & typeof globalThis

    expect(loadStudioSettings()).toMatchObject({
      ttsProvider: "volcengine-tts",
    })
  })

  it("keeps Google batched server TTS selections round-trippable", () => {
    const storage = createMemoryStorage()
    storage.setItem(
      STUDIO_SETTINGS_STORAGE_KEY,
      JSON.stringify({
        ttsProvider: "google-batched-tts",
      }),
    )
    globalThis.window = { localStorage: storage } as Window & typeof globalThis

    expect(loadStudioSettings()).toMatchObject({
      ttsProvider: "google-batched-tts",
    })
  })

  it("keeps Tencent unary server TTS selections round-trippable", () => {
    const storage = createMemoryStorage()
    storage.setItem(
      STUDIO_SETTINGS_STORAGE_KEY,
      JSON.stringify({
        ttsProvider: "tencent-tts",
      }),
    )
    globalThis.window = { localStorage: storage } as Window & typeof globalThis

    expect(loadStudioSettings()).toMatchObject({
      ttsProvider: "tencent-tts",
    })
  })

  it("keeps Tencent bidirectional server TTS selections round-trippable", () => {
    const storage = createMemoryStorage()
    storage.setItem(
      STUDIO_SETTINGS_STORAGE_KEY,
      JSON.stringify({
        ttsProvider: "tencent-streaming-tts",
      }),
    )
    globalThis.window = { localStorage: storage } as Window & typeof globalThis

    expect(loadStudioSettings()).toMatchObject({
      ttsProvider: "tencent-streaming-tts",
    })
  })

  it("keeps Azure segmented server TTS selections round-trippable", () => {
    const storage = createMemoryStorage()
    storage.setItem(
      STUDIO_SETTINGS_STORAGE_KEY,
      JSON.stringify({
        ttsProvider: "azure-streaming-tts",
      }),
    )
    globalThis.window = { localStorage: storage } as Window & typeof globalThis

    expect(loadStudioSettings()).toMatchObject({
      ttsProvider: "azure-streaming-tts",
    })
  })

  it("isolates hosted settings by namespace", () => {
    const storage = createMemoryStorage()
    globalThis.window = { localStorage: storage } as Window & typeof globalThis

    persistStudioSettings(
      {
        ...defaultStudioSettings,
        channelId: "Hosted Room",
      },
      "ws-demo.sayhello-demo",
    )

    expect(
      JSON.parse(
        storage.getItem(getStudioSettingsStorageKey("ws-demo.sayhello-demo")) ??
          "",
      ),
    ).toMatchObject({
      channelId: "hosted-room",
    })
    expect(storage.getItem(STUDIO_SETTINGS_STORAGE_KEY)).toBeNull()
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
