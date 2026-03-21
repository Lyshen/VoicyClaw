import type { ASRChunk, ASRConfig, AudioChunk } from "./types"

export interface ASRAdapter {
  readonly name: string

  transcribe(
    audio: AsyncIterable<AudioChunk>,
    config?: ASRConfig
  ): AsyncGenerator<ASRChunk>
}
