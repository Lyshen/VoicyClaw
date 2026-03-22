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

  it("derives the public server url from forwarded headers", () => {
    const request = createRequest("http://localhost:3000/settings", {
      "x-forwarded-host": "demo.example.com",
      "x-forwarded-proto": "https",
    })

    expect(
      getRuntimeConfig(request, {
        VOICYCLAW_PUBLIC_SERVER_PORT: "443",
      }),
    ).toEqual({
      serverUrl: "https://demo.example.com",
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
