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

## Link Into OpenClaw

```bash
openclaw plugins install --link /Users/lyshen/Desktop/project/VoicyClaw/extensions/voicyclaw
openclaw gateway restart
```

## Channel Config

Configure the connector under `channels.voicyclaw`.

Minimal local example:

```json
{
  "channels": {
    "voicyclaw": {
      "url": "http://127.0.0.1:3001",
      "token": "vc_xxx",
      "channelId": "demo-room",
      "botId": "openclaw-local",
      "displayName": "OpenClaw Local"
    }
  }
}
```

Important:

- `channels.voicyclaw.token` is the VoicyClaw API key issued by the VoicyClaw
  server
- it is not the same thing as `gateway.auth.token` from OpenClaw
- if the wrong token is configured, the OpenClaw logs will show
  `AUTH_FAILED Invalid or expired API key.`

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
