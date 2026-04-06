# VoicyClaw OpenClaw Plugin

This package is the standalone OpenClaw plugin for VoicyClaw.

This package gives OpenClaw one minimal VoicyClaw integration:

- authenticate with a VoicyClaw token
- open the `HELLO` / `WELCOME` WebSocket session
- forward final `STT_RESULT` turns into OpenClaw
- map OpenClaw block/final replies back into `BOT_PREVIEW` and `TTS_TEXT`
- expose runtime state through `voicyclaw.status`

## Install In OpenClaw

```bash
openclaw plugins install @voicyclaw/voicyclaw
openclaw gateway restart
```

## Hosted Quick Start

For the hosted VoicyClaw service, the plugin already defaults to
`https://api.voicyclaw.com`, so the smallest working config is:

```json
{
  "channels": {
    "voicyclaw": {
      "token": "vcs_xxx"
    }
  }
}
```

Then restart the gateway:

```bash
openclaw gateway restart
```

## Config Notes

- the plugin reads one block only: `channels.voicyclaw`
- `channels.voicyclaw.token` is the VoicyClaw API key
- room and bot binding come from the VoicyClaw server after the token is accepted
- `channels.voicyclaw.url` is optional and is only for self-hosted deployments
- this token is unrelated to `gateway.auth.token` from OpenClaw
- a bad token will fail the handshake with `AUTH_FAILED Invalid or expired API key.`

## Self-Hosted Override

Set `channels.voicyclaw.url` only when you are connecting to a self-hosted or
non-default VoicyClaw deployment:

```json
{
  "channels": {
    "voicyclaw": {
      "url": "https://voice.example.com",
      "token": "vc_xxx"
    }
  }
}
```

## Local Development

Install dependencies inside this directory. Because this package lives inside
the main VoicyClaw monorepo but stays intentionally outside the workspace, use
`--ignore-workspace` for the initial install so pnpm creates the standalone
lockfile here.

```bash
pnpm install --ignore-workspace
```

Run the local checks for the standalone package:

```bash
pnpm lint
pnpm test
pnpm typecheck
```

For local linking during plugin development:

```bash
openclaw plugins install --link /Users/lyshen/Desktop/project/VoicyClaw/extensions/voicyclaw
openclaw gateway restart
```

The test suite includes a wire-level smoke case that covers the minimal
VoicyClaw workflow:

- `HELLO`
- `WELCOME`
- `STT_RESULT`
- `BOT_PREVIEW`
- `TTS_TEXT`
