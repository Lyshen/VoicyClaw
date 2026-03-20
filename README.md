# VoicyClaw

### *Talk to claws easily.*

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
- **Pluggable adapters** — swap ASR/TTS providers without touching the pipeline
- **OpenClaw protocol** — minimal JSON-over-WebSocket channel protocol between server and bots (see [`doc/02-openclaw-protocol.md`](doc/02-openclaw-protocol.md))

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

## Tech Stack (Prototype)

- **Frontend**: Next.js (TypeScript)
- **Backend / WS Server**: Fastify + `ws` (TypeScript)
- **Database**: SQLite via Prisma
- **Monorepo**: pnpm workspaces

---

## Documentation

| Doc | Description |
|---|---|
| [`doc/01-project-definition.md`](doc/01-project-definition.md) | Full project definition, architecture, scope |
| [`doc/02-openclaw-protocol.md`](doc/02-openclaw-protocol.md) | OpenClaw WebSocket protocol spec |
| [`doc/03-adapter-interface.md`](doc/03-adapter-interface.md) | ASR / TTS adapter interface definitions |

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
