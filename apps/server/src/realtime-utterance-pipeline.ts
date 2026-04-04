import { DemoASRProvider } from "@voicyclaw/asr"
import type { BotChannelMessage } from "@voicyclaw/protocol"

import type {
  ConversationBackend,
  ConversationTurnInput,
} from "./backends/conversation-backend"
import { getConversationBackendId } from "./backends/conversation-backend"
import { OpenClawGatewayConversationBackend } from "./backends/openclaw-gateway"
import { recordTtsUsageForChannel } from "./domains/billing/service"
import type {
  ActiveUtterance,
  ClientSession,
  ConnectedBot,
  RealtimeRuntime,
} from "./realtime-runtime"
import { createRuntimeTTSProvider } from "./tts-provider"

class LocalBotConversationBackend implements ConversationBackend {
  readonly kind = "local-bot" as const

  constructor(
    private readonly bot: ConnectedBot,
    private readonly client: ClientSession,
  ) {}

  get botId() {
    return this.bot.botId
  }

  sendTurn(input: ConversationTurnInput) {
    return this.bot.send(this.client, input.utteranceId, input.text)
  }
}

async function* bufferIterable(chunks: Buffer[]) {
  for (const chunk of chunks) {
    yield chunk
  }
}

function getConversationBackendForClient(
  runtime: RealtimeRuntime,
  client: ClientSession,
) {
  const backendId = getConversationBackendId(client.settings)
  if (backendId === "openclaw-gateway") {
    return new OpenClawGatewayConversationBackend(
      client.settings ?? {
        conversationBackend: "openclaw-gateway",
        asrMode: "client",
        asrProvider: "browser",
        ttsMode: "client",
        ttsProvider: "browser",
        language: "en-US",
      },
    )
  }

  const bot = runtime.getPrimaryBot(client.channelId)
  if (!bot) {
    return null
  }

  return new LocalBotConversationBackend(bot, client)
}

async function* forwardBotText(
  runtime: RealtimeRuntime,
  client: ClientSession,
  backend: ConversationBackend,
  utteranceId: string,
  source: AsyncGenerator<BotChannelMessage>,
) {
  for await (const message of source) {
    runtime.logPipeline("BOT_TEXT_FORWARD", {
      channelId: client.channelId,
      clientId: client.id,
      botId: backend.botId,
      backend: backend.kind,
      utteranceId,
      isFinal: message.isFinal,
      text: runtime.clipTextForLog(message.text),
    })

    runtime.sendJson(client.ws, {
      type: "BOT_TEXT",
      utteranceId,
      botId: backend.botId,
      text: message.text,
      isFinal: message.isFinal,
    })

    yield message.text
  }
}

async function resolveTranscript(
  runtime: RealtimeRuntime,
  client: ClientSession,
  utterance: ActiveUtterance,
) {
  const directTranscript = utterance.transcriptHint?.trim()
  const useClientTranscript =
    utterance.source === "text" ||
    (client.settings?.asrMode === "client" && Boolean(directTranscript))

  if (useClientTranscript) {
    if (directTranscript) {
      runtime.logPipeline("ASR_CLIENT_TRANSCRIPT", {
        channelId: client.channelId,
        clientId: client.id,
        utteranceId: utterance.utteranceId,
        source: utterance.source,
        asrMode: client.settings?.asrMode ?? "unknown",
        asrProvider: client.settings?.asrProvider ?? "unknown",
        text: runtime.clipTextForLog(directTranscript),
      })

      runtime.sendJson(client.ws, {
        type: "TRANSCRIPT",
        utteranceId: utterance.utteranceId,
        text: directTranscript,
        isFinal: true,
      })
    }

    return directTranscript ?? ""
  }

  const asr = new DemoASRProvider({
    latencyMs: 120,
    resolveTranscript: () => utterance.transcriptHint || "",
  })

  let transcript = ""

  for await (const chunk of asr.transcribe(
    bufferIterable(utterance.audioChunks),
  )) {
    transcript = chunk.text.trim()
    runtime.logPipeline("ASR_SERVER_TRANSCRIPT", {
      channelId: client.channelId,
      clientId: client.id,
      utteranceId: utterance.utteranceId,
      source: utterance.source,
      asrMode: client.settings?.asrMode ?? "unknown",
      asrProvider: client.settings?.asrProvider ?? "unknown",
      isFinal: chunk.isFinal,
      audioChunkCount: utterance.audioChunks.length,
      text: runtime.clipTextForLog(chunk.text),
    })

    runtime.sendJson(client.ws, {
      type: "TRANSCRIPT",
      utteranceId: utterance.utteranceId,
      text: chunk.text,
      isFinal: chunk.isFinal,
    })
  }

  return transcript
}

function calculateAudioDurationMs(audioBytes: number, sampleRate: number) {
  if (audioBytes <= 0 || sampleRate <= 0) {
    return 0
  }

  return Math.round((audioBytes / (sampleRate * 2)) * 1000)
}

async function recordTtsUsageSafely(
  runtime: RealtimeRuntime,
  input: Parameters<typeof recordTtsUsageForChannel>[0],
) {
  try {
    return await recordTtsUsageForChannel(input)
  } catch (error) {
    runtime.logPipeline("TTS_USAGE_RECORD_FAILED", {
      channelId: input.channelId,
      requestId: input.requestId,
      providerId: input.providerId,
      status: input.status,
      message: error instanceof Error ? error.message : String(error),
    })
    return null
  }
}

export async function processUtterance(
  runtime: RealtimeRuntime,
  client: ClientSession,
  utterance: ActiveUtterance,
) {
  const transcript = await resolveTranscript(runtime, client, utterance)

  if (!transcript) {
    runtime.sendNotice(
      client,
      "error",
      "This utterance ended without a transcript. Try typed text or browser speech recognition.",
    )
    return
  }

  const backend = getConversationBackendForClient(runtime, client)
  if (!backend) {
    runtime.sendNotice(
      client,
      "error",
      "No ClawBot is connected to this channel yet. Start the local bot to complete the loop.",
    )
    return
  }

  try {
    runtime.logPipeline("BACKEND_REQUEST_SENT", {
      channelId: client.channelId,
      clientId: client.id,
      utteranceId: utterance.utteranceId,
      backend: backend.kind,
      botId: backend.botId,
      text: runtime.clipTextForLog(transcript),
    })

    const botStream = backend.sendTurn({
      channelId: client.channelId,
      clientId: client.id,
      utteranceId: utterance.utteranceId,
      text: transcript,
      language: client.settings?.language ?? "en-US",
      settings: client.settings ?? {
        conversationBackend: "local-bot",
        asrMode: "client",
        asrProvider: "browser",
        ttsMode: "client",
        ttsProvider: "browser",
        language: "en-US",
      },
    })
    const textStream = forwardBotText(
      runtime,
      client,
      backend,
      utterance.utteranceId,
      botStream,
    )

    if (client.settings?.ttsMode === "client") {
      runtime.logPipeline("TTS_CLIENT_MODE_SELECTED", {
        channelId: client.channelId,
        clientId: client.id,
        utteranceId: utterance.utteranceId,
        backend: backend.kind,
        ttsProvider: client.settings.ttsProvider,
      })

      for await (const _text of textStream) {
        // Final bot text still streams to the browser while client TTS owns playback.
      }
      return
    }

    let inputChars = 0
    let audioChunkCount = 0
    let audioBytes = 0
    let ttsProviderId = client.settings?.ttsProvider ?? "demo"
    let ttsSampleRate = 0

    try {
      const tts = createRuntimeTTSProvider(client.settings)
      ttsProviderId = tts.providerId
      ttsSampleRate = tts.sampleRate

      async function* meteredTextStream() {
        for await (const text of textStream) {
          inputChars += text.length
          yield text
        }
      }

      for await (const audioChunk of tts.adapter.synthesize(
        meteredTextStream(),
        {
          language: client.settings?.language,
          sampleRate: tts.sampleRate,
        },
      )) {
        audioChunkCount += 1
        audioBytes += audioChunk.byteLength
        runtime.logPipeline("TTS_AUDIO_CHUNK", {
          channelId: client.channelId,
          clientId: client.id,
          utteranceId: utterance.utteranceId,
          chunkIndex: audioChunkCount,
          bytes: audioChunk.byteLength,
          sampleRate: tts.sampleRate,
          ttsProvider: tts.providerId,
        })

        runtime.sendJson(client.ws, {
          type: "AUDIO_CHUNK",
          utteranceId: utterance.utteranceId,
          audioBase64: audioChunk.toString("base64"),
          sampleRate: tts.sampleRate,
        })
      }

      runtime.logPipeline("TTS_AUDIO_END", {
        channelId: client.channelId,
        clientId: client.id,
        utteranceId: utterance.utteranceId,
        chunkCount: audioChunkCount,
        audioBytes,
        sampleRate: tts.sampleRate,
        ttsProvider: tts.providerId,
      })

      await recordTtsUsageSafely(runtime, {
        channelId: client.channelId,
        requestId: utterance.utteranceId,
        providerId: tts.providerId,
        status: "succeeded",
        inputChars,
        outputAudioBytes: audioBytes,
        outputAudioMs: calculateAudioDurationMs(audioBytes, tts.sampleRate),
      })

      runtime.sendJson(client.ws, {
        type: "AUDIO_END",
        utteranceId: utterance.utteranceId,
        sampleRate: tts.sampleRate,
      })
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown server TTS failure"

      await recordTtsUsageSafely(runtime, {
        channelId: client.channelId,
        requestId: utterance.utteranceId,
        providerId: ttsProviderId,
        status: "failed",
        inputChars,
        outputAudioBytes: audioBytes,
        outputAudioMs: calculateAudioDurationMs(audioBytes, ttsSampleRate),
        errorMessage: message,
      })

      throw error
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown bot pipeline failure"
    runtime.logPipeline("BACKEND_REQUEST_FAILED", {
      channelId: client.channelId,
      clientId: client.id,
      utteranceId: utterance.utteranceId,
      backend: backend.kind,
      botId: backend.botId,
      message,
    })
    runtime.sendNotice(client, "error", message)
  }
}
