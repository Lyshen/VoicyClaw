# VoicyClaw — Project Definition

> Version: 0.1 (Prototype)
> Last Updated: 2026-03-20

---

## 1. Project Overview

VoicyClaw is an open-source voice communication platform that bridges end-users and AI bots (referred to as **ClawBots**) via a real-time voice channel. Users speak, their voice is transcribed (ASR), routed through the OpenClaw channel protocol to a ClawBot, and the bot's response is synthesized back to speech (TTS) in real time.

The platform is designed to be:
- **Self-hosted friendly** — users bring their own ASR/TTS API keys
- **Multi-bot capable** — multiple ClawBots can coexist in a single channel
- **Open protocol** — the channel protocol (OpenClaw) is documented and extensible

---

## 2. Core Concepts

### 2.1 Channel
A **Channel** is a named voice room where one or more users and one or more ClawBots participate. All messages (voice transcripts and bot responses) flow through the channel.

### 2.2 ClawBot
A **ClawBot** is an AI agent that implements the OpenClaw Channel Protocol. It listens for text messages on a channel, processes them (e.g., via an LLM), and streams text responses back.

### 2.3 OpenClaw Channel Protocol
A lightweight WebSocket-based protocol for channel message routing between the VoicyClaw server and ClawBots. Messages are JSON-framed. See `doc/02-openclaw-protocol.md` for the full spec.

### 2.4 Platform API Key
A key issued by the VoicyClaw platform to authenticate a ClawBot. The bot uses this key to:
1. Self-register with the platform
2. Declare which channels it serves
3. Receive and send channel messages

### 2.5 ASR Adapter
A pluggable interface that returns transcribed text. VoicyClaw supports two ASR execution modes:
- **Client provider mode** — ASR runs in the browser or operating system (for example browser speech recognition) and sends transcript text to the platform
- **Server provider mode** — raw audio is sent to the VoicyClaw server, which calls a vendor API/SDK and returns transcript text

### 2.6 TTS Adapter
A pluggable interface that turns text into speech. VoicyClaw supports two TTS execution modes:
- **Client provider mode** — the browser or operating system speaks the bot text directly (for example browser speech synthesis)
- **Server provider mode** — the VoicyClaw server calls a vendor API/SDK and streams synthesized audio back to the user

### 2.7 Provider Mode
A **Provider Mode** describes where a media capability executes:
- `client provider` — runs in the end-user runtime (browser or OS integration)
- `server provider` — runs inside the VoicyClaw backend through vendor integrations

ASR and TTS are both intentionally designed to support either mode independently.

---

## 3. System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     VoicyClaw Platform                  │
│                                                         │
│  ┌──────────┐    ┌─────────────────┐   ┌────────────┐  │
│  │  Web UI  │◄──►│  API / WS Gate  │◄──►│  Channel   │  │
│  │(Next.js) │    │  (Fastify/NestJS│   │  Manager   │  │
│  └────┬─────┘    └────────┬────────┘   └─────┬──────┘  │
│       │                   │                   │         │
│       │      client providers        server providers   │
│       │                   │                   │         │
│  ┌────▼────┐    ┌─────────▼────────┐  ┌──────▼───────┐ │
│  │Browser  │    │   ASR Adapter    │  │ TTS Adapter  │ │
│  │ASR/TTS  │    │ (Whisper/Azure/  │  │(OpenAI/Azure/│ │
│  │providers│    │  Volcengine/…)   │  │ Volcengine…) │ │
│  └─────────┘    └──────────────────┘  └──────────────┘ │
└──────────────────────────┬──────────────────────────────┘
                           │  OpenClaw Channel Protocol
                           │  (WebSocket, JSON-framed)
              ┌────────────▼────────────┐
              │        ClawBot          │
              │  (User self-hosted LLM  │
              │   agent / OpenClaw bot) │
              └─────────────────────────┘
```

---

## 4. Real-Time Data Flow

```
Option A — server-provider pipeline

User Microphone
      │
      │ (raw audio via WebSocket)
      ▼
  Server ASR Adapter ──► transcribed text
                              │
                              ▼
                    Channel Message (OpenClaw Protocol)
                              │
                              ▼
                          ClawBot
                              │
                              │ streaming text chunks
                              ▼
                    Server TTS Adapter ──► audio stream chunks
                                                  │
                                                  ▼
                                         User Speaker (playback)

Option B — client-provider assisted pipeline

User Microphone
      │
      ▼
Client ASR Provider ──► transcript text ──► VoicyClaw / OpenClaw ──► ClawBot
                                                                 │
                                                                 ▼
                                               bot text chunks ──► Client TTS Provider
                                                                 │
                                                                 ▼
                                                          User Speaker
```

Key design decisions:
- **Streaming TTS**: TTS synthesis begins on the first text chunk from the bot, minimizing perceived latency.
- **No WebRTC in prototype**: all audio is transported over WebSocket (binary frames, PCM 16kHz mono).
- **Dual execution modes**: ASR and TTS can independently run as client providers or server providers.
- **Stateless server adapters**: server-side adapters are self-contained async functions with a standard interface.
- **Shared output-turn coordinator**: the web runtime owns playback turn state above the providers, so browser speech synthesis and streamed server audio both follow the same interrupt / stale-drop rules.

### 4.1 Shared Output-Turn Coordinator

TTS provider mode changes where voice is produced, but not how a conversation turn should be controlled. To avoid duplicating queue logic in every provider, VoicyClaw defines a shared output-turn coordinator in the client runtime:

- it tracks the active `utteranceId` for outbound bot media
- it interrupts the previous turn when a newer turn becomes active
- it drops stale browser speech tasks and stale server audio chunks that arrive after a turn switch
- it lets browser TTS providers and server audio playback share the same turn-boundary behavior

This keeps provider implementations simple. Client providers only speak text. Server providers only emit audio chunks. The coordinator owns when those outputs are still allowed to play.

### 4.2 OpenClaw Gateway Interop Path

The next planned interoperability milestone is to let VoicyClaw talk to a real OpenClaw Gateway without first requiring a custom OpenClaw plugin channel.

The chosen MVP path is a **Gateway WebChat-compatible bridge**:

- VoicyClaw still owns microphone capture, ASR, TTS, and browser playback
- OpenClaw still owns agent execution, session routing, and streamed text generation
- the bridge boundary is text-first: VoicyClaw sends final transcript text through the official Gateway chat API and consumes streamed chat events back
- one VoicyClaw room maps to one deterministic OpenClaw `sessionKey` for the first feasibility slice

This is intentionally smaller than a native OpenClaw extension and gives us the fastest route to a real end-to-end interop loop.

See `doc/04-openclaw-gateway-bridge.md` for the detailed design.
See `doc/05-conversation-backend-abstraction.md` for the backend contract that keeps transport-specific logic below the main voice pipeline.

Longer term, the preferred product shape is the reverse connection model:

- VoicyClaw exposes the stable hosted service endpoint
- OpenClaw installs a `voicyclaw` channel plugin
- the plugin actively connects to VoicyClaw instead of VoicyClaw dialing a remote Gateway

See `doc/06-openclaw-voicyclaw-channel-plugin.md` for that detailed design.

---

## 5. Tech Stack

### Prototype (v0.1)

| Layer | Technology | Rationale |
|---|---|---|
| Frontend | Next.js (TypeScript) + browser speech APIs | Full-stack TS, SSR, optional client-provider media path |
| Backend API | Fastify or NestJS (TypeScript) | WebSocket support, typed, performant |
| Real-time WS Server | Node.js `ws` library | Simple, battle-tested |
| Channel Protocol | JSON over WebSocket | Easy to implement, easy to debug |
| Database | SQLite | Zero-ops for prototype |
| Auth | Simple JWT + API Key | Sufficient for prototype |

### Future Migration Path

- Real-time WS Server → **Go** (`nhooyr.io/websocket`) when concurrent audio channel count demands it
- Database → **PostgreSQL** for production
- WebSocket → **WebRTC** optional, for P2P audio and NAT traversal

---

## 6. Prototype Quality Strategy

The runnable prototype is now guarded by three complementary test layers so the current demo loop does not regress while ASR / TTS providers keep evolving:

- **Lint gate** — Biome blocks obvious code quality regressions before build and runtime checks start
- **Unit coverage** — protocol helpers, provider selection, demo ASR/TTS adapters, and the shared output-turn coordinator are covered by Vitest
- **Integration coverage** — the Fastify / WebSocket server and the local mock bot are exercised together in-process through both real OpenClaw happy-path round-trips and protocol failure-path checks
- **Smoke E2E coverage** — Playwright boots the full local demo stack, drives the settings UI, and verifies the browser can send a text utterance and receive streamed bot output

GitHub Actions runs the same `pnpm ci:check` pipeline used locally, uploads the coverage reports, and writes the current coverage summary into the job report.

This split keeps the quality model pragmatic:
- unit tests protect pure logic quickly
- integration tests protect the server-to-bot contract
- smoke E2E protects the actual demo experience shown in the browser

---

## 7. ASR / TTS Vendor Support Plan

### ASR (Speech-to-Text)

#### Client Providers

| Provider | Region | Priority |
|---|---|---|
| Browser SpeechRecognition / OS speech services | Browser-dependent | P0 |

#### Server Providers

| Vendor | Region | Priority |
|---|---|---|
| OpenAI Whisper API | Global | P0 |
| Azure Cognitive Speech | Global | P0 |
| Volcengine ASR | CN | P0 |
| iFlytek ASR | CN | P1 |
| Google STT | Global | P1 |
| Deepgram | Global | P2 |

### TTS (Text-to-Speech)

#### Client Providers

| Provider | Region | Priority |
|---|---|---|
| Browser SpeechSynthesis / OS speech services | Browser-dependent | P0 |

#### Server Providers

| Vendor | Region | Priority |
|---|---|---|
| OpenAI TTS | Global | P0 |
| Azure Cognitive Speech TTS | Global | P0 |
| Volcengine TTS | CN | P0 |
| ElevenLabs | Global | P1 |
| iFlytek TTS | CN | P1 |
| Edge TTS (free) | Global | P2 |

Server adapters share a common backend interface (see `doc/03-adapter-interface.md`). Client providers use browser or OS capabilities and are configured in the web UI alongside server providers. Users provide their own API keys for server-provider mode via the platform settings UI.

---

## 8. Platform API Key Flow

```
1. User visits VoicyClaw platform
2. User registers / logs in
3. User navigates to "API Keys" and requests a new key
4. Platform generates a signed key and displays it once
5. User pastes this key into their ClawBot's configuration
6. ClawBot connects to VoicyClaw via WebSocket using the key
7. ClawBot declares its channel bindings
8. Platform verifies key → ClawBot is live in the channel
```

---

## 9. ClawBot Auto-Configuration Flow

The key insight: **the bot should configure itself with minimal human steps**.

```
1. User has a running ClawBot instance (OpenClaw-compatible)
2. User tells the bot (via voice or chat): 
   "Use VoicyClaw API key: <key>, channel: <channel-name>"
3. ClawBot parses the intent, calls VoicyClaw /api/bot/register
4. Platform creates the channel if it doesn't exist
5. ClawBot receives channel config (WS endpoint, message schema)
6. ClawBot connects and is immediately active
```

This flow requires ClawBots to implement the OpenClaw self-configuration command spec (see `doc/04-bot-self-config.md`).

---

## 9. Multi-Bot Channel Design

A channel can have multiple ClawBots. Message dispatch rules:
- **Mention routing**: `@botname <message>` routes to a specific bot
- **Broadcast** (default): message goes to all bots; first response wins and cancels others
- **Round-robin** (future): configurable dispatcher strategy

---

## 10. Prototype Scope (v0.1)

In scope:
- [ ] Web UI: Login, API Key management, Channel view with voice input/output
- [ ] WebSocket server for audio streaming
- [ ] Client-provider path: browser speech recognition and browser speech synthesis
- [ ] ASR adapter: OpenAI Whisper (P0)
- [ ] TTS adapter: OpenAI TTS (P0)
- [ ] OpenClaw channel protocol (basic JSON WS)
- [ ] Bot registration + channel binding via API key
- [ ] Single bot per channel (multi-bot in v0.2)
- [ ] SQLite persistence for users, keys, channels

Out of scope for v0.1:
- WebRTC
- Multiple simultaneous speakers
- Bot dispatcher strategies
- CN vendor ASR/TTS adapters (v0.2)
- Production auth (OAuth, SSO)

---

## 11. Monorepo Structure (Proposed)

```
VoicyClaw/
├── apps/
│   ├── web/          # Next.js frontend
│   └── server/       # Fastify/NestJS backend + WS server
├── packages/
│   ├── protocol/     # OpenClaw protocol types (shared TS)
│   ├── asr/          # ASR adapter implementations
│   └── tts/          # TTS adapter implementations
├── doc/              # Project documentation
└── docker-compose.yml
```

---

## 12. Open Questions

- [ ] Should the OpenClaw Channel Protocol be versioned independently as a separate spec repo?
- [ ] Auth model: per-user API keys or per-bot keys?
- [ ] Audio format negotiation between client and server (PCM vs Opus)?
