# VoicyClaw OpenClaw Plugin

This package is the standalone OpenClaw plugin for VoicyClaw.

Current scope:

- registers a real `voicyclaw` channel plugin
- owns an outbound WebSocket gateway connector
- performs the VoicyClaw `HELLO` / `WELCOME` handshake
- forwards final `STT_RESULT` turns into the OpenClaw agent runtime
- maps OpenClaw block/final replies back into VoicyClaw preview/text events
- tracks connection status through `voicyclaw.status`
- keeps a guarded `devEchoReplies` mode for transport smoke tests

What is not wired yet:

- audio frame handling beyond the protocol skeleton
- richer non-text payload delivery beyond text plus attachment URLs

## Install In OpenClaw

```bash
openclaw plugins install @voicyclaw/voicyclaw
openclaw gateway restart
```

## Hosted Quick Start

Configure the connector under `channels.voicyclaw`. For the hosted VoicyClaw
service, the plugin already defaults to `https://api.voicyclaw.com`, so the
smallest working config is:

```json
{
  "channels": {
    "voicyclaw": {
      "token": "vcs_xxx",
      "channelId": "sayhello-demo"
    }
  }
}
```

Then restart the gateway:

```bash
openclaw gateway restart
```

## Config Notes

- `channels.voicyclaw.token` is the VoicyClaw API key issued by the VoicyClaw
  server
- `channels.voicyclaw.channelId` is required and should match the room / voice
  project you want this OpenClaw node to join
- it is not the same thing as `gateway.auth.token` from OpenClaw
- if the wrong token is configured, the OpenClaw logs will show
  `AUTH_FAILED Invalid or expired API key.`

## Self-Hosted Override

Set `channels.voicyclaw.url` only when you are connecting to a self-hosted or
non-default VoicyClaw deployment:

```json
{
  "channels": {
    "voicyclaw": {
      "url": "https://voice.example.com",
      "token": "vc_xxx",
      "channelId": "sayhello-demo"
    }
  }
}
```

Advanced fields such as `workspaceId`, `botId`, and `displayName` remain
available, but they are optional for the hosted path.

Optional development-only transport echo:

```json
{
  "channels": {
    "voicyclaw": {
      "devEchoReplies": true
    }
  }
}
```

When `devEchoReplies` is enabled, the plugin sends a simple echoed `TTS_TEXT`
reply after a final transcript arrives, bypassing the real OpenClaw dispatch
path. That is only for isolating transport problems during local debugging.

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
