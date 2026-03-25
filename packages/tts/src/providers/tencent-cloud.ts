import { randomUUID } from "node:crypto"

import type { TTSAdapter } from "../interface"
import type { AudioChunk, TTSConfig } from "../types"
import { collectFullText } from "./shared"
import {
  buildTencentSignedUrl,
  createTencentSessionQuery,
  createTencentSocket,
  createTencentSocketSession,
  DEFAULT_TENCENT_SAMPLE_RATE,
  DEFAULT_TENCENT_TTS_ENDPOINT,
  resolveTencentRuntimeConfig,
  type TencentCloudBaseSynthesisOptions,
  validateTencentUnarySampleRate,
  waitForTencentSocketOpen,
} from "./tencent-cloud-shared"

export interface TencentCloudTTSProviderOptions
  extends TencentCloudBaseSynthesisOptions {
  emotionCategory?: string
  emotionIntensity?: number
  segmentRate?: number
}

export class TencentCloudTTSProvider implements TTSAdapter {
  readonly name = "tencent-cloud-tts"

  constructor(private readonly options: TencentCloudTTSProviderOptions) {}

  async *synthesize(
    text: AsyncIterable<string>,
    config?: TTSConfig,
  ): AsyncGenerator<AudioChunk> {
    const input = await collectFullText(text)

    if (!input) {
      return
    }

    const runtime = resolveTencentRuntimeConfig(this.options, config)
    const sampleRate = validateTencentUnarySampleRate(
      runtime.sampleRate ?? DEFAULT_TENCENT_SAMPLE_RATE,
    )
    const sessionId = randomUUID()
    const socket = createTencentSocket(
      buildTencentSignedUrl(
        runtime.endpoint?.trim() || DEFAULT_TENCENT_TTS_ENDPOINT,
        {
          ...createTencentSessionQuery(
            "TextToStreamAudioWS",
            runtime,
            sessionId,
          ),
          Text: input,
          EmotionCategory: this.options.emotionCategory?.trim(),
          EmotionIntensity:
            typeof this.options.emotionIntensity === "number"
              ? this.options.emotionIntensity
              : undefined,
          SegmentRate:
            typeof this.options.segmentRate === "number"
              ? this.options.segmentRate
              : undefined,
          SampleRate: sampleRate,
        },
        runtime.secretKey,
      ),
      this.options.createSocket,
    )
    const session = createTencentSocketSession(socket)

    try {
      await waitForTencentSocketOpen(socket)

      for await (const audioChunk of session.audio) {
        yield audioChunk
      }

      await session.completion
    } finally {
      session.dispose()
      socket.close()
      await session.completion.catch(() => undefined)
    }
  }
}
