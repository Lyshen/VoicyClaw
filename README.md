# VoicyClaw

[![CI](https://github.com/Lyshen/VoicyClaw/actions/workflows/ci.yml/badge.svg)](https://github.com/Lyshen/VoicyClaw/actions/workflows/ci.yml)
![Coverage](docs/badges/coverage.svg)

---

> **Give OpenClaw agents a voice.**
>
> Talk in VoicyClaw, let OpenClaw run the agent, and hear the reply streamed back in real time.

**VoicyClaw turns OpenClaw agents into spoken conversations.**
It starts as a web voice app today, and grows toward a simple hosted layer for connecting real OpenClaw agents.

**Project direction**

- a dedicated voice-first web experience
- a simple way to connect real OpenClaw agents
- a stable hosted endpoint for future OpenClaw plugin installs
- a clean path toward account, workspace, and connector token onboarding

---

## What Is VoicyClaw

**VoicyClaw is the part that makes OpenClaw feel spoken, not just textual.**
You speak, OpenClaw does the agent work, and VoicyClaw plays the reply back.

**VoicyClaw handles**

- microphone capture, ASR, TTS, playback, interruption, and voice UX

**OpenClaw handles**

- agent execution, memory, tools, model routing, and session logic

**Today:** the main experience is hearing an OpenClaw agent speak inside the VoicyClaw web app.

**Next:** the main onboarding target is "install a connector, issue a token, and hear your OpenClaw agent speak".

This means VoicyClaw should be described first as a voice product for OpenClaw, not just as a TTS playground or a one-off browser demo.

---

## Current Product Shape

**The clearest product story today lives in the VoicyClaw web app.**
Right now, the easiest way to understand the project is to use it and hear the agent speak.

**What that means today**

- open the VoicyClaw web app
- connect either the bundled local demo bot or a real OpenClaw backend
- choose a voice path such as browser, Azure, Google, or Volcengine
- hear streamed OpenClaw replies inside VoicyClaw itself

**Near-term product target**

- deploy VoicyClaw behind a stable public domain
- improve the landing page so the hosted voice story is obvious
- issue connector tokens / API keys from a lightweight account flow
- make OpenClaw onboarding feel like a short install-and-connect workflow

---

## Connection Modes

**VoicyClaw should support more than one way to reach an OpenClaw agent.**
That lets the product start simple for local demos and grow into a cleaner install story later.

| Mode | Status | What it means |
|---|---|---|
| local demo bot | available now | fully local dev loop for fast iteration |
| OpenClaw Gateway backend | available now | VoicyClaw talks to a real OpenClaw deployment through Gateway URL + token |
| OpenClaw `voicyclaw` plugin | in progress | installable connector that lets OpenClaw connect outward to VoicyClaw |

The long-term preferred shape is the plugin path, because it removes the need for users to expose their OpenClaw Gateway to the public internet just to test voice.

---

## How It Works Today

**The current interaction loop is already simple enough to explain in one glance.**

```
User mic
  -> VoicyClaw web client
  -> VoicyClaw server
  -> local bot or OpenClaw backend
  -> streamed text reply
  -> VoicyClaw TTS
  -> audio playback in VoicyClaw
```

**Hosted onboarding target**

1. sign into VoicyClaw
2. create a workspace or project
3. issue a connector token / API key
4. install or configure the OpenClaw connector
5. see the OpenClaw agent appear in VoicyClaw
6. talk and hear the reply with real-time voice playback

---

## Scope Today vs Later

**README should promise the experience people can actually use now.**

**Today**, VoicyClaw's primary user-facing surface is its own web voice experience.

- users talk inside VoicyClaw
- VoicyClaw owns the voice playback path
- OpenClaw provides the agent response stream

**Later**, the same speech infrastructure may also help render or deliver voice for additional OpenClaw channels such as Feishu or WeChat. That is an important future expansion path, but it is not the primary README promise today.

---

## Key Design Decisions

**The prototype stays intentionally simple in the business layer, while keeping room for better provider integrations underneath.**

- **WebSocket only** (prototype) — no WebRTC complexity
- **Bidirectional streaming** — ASR and TTS both stream; TTS synthesis starts on the first text token from the bot
- **Bring your own API keys** — users configure their own ASR/TTS vendor keys; VoicyClaw never holds them
- **Dual provider modes** — both ASR and TTS support `client provider` mode and `server provider` mode
- **Pluggable adapters** — swap ASR/TTS providers without touching the pipeline
- **OpenClaw protocol** — minimal JSON-over-WebSocket channel protocol between server and bots (see [`doc/02-openclaw-protocol.md`](doc/02-openclaw-protocol.md))

---

## Provider Modes

**ASR and TTS can run in the browser or on the server.**
That flexibility lets VoicyClaw support both quick demos and more controlled production-style setups.

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

**Playback control is shared across providers instead of being reimplemented provider by provider.**
That keeps interruption behavior and turn ownership consistent even when the speech vendor changes.

- both browser TTS text playback and server PCM playback are correlated by `utteranceId`
- when a newer bot turn becomes active, stale queued speech or audio chunks from older turns are cancelled or dropped
- provider switching does not duplicate queue logic, because the same coordinator owns interruption, reset, and turn-boundary rules

This keeps `client provider` and `server provider` modes behaviorally consistent even though one side emits browser speech calls and the other side emits audio chunks.

---

## What Works Today

**The core voice loop is already real and usable.**

| Capability | Status | Notes |
|---|---|---|
| browser speech recognition | available now | fastest zero-setup prototype path |
| browser speech synthesis | available now | client-side playback option |
| Azure Speech TTS (unary + segmented) | available now | official Azure audio streaming plus adapter-level segmented playback |
| Google Cloud TTS (Chirp streaming) | available now | premium realtime Google path |
| Google Cloud TTS (WaveNet / Neural2 batched) | available now | lower-cost unary Google path |
| Volcengine bidirectional TTS | available now | CN-market low-latency path |
| OpenClaw Gateway backend | available now | real OpenClaw text backend integration |
| OpenClaw `voicyclaw` plugin | in progress | connector/productization path for easier install |

---

## Quality Gates

**The repo already has real engineering guardrails, not just prototype code.**

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
| [`doc/08-tts-provider-roadmap.md`](doc/08-tts-provider-roadmap.md) | TTS provider strategy across realtime flagship providers and cheaper batched providers |
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
  voice: en-US-AriaNeural
  style: chat
  rate: +4%

AzureSpeechStreamingTTS:
  voice: en-US-AriaNeural
  style: chat
  rate: +4%
  flush_timeout_ms: 450
  max_chunk_characters: 220

GoogleCloudTTS:
  service_account_file: /absolute/path/to/google-service-account.json
  voice: en-US-Chirp3-HD-Leda

GoogleCloudBatchedTTS:
  service_account_file: /absolute/path/to/google-service-account.json
  voice: en-US-Neural2-F
```

Copy [`config/providers.example.yaml`](config/providers.example.yaml) to
`config/providers.local.yaml`. The server auto-loads that local file when it
exists. You can also point at another file with
`VOICYCLAW_PROVIDER_CONFIG=/absolute/path/to/providers.local.yaml`.
Environment variables still work as one-off overrides and win over YAML when
both are present.

To enable server-side Azure unary TTS, fill `AzureSpeechTTS.api_key` plus
either `AzureSpeechTTS.region` or `AzureSpeechTTS.endpoint`, then choose
`Azure Speech TTS (Unary)` in `/settings`.

To enable the earlier-playback Azure segmented path, either add an
`AzureSpeechStreamingTTS` section or let it reuse the base `AzureSpeechTTS`
credentials, then choose `Azure Speech TTS (Segmented)` in `/settings`.

Azure now also supports provider-level SSML tuning in config via fields such as
`style`, `style_degree`, `role`, `rate`, `pitch`, and `volume`. The default
English path now leans more conversational out of the box by preferring
`en-US-AriaNeural` plus a chat-oriented style, while `en-US-JennyNeural` still
gets a strong assistant-style default when you select it explicitly.

To enable server-side Google Cloud TTS, fill one of
`GoogleCloudTTS.service_account_file`,
`GoogleCloudTTS.service_account_json`, plus a `Chirp 3 HD` voice such as
`en-US-Chirp3-HD-Leda`, then choose `Google Cloud TTS (Streaming)` in
`/settings`.

When you use a `Chirp 3 HD` voice together with
`GoogleCloudTTS.service_account_file` or `GoogleCloudTTS.service_account_json`,
VoicyClaw now upgrades that path to bidirectional streaming synthesis so audio
can start before the full bot reply is finished. The old synchronous Google
path has been removed, so API keys, access tokens, and non-Chirp voices are no
longer accepted for `google-tts`.

To enable the cheaper Google batched path, fill one of
`GoogleCloudBatchedTTS.service_account_file`,
`GoogleCloudBatchedTTS.service_account_json`, plus a non-Chirp voice such as
`en-US-Neural2-F` or `en-US-Wavenet-D`, then choose `Google Cloud TTS
(Batched)` in `/settings`.

`google-batched-tts` intentionally keeps its sentence batching inside the
provider adapter so the existing business-layer flow does not need to change,
and the current `google-tts` / `volcengine-tts` streaming paths stay isolated.

`azure-streaming-tts` follows the same adapter-level batching idea for Azure:
the shared business-layer contract stays unchanged, while the provider handles
sentence-ish segmentation and early playback internally.

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

## Product Roadmap

### Phase 1 — Public Voice Beta

Goal: make VoicyClaw feel like a real hosted voice product, not just a dev shell.

- deploy behind a stable public domain with HTTPS / WSS
- add a stronger landing page that explains the OpenClaw voice story clearly
- keep the VoicyClaw web app as the fastest way to hear OpenClaw bots speak
- tighten the hosted demo loop and setup docs

### Phase 2 — Connector Onboarding

Goal: make "connect my OpenClaw bot" a short, repeatable workflow.

- add a lightweight account / workspace model
- issue connector tokens or API keys from the dashboard
- provide copy-paste install and config steps for OpenClaw users
- show bot online / offline state clearly after installation

### Phase 3 — Plugin-First Install Flow

Goal: reduce setup friction for real OpenClaw users.

- ship the installable `@voicyclaw/voicyclaw` package as the preferred path
- let OpenClaw connect outward to VoicyClaw instead of requiring public Gateway exposure
- improve reconnect, status reporting, and bot registration behavior
- turn "install + configure + talk" into the default product story

### Phase 4 — Channel Expansion and Hosted Operations

Goal: grow from one great voice surface into a broader speech layer.

- evaluate speech delivery for additional OpenClaw channels such as Feishu or WeChat
- expand usage tracking, provider guidance, and cost visibility
- add richer tenant / billing / project controls only when the hosted flow truly needs them

---

## License

[Apache 2.0](LICENSE)
