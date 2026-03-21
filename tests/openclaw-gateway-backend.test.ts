import { describe, expect, it } from "vitest"

import {
  buildOpenClawSessionKey,
  extractTextFromUnknown,
  normalizeOpenClawGatewayUrl,
  toIncrementalText,
} from "../apps/server/src/backends/openclaw-gateway"

describe("openclaw gateway backend helpers", () => {
  it("builds a stable session key from the channel id", () => {
    expect(buildOpenClawSessionKey("demo-room")).toBe(
      "voicyclaw:channel:demo-room",
    )
  })

  it("normalizes gateway urls to websocket origins", () => {
    expect(normalizeOpenClawGatewayUrl("127.0.0.1:18789")).toBe(
      "ws://127.0.0.1:18789",
    )
    expect(normalizeOpenClawGatewayUrl("https://gateway.example.com/ws")).toBe(
      "wss://gateway.example.com/ws",
    )
  })

  it("extracts readable text from nested OpenClaw chat payloads", () => {
    expect(
      extractTextFromUnknown({
        content: [
          {
            type: "output_text",
            text: "Hello from",
          },
          {
            text: "OpenClaw.",
          },
        ],
      }),
    ).toBe("Hello from OpenClaw.")
  })

  it("converts cumulative OpenClaw deltas into incremental chunks", () => {
    expect(toIncrementalText("", "Hello")).toBe("Hello")
    expect(toIncrementalText("Hello", "Hello world")).toBe(" world")
    expect(toIncrementalText("Hello world", "Different text")).toBe(
      "Different text",
    )
  })
})
