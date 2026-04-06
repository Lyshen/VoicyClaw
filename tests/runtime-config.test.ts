import { mkdtempSync, writeFileSync } from "node:fs"
import os from "node:os"
import path from "node:path"

import { describe, expect, it } from "vitest"

import {
  getResolvedAuthConfig,
  getResolvedAuthMode,
} from "../apps/web/lib/auth-mode"
import {
  getWebRuntimePayload,
  resolvePublicServerUrl,
} from "../apps/web/lib/web-runtime"

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
      await getWebRuntimePayload(
        request,
        {
          VOICYCLAW_PUBLIC_SERVER_PORT: "443",
        },
        {
          getHostedOnboardingState: async () => null,
        },
      ),
    ).toEqual({
      initialSettings: {
        serverUrl: "https://demo.example.com",
        channelId: undefined,
        conversationBackend: undefined,
      },
      settingsNamespace: undefined,
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
      settingsNamespace: "ws-demo.sayhello-demo",
    }

    expect(
      await getWebRuntimePayload(
        request,
        {
          VOICYCLAW_PUBLIC_SERVER_URL: "https://voice.example.com",
        },
        {
          getHostedOnboardingState: async () => onboarding,
        },
      ),
    ).toEqual({
      initialSettings: {
        serverUrl: "https://voice.example.com",
        channelId: "sayhello-demo",
        conversationBackend: "local-bot",
      },
      settingsNamespace: "ws-demo.sayhello-demo",
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

  it("hydrates standalone web auth env from the unified yaml config", async () => {
    const cwd = mkdtempSync(path.join(os.tmpdir(), "voicyclaw-web-runtime-"))
    const filePath = path.join(cwd, "voicyclaw.local.yaml")

    writeFileSync(
      filePath,
      [
        "App:",
        "  server_port: 6301",
        "  web_port: 6300",
        "  public_server_url: https://api.voice.example.com",
        "",
        "Auth:",
        "  mode: clerk",
        "  clerk_publishable_key: pk_live_example",
        "  clerk_secret_key: sk_live_example",
      ].join("\n"),
    )

    const { getHydratedRuntimeEnvironment } = await import(
      "../scripts/runtime-env.mjs"
    )
    const env = getHydratedRuntimeEnvironment({
      VOICYCLAW_CONFIG: filePath,
    })

    expect(env.VOICYCLAW_WEB_PORT).toBe("6300")
    expect(env.VOICYCLAW_PUBLIC_SERVER_URL).toBe(
      "https://api.voice.example.com",
    )
    expect(env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY).toBe("pk_live_example")
    expect(getResolvedAuthMode(env)).toBe("clerk")
    expect(getResolvedAuthConfig(env)).toEqual({
      requestedMode: "clerk",
      resolvedMode: "clerk",
      isEnabled: true,
      clerkPublishableKey: "pk_live_example",
      clerkSecretKey: "sk_live_example",
    })
  })
})

function createRequest(url: string, headers?: Record<string, string>) {
  return {
    headers: new Headers(headers),
    nextUrl: new URL(url),
  }
}
