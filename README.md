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
- **Server provider mode** — the browser sends raw audio or text to VoicyClaw, and the VoicyClaw server calls a vendor SDK or API such as Azure, Google Cloud, OpenAI, or Volcengine.

This gives four valid combinations:

| ASR | TTS | Typical use |
|---|---|---|
| client | client | fastest prototype path, lowest setup cost |
| client | server | browser transcript + server-managed voice output |
| server | client | server-grade transcription + lightweight browser playback |
| server | server | full managed media pipeline, best for production control |

For the current runnable prototype, browser speech recognition and browser speech synthesis are already used as client providers, while demo server-side adapters keep the OpenClaw pipeline runnable. Volcengine bidirectional TTS is also available now as a server provider when the backend is configured through `config/providers.local.yaml` or `VOICYCLAW_VOLCENGINE_*` environment variables.

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
| Google Cloud TTS | TTS | Global | P0 |
| Volcengine | ASR + TTS | CN | P0 |
| ElevenLabs | TTS | Global | P1 |
| iFlytek | ASR + TTS | CN | P1 |

---

## Quality Gates

The repo now includes a standard GitHub CI workflow, a repo-wide lint gate, coverage reporting, smoke E2E coverage, and integration coverage for both the happy path and key protocol failure paths.

- `pnpm lint` - runs Biome across the monorepo so obvious code quality issues are blocked before merge
- `pnpm test` - runs unit and integration tests for protocol helpers, demo providers, settings normalization, output-turn coordination, the local server/mock-bot relay, and protocol failure handling
- `pnpm test:coverage` - runs the same Vitest suite with V8 coverage, writes `coverage/summary.md`, and refreshes `docs/badges/coverage.svg`
- `pnpm typecheck` - runs TypeScript checks across `apps/server`, `apps/web`, and `apps/mock-bot`
- `pnpm plugin:voicyclaw:check` - runs install, lint, typecheck, and smoke-tested protocol checks for the standalone OpenClaw plugin under `extensions/voicyclaw`
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
| [`doc/06-openclaw-voicyclaw-channel-plugin.md`](doc/06-openclaw-voicyclaw-channel-plugin.md) | Detailed design for the long-term OpenClaw `voicyclaw` channel plugin that actively connects to the VoicyClaw service |
| [`doc/07-artifact-standardization.md`](doc/07-artifact-standardization.md) | Standardized release outputs for the plugin and the self-hostable VoicyClaw service |

---

## Release Artifacts

VoicyClaw now standardizes around two main deliverables:

- OpenClaw plugin: npm package `@voicyclaw/voicyclaw`
- Self-hosted service: Docker images plus `deploy/docker-compose.yml`

Useful commands:

```bash
pnpm release:prepare
pnpm plugin:voicyclaw:pack
pnpm docker:build:server
pnpm docker:build:web
pnpm docker:compose:up
```

`pnpm release:prepare` runs the repo checks, packs the plugin tarball into
`dist/release`, and copies the self-host deploy bundle into `dist/deploy`.

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
- Add `config/providers.local.yaml` (or set `VOICYCLAW_PROVIDER_CONFIG`) before `pnpm dev` if you want to select `Volcengine TTS` on `/settings`
- Visit `/settings` to edit the channel/server defaults and mint platform keys for external bots
- `pnpm build` verifies the server, web app, and local bot all compile successfully

For server-side TTS providers, prefer a repo-local YAML file:

```yaml
# config/providers.local.yaml
AzureSpeechTTS:
  endpoint: https://eastasia.tts.speech.microsoft.com/cognitiveservices/v1
  region: eastasia
  api_key: your-azure-speech-key
  voice: en-US-JennyNeural

GoogleCloudTTS:
  service_account_file: /absolute/path/to/google-service-account.json
  voice: en-US-Chirp3-HD-Leda
```

Copy [`config/providers.example.yaml`](config/providers.example.yaml) to
`config/providers.local.yaml`. The server auto-loads that local file when it
exists. You can also point at another file with
`VOICYCLAW_PROVIDER_CONFIG=/absolute/path/to/providers.local.yaml`.
Environment variables still work as one-off overrides and win over YAML when
both are present.

To enable server-side Azure TTS, fill `AzureSpeechTTS.api_key` plus either
`AzureSpeechTTS.region` or `AzureSpeechTTS.endpoint`, then choose `Azure Speech
TTS` in `/settings`.

To enable server-side Google Cloud TTS, fill one of
`GoogleCloudTTS.service_account_file`,
`GoogleCloudTTS.service_account_json`,
`GoogleCloudTTS.access_token`, or `GoogleCloudTTS.api_key`, then choose
`Google Cloud TTS` in `/settings`.

When you use a `Chirp 3 HD` voice together with
`GoogleCloudTTS.service_account_file` or `GoogleCloudTTS.service_account_json`,
VoicyClaw now upgrades that path to bidirectional streaming synthesis so audio
can start before the full bot reply is finished. If you stay on API key auth,
pick a non-Chirp voice, or set `pitch`, the provider automatically falls back
to synchronous synthesis.

Note: this runnable prototype uses `node:sqlite` instead of Prisma so it stays friction-free on the current Node toolchain, while the design docs still describe the longer-term Prisma-based plan.

You can start from the tracked example file:

```bash
cp config/providers.example.yaml config/providers.local.yaml
VOICYCLAW_PROVIDER_CONFIG=./config/providers.local.yaml pnpm dev
```

Example provider config shape:

```yaml
DoubaoStreamTTS:
  type: doubao_stream
  ws_url: wss://openspeech.bytedance.com/api/v3/tts/bidirection
  appid: "your-app-id"
  access_token: "your-access-token"
  resource_id: volc.service_type.10029
  speaker: zh_female_wanwanxiaohe_moon_bigtts
  sample_rate: 16000
```

When both are present, `VOICYCLAW_VOLCENGINE_*` environment variables override the YAML values.

## Live TTS Fixture Checks

To keep each TTS vendor independently testable, VoicyClaw now includes an opt-in live fixture test that renders fixed samples (`你好`, `hello`) and stores local WAV + JSON manifests under `.artifacts/tts-fixtures`.

```bash
pnpm test:tts:live:record
pnpm test:tts:live
```

- uses the same local provider config file at `config/providers.local.yaml`
- records per-provider baselines into `.artifacts/tts-fixtures/baselines`
- writes the latest run into `.artifacts/tts-fixtures/latest`
- compares deterministic providers exactly and live vendor providers with manifest tolerances
- lets you target one provider with `VOICYCLAW_TTS_FIXTURE_PROVIDER=volcengine-tts`
- keeps CI clean because `tests/**/*.live.test.ts` is excluded from the default `pnpm test`
- is meant as a local vendor regression check, not as a default PR gate in CI

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
