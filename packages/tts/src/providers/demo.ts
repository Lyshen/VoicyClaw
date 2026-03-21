import { Buffer } from "node:buffer"

import type { TTSAdapter } from "../interface"
import type { AudioChunk, TTSConfig } from "../types"

const DEFAULT_SAMPLE_RATE = 16_000

export class DemoTTSProvider implements TTSAdapter {
  readonly name = "demo-tts"

  async *synthesize(
    text: AsyncIterable<string>,
    config?: TTSConfig,
  ): AsyncGenerator<AudioChunk> {
    const sampleRate = config?.sampleRate ?? DEFAULT_SAMPLE_RATE

    for await (const chunk of text) {
      const cleaned = chunk.trim()
      if (!cleaned) continue
      yield renderToneChunk(cleaned, sampleRate)
    }
  }
}

function renderToneChunk(text: string, sampleRate: number): Buffer {
  const excerpt = text.slice(0, 72)
  const noteLength = Math.floor(sampleRate * 0.06)
  const silenceLength = Math.floor(sampleRate * 0.015)
  const leadIn = Math.floor(sampleRate * 0.02)
  const totalLength = leadIn + excerpt.length * (noteLength + silenceLength)
  const samples = new Int16Array(totalLength)

  let offset = leadIn

  for (const character of excerpt) {
    const frequency = 220 + (character.charCodeAt(0) % 18) * 28
    const amplitude = character === " " ? 0 : 9_500

    for (let index = 0; index < noteLength; index += 1) {
      const envelope = Math.sin((Math.PI * index) / noteLength)
      const sample = Math.sin((2 * Math.PI * frequency * index) / sampleRate)
      samples[offset + index] = Math.round(sample * envelope * amplitude)
    }

    offset += noteLength + silenceLength
  }

  return Buffer.from(samples.buffer)
}
