# Adapter Interface Definitions

> Version: 0.1 (Prototype)
> Last Updated: 2026-03-20

---

## 1. Design Principles

- **Bidirectional streaming throughout**: audio in → text out (ASR), text in → audio out (TTS)
- **Provider implementations are thin**: they map vendor SDK streaming APIs onto these interfaces. No business logic lives in providers.
- **Interfaces are stable**: once validated, adapters do not change. Only provider implementations evolve.
- **AsyncGenerator as the streaming primitive**: native TypeScript, backpressure-aware, no extra dependencies.

---

## 2. Shared Types

```typescript
// packages/asr/src/types.ts
// packages/tts/src/types.ts

export type AudioChunk = Buffer  // PCM 16-bit signed, 16kHz, mono

export interface ASRChunk {
  text: string
  isFinal: boolean
}

export interface ASRConfig {
  language?: string          // BCP-47, e.g. "en-US", "zh-CN"
  sampleRate?: number        // default: 16000
  encoding?: "pcm16"         // v0.1 only supports pcm16
}

export interface TTSConfig {
  language?: string          // BCP-47
  voice?: string             // vendor-specific voice ID
  sampleRate?: number        // default: 16000
  encoding?: "pcm16"         // v0.1 only supports pcm16
}
```

---

## 3. ASR Adapter Interface

**Contract**: Accepts a continuous audio stream. Yields transcript chunks as they arrive. Vendors that support interim results will emit `isFinal: false` chunks first, then `isFinal: true` to close the utterance.

```typescript
// packages/asr/src/interface.ts

export interface ASRAdapter {
  readonly name: string

  /**
   * Transcribe a continuous audio stream.
   *
   * @param audio  - AsyncIterable of PCM audio chunks (from mic or WS relay)
   * @param config - ASR configuration
   * @yields ASRChunk  - interim and final transcript chunks
   */
  transcribe(
    audio: AsyncIterable<AudioChunk>,
    config?: ASRConfig
  ): AsyncGenerator<ASRChunk>
}
```

### Provider Implementation Shape

```typescript
// packages/asr/src/providers/openai.ts

export class OpenAIASRProvider implements ASRAdapter {
  readonly name = "openai-whisper"

  constructor(private readonly apiKey: string) {}

  async *transcribe(
    audio: AsyncIterable<AudioChunk>,
    config?: ASRConfig
  ): AsyncGenerator<ASRChunk> {
    // Wire audio stream to OpenAI Whisper streaming API.
    // Yield ASRChunk as vendor SDK emits partial/final transcripts.
    // All vendor-specific logic stays here. Interface never changes.
  }
}
```

---

## 4. TTS Adapter Interface

**Contract**: Accepts a stream of text chunks (e.g., LLM output tokens). Begins synthesis immediately on the first chunk. Yields synthesized audio chunks as they become available, enabling low-latency playback before the full text is known.

```typescript
// packages/tts/src/interface.ts

export interface TTSAdapter {
  readonly name: string

  /**
   * Synthesize a streaming text input into an audio stream.
   *
   * @param text   - AsyncIterable of text chunks (streaming LLM output)
   * @param config - TTS configuration
   * @yields AudioChunk - synthesized PCM audio chunks
   */
  synthesize(
    text: AsyncIterable<string>,
    config?: TTSConfig
  ): AsyncGenerator<AudioChunk>
}
```

### Provider Implementation Shape

```typescript
// packages/tts/src/providers/openai.ts

export class OpenAITTSProvider implements TTSAdapter {
  readonly name = "openai-tts"

  constructor(private readonly apiKey: string) {}

  async *synthesize(
    text: AsyncIterable<string>,
    config?: TTSConfig
  ): AsyncGenerator<AudioChunk> {
    // Buffer text chunks into sentence boundaries (or stream directly
    // if vendor supports token-level streaming TTS).
    // Yield audio chunks as vendor SDK returns them.
  }
}
```

---

## 5. Bot Channel Interface

The bot channel represents the outbound connection from the VoicyClaw server to a ClawBot over the OpenClaw protocol. Responses from the bot are always streamed.

```typescript
// packages/protocol/src/channel.ts

export interface BotChannelMessage {
  utteranceId: string
  text: string
  isFinal: boolean
}

export interface BotChannel {
  readonly botId: string
  readonly channelId: string
  readonly sessionId: string

  /**
   * Send a transcribed user utterance to the bot.
   * The bot's response is returned as a streaming async generator.
   *
   * @param utteranceId - correlates STT_RESULT → TTS_TEXT
   * @param text        - final transcribed user input
   * @yields BotChannelMessage - streaming text chunks from bot
   */
  send(
    utteranceId: string,
    text: string
  ): AsyncGenerator<BotChannelMessage>
}
```

---

## 6. End-to-End Pipeline (Server Composition)

These three interfaces compose cleanly into the full real-time pipeline. This is the only place business logic lives:

```typescript
async function handleUtterance(
  audioStream: AsyncIterable<AudioChunk>,
  asr: ASRAdapter,
  bot: BotChannel,
  tts: TTSAdapter,
  wsOut: (chunk: AudioChunk) => void
) {
  // 1. ASR: audio → transcript (streaming)
  for await (const asrChunk of asr.transcribe(audioStream)) {
    if (!asrChunk.isFinal) continue  // skip interim results in v0.1

    // 2. Bot: transcript → text response (streaming)
    const botTextStream = bot.send(asrChunk.utteranceId, asrChunk.text)

    // 3. TTS: text stream → audio stream (streaming)
    for await (const audioChunk of tts.synthesize(botTextStream)) {
      wsOut(audioChunk)  // push to user
    }
  }
}
```

No adapter needs to know about the others. Swap any provider without touching this pipeline.

---

## 7. Provider Implementation Checklist

For each new vendor, implement either `ASRAdapter` or `TTSAdapter`:

- [ ] `constructor` accepts only `apiKey: string` (+ optional vendor-specific options)
- [ ] `name` is a stable lowercase slug (e.g. `"volcengine-asr"`)
- [ ] Uses `async function*` (AsyncGenerator) — no callbacks, no EventEmitter exposed upward
- [ ] Cleans up vendor SDK connection when the input iterable is exhausted or throws
- [ ] Does not buffer more than one vendor-defined chunk unit (no artificial latency)

### Planned Providers

| Adapter | Provider | Status |
|---|---|---|
| ASR | OpenAI Whisper | P0 — implement first |
| TTS | OpenAI TTS | P0 — implement first |
| ASR | Volcengine ASR | P0 |
| TTS | Volcengine TTS | P0 |
| ASR | Alibaba Cloud NLS | P0 |
| TTS | Alibaba Cloud TTS | P0 |
| ASR | Azure Cognitive Speech | P0 |
| TTS | Azure Cognitive Speech TTS | P0 |
