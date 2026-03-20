import type { Buffer } from "node:buffer"

export type AudioChunk = Buffer

export interface TTSConfig {
  language?: string
  voice?: string
  sampleRate?: number
  encoding?: "pcm16"
}
