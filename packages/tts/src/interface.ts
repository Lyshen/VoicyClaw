import type { AudioChunk, TTSConfig } from "./types"

export interface TTSAdapter {
  readonly name: string

  synthesize(
    text: AsyncIterable<string>,
    config?: TTSConfig,
  ): AsyncGenerator<AudioChunk>
}
