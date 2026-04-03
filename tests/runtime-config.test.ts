import { describe, expect, it } from "vitest"

import {
  getRuntimeConfig,
  resolvePublicServerUrl,
} from "../apps/web/lib/runtime-config"

describe("runtime config", () => {
  it("prefers an explicit public server url", () => {
    const request = createRequest("http://localhost:3000")

    expect(
      resolvePublicServerUrl(request, {
        VOICYCLAW_PUBLIC_SERVER_URL: "https://voice.example.com/api",
      }),
    ).toBe("https://voice.example.com/api")
  })

  it("derives the public server url from forwarded headers", async () => {
    const request = createRequest("http://localhost:3000/settings", {
      "x-forwarded-host": "demo.example.com",
      "x-forwarded-proto": "https",
    })

    expect(
      await getRuntimeConfig(
        request,
        {
          VOICYCLAW_PUBLIC_SERVER_PORT: "443",
        },
        {
          getHostedOnboardingState: async () => null,
        },
      ),
    ).toEqual({
      settingsDefaults: {
        serverUrl: "https://demo.example.com",
        channelId: undefined,
        conversationBackend: undefined,
      },
      settingsStorageNamespace: undefined,
      onboarding: null,
    })
  })

  it("returns starter project defaults when hosted onboarding is available", async () => {
    const request = createRequest("https://voice.example.com/studio", {
      host: "voice.example.com",
    })

    const onboarding = {
      version: 1 as const,
      workspace: {
        id: "ws-demo",
        name: "My Workspace",
      },
      project: {
        id: "sayhello-demo",
        name: "SayHello",
        channelId: "sayhello-demo",
        botId: "openclaw-demo",
        displayName: "SayHello Connector",
      },
      starterKey: {
        value: "vc_demo",
        label: "Starter key",
      },
      allowance: {
        label: "Free preview allowance",
        status: "preview" as const,
        note: "Starter preview allowance is active. 500.000 voice credits remaining. Billing is not enforced yet.",
        currency: "voice-credits" as const,
        grantedCreditsMillis: 500_000,
        usedCreditsMillis: 0,
        remainingCreditsMillis: 500_000,
      },
      connectorConfigJson: "{}",
      connectorConfigLine: "{}",
      connectorPackageName: "@voicyclaw/voicyclaw",
      settingsStorageNamespace: "ws-demo.sayhello-demo",
    }

    expect(
      await getRuntimeConfig(
        request,
        {
          VOICYCLAW_PUBLIC_SERVER_URL: "https://voice.example.com",
        },
        {
          getHostedOnboardingState: async () => onboarding,
        },
      ),
    ).toEqual({
      settingsDefaults: {
        serverUrl: "https://voice.example.com",
        channelId: "sayhello-demo",
        conversationBackend: "local-bot",
      },
      settingsStorageNamespace: "ws-demo.sayhello-demo",
      onboarding,
    })
  })

  it("falls back to the request host and server port", () => {
    const request = createRequest("http://127.0.0.1:3000", {
      host: "127.0.0.1:3000",
    })

    expect(
      resolvePublicServerUrl(request, {
        VOICYCLAW_SERVER_PORT: "3101",
      }),
    ).toBe("http://127.0.0.1:3101")
  })
})

function createRequest(url: string, headers?: Record<string, string>) {
  return {
    headers: new Headers(headers),
    nextUrl: new URL(url),
  }
}
