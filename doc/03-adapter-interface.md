# Adapter Interface Definitions

> Version: 0.1 (Prototype)
> Last Updated: 2026-03-20

---

## 1. Design Principles

- **Bidirectional streaming throughout**: audio in -> text out (ASR), text in -> audio out (TTS)
- **Dual provider modes**: both ASR and TTS may run as client providers or server providers
- **Provider implementations are thin**: they map browser/OS APIs or vendor SDK streaming APIs onto these interfaces. No business logic lives in providers.
- **Interfaces are stable**: once validated, provider contracts do not change. Only provider implementations evolve.
- **AsyncGenerator as the streaming primitive**: native TypeScript, backpressure-aware, no extra dependencies.

---

## 2. Provider Modes

VoicyClaw distinguishes two execution locations:

- **Client provider** - runs in the user's browser or OS integration layer. Example: browser `SpeechRecognition`, browser `speechSynthesis`.
- **Server provider** - runs inside the VoicyClaw backend and usually talks to a vendor SDK or API. Example: OpenAI Whisper, Azure Speech, ElevenLabs.

These modes are supported independently for ASR and TTS. A deployment may use client ASR with server TTS, server ASR with client TTS, or run both stages on the same side.

---

## 3. Shared Types

```typescript
// packages/asr/src/types.ts
// packages/tts/src/types.ts

export type AudioChunk = Buffer  // PCM 16-bit signed, 16kHz, mono
export type ProviderMode = "client" | "server"

export interface ASRChunk {
  text: string
  isFinal: boolean
}

export interface ASRConfig {
  language?: string          // BCP-47, e.g. "en-US", "zh-CN"
  sampleRate?: number        // default: 16000
  encoding?: "pcm16"        // v0.1 only supports pcm16
}

export interface TTSConfig {
  language?: string          // BCP-47
  voice?: string             // vendor-specific voice ID
  sampleRate?: number        // default: 16000
  encoding?: "pcm16"        // v0.1 only supports pcm16
}
```

---

## 4. ASR Provider Interfaces

### 4.1 Server ASR Adapter

**Contract**: Accepts a continuous audio stream. Yields transcript chunks as they arrive. Vendors that support interim results will emit `isFinal: false` chunks first, then `isFinal: true` to close the utterance.

```typescript
// packages/asr/src/interface.ts

export interface ServerASRAdapter {
  readonly mode: "server"
  readonly name: string

  /**
   * Transcribe a continuous audio stream.
   *
   * @param audio  - AsyncIterable of PCM audio chunks (from mic or WS relay)
   * @param config - ASR configuration
   * @yields ASRChunk - interim and final transcript chunks
   */
  transcribe(
    audio: AsyncIterable<AudioChunk>,
    config?: ASRConfig
  ): AsyncGenerator<ASRChunk>
}
```

### 4.2 Client ASR Provider

**Contract**: Captures speech or receives transcript events from browser/OS services and yields transcript chunks to the rest of the app. Unlike the server adapter, it does not require raw PCM to be shipped to the backend first.

```typescript
export interface ClientASRProvider {
  readonly mode: "client"
  readonly name: string

  /**
   * Start client-side recognition.
   *
   * @param config - ASR configuration
   * @yields ASRChunk - interim and final transcript chunks
   */
  start(config?: ASRConfig): AsyncGenerator<ASRChunk>
}
```

### 4.3 Provider Implementation Shape

```typescript
// packages/asr/src/providers/openai.ts

export class OpenAIASRProvider implements ServerASRAdapter {
  readonly mode = "server" as const
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

## 5. TTS Provider Interfaces

### 5.1 Server TTS Adapter

**Contract**: Accepts a stream of text chunks (e.g., LLM output tokens). Begins synthesis immediately on the first chunk. Yields synthesized audio chunks as they become available, enabling low-latency playback before the full text is known.

```typescript
// packages/tts/src/interface.ts

export interface ServerTTSAdapter {
  readonly mode: "server"
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

### 5.2 Client TTS Provider

**Contract**: Accepts streaming text and speaks it directly through browser/OS facilities. It does not return PCM chunks because playback happens on the client side.

```typescript
export interface ClientTTSProvider {
  readonly mode: "client"
  readonly name: string

  /**
   * Speak a text stream directly in the client runtime.
   *
   * @param text   - AsyncIterable of text chunks
   * @param config - TTS configuration
   */
  speak(
    text: AsyncIterable<string>,
    config?: TTSConfig
  ): Promise<void>
}
```

### 5.3 Provider Implementation Shape

```typescript
// packages/tts/src/providers/openai.ts

export class OpenAITTSProvider implements ServerTTSAdapter {
  readonly mode = "server" as const
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

## 6. Bot Channel Interface

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
   * @param utteranceId - correlates STT_RESULT -> TTS_TEXT
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

## 7. End-to-End Pipeline Composition

### 7.1 Server-provider composition

These three interfaces compose cleanly into the full backend-managed pipeline. This is the only place server-side business logic lives:

```typescript
async function handleUtterance(
  audioStream: AsyncIterable<AudioChunk>,
  asr: ServerASRAdapter,
  bot: BotChannel,
  tts: ServerTTSAdapter,
  wsOut: (chunk: AudioChunk) => void
) {
  // 1. ASR: audio -> transcript (streaming)
  for await (const asrChunk of asr.transcribe(audioStream)) {
    if (!asrChunk.isFinal) continue  // skip interim results in v0.1

    // 2. Bot: transcript -> text response (streaming)
    const botTextStream = bot.send(crypto.randomUUID(), asrChunk.text)

    // 3. TTS: text stream -> audio stream (streaming)
    for await (const audioChunk of tts.synthesize(botTextStream)) {
      wsOut(audioChunk)  // push to user
    }
  }
}
```

No server adapter needs to know about the others. Swap any server provider without touching this pipeline.

### 7.2 Client-provider composition

Client providers participate at the same logical stages, but the execution location changes:

```typescript
async function handleClientMedia(
  clientAsr: ClientASRProvider,
  bot: BotChannel,
  clientTts: ClientTTSProvider
) {
  for await (const asrChunk of clientAsr.start({ language: "en-US" })) {
    if (!asrChunk.isFinal) continue

    const botTextStream = bot.send(crypto.randomUUID(), asrChunk.text)
    await clientTts.speak(botTextStream, { language: "en-US" })
  }
}
```

In practice, deployments may mix modes. For example:
- browser `SpeechRecognition` as a client ASR provider
- OpenAI TTS as a server TTS provider
- OpenAI Whisper as a server ASR provider
- browser `speechSynthesis` as a client TTS provider

---

## 8. Provider Implementation Checklist

For each new provider, implement one of the mode-specific interfaces above:

- [ ] `constructor` accepts only `apiKey: string` (+ optional vendor-specific options)
- [ ] `name` is a stable lowercase slug (e.g. `"volcengine-asr"`)
- [ ] `mode` is declared explicitly as `"client"` or `"server"`
- [ ] Uses `async function*` (AsyncGenerator) where streaming output is exposed upward
- [ ] Cleans up browser/vendor connections when the input iterable is exhausted or throws
- [ ] Does not buffer more than one vendor-defined chunk unit (no artificial latency)

### Planned Providers

| Mode | Adapter | Provider | Status |
|---|---|---|---|
| client | ASR | Browser SpeechRecognition / OS speech services | P0 |
| client | TTS | Browser SpeechSynthesis / OS speech services | P0 |
| server | ASR | OpenAI Whisper | P0 - implement first |
| server | TTS | OpenAI TTS | P0 - implement first |
| server | ASR | Volcengine ASR | P0 |
| server | TTS | Volcengine TTS | P0 |
| server | ASR | Alibaba Cloud NLS | P0 |
| server | TTS | Alibaba Cloud TTS | P0 |
| server | ASR | Azure Cognitive Speech | P0 |
| server | TTS | Azure Cognitive Speech TTS | P0 |
