import { Buffer } from "node:buffer"

export const PROTOCOL_VERSION = "0.1" as const

export type OpenClawProtocolVersion = typeof PROTOCOL_VERSION

export interface HelloMessage {
  type: "HELLO"
  api_key: string
  bot_id: string
  channel_id: string
  protocol_version: OpenClawProtocolVersion
}

export interface WelcomeMessage {
  type: "WELCOME"
  session_id: string
  channel_id: string
  bot_id: string
}

export interface ErrorMessage {
  type: "ERROR"
  code:
    | "AUTH_FAILED"
    | "CHANNEL_NOT_FOUND"
    | "BOT_ALREADY_CONNECTED"
    | "PROTOCOL_VERSION_UNSUPPORTED"
  message: string
}

export interface DisconnectMessage {
  type: "DISCONNECT"
  session_id: string
  reason: string
}

export interface AudioStartMessage {
  type: "AUDIO_START"
  session_id: string
  utterance_id: string
}

export interface AudioEndMessage {
  type: "AUDIO_END"
  session_id: string
  utterance_id: string
}

export interface SttResultMessage {
  type: "STT_RESULT"
  session_id: string
  utterance_id: string
  text: string
  is_final: boolean
}

export interface TtsTextMessage {
  type: "TTS_TEXT"
  session_id: string
  utterance_id: string
  text: string
  is_final: boolean
}

export interface BotChannelMessage {
  utteranceId: string
  text: string
  isFinal: boolean
}

export interface BotChannel {
  readonly botId: string
  readonly channelId: string
  readonly sessionId: string

  send(utteranceId: string, text: string): AsyncGenerator<BotChannelMessage>
}

export type OpenClawBotMessage = HelloMessage | TtsTextMessage
export type OpenClawServerMessage =
  | WelcomeMessage
  | ErrorMessage
  | DisconnectMessage
  | AudioStartMessage
  | AudioEndMessage
  | SttResultMessage

export function isSupportedProtocolVersion(
  version: string
): version is OpenClawProtocolVersion {
  return version === PROTOCOL_VERSION
}

export function encodeAudioFrame(sequence: number, payload: Buffer): Buffer {
  const frame = Buffer.allocUnsafe(8 + payload.byteLength)
  frame.writeUInt32BE(sequence >>> 0, 0)
  frame.writeUInt8(0x01, 4)
  frame.writeUInt8(0x00, 5)
  frame.writeUInt16BE(payload.byteLength, 6)
  payload.copy(frame, 8)
  return frame
}

export function decodeAudioFrame(frame: Buffer) {
  if (frame.byteLength < 8) {
    throw new Error("Invalid frame: header is shorter than 8 bytes")
  }

  const payloadLength = frame.readUInt16BE(6)
  const expectedLength = 8 + payloadLength

  if (frame.byteLength < expectedLength) {
    throw new Error("Invalid frame: payload length does not match header")
  }

  return {
    sequence: frame.readUInt32BE(0),
    streamType: frame.readUInt8(4),
    payloadLength,
    payload: frame.subarray(8, expectedLength)
  }
}
