# OpenClaw Gateway Bridge Design

> Version: 0.1 (Design)
> Last Updated: 2026-03-21

---

## 1. Goal

Define the smallest realistic integration that lets **VoicyClaw** talk to a real **OpenClaw** deployment without requiring a custom OpenClaw plugin channel first.

The MVP target is:

- OpenClaw users keep running their normal Gateway process
- VoicyClaw connects to the OpenClaw Gateway over the official WebSocket protocol
- VoicyClaw keeps owning ASR / TTS and the voice UX
- OpenClaw keeps owning agent execution, session storage, routing, and streamed chat output

This gives us a runnable end-to-end feasibility path before investing in a deeper "native OpenClaw channel plugin" implementation.

---

## 2. Research Summary

The official OpenClaw docs show four facts that matter for a VoicyClaw integration:

### 2.1 Channels are Gateway-owned

OpenClaw channels are connected and routed by the single long-running Gateway process. The Gateway is the source of truth for:

- active channel connections
- session keys and routing
- chat history
- streamed agent responses

### 2.2 WebChat is already the simplest first-party chat surface

The official channel list includes **WebChat**, a WebSocket-native Gateway UI. The WebChat docs state that it:

- talks directly to the Gateway WebSocket
- uses `chat.history`, `chat.send`, `chat.abort`, and `chat.inject`
- follows the same routing/session rules as other channels
- receives deterministic replies back through the same WebChat route

This makes WebChat behavior the best reference model for a minimal VoicyClaw bridge.

### 2.3 Gateway protocol is the supported integration surface

The official Gateway protocol docs describe a WebSocket control plane where:

- the first client frame must be a `connect` request
- the server first emits a `connect.challenge` event
- auth is done during `connect`
- operator clients can authenticate with a shared Gateway token during `connect`
- device identity / signature is a separate auth path, not required for the MVP bridge
- clients declare role and scopes
- the protocol exposes `chat`, `sessions`, `channels`, `agent`, `presence`, and related APIs

For our bridge, the relevant scope family is the chat API:

- `chat.history`
- `chat.send`
- `chat.abort`
- `chat.inject`

### 2.4 Chat streaming is officially exposed as events

The current OpenClaw protocol schema defines chat methods and a `chat` event stream with:

- `runId`
- `sessionKey`
- `seq`
- `state` = `delta | final | aborted | error`
- optional `message`
- optional `errorMessage`
- optional `usage`
- optional `stopReason`

This is enough to build a streaming adapter on the VoicyClaw side, even though `message` is intentionally typed loosely in the public schema.

---

## 3. Decision

### 3.1 Chosen MVP

Implement **VoicyClaw as an OpenClaw Gateway WebChat-compatible bridge**, not as a custom OpenClaw plugin channel.

### 3.2 Why this is the smallest path

This path avoids:

- writing and packaging an OpenClaw extension first
- learning each channel plugin lifecycle before proving the product loop
- adding a second media stack inside OpenClaw
- requiring OpenClaw users to install a brand-new channel package just to test VoicyClaw

Instead, we reuse what OpenClaw already supports:

- Gateway WebSocket auth
- chat session routing
- streaming chat events
- session history
- abort semantics

### 3.3 What "minimal" means here

For the first interop slice, VoicyClaw only bridges **text turns** to OpenClaw:

- user speech -> ASR -> final transcript in VoicyClaw
- final transcript -> `chat.send` in OpenClaw
- OpenClaw streamed text -> VoicyClaw UI + TTS

VoicyClaw continues to own:

- microphone capture
- ASR provider selection
- TTS provider selection
- output-turn coordination

OpenClaw continues to own:

- agent run execution
- session memory
- session routing
- streamed response generation

For auth, the MVP deliberately uses the simplest supported path:

- VoicyClaw connects as an `operator`
- VoicyClaw presents the configured shared Gateway token
- VoicyClaw does not attempt device-signature auth in the first slice

Why:

- it matches the shortest manual setup path for local feasibility testing
- it avoids coupling MVP success to OpenClaw device-pairing semantics
- it keeps the future "device auth" path isolated as a transport detail, not a voice-pipeline concern

---

## 4. Alternatives Considered

### Option A - Gateway WebChat-compatible bridge

Status: **recommended**

Pros:

- official integration surface
- smallest installation burden
- supports streaming
- no OpenClaw plugin work required
- good fit for VoicyClaw as a voice-first front-end

Cons:

- not a "true OpenClaw plugin channel" yet
- requires a Gateway token and protocol client implementation
- `chat` event payload normalization is our responsibility

### Option B - Native OpenClaw plugin channel (`voicyclaw`)

Status: future phase

Pros:

- first-class OpenClaw channel identity
- cleaner long-term packaging story inside OpenClaw
- can eventually support richer inbound/outbound media ownership

Cons:

- larger implementation surface
- plugin lifecycle and install flow add friction
- slower path to first end-to-end proof

### Option C - CLI subprocess bridge

Status: rejected for MVP

Pros:

- almost no protocol client code

Cons:

- poor streaming story
- weak session reuse semantics
- process-per-turn overhead
- not representative of a real product path

---

## 5. Core Mapping

The bridge needs stable identity mapping across both systems.

| VoicyClaw concept | OpenClaw concept | MVP rule |
|---|---|---|
| `channelId` | `sessionKey` | one VoicyClaw channel maps to one deterministic OpenClaw session key |
| `utteranceId` | `idempotencyKey` | reuse the utterance ID to dedupe `chat.send` |
| active speaking turn | `runId` | store the current OpenClaw run ID per channel for abort/interruption |
| bot streamed text | `chat` event stream | normalize `delta` / `final` into VoicyClaw `BOT_PREVIEW` and `BOT_TEXT` |

### 5.1 Session key strategy

For MVP, use one deterministic OpenClaw `sessionKey` per VoicyClaw room:

```text
voicyclaw:<deploymentId>:channel:<channelId>
```

Why:

- it matches VoicyClaw's room-centric model
- reconnects can resume history
- OpenClaw keeps one stable memory bucket per voice room
- the mapping stays inspectable and debuggable

Important interoperability note:

- VoicyClaw may send the alias session key `voicyclaw:<deploymentId>:channel:<channelId>`
- OpenClaw may emit streamed `chat` events with the canonical stored key, for example `agent:main:voicyclaw:<deploymentId>:channel:<channelId>`
- the bridge should therefore correlate reply streams primarily by `runId`, not by strict raw `sessionKey` string equality

If multi-user isolation becomes necessary later, we can switch to:

```text
voicyclaw:<deploymentId>:channel:<channelId>:client:<clientId>
```

but that is not required for the first feasibility milestone.

---

## 6. Proposed Architecture

```text
Browser mic / typed input
        |
        v
VoicyClaw web runtime
        |
        |  CLIENT_HELLO / START_UTTERANCE / COMMIT_UTTERANCE
        v
VoicyClaw server
        |
        |  transcript resolved by client ASR or server ASR
        v
OpenClawGatewayBridge
        |
        |  Gateway WS: connect + chat.send + chat.abort + chat.history
        v
OpenClaw Gateway
        |
        v
OpenClaw agent runtime
        |
        |  event: chat (delta/final)
        v
OpenClawGatewayBridge
        |
        v
VoicyClaw server
        |
        +--> VoicyClaw web transcript stream
        |
        +--> client TTS or server TTS
```

### 6.1 New server abstraction

Today the server assumes a bot connects inward through `/bot/connect`.

To support OpenClaw cleanly, introduce a provider-neutral conversation backend abstraction:

```ts
interface ConversationBackend {
  readonly kind: "local-bot" | "openclaw-gateway"

  sendTurn(input: {
    channelId: string
    clientId: string
    utteranceId: string
    text: string
  }): AsyncGenerator<{
    utteranceId: string
    text: string
    isFinal: boolean
    isPreview?: boolean
  }>

  abortTurn?(input: {
    channelId: string
    utteranceId: string
  }): Promise<void>
}
```

Implementations:

1. `LocalBotConversationBackend`
   - wraps the current `/bot/connect` flow
   - preserves the existing mock-bot demo

2. `OpenClawGatewayConversationBackend`
   - owns the outbound Gateway WebSocket
   - issues `chat.send`
   - listens to `chat` events
   - calls `chat.abort` when the turn is interrupted

This keeps the rest of the voice pipeline unchanged.

---

## 7. Runtime Flow

### 7.1 Bridge bootstrap

1. VoicyClaw server loads OpenClaw bridge config
2. bridge opens one Gateway WebSocket connection
3. Gateway emits `connect.challenge`
4. bridge replies with `connect`, including:
   - protocol range
   - client metadata
   - `role: "operator"`
   - a stable bridge `device.id`
   - token auth
   - operator scopes required by chat methods
5. if the bridge is running on the same host and connects over loopback, the device can use local auto-approval; otherwise standard OpenClaw pairing/approval rules apply
6. on successful `hello-ok`, the bridge is considered ready

### 7.2 User turn -> OpenClaw

1. user speaks or types in VoicyClaw
2. VoicyClaw resolves the final transcript
3. server chooses `OpenClawGatewayConversationBackend`
4. bridge builds the deterministic `sessionKey`
5. bridge calls `chat.send` with:
   - `sessionKey`
   - `message`
   - `idempotencyKey = utteranceId`
   - `deliver = true`
6. bridge stores the returned `runId` as the active run for that channel

### 7.3 OpenClaw stream -> VoicyClaw

1. Gateway emits `event: "chat"` messages
2. bridge filters by `sessionKey` and current `runId`
3. `state = delta` becomes a VoicyClaw preview/text stream chunk
4. `state = final` closes the turn
5. normalized text is forwarded into:
   - `BOT_PREVIEW`
   - `BOT_TEXT`
   - TTS playback pipeline

### 7.4 Interruption

If a new user turn arrives while the previous OpenClaw run is still streaming:

1. VoicyClaw output-turn coordinator marks the older turn stale
2. server calls `chat.abort` with the active `runId`
3. bridge drops any late `chat` events from the aborted run
4. the new turn becomes the only active run for that channel

### 7.5 History hydration

Optional in MVP, but supported by the same bridge:

1. on client join, bridge can call `chat.history(sessionKey)`
2. the server can hydrate recent OpenClaw transcript into the VoicyClaw UI
3. if the Gateway is offline, VoicyClaw stays usable but marks OpenClaw as unavailable

---

## 8. Text Normalization Strategy

The official `chat` event schema intentionally leaves `message` as an opaque payload. Because of that, the bridge should not hard-code one brittle message shape.

Use a two-layer strategy:

### 8.1 Preferred path

Extract streaming text from the event payload when it exposes a clear assistant delta/final message body.

### 8.2 Safe fallback

If a `final` event arrives but text extraction is ambiguous:

1. call `chat.history(sessionKey, limit=N)`
2. find the newest assistant-visible message for the active `runId`
3. emit that as the final text

This keeps the MVP resilient against protocol payload evolution.

---

## 9. Configuration Surface

### 9.1 VoicyClaw server config

Add an OpenClaw backend block:

```text
OPENCLAW_GATEWAY_URL=ws://127.0.0.1:18789
OPENCLAW_GATEWAY_TOKEN=...
OPENCLAW_AGENT_ID=main
OPENCLAW_SESSION_PREFIX=voicyclaw
```

### 9.2 VoicyClaw settings UI

Expose a new conversation backend selector:

- `Local demo bot`
- `OpenClaw Gateway`

When `OpenClaw Gateway` is selected, show:

- Gateway URL
- Gateway token
- Agent ID
- session prefix

ASR and TTS settings stay exactly where they are today.

### 9.3 OpenClaw-side setup target

The intended OpenClaw setup should stay minimal:

1. install and onboard OpenClaw normally
2. run the Gateway locally
3. enable token auth
4. prefer the same-host loopback connection for MVP (`ws://127.0.0.1:18789`) so the first device pairing stays simple
5. copy the Gateway URL + token into VoicyClaw

No VoicyClaw-specific OpenClaw plugin install should be required for MVP.

---

## 10. Proposed Repo Changes

### 10.1 `apps/server`

Add:

- `apps/server/src/integrations/openclaw-gateway.ts`
- `apps/server/src/integrations/conversation-backend.ts`

Refactor:

- move current local-bot logic behind `LocalBotConversationBackend`
- keep `/bot/connect` for existing mock-bot/demo compatibility
- select backend per channel/runtime settings

### 10.2 `apps/web`

Update:

- `apps/web/lib/prototype-settings.ts`
- `apps/web/lib/use-prototype-settings.ts`
- `apps/web/components/settings-studio.tsx`

Purpose:

- persist backend selection
- show OpenClaw Gateway configuration fields
- surface connection health/errors in the UI

### 10.3 tests

Add:

- unit tests for session-key mapping and chat-event normalization
- integration tests with a mocked Gateway WebSocket server
- one Playwright smoke path that verifies OpenClaw mode can stream a reply

---

## 11. MVP Acceptance Criteria

The design is considered validated when all of the following are true:

1. a local OpenClaw Gateway can be configured from VoicyClaw settings
2. VoicyClaw can connect to the Gateway with token auth
3. a typed turn from VoicyClaw reaches OpenClaw through `chat.send`
4. OpenClaw streamed reply text appears in the VoicyClaw channel view
5. browser client TTS can speak the streamed reply
6. interruption calls `chat.abort` and stale chunks are dropped
7. the existing local mock-bot demo still works unchanged

---

## 12. Risks and Open Questions

### 12.1 Chat payload variability

Risk:

- the public `chat` event schema intentionally leaves `message` loosely typed

Mitigation:

- use tolerant extraction logic plus `chat.history` fallback on `final`

### 12.2 Auth and device identity

Risk:

- OpenClaw supports stricter connect-time identity/auth rules than a browser-only demo

Mitigation:

- use the normal Gateway token flow for the server bridge
- do not depend on device-signature auth for MVP success
- keep device-auth as a later bridge strategy, not a cross-cutting voice concern
- prefer same-host loopback for the first runnable path, because local devices can be auto-approved
- avoid depending on Control UI insecure-auth shortcuts

### 12.3 Concurrency inside one VoicyClaw room

Risk:

- multiple simultaneous users in one room may contend for one OpenClaw session

Mitigation:

- explicitly scope MVP to one active conversational run per room
- add per-client session keys only if real usage demands it

### 12.4 Media ownership split

Risk:

- OpenClaw also has channel/media concepts, but VoicyClaw owns voice media today

Mitigation:

- keep MVP text-only at the bridge boundary
- preserve VoicyClaw ASR/TTS ownership until interop is proven

---

## 13. Implementation Order

### Phase 1 - Configuration and bridge skeleton

- add backend selection to settings
- add OpenClaw Gateway config fields
- create server-side Gateway client with connect/auth

### Phase 2 - Text turn interoperability

- route final transcript to `chat.send`
- normalize `chat` events into VoicyClaw bot text
- wire `chat.abort` on interruption

### Phase 3 - Quality gates

- mock Gateway integration tests
- OpenClaw mode Playwright smoke coverage
- docs + troubleshooting notes

---

## 14. Local Validation Checklist

For the first manual MVP test on one machine:

1. start OpenClaw Gateway locally
2. ensure the Gateway is reachable on loopback, usually `ws://127.0.0.1:18789`
3. set a known Gateway token explicitly
4. run VoicyClaw locally
5. switch the VoicyClaw settings page to:
   - backend = `OpenClaw Gateway`
   - ASR = any working client or server provider
   - TTS = any working client or server provider
   - Gateway URL = local loopback WebSocket
   - Gateway token = the configured token
6. send a typed utterance first
7. confirm the text streams back from OpenClaw before validating microphone ASR

Recommended first-pass OpenClaw setup:

```bash
openclaw config set gateway.mode local
openclaw config set gateway.auth.mode token
openclaw config set gateway.auth.token "vc-local-test-token"
openclaw gateway restart
```

Then VoicyClaw should use:

```text
Gateway URL   = ws://127.0.0.1:18789
Gateway token = vc-local-test-token
```

---

## 15. Sources

- OpenClaw Channels: <https://docs.openclaw.ai/zh-CN/channels>
- OpenClaw Gateway Protocol: <https://docs.openclaw.ai/zh-CN/gateway/protocol>
- OpenClaw WebChat: <https://docs.openclaw.ai/zh-CN/web/webchat>
- OpenClaw Gateway CLI: <https://docs.openclaw.ai/zh-CN/cli/gateway>
- OpenClaw Channel Routing: <https://docs.openclaw.ai/zh-CN/channels/channel-routing>
- OpenClaw chat schema reference:
  <https://raw.githubusercontent.com/openclaw/openclaw/main/src/gateway/protocol/schema/logs-chat.ts>
