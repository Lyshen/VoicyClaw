import type { TTSAdapter } from "../interface"
import type { AudioChunk, TTSConfig } from "../types"
import {
  type AzureSpeechRuntimeConfig,
  type AzureSpeechSynthesisOptions,
  closeAzureSpeechSynthesizer,
  createAzureSpeechSynthesizer,
  createDefaultAzurePushAudioStream,
  DEFAULT_AZURE_FLUSH_TIMEOUT_MS,
  DEFAULT_AZURE_MAX_CHUNK_CHARACTERS,
  resolveAzureRuntimeConfig,
  synthesizeAzureTextSegment,
} from "./azure-speech-shared"

export interface AzureSpeechStreamingTTSProviderOptions
  extends AzureSpeechSynthesisOptions {
  flushTimeoutMs?: number
  maxChunkCharacters?: number
}

export class AzureSpeechStreamingTTSProvider implements TTSAdapter {
  readonly name = "azure-speech-streaming-tts"

  constructor(
    private readonly options: AzureSpeechStreamingTTSProviderOptions,
  ) {}

  async *synthesize(
    text: AsyncIterable<string>,
    config?: TTSConfig,
  ): AsyncGenerator<AudioChunk> {
    const runtime = resolveAzureRuntimeConfig(this.options, config)
    const synthesizer = this.createSynthesizer(runtime)
    const segments = createBatchedSegments(text, {
      flushTimeoutMs:
        this.options.flushTimeoutMs ?? DEFAULT_AZURE_FLUSH_TIMEOUT_MS,
      maxChunkCharacters:
        this.options.maxChunkCharacters ?? DEFAULT_AZURE_MAX_CHUNK_CHARACTERS,
    })

    try {
      for await (const segment of segments) {
        yield* synthesizeAzureTextSegment(
          synthesizer,
          segment,
          this.options.createPushAudioStream ??
            createDefaultAzurePushAudioStream,
        )
      }
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

async function* createBatchedSegments(
  text: AsyncIterable<string>,
  options: {
    flushTimeoutMs: number
    maxChunkCharacters: number
  },
) {
  const iterator = text[Symbol.asyncIterator]()
  let buffer = ""
  let pendingRead: Promise<IteratorResult<string>> | null = null

  while (true) {
    const readySegment = extractReadySegment(buffer, options.maxChunkCharacters)

    if (readySegment) {
      buffer = readySegment.rest
      yield readySegment.segment
      continue
    }

    if (!pendingRead) {
      pendingRead = iterator.next()
    }

    if (!buffer.trim()) {
      const nextResult = await pendingRead
      pendingRead = null

      if (nextResult.done) {
        return
      }

      buffer += nextResult.value
      continue
    }

    const pendingResult = await waitForReadOrTimeout(
      pendingRead,
      options.flushTimeoutMs,
    )

    if (pendingResult.kind === "timeout") {
      const flushed = normalizeSegment(buffer)
      buffer = ""

      if (flushed) {
        yield flushed
      }
      continue
    }

    pendingRead = null

    if (pendingResult.result.done) {
      const finalSegment = normalizeSegment(buffer)
      if (finalSegment) {
        yield finalSegment
      }
      return
    }

    buffer += pendingResult.result.value
  }
}

function extractReadySegment(buffer: string, maxChunkCharacters: number) {
  if (!buffer.trim()) {
    return null
  }

  const sentenceBoundary = findSentenceBoundary(buffer)
  if (sentenceBoundary !== null) {
    return {
      segment: normalizeSegment(buffer.slice(0, sentenceBoundary)) as string,
      rest: buffer.slice(sentenceBoundary),
    }
  }

  if (buffer.length < maxChunkCharacters) {
    return null
  }

  const splitIndex = findPreferredSplitIndex(buffer, maxChunkCharacters)
  return {
    segment: normalizeSegment(buffer.slice(0, splitIndex)) as string,
    rest: buffer.slice(splitIndex),
  }
}

function findSentenceBoundary(buffer: string) {
  for (let index = 0; index < buffer.length; index += 1) {
    if (!isStrongBoundary(buffer[index])) {
      continue
    }

    let end = index + 1
    while (end < buffer.length && isBoundarySuffix(buffer[end])) {
      end += 1
    }

    return end
  }

  return null
}

function isStrongBoundary(character: string) {
  return (
    character === "." ||
    character === "!" ||
    character === "?" ||
    character === "。" ||
    character === "！" ||
    character === "？"
  )
}

function isBoundarySuffix(character: string) {
  return /\s|["')\]]/.test(character)
}

function findPreferredSplitIndex(buffer: string, maxChunkCharacters: number) {
  const slice = buffer.slice(0, maxChunkCharacters)
  const whitespaceIndex = Math.max(
    slice.lastIndexOf(" "),
    slice.lastIndexOf("\n"),
  )

  if (whitespaceIndex > maxChunkCharacters / 2) {
    return whitespaceIndex + 1
  }

  return maxChunkCharacters
}

function normalizeSegment(segment: string) {
  const trimmed = segment.trim()
  return trimmed || null
}

async function waitForReadOrTimeout(
  pendingRead: Promise<IteratorResult<string>>,
  timeoutMs: number,
) {
  const timeout = new Promise<{ kind: "timeout" }>((resolve) => {
    setTimeout(() => {
      resolve({
        kind: "timeout",
      })
    }, timeoutMs)
  })
  const read = pendingRead.then((result) => ({
    kind: "read" as const,
    result,
  }))

  return await Promise.race([read, timeout])
}
