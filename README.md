<p align="center">
  <img src="apps/web/public/voicyclaw-icon.svg" alt="VoicyClaw" width="88" />
</p>

# VoicyClaw

[![CI](https://github.com/Lyshen/VoicyClaw/actions/workflows/ci.yml/badge.svg)](https://github.com/Lyshen/VoicyClaw/actions/workflows/ci.yml)
![Coverage](docs/badges/coverage.svg)

> **Give OpenClaw agents a voice.**
>
> Talk in VoicyClaw, let OpenClaw run the agent, and hear the reply streamed back in real time.

VoicyClaw is the voice layer around OpenClaw bots. It gives you a web voice studio, realtime speech pipelines, and the connector path for bringing a real OpenClaw bot online.

## What Works Today

- voice-first web studio for talking with a local demo bot or a real OpenClaw backend
- client and server speech paths that share the same turn-control UX
- server TTS adapters for Azure, Google Cloud, Tencent Cloud, and Volcengine
- hosted-style starter onboarding for workspace, project, and starter key flows
- OpenClaw plugin packaging under `extensions/voicyclaw`

## Quick Start

```bash
cp config/voicyclaw.example.yaml config/voicyclaw.local.yaml
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Runtime Modes

- `pnpm dev`
  Source-mode local development. Starts the server, web app, and mock bot together.
- `pnpm build && pnpm start:demo`
  Built runtime. Uses the server dist, Next standalone output, and the built mock bot.
- `pnpm test:e2e`
  Builds first, then runs Playwright against the same built demo runtime.
- `docker compose -f deploy/docker-compose.yml --env-file deploy/.env up --build`
  Self-hostable Docker path.

## Config Story

The main local config file is:

```bash
config/voicyclaw.local.yaml
```

That one YAML file is the public-facing source of truth for:

- app ports and public server URL
- auth mode
- storage driver
- demo bot defaults
- provider credentials

`VOICYCLAW_CONFIG` still exists as an advanced override, but the default repo story is one local YAML file.

## Maps

- [Developer Map](docs/developer-map.md)
- [Deployment Map](docs/deployment-map.md)
- [Deploy Notes](deploy/README.md)

## Design Docs

- [Project Definition](doc/01-project-definition.md)
- [OpenClaw Protocol](doc/02-openclaw-protocol.md)
- [Adapter Interface](doc/03-adapter-interface.md)
- [Gateway Bridge](doc/04-openclaw-gateway-bridge.md)
- [Conversation Backend Abstraction](doc/05-conversation-backend-abstraction.md)
- [VoicyClaw Channel Plugin](doc/06-openclaw-voicyclaw-channel-plugin.md)
- [Artifact Standardization](doc/07-artifact-standardization.md)
- [TTS Provider Roadmap](doc/08-tts-provider-roadmap.md)
- [Extreme Onboarding Flow](doc/09-extreme-onboarding-flow.md)
- [Hosted Resource Model](doc/10-hosted-resource-model.md)
