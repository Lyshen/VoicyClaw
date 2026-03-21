# Conversation Backend Abstraction

> Version: 0.1 (Design + MVP)
> Last Updated: 2026-03-21

---

## 1. Purpose

VoicyClaw must support multiple agent connection directions without rewriting the voice product flow each time.

The abstraction goal is:

- keep **voice UX** stable
- keep **ASR / TTS orchestration** stable
- isolate **agent transport differences** behind one backend interface

In practice this means the browser and most of the server should not care whether:

- a local bot connects inward to VoicyClaw
- VoicyClaw connects outward to OpenClaw Gateway
- a future native OpenClaw channel plugin replaces the bridge later

---

## 2. Stable vs Variable Layers

### 2.1 Stable product layer

These flows should stay the same across all agent backends:

- microphone capture
- ASR provider selection
- transcript lifecycle
- bot text streaming in the timeline
- TTS provider selection
- shared output-turn coordination
- interruption and stale-drop playback rules

### 2.2 Variable backend layer

These concerns are intentionally backend-specific:

- who initiates the connection
- auth shape
- session/run identifiers
- request/response wire protocol
- preview/final event normalization
- backend-specific retries and disconnect handling

---

## 3. Backend Contract

The server-side contract is intentionally small:

```ts
interface ConversationBackend {
  readonly kind: "local-bot" | "openclaw-gateway"
  readonly botId: string

  sendTurn(input: {
    channelId: string
    clientId: string
    utteranceId: string
    text: string
    language: string
    settings: ConversationSettings
  }): AsyncGenerator<{
    utteranceId: string
    text: string
    isFinal: boolean
  }>
}
```

This contract is enough for the current VoicyClaw pipeline because the upper layer only needs:

- a way to submit one resolved user turn
- a streamed text response
- one stable display identity for the source backend

---

## 4. Current Implementations

### 4.1 `local-bot`

Implementation:

- wraps the existing inbound `/bot/connect` OpenClaw-style local bot flow
- preserves the current mock-bot demo
- keeps platform key issuance and bot registration unchanged

### 4.2 `openclaw-gateway`

Implementation:

- opens an outbound Gateway WebSocket
- completes the `connect.challenge` -> `connect` handshake
- authenticates with the configured shared Gateway token
- sends a `chat.send` request for the resolved user transcript
- normalizes streamed `chat` events back into VoicyClaw bot text chunks

For the first MVP slice, this backend opens a fresh Gateway connection per turn and uses the shared-token auth strategy only.

That is not the long-term pooling model, but it is the fastest safe path to validate local interoperability.

The important design point is that auth shape now lives under the backend/bridge layer. Later we can add a second connect strategy, for example:

- shared Gateway token
- paired device identity + device token/signature

without changing the upper voice turn pipeline.

---

## 5. Why This Abstraction Matters

Without this layer, each new agent transport would leak protocol details into the voice pipeline:

- local bot handshake logic
- Gateway token logic
- future native OpenClaw channel logic

That would make the codebase fork around transport details.

With this layer:

- the upper pipeline always speaks in turns
- the backend layer translates turns into whichever wire protocol is needed
- future transports replace only backend implementations, not the voice product flow

---

## 6. Evolution Path

### Phase 1 - current MVP

- `local-bot`
- `openclaw-gateway`

### Phase 2 - richer Gateway support

- connection pooling
- explicit abort propagation
- optional history hydration
- better preview extraction

### Phase 3 - native OpenClaw channel

Add a third backend:

- `native-openclaw-channel`

At that point:

- the browser still does not change
- ASR/TTS provider orchestration still does not change
- only the backend implementation changes

That is the main architectural payoff.
