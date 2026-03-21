import { describe, expect, it } from "vitest"

import { DemoASRProvider } from "../packages/asr/src/providers/demo"
import { DemoTTSProvider } from "../packages/tts/src/providers/demo"

describe("demo providers", () => {
  it("uses the resolved transcript hint when demo ASR receives one", async () => {
    const provider = new DemoASRProvider({
      resolveTranscript: () => "hello from test"
    })

    const chunks = await collect(provider.transcribe(singleChunk(Buffer.from([1, 2, 3, 4]))))

    expect(chunks).toEqual([{ text: "hello from test", isFinal: true }])
  })

  it("falls back to a helpful message when demo ASR has no transcript hint", async () => {
    const provider = new DemoASRProvider()

    const chunks = await collect(provider.transcribe(emptyChunks()))

    expect(chunks).toEqual([
      {
        text: "Prototype ASR did not receive a transcript hint, so the utterance stayed silent.",
        isFinal: true
      }
    ])
  })

  it("renders non-empty audio for each non-empty demo TTS chunk", async () => {
    const provider = new DemoTTSProvider()

    const chunks = await collect(
      provider.synthesize(textChunks(["Hello from Studio Claw.", "", "Streaming demo output."]))
    )

    expect(chunks).toHaveLength(2)
    expect(chunks.every((chunk) => chunk.byteLength > 0)).toBe(true)
  })
})

async function collect<T>(source: AsyncIterable<T>) {
  const values: T[] = []
  for await (const item of source) {
    values.push(item)
  }
  return values
}

async function* singleChunk(chunk: Buffer) {
  yield chunk
}

async function* emptyChunks() {}

async function* textChunks(values: string[]) {
  for (const value of values) {
    yield value
  }
}
