# Developer Map

## Repo Shape

| Area | Responsibility |
| --- | --- |
| `apps/web` | landing page, studio UI, settings UI, account UI, browser audio runtime |
| `apps/server` | HTTP APIs, WebSocket gateway, realtime turn pipeline, storage-backed business flows |
| `apps/mock-bot` | local demo OpenClaw-style bot for day-to-day development |
| `extensions/voicyclaw` | installable OpenClaw connector package |
| `packages/config` | shared config loader and runtime env builder |
| `packages/protocol` | client/bot/server message contracts |
| `packages/tts` / `packages/asr` | speech provider adapters |
| `scripts` | local dev, built demo runtime, e2e, release helpers |
| `tests` / `e2e` | unit, integration, coverage, and Playwright smoke coverage |

## Web Side

### The files to read first

| File | Why it exists |
| --- | --- |
| `apps/web/lib/studio-provider-catalog.ts` | provider ids, labels, modes, and guides |
| `apps/web/lib/studio-settings.ts` | persisted studio settings model, URL helpers, storage helpers |
| `apps/web/lib/web-runtime.ts` | request-scoped bootstrap data for the web app |
| `apps/web/lib/use-studio-settings.ts` | client hook that merges runtime defaults with local persisted settings |
| `apps/web/lib/use-voice-studio-session.ts` | main voice-room session hook |
| `apps/web/lib/use-voice-studio-capture.ts` | microphone and browser speech capture behavior |
| `apps/web/lib/voice-studio-transport.ts` | WebSocket connection for the browser client |
| `apps/web/lib/output-turn-coordinator.ts` | shared playback / interruption logic |

### Mental model

1. `web-runtime.ts` decides the public server URL and hosted onboarding state.
2. `use-studio-settings.ts` fetches that bootstrap payload.
3. `studio-settings.ts` merges bootstrap defaults with local storage.
4. `use-voice-studio-session.ts` opens the client socket, sends utterances, and owns the room timeline.
5. `output-turn-coordinator.ts` keeps playback behavior consistent across browser TTS and server audio.

## Server Side

### The files to read first

| File | Why it exists |
| --- | --- |
| `apps/server/src/index.ts` | main server entry |
| `apps/server/src/http-routes.ts` | REST APIs for health, keys, hosted bootstrap, billing, and bot registration |
| `apps/server/src/realtime-gateway.ts` | WebSocket entrypoint for browser clients and bots |
| `apps/server/src/realtime-runtime.ts` | wires storage, providers, and realtime session services together |
| `apps/server/src/realtime-client-session.ts` | per-client session state and message handling |
| `apps/server/src/realtime-utterance-pipeline.ts` | bot turn coordination and TTS output flow |
| `apps/server/src/backends/*` | local-bot vs OpenClaw Gateway backend adapters |
| `apps/server/src/storage/*` | storage boundary and driver selection |
| `apps/server/src/tts-provider.ts` | server TTS adapter selection |

### Mental model

1. HTTP routes handle key issuance, hosted bootstrap, billing summaries, and health checks.
2. The realtime gateway upgrades browser and bot connections.
3. A client session turns microphone/text input into utterances.
4. The utterance pipeline routes transcript turns into the chosen backend.
5. The chosen TTS provider converts bot text to audio.
6. Storage persists the business state underneath hosted onboarding and billing.

## Runtime Scripts

| Command | What it runs |
| --- | --- |
| `pnpm dev` | source-mode server + Next dev + source mock bot |
| `pnpm start:demo` | built server dist + Next standalone + built mock bot |
| `pnpm test:e2e` | `pnpm build`, then Playwright against the same built demo runtime |

The key rule now is simple:

- dev commands run source code
- demo, e2e, and docker run built artifacts

## Common Extension Points

### Add a new TTS provider

1. Add the provider adapter in `packages/tts/src/providers`.
2. Expose server config in `packages/config`.
3. Register it in `apps/server/src/tts-provider.ts`.
4. Add the UI catalog entry in `apps/web/lib/studio-provider-catalog.ts`.
5. Add tests in `tests/`.

### Add a new hosted business feature

1. Add the domain/storage contract in `apps/server/src/storage/types.ts`.
2. Implement it in the storage driver boundary.
3. Expose the HTTP route in `apps/server/src/http-routes.ts`.
4. Add a web-side loader or summary helper in `apps/web/lib`.
5. Add integration coverage in `tests/`.
