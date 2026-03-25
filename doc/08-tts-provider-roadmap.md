# TTS Provider Roadmap

> Version: 0.1 (Prototype)
> Last Updated: 2026-03-24

---

## 1. Goal

VoicyClaw should support two complementary server-side TTS tracks:

- **Realtime flagship providers** for the best possible conversational feel
- **Budget / free-tier providers** that still sound good enough when wrapped in sentence batching

The project does not need every vendor to expose true bidirectional streaming in
order to be useful. It does need a clear separation between:

- providers that own a real low-latency streaming voice experience
- providers that are good enough through unary synthesis plus local batching

---

## 2. Target Capability Tiers

### 2.1 Tier 1: Realtime Flagship

These providers are intended to deliver the best interactive voice-agent
experience. They should begin playback as early as possible and stay close to a
true text-stream -> audio-stream flow.

Current / intended examples:

- `google-tts` using `Chirp 3 HD`
- `volcengine-tts` using bidirectional WebSocket synthesis

Design rules:

- prefer true bidirectional streaming APIs
- avoid sentence-level buffering inside shared business logic
- keep provider latency work inside the adapter implementation

### 2.2 Tier 2: Budget / Free-Tier Batched

These providers are still valuable even when they only expose unary or
single-request synthesis APIs.

Typical strategy:

1. buffer the bot text stream into sentence-ish segments
2. synthesize each segment with a unary API call
3. queue the returned PCM segments for browser playback

Representative vendors / models:

- Google `WaveNet`
- Google `Neural2`
- Google `Standard`
- Azure classic neural TTS
- AWS Polly

Design rules:

- do **not** change the server business pipeline for these vendors
- keep batching and flush heuristics inside the provider adapter
- preserve the same `AsyncIterable<string> -> AsyncGenerator<AudioChunk>`
  contract so batched and realtime providers remain interchangeable

### 2.3 Tier 3: Long-Form / Offline

These providers or modes optimize for large paragraphs, narration, downloads, or
batch rendering rather than conversational latency.

Examples:

- AWS Polly long-form / async tasks
- Google long audio synthesis
- vendor batch TTS jobs

This tier is useful later, but it is not the current priority for VoicyClaw’s
interactive demo surface.

---

## 3. Product Strategy

From an open-source developer perspective, the roadmap should intentionally
cover both ends of the market:

- **best experience, even if expensive**
- **cheap or free enough to experiment with**

That means VoicyClaw should not aim for “only bidirectional streaming
providers.” A healthy TTS matrix should look like this:

- **2-3 flagship realtime providers** across global and CN markets
- **multiple cheaper batched providers** with generous free tiers
- **shared playback behavior** regardless of which provider is selected

This lets developers choose what matters most:

- latency
- naturalness
- global reach
- CN-market quality
- free-tier experimentation
- predictable cost

---

## 4. Business-Layer Contract

The existing TTS adapter contract is sufficient:

```ts
synthesize(
  text: AsyncIterable<string>,
  config?: TTSConfig,
): AsyncGenerator<AudioChunk>
```

Why this contract still works:

- realtime providers can stream text directly into vendor APIs
- batched providers can buffer sentence segments internally and still yield PCM
  chunks incrementally
- the shared output-turn coordinator already owns interruption and stale-turn
  dropping above the provider layer

So the roadmap should **avoid rewriting the business pipeline** just to support
budget providers.

---

## 5. Near-Term Execution Plan

### Done

- `google-tts` real bidirectional streaming via `Chirp 3 HD`
- `google-batched-tts` as the reference unary / sentence-batched provider
- `tencent-tts` using Tencent Cloud's unary websocket streaming API
- `tencent-streaming-tts` using Tencent Cloud's bidirectional websocket API
- `azure-tts` upgraded to official Azure SDK audio streaming output
- `azure-streaming-tts` added as the Azure segmented streaming-input style path
- `volcengine-tts` improved bidirectional streaming behavior

### Next

- validate that sentence batching produces acceptable conversational latency
  across the cheaper provider tier
- keep the flagship realtime providers isolated from batched-provider changes
- optionally add a unified provider capability matrix to `/settings`

### After That

- evaluate AWS Polly batched TTS
- expand the budget-tier matrix with more providers once the capability model
  is stable

---

## 6. Guiding Principle

VoicyClaw should treat **true bidirectional streaming** as the premium voice
path, but treat **well-executed batched unary synthesis** as a first-class
fallback rather than a second-rate hack.

That balance keeps the project practical, affordable, and attractive to a wider
developer audience.
