# OpenClaw VoicyClaw Channel Plugin Design

> Version: 0.1 (Design)
> Last Updated: 2026-03-21

---

## 1. Goal

Define the long-term product shape where:

- **VoicyClaw** is the stable hosted service with a public domain
- **OpenClaw** installs a `voicyclaw` channel plugin
- the plugin runs inside the OpenClaw Gateway process
- the plugin **actively connects to VoicyClaw**
- upper voice business logic stays unchanged while transport direction changes

This is the formal product target after the current Gateway `url + token` MVP.

---

## 2. Why Move Beyond the Current Gateway MVP

The current MVP is:

- VoicyClaw -> OpenClaw Gateway
- configured by manual `Gateway URL + token`
- ideal for local feasibility testing

It is not the best final product shape because remote access becomes the user's burden:

- expose remote Gateway safely
- manage SSH tunnels / Tailscale / public ingress
- hand VoicyClaw a reachable OpenClaw URL

For productization, the cleaner shape is the reverse:

- VoicyClaw exposes one stable service endpoint
- OpenClaw plugin connects outward to that endpoint
- OpenClaw users only configure:
  - VoicyClaw base URL
  - VoicyClaw-issued secret / token
  - plugin/channel options

That makes VoicyClaw the control plane and OpenClaw the attached execution node.

---

## 3. Product Thesis

### 3.1 Desired end-state

From the user perspective:

1. Deploy or sign into VoicyClaw
2. Install the `voicyclaw` OpenClaw plugin
3. Configure `channels.voicyclaw`
4. Restart Gateway
5. See the OpenClaw bot appear inside a VoicyClaw room / workspace
6. Speak in VoicyClaw; OpenClaw replies through the plugin bridge

### 3.2 What each side owns

VoicyClaw owns:

- browser UX
- rooms / voice sessions
- microphone capture
- ASR selection
- TTS playback
- user/org/project management
- public ingress and cloud control plane

OpenClaw owns:

- agent execution
- session memory
- model/tool orchestration
- local filesystem / local tool access
- channel adapter runtime

### 3.3 Key architectural rule

The voice pipeline must remain backend-agnostic.

That means:

- current backend: `openclaw-gateway`
- future backend: `openclaw-plugin-channel`

Both should feed the same upper-layer VoicyClaw runtime contract:

- send final user text
- stream partial/final assistant text back
- optionally support interrupts / aborts
- preserve stable room/session identity

---

## 4. OpenClaw Plugin Model

Based on the OpenClaw plugin docs:

- plugins can register a channel using `api.registerChannel(...)`
- channel plugins are native plugins with:
  - `package.json`
  - `openclaw.plugin.json`
  - runtime entrypoint such as `index.ts`
- plugins can be installed from:
  - npm
  - local directory
  - local linked path
- plugin config is validated from manifest schema before runtime boot

Relevant official references:

- [Plugins](https://docs.openclaw.ai/tools/plugin)
- [Building Plugins](https://docs.openclaw.ai/plugins/building-plugins)
- [Plugin Manifest](https://docs.openclaw.ai/plugins/manifest)

### 4.1 First release packaging strategy

Phase 1 should be a **private/local plugin**, not a public npm package yet.

Recommended install during development:

```bash
openclaw plugins install --link /path/to/voicyclaw-plugin
openclaw gateway restart
```

Later, when stable:

```bash
openclaw plugins install @voicyclaw/voicyclaw
```

### 4.2 Plugin shape

Recommended initial structure:

```text
extensions/voicyclaw/
├── package.json
├── openclaw.plugin.json
├── README.md
├── tsconfig.json
├── index.ts
└── src/
    ├── channel.ts
    ├── config.ts
    ├── dispatch.ts
    ├── gateway.ts
    ├── protocol.ts
    ├── runtime.ts
    ├── socket-client.ts
    └── *.test.ts
```

### 4.3 Manifest draft

```json
{
  "id": "voicyclaw",
  "channels": ["voicyclaw"],
  "configSchema": {
    "type": "object",
    "additionalProperties": false,
    "properties": {}
  }
}
```

Important distinction:

- `openclaw.plugin.json` reserves the `channels.voicyclaw` key and validates plugin-level config
- the actual `channels.voicyclaw` schema should live in the runtime channel plugin (`src/channel.ts`)

That matches how OpenClaw channel plugins such as `nostr` and `discord` are packaged.

---

## 5. Proposed Runtime Model

### 5.1 High-level topology

```text
Browser / mobile VoicyClaw client
        |
        v
VoicyClaw hosted service
        ^
        |  outbound secure websocket
        |
OpenClaw Gateway process
  └─ voicyclaw channel plugin
        |
        v
OpenClaw agent/session runtime
```

### 5.2 Why active outbound connection is preferred

The plugin should connect outward to VoicyClaw because:

- outbound connections are easier for users than exposing inbound webhooks
- no public Gateway ingress is required for the common case
- local/private OpenClaw nodes can still participate
- VoicyClaw can authenticate and multiplex many OpenClaw nodes centrally

This makes the plugin more like a node/connector than a public webhook receiver.

---

## 6. Product-Level Features

The first plugin version should intentionally stay narrow.

### 6.1 MVP feature set

- one OpenClaw plugin instance connects to one VoicyClaw workspace
- plugin authenticates with a VoicyClaw-issued token
- plugin registers one or more OpenClaw bots into VoicyClaw
- VoicyClaw sends text turns to the plugin
- plugin forwards those turns into OpenClaw session execution
- plugin streams assistant text deltas/finals back to VoicyClaw
- plugin supports reconnect and resume-safe idempotency

### 6.2 Explicit non-goals for v1

- binary audio transport through the plugin
- file upload / image / media rich payloads
- multi-node routing across many OpenClaw agents on day one
- advanced channel directory sync
- background job scheduling from VoicyClaw into OpenClaw
- distributed cluster failover

### 6.3 Nice-to-have v1.1 / v2

- typing / preview states
- abort / interrupt propagation
- presence and health reporting
- richer bot metadata sync
- room-to-session restore after reconnect
- multiple accounts / multiple bot personas

---

## 7. Config Model

The plugin should be configured under `channels.voicyclaw`, not under application-private plugin config.

Proposed minimal config:

```json
{
  "channels": {
    "voicyclaw": {
      "enabled": true,
      "url": "wss://api.voicyclaw.example/ws/openclaw",
      "token": "${VOICYCLAW_CHANNEL_TOKEN}",
      "workspaceId": "workspace_demo",
      "botId": "openclaw-main",
      "displayName": "Studio Claw"
    }
  }
}
```

Recommended env support:

- `VOICYCLAW_CHANNEL_TOKEN`
- optional `VOICYCLAW_CHANNEL_URL`

### 7.1 Why `channels.voicyclaw`

Use `channels.voicyclaw` because:

- it matches how OpenClaw users configure channel plugins
- it fits the OpenClaw mental model
- it keeps the feature discoverable under `openclaw channels ...`

---

## 8. Connection and Auth

### 8.1 Auth model

The first version should use a simple VoicyClaw-issued shared token:

- plugin connects to VoicyClaw websocket endpoint
- plugin sends:
  - plugin/channel id
  - bot identity
  - workspace id
  - token
- VoicyClaw validates the token and binds the plugin connection to a tenant/workspace

### 8.2 Why not OAuth first

OAuth or interactive pairing is likely overkill for the first version.

Shared token is enough to prove:

- connection lifecycle
- message flow
- reconnect
- bot registration
- room/session mapping

### 8.3 Recommended future auth path

Later, upgrade to:

- token + signed connector identity
- optional device registration
- rotating credentials
- org-scoped issued secrets

---

## 9. Session and Identity Mapping

### 9.1 Stable identifiers

We need deterministic mapping between VoicyClaw rooms and OpenClaw sessions.

Suggested mapping:

| VoicyClaw concept | OpenClaw concept | Rule |
|---|---|---|
| workspace | plugin connection scope | one authenticated connector belongs to one workspace |
| room / channel | session key | deterministic session key per room |
| user turn id | idempotency key | reuse request id for dedupe |
| reply stream id | run id | used for delta/final/abort correlation |

### 9.2 Proposed session key format

```text
voicyclaw:workspace:<workspaceId>:room:<roomId>
```

Important:

- the plugin must tolerate OpenClaw canonicalization such as `agent:main:...`
- correlation should prefer `runId`
- raw session key string equality should not be the only matching rule

That lesson comes directly from the current Gateway MVP.

---

## 10. Message Flow

### 10.1 Inbound user turn

```text
VoicyClaw client
  -> final transcript text
VoicyClaw server
  -> plugin websocket message: user_turn
OpenClaw plugin
  -> dispatch to OpenClaw session
OpenClaw runtime
  -> execute agent reply
```

### 10.2 Outbound assistant stream

```text
OpenClaw runtime
  -> assistant delta/final
OpenClaw plugin
  -> plugin websocket message: assistant_delta / assistant_final
VoicyClaw server
  -> browser BOT_PREVIEW / BOT_TEXT
  -> client TTS playback
```

### 10.3 Interrupt flow

Later addition:

```text
VoicyClaw interrupt
  -> plugin websocket message: abort_turn
OpenClaw plugin
  -> abort active run
OpenClaw runtime
  -> aborted/finalized event
VoicyClaw
  -> stop output turn
```

---

## 11. Suggested Plugin <-> VoicyClaw Protocol

The plugin transport should be intentionally small and versioned.

### 11.1 Envelope

```json
{
  "v": 1,
  "type": "assistant_final",
  "requestId": "uuid",
  "payload": {}
}
```

### 11.2 Core message types

Plugin -> VoicyClaw:

- `connector_hello`
- `connector_health`
- `bot_online`
- `assistant_delta`
- `assistant_final`
- `assistant_error`
- `turn_aborted`

VoicyClaw -> Plugin:

- `hello_ok`
- `bind_room`
- `user_turn`
- `abort_turn`
- `ping`

### 11.3 `user_turn` draft

```json
{
  "v": 1,
  "type": "user_turn",
  "requestId": "turn_uuid",
  "payload": {
    "workspaceId": "workspace_demo",
    "roomId": "demo-room",
    "sessionKey": "voicyclaw:workspace:workspace_demo:room:demo-room",
    "text": "hello world",
    "language": "en-US",
    "metadata": {
      "source": "voice"
    }
  }
}
```

### 11.4 `assistant_delta` draft

```json
{
  "v": 1,
  "type": "assistant_delta",
  "requestId": "turn_uuid",
  "payload": {
    "runId": "openclaw_run_uuid",
    "roomId": "demo-room",
    "text": "hello",
    "isFinal": false
  }
}
```

---

## 12. OpenClaw-Side Implementation Strategy

### 12.1 Channel plugin responsibility

The plugin should do four things well:

1. connect and authenticate to VoicyClaw
2. translate VoicyClaw messages into OpenClaw channel/session execution
3. translate OpenClaw reply stream back to VoicyClaw
4. survive disconnects safely

### 12.2 Internal modules

Recommended internal split:

- `config.ts`
  - parse and validate plugin config
- `socket-client.ts`
  - websocket transport, backoff, heartbeats
- `session-map.ts`
  - roomId <-> sessionKey helpers
- `channel-adapter.ts`
  - OpenClaw channel registration and message dispatch
- `runtime.ts`
  - bootstraps plugin and lifecycle wiring

### 12.3 OpenClaw registration path

Use channel plugin registration:

- `defineChannelPluginEntry(...)`
- channel id: `voicyclaw`
- OpenClaw config lives under `channels.voicyclaw`

This is more semantically correct than a generic tool-only plugin.

---

## 13. VoicyClaw-Side Changes Needed

To support the plugin architecture cleanly, VoicyClaw will need a server-side connector hub.

### 13.1 New server component

Add a connector service in VoicyClaw server:

- accepts plugin websocket connections
- authenticates them
- keeps connector registry by workspace/bot/node
- routes `user_turn` to the right connector
- receives `assistant_delta/final` and forwards them to the existing browser pipeline

### 13.2 Why this is compatible with current work

This fits the existing abstraction plan:

- current backend:
  - `openclaw-gateway`
- future backend:
  - `openclaw-plugin-channel`

The browser and output-turn logic should not care whether the text came from:

- local demo bot
- OpenClaw gateway client
- OpenClaw plugin connection

---

## 14. Distribution and Publishing

### 14.1 Development phase

Use local install:

```bash
openclaw plugins install --link /path/to/voicyclaw-plugin
openclaw gateway restart
```

### 14.2 Internal/private beta

Possible approaches:

- private npm package
- tarball install
- internal monorepo extension path

### 14.3 Public release

Public npm package:

```bash
npm publish
openclaw plugins install @voicyclaw/voicyclaw
```

This avoids needing special OpenClaw core releases just to ship plugin changes.

---

## 15. Risks and Edge Cases

### 15.1 Reconnect duplication

Risk:

- plugin disconnects after receiving a turn but before replying

Mitigation:

- every turn carries a stable `requestId`
- plugin stores last-seen request ids for short dedupe windows
- VoicyClaw treats replies idempotently by `requestId` + `runId`

### 15.2 Session divergence

Risk:

- room reconnect maps to a different OpenClaw session

Mitigation:

- deterministic session key generation
- canonical session matching logic

### 15.3 Backpressure

Risk:

- VoicyClaw or plugin side cannot keep up with streaming deltas

Mitigation:

- allow delta coalescing
- final must always be delivered
- optional preview throttling

### 15.4 Security

Risk:

- stolen plugin token

Mitigation:

- workspace-scoped tokens
- token rotation
- connector online status
- optional IP / device binding later

---

## 16. Phased Delivery Plan

### Phase A - design and scaffolding

- write detailed design doc
- define config schema
- define transport message schema
- decide plugin package name / repo location

### Phase B - local private plugin MVP

- scaffold plugin package
- implement outbound websocket connector
- accept `user_turn`
- stream back `assistant_delta/final`
- manual local install with `--link`

### Phase C - VoicyClaw connector hub

- add connector auth
- add bot registration
- add room routing
- add reconnect + health surfaces

### Phase D - polish

- aborts
- presence
- multi-bot
- packaging and npm publish

---

## 17. Immediate Next Step

The next implementation step after this doc is:

1. scaffold a local OpenClaw channel plugin package
2. define the minimal websocket protocol between plugin and VoicyClaw server
3. build a private end-to-end text-only connector MVP

That should become the next branch after the current design branch.
