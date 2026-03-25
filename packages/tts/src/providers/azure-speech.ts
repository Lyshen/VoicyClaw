import type { TTSAdapter } from "../interface"
import type { AudioChunk, TTSConfig } from "../types"
import {
  type AzureSpeechRuntimeConfig,
  type AzureSpeechSynthesisOptions,
  type AzureSpeechSynthesizerLike,
  closeAzureSpeechSynthesizer,
  createAzureSpeechSynthesizer,
  createDefaultAzurePushAudioStream,
  resolveAzureRuntimeConfig,
  synthesizeAzureTextSegment,
} from "./azure-speech-shared"
import { collectFullText } from "./shared"

export interface AzureSpeechTTSProviderOptions
  extends AzureSpeechSynthesisOptions {}

export class AzureSpeechTTSProvider implements TTSAdapter {
  readonly name = "azure-speech-tts"

  constructor(private readonly options: AzureSpeechTTSProviderOptions) {}

  async *synthesize(
    text: AsyncIterable<string>,
    config?: TTSConfig,
  ): AsyncGenerator<AudioChunk> {
    const input = await collectFullText(text)

    if (!input) {
      return
    }

    const runtime = resolveAzureRuntimeConfig(this.options, config)
    const synthesizer = this.createSynthesizer(runtime)

    try {
      yield* synthesizeAzureTextSegment(
        synthesizer,
        input,
        this.options.createPushAudioStream ?? createDefaultAzurePushAudioStream,
      )
    } finally {
      await closeAzureSpeechSynthesizer(synthesizer)
    }
  }

  private createSynthesizer(runtime: AzureSpeechRuntimeConfig) {
    const factory =
      this.options.createSynthesizer ?? createAzureSpeechSynthesizer

    return factory(runtime)
  }
}

export type { AzureSpeechSynthesizerLike }
