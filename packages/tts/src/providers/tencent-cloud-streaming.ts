import { randomUUID } from "node:crypto"

import type { TTSAdapter } from "../interface"
import type { AudioChunk, TTSConfig } from "../types"
import {
  buildTencentSignedUrl,
  createTencentSessionQuery,
  createTencentSocket,
  createTencentSocketSession,
  DEFAULT_TENCENT_SAMPLE_RATE,
  DEFAULT_TENCENT_STREAMING_TTS_ENDPOINT,
  resolveTencentRuntimeConfig,
  sendTencentJsonMessage,
  type TencentCloudBaseSynthesisOptions,
  validateTencentBidirectionalSampleRate,
  waitForTencentSocketOpen,
} from "./tencent-cloud-shared"

export interface TencentCloudStreamingTTSProviderOptions
  extends TencentCloudBaseSynthesisOptions {}

export class TencentCloudStreamingTTSProvider implements TTSAdapter {
  readonly name = "tencent-cloud-streaming-tts"

  constructor(
    private readonly options: TencentCloudStreamingTTSProviderOptions,
  ) {}

  async *synthesize(
    text: AsyncIterable<string>,
    config?: TTSConfig,
  ): AsyncGenerator<AudioChunk> {
    const runtime = resolveTencentRuntimeConfig(this.options, config)
    const sampleRate = validateTencentBidirectionalSampleRate(
      runtime.sampleRate ?? DEFAULT_TENCENT_SAMPLE_RATE,
    )
    const iterator = text[Symbol.asyncIterator]()
    const firstChunk = await readNextNonEmptyChunk(iterator)

    if (!firstChunk) {
      return
    }

    const sessionId = randomUUID()
    const socket = createTencentSocket(
      buildTencentSignedUrl(
        runtime.endpoint?.trim() || DEFAULT_TENCENT_STREAMING_TTS_ENDPOINT,
        {
          ...createTencentSessionQuery(
            "TextToStreamAudioWSv2",
            runtime,
            sessionId,
          ),
          SampleRate: sampleRate,
        },
        runtime.secretKey,
      ),
      this.options.createSocket,
    )
    const session = createTencentSocketSession(socket, {
      expectReady: true,
    })
    const writePromise = this.writeStreamingText(
      socket,
      session.ready,
      sessionId,
      iterator,
      firstChunk,
    ).catch((error) => {
      socket.close()
      throw error
    })

    try {
      await waitForTencentSocketOpen(socket)

      for await (const audioChunk of session.audio) {
        yield audioChunk
      }

      await writePromise
      await session.completion
    } finally {
      session.dispose()
      socket.close()
      await writePromise.catch(() => undefined)
      await session.completion.catch(() => undefined)
    }
  }

  private async writeStreamingText(
    socket: ReturnType<typeof createTencentSocket>,
    ready: Promise<void>,
    sessionId: string,
    iterator: AsyncIterator<string>,
    firstChunk: string,
  ) {
    await ready

    await sendTencentJsonMessage(socket, {
      session_id: sessionId,
      message_id: randomUUID(),
      action: "ACTION_SYNTHESIS",
      data: firstChunk,
    })

    for await (const chunk of iterateNonEmptyChunks(iterator)) {
      await sendTencentJsonMessage(socket, {
        session_id: sessionId,
        message_id: randomUUID(),
        action: "ACTION_SYNTHESIS",
        data: chunk,
      })
    }

    await sendTencentJsonMessage(socket, {
      session_id: sessionId,
      message_id: randomUUID(),
      action: "ACTION_COMPLETE",
    })
  }
}

async function readNextNonEmptyChunk(iterator: AsyncIterator<string>) {
  while (true) {
    const next = await iterator.next()
    if (next.done) {
      return null
    }

    if (next.value.trim()) {
      return next.value
    }
  }
}

async function* iterateNonEmptyChunks(iterator: AsyncIterator<string>) {
  while (true) {
    const next = await iterator.next()
    if (next.done) {
      return
    }

    if (next.value.trim()) {
      yield next.value
    }
  }
}
