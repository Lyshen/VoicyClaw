# VoicyClaw

### *Talk to claws easily.*

[![CI](https://github.com/Lyshen/VoicyClaw/actions/workflows/ci.yml/badge.svg)](https://github.com/Lyshen/VoicyClaw/actions/workflows/ci.yml)
![Coverage](docs/badges/coverage.svg)

---

VoicyClaw is an open-source voice platform that connects you to AI agents (ClawBots) through a real-time voice channel. Speak — your voice is transcribed, routed to a ClawBot via the OpenClaw protocol, and the response streams back as synthesized speech. End-to-end streaming, bring-your-own API keys, no lock-in.

---

## How It Works

```
User mic → WebSocket → ASR (streaming) → OpenClaw protocol
                                                  ↓
                                           ClawBot (LLM agent)
                                                  ↓
                                    streaming text → TTS → audio → User
```

1. **Request an API key** from the VoicyClaw platform
2. **Give the key to your ClawBot** — it self-registers and joins the channel automatically
3. **Talk** — voice in, voice out, streaming throughout

---

## Key Design Decisions

- **WebSocket only** (prototype) — no WebRTC complexity
- **Bidirectional streaming** — ASR and TTS both stream; TTS synthesis starts on the first text token from the bot
- **Bring your own API keys** — users configure their own ASR/TTS vendor keys; VoicyClaw never holds them
- **Dual provider modes** — both ASR and TTS support `client provider` mode and `server provider` mode
- **Pluggable adapters** — swap ASR/TTS providers without touching the pipeline
- **OpenClaw protocol** — minimal JSON-over-WebSocket channel protocol between server and bots (see [`doc/02-openclaw-protocol.md`](doc/02-openclaw-protocol.md))

---

## Provider Modes

VoicyClaw treats ASR and TTS as two-stage capabilities that may run in either the client or the server:

- **Client provider mode** — the browser or operating system performs ASR/TTS locally or through its own bundled service. Example: browser `SpeechRecognition` or `speechSynthesis`.
- **Server provider mode** — the browser sends raw audio or text to VoicyClaw, and the VoicyClaw server calls a vendor SDK or API such as OpenAI, Azure, Volcengine, or Alibaba Cloud.

This gives four valid combinations:

| ASR | TTS | Typical use |
|---|---|---|
| client | client | fastest prototype path, lowest setup cost |
| client | server | browser transcript + server-managed voice output |
| server | client | server-grade transcription + lightweight browser playback |
| server | server | full managed media pipeline, best for production control |

For the current runnable prototype, browser speech recognition and browser speech synthesis are already used as client providers, while demo server-side adapters keep the OpenClaw pipeline runnable.

## Shared Output Turn Control

VoicyClaw keeps provider implementations thin and moves playback ownership into a shared output-turn coordinator in the web runtime:

- both browser TTS text playback and server PCM playback are correlated by `utteranceId`
- when a newer bot turn becomes active, stale queued speech or audio chunks from older turns are cancelled or dropped
- provider switching does not duplicate queue logic, because the same coordinator owns interruption, reset, and turn-boundary rules

This keeps `client provider` and `server provider` modes behaviorally consistent even though one side emits browser speech calls and the other side emits audio chunks.

---

## ASR / TTS Vendor Support

| Vendor | Type | Region | Priority |
|---|---|---|---|
| OpenAI Whisper | ASR | Global | P0 |
| OpenAI TTS | TTS | Global | P0 |
| Azure Cognitive Speech | ASR + TTS | Global | P0 |
| Volcengine | ASR + TTS | CN | P0 |
| Alibaba Cloud NLS | ASR + TTS | CN | P0 |
| ElevenLabs | TTS | Global | P1 |
| iFlytek | ASR + TTS | CN | P1 |

---

## Quality Gates

The repo now includes a standard GitHub CI workflow, a repo-wide lint gate, coverage reporting, smoke E2E coverage, and integration coverage for both the happy path and key protocol failure paths.

- `pnpm lint` - runs Biome across the monorepo so obvious code quality issues are blocked before merge
- `pnpm test` - runs unit and integration tests for protocol helpers, demo providers, settings normalization, output-turn coordination, the local server/mock-bot relay, and protocol failure handling
- `pnpm test:coverage` - runs the same Vitest suite with V8 coverage, writes `coverage/summary.md`, and refreshes `docs/badges/coverage.svg`
- `pnpm typecheck` - runs TypeScript checks across `apps/server`, `apps/web`, and `apps/mock-bot`
- `pnpm build` - validates production builds for the server, web app, and mock bot
- `pnpm test:e2e` - builds the monorepo and runs Playwright smoke tests against the full local demo stack
- `pnpm ci:check` - runs the database bootstrap, coverage suite, typecheck, and Playwright smoke flow used in GitHub Actions

The CI workflow in `.github/workflows/ci.yml` runs on pushes to `main` / `codex/**` plus all pull requests, publishes the coverage artifacts, and writes the latest coverage summary into the GitHub Actions job report.

---

## Tech Stack (Prototype)

- **Frontend**: Next.js (TypeScript)
- **Backend / WS Server**: Fastify + `ws` (TypeScript)
- **Database**: SQLite via `node:sqlite`
- **Monorepo**: pnpm workspaces

---

## Documentation

| Doc | Description |
|---|---|
| [`doc/01-project-definition.md`](doc/01-project-definition.md) | Full project definition, architecture, scope |
| [`doc/02-openclaw-protocol.md`](doc/02-openclaw-protocol.md) | OpenClaw WebSocket protocol spec |
| [`doc/03-adapter-interface.md`](doc/03-adapter-interface.md) | ASR / TTS adapter interface definitions |
| [`doc/04-openclaw-gateway-bridge.md`](doc/04-openclaw-gateway-bridge.md) | Design for the minimal OpenClaw Gateway bridge that lets VoicyClaw interoperate with a real OpenClaw deployment |
| [`doc/05-conversation-backend-abstraction.md`](doc/05-conversation-backend-abstraction.md) | The stable backend contract that keeps voice business logic independent from local-bot vs Gateway transport details |

---

## Quick Start

```bash
pnpm install
pnpm dev
```

Then open `http://localhost:3000`.

- The root `dev` script starts the web app, the Fastify/WebSocket server, and a local demo ClawBot
- Use **hold-to-talk** for microphone streaming, or type into the composer as a transcript fallback
- Browser speech recognition and browser speech synthesis are treated as `client providers`
- Visit `/settings` to edit the channel/server defaults and mint platform keys for external bots
- `pnpm build` verifies the server, web app, and local bot all compile successfully

Note: this runnable prototype uses `node:sqlite` instead of Prisma so it stays friction-free on the current Node toolchain, while the design docs still describe the longer-term Prisma-based plan.

---

## Prototype Sprint — Next 24–48 Hours

Goal: **end-to-end voice conversation with a real ClawBot running locally**.

### Milestone 1 — Foundation (0–8h)
- [ ] Init pnpm monorepo (`apps/web`, `apps/server`, `packages/protocol`, `packages/asr`, `packages/tts`)
- [ ] Shared `protocol` package: TypeScript types for all OpenClaw messages
- [ ] `apps/server`: Fastify + WS server, implement `HELLO / WELCOME / ERROR / DISCONNECT`
- [ ] `apps/web`: Next.js shell, basic layout, mic permission request

### Milestone 2 — Audio Pipeline (8–20h)
- [ ] Browser → server: capture mic audio (PCM 16kHz), stream over WebSocket binary frames
- [ ] Server → ASR: wire `OpenAIASRProvider`, get `STT_RESULT` flowing
- [ ] Server → Bot: send `STT_RESULT` to ClawBot via OpenClaw protocol, receive `TTS_TEXT` stream
- [ ] Server → TTS: wire `OpenAITTSProvider`, stream synthesized audio back to browser
- [ ] Browser: play received audio chunks in real time

### Milestone 3 — Connect Real ClawBot (20–36h)
- [ ] API key issuance endpoint (`POST /api/keys`)
- [ ] Bot registration endpoint (`POST /api/bot/register`)
- [ ] Connect local ClawBot, verify full voice loop end-to-end

### Milestone 4 — Minimal UI Polish (36–48h)
- [ ] Channel view: show live transcript (ASR text) and bot response text
- [ ] Settings page: enter OpenAI ASR/TTS API keys
- [ ] Push-to-talk button + visual speaking indicator

---

## License

[Apache 2.0](LICENSE)
