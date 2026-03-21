import type { Buffer } from "node:buffer"

export type AudioChunk = Buffer

export interface ASRChunk {
  text: string
  isFinal: boolean
}

export interface ASRConfig {
  language?: string
  sampleRate?: number
  encoding?: "pcm16"
}
