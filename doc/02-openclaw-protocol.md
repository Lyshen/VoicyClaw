# OpenClaw Channel Protocol

> Version: 0.1 (Prototype)
> Last Updated: 2026-04-05

---

## 1. Overview

The OpenClaw Channel Protocol defines the WebSocket message contract between the **VoicyClaw server** and a **ClawBot**. It is intentionally minimal for v0.1. All messages are JSON (text frames), except audio which uses binary frames.

**Transport**: WebSocket (`wss://`)
**Encoding**: UTF-8 JSON for control/data messages; raw binary for audio frames

---

## 2. Connection Establishment

### 2.1 Bot connects to the server

```
wss://<host>/bot/connect
```

On connection, the bot immediately sends a `HELLO` message. The server responds with `WELCOME` or `ERROR`.

### 2.2 HELLO (Bot → Server)

Sent once, as the first message after the WebSocket connection opens.

```json
{
  "type": "HELLO",
  "api_key": "<platform-api-key>",
  "protocol_version": "0.1"
}
```

| Field | Type | Description |
|---|---|---|
| `api_key` | string | Platform API key issued to this bot |
| `protocol_version` | string | Must be `"0.1"` |

The API key fully determines the server-side binding. Bots do not choose `channel_id` or `bot_id` during connect.

### 2.3 WELCOME (Server → Bot)

```json
{
  "type": "WELCOME",
  "session_id": "<uuid>",
  "channel_id": "<channel-id>",
  "bot_id": "<bot-id>",
  "bot_name": "<display-name>"
}
```

`session_id` identifies this connection lifetime. The bot must include it in all subsequent messages for correlation. `channel_id`, `bot_id`, and optional `bot_name` are the server-authoritative binding metadata for this session.

### 2.4 ERROR (Server → Bot)

Sent on auth failure or invalid HELLO. Server closes the connection immediately after.

```json
{
  "type": "ERROR",
  "code": "AUTH_FAILED",
  "message": "Invalid or expired API key"
}
```

| Code | Meaning |
|---|---|
| `AUTH_FAILED` | API key invalid or expired |
| `BOT_ALREADY_CONNECTED` | The server-bound bot session is already active |
| `PROTOCOL_VERSION_UNSUPPORTED` | Server does not support requested version |

---

## 3. Session

A **session** represents one active WebSocket connection lifetime between a bot and the server. It is scoped to one server-bound `(bot_id, channel_id)` pair.

- Sessions are created on successful `WELCOME`
- Sessions end when the WebSocket closes (clean or error)
- The server may close a session at any time by sending a `DISCONNECT` message before closing

### DISCONNECT (Server → Bot)

```json
{
  "type": "DISCONNECT",
  "session_id": "<uuid>",
  "reason": "SERVER_SHUTDOWN"
}
```

---

## 4. Audio Stream (User → Bot)

Audio from the user's microphone is relayed to the bot over the same WebSocket connection as **binary frames**.

### 4.1 Binary Frame Format

Each binary frame is prefixed with a fixed 8-byte header:

```
Bytes 0-3  : uint32 (big-endian) — frame sequence number
Bytes 4    : uint8  — stream type  (0x01 = audio upstream)
Bytes 5    : uint8  — reserved, must be 0x00
Bytes 6-7  : uint16 (big-endian) — payload length in bytes
Bytes 8+   : raw PCM payload (16-bit signed, 16kHz, mono)
```

The server relays these binary frames to the connected bot as-is.

### 4.2 AUDIO_START / AUDIO_END (Server → Bot)

Before the first audio frame of a user utterance, the server sends:

```json
{
  "type": "AUDIO_START",
  "session_id": "<uuid>",
  "utterance_id": "<uuid>"
}
```

After the last frame (silence detection or user releases push-to-talk):

```json
{
  "type": "AUDIO_END",
  "session_id": "<uuid>",
  "utterance_id": "<uuid>"
}
```

The bot uses `utterance_id` to correlate the audio stream with subsequent STT/response messages.

---

## 5. STT Result (Server → Bot)

After ASR transcription completes, the server sends the text result to the bot.

```json
{
  "type": "STT_RESULT",
  "session_id": "<uuid>",
  "utterance_id": "<uuid>",
  "text": "What is the weather today?",
  "is_final": true
}
```

| Field | Type | Description |
|---|---|---|
| `utterance_id` | string | Links back to the originating audio utterance |
| `text` | string | Transcribed text |
| `is_final` | bool | `false` for interim results, `true` for final transcript |

The bot should wait for `is_final: true` before sending a response, unless it wants to implement streaming anticipation.

---

## 6. TTS Text (Bot → Server)

The bot sends text to the server to be synthesized and played to the user.

```json
{
  "type": "TTS_TEXT",
  "session_id": "<uuid>",
  "utterance_id": "<uuid>",
  "text": "Today's weather is sunny with a high of 25°C.",
  "is_final": true
}
```

| Field | Type | Description |
|---|---|---|
| `utterance_id` | string | Must match the originating `STT_RESULT` `utterance_id` |
| `text` | string | Text chunk to synthesize |
| `is_final` | bool | `false` for streaming chunks, `true` for last chunk |

The server begins TTS synthesis immediately on the first chunk (streaming TTS), enabling low-latency playback.

---

## 7. Message Summary

| Message | Direction | Transport |
|---|---|---|
| `HELLO` | Bot → Server | JSON text frame |
| `WELCOME` | Server → Bot | JSON text frame |
| `ERROR` | Server → Bot | JSON text frame |
| `DISCONNECT` | Server → Bot | JSON text frame |
| `AUDIO_START` | Server → Bot | JSON text frame |
| Audio frames | Server → Bot | Binary frames |
| `AUDIO_END` | Server → Bot | JSON text frame |
| `STT_RESULT` | Server → Bot | JSON text frame |
| `TTS_TEXT` | Bot → Server | JSON text frame |

---

## 8. Minimal Flow (End-to-End)

```
Bot                          Server                        User
 │                               │                            │
 │──── HELLO ────────────────────►│                            │
 │◄─── WELCOME (session_id) ──────│                            │
 │                               │◄── audio binary frames ────│
 │◄─── AUDIO_START ──────────────│                            │
 │◄─── [binary audio frames] ────│                            │
 │◄─── AUDIO_END ────────────────│                            │
 │◄─── STT_RESULT (is_final) ────│                            │
 │                               │                            │
 │──── TTS_TEXT (chunk 1) ───────►│                            │
 │──── TTS_TEXT (chunk 2) ───────►│                            │
 │──── TTS_TEXT (is_final) ──────►│                            │
 │                               │──── synthesized audio ────►│
```

---

## 9. Extension Notes

This protocol is intentionally minimal. Future versions may add:
- `BOT_TEXT` — bot sending plain text (non-TTS) to the channel UI
- `USER_EVENT` — user join/leave notifications
- Multi-speaker audio stream multiplexing
- Binary TTS audio frames (bot → server) for pre-synthesized audio
- Heartbeat / ping-pong keepalive

All future message types will use the same `type` field discriminator pattern, ensuring backward compatibility.
