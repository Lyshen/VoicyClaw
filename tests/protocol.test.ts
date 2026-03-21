import { Buffer } from "node:buffer"

import { describe, expect, it } from "vitest"

import {
  PROTOCOL_VERSION,
  decodeAudioFrame,
  encodeAudioFrame,
  isSupportedProtocolVersion
} from "../packages/protocol/src/openclaw"

describe("openclaw protocol helpers", () => {
  it("validates the supported protocol version", () => {
    expect(isSupportedProtocolVersion(PROTOCOL_VERSION)).toBe(true)
    expect(isSupportedProtocolVersion("0.2")).toBe(false)
  })

  it("round-trips encoded audio frames", () => {
    const payload = Buffer.from([1, 2, 3, 4, 5, 6])
    const frame = encodeAudioFrame(42, payload)
    const decoded = decodeAudioFrame(frame)

    expect(decoded.sequence).toBe(42)
    expect(decoded.streamType).toBe(0x01)
    expect(decoded.payloadLength).toBe(payload.byteLength)
    expect(Buffer.from(decoded.payload)).toEqual(payload)
  })

  it("rejects truncated audio frames", () => {
    expect(() => decodeAudioFrame(Buffer.from([1, 2, 3]))).toThrow(
      "Invalid frame: header is shorter than 8 bytes"
    )
  })
})
