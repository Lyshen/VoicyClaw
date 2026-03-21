import { setTimeout as delay } from "node:timers/promises"

import type { ASRAdapter } from "../interface"
import type { ASRChunk, ASRConfig, AudioChunk } from "../types"

interface DemoASROptions {
  latencyMs?: number
  resolveTranscript?: (context: {
    audioBytes: number
    chunkCount: number
  }) => string | Promise<string>
}

export class DemoASRProvider implements ASRAdapter {
  readonly name = "demo-asr"

  constructor(private readonly options: DemoASROptions = {}) {}

  async *transcribe(
    audio: AsyncIterable<AudioChunk>,
    _config?: ASRConfig
  ): AsyncGenerator<ASRChunk> {
    let audioBytes = 0
    let chunkCount = 0

    for await (const chunk of audio) {
      audioBytes += chunk.byteLength
      chunkCount += 1
    }

    if (this.options.latencyMs) {
      await delay(this.options.latencyMs)
    }

    const hint = await this.options.resolveTranscript?.({
      audioBytes,
      chunkCount
    })

    const fallback = chunkCount
      ? `Prototype ASR captured ${chunkCount} audio chunks (${Math.round(audioBytes / 1024)} KB) but did not receive a browser transcript.`
      : "Prototype ASR did not receive a transcript hint, so the utterance stayed silent."

    yield {
      text: hint?.trim() || fallback,
      isFinal: true
    }
  }
}
