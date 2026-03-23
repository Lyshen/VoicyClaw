import { Buffer } from "node:buffer"

import type { RawData } from "ws"

export enum VolcengineEventType {
  None = 0,
  StartConnection = 1,
  FinishConnection = 2,
  ConnectionStarted = 50,
  ConnectionFailed = 51,
  ConnectionFinished = 52,
  StartSession = 100,
  CancelSession = 101,
  FinishSession = 102,
  SessionStarted = 150,
  SessionCanceled = 151,
  SessionFinished = 152,
  SessionFailed = 153,
  TaskRequest = 200,
}

export enum VolcengineMessageType {
  Invalid = 0,
  FullClientRequest = 0b1,
  AudioOnlyClient = 0b10,
  FullServerResponse = 0b1001,
  AudioOnlyServer = 0b1011,
  Error = 0b1111,
}

enum VolcengineMessageFlag {
  NoSequence = 0,
  WithEvent = 0b100,
}

enum SerializationBits {
  Raw = 0,
  JSON = 0b1,
}

enum CompressionBits {
  None = 0,
}

const HEADER_SIZE = 4
const SESSION_FREE_EVENTS = new Set<VolcengineEventType>([
  VolcengineEventType.StartConnection,
  VolcengineEventType.FinishConnection,
  VolcengineEventType.ConnectionStarted,
  VolcengineEventType.ConnectionFailed,
  VolcengineEventType.ConnectionFinished,
])

export interface VolcengineMessage {
  version: number
  headerSize: number
  type: VolcengineMessageType
  flag: number
  serialization: number
  compression: number
  event?: VolcengineEventType
  sessionId?: string
  connectId?: string
  errorCode?: number
  payload: Uint8Array
}

type PendingReceiver = {
  resolve: (message: VolcengineMessage) => void
  reject: (error: Error) => void
}

export type VolcengineSocket = {
  readonly readyState: number
  on(event: "message", listener: (raw: RawData) => void): unknown
  on(event: "close", listener: () => void): unknown
  once(event: "open", listener: () => void): unknown
  once(event: "error", listener: (error: Error) => void): unknown
  removeListener(event: "error", listener: (error: Error) => void): unknown
  send(data: Uint8Array, callback?: (error?: Error) => void): void
  close(): void
}

export function createVolcengineMessage(
  type: VolcengineMessageType,
  flag = VolcengineMessageFlag.NoSequence,
): VolcengineMessage {
  return {
    version: 1,
    headerSize: 1,
    type,
    flag,
    serialization: SerializationBits.JSON,
    compression: CompressionBits.None,
    payload: new Uint8Array(0),
  }
}

export function marshalVolcengineMessage(message: VolcengineMessage) {
  const buffers: Uint8Array[] = []
  const header = new Uint8Array(HEADER_SIZE)

  header[0] = (message.version << 4) | message.headerSize
  header[1] = (message.type << 4) | message.flag
  header[2] = (message.serialization << 4) | message.compression
  buffers.push(header)

  if (message.flag === VolcengineMessageFlag.WithEvent) {
    buffers.push(writeInt32(message.event ?? VolcengineEventType.None))

    if (!SESSION_FREE_EVENTS.has(message.event ?? VolcengineEventType.None)) {
      buffers.push(writeSizedUtf8(message.sessionId ?? ""))
    }
  }

  if (message.type === VolcengineMessageType.Error) {
    buffers.push(writeUint32(message.errorCode ?? 0))
  }

  if (
    message.flag === VolcengineMessageFlag.WithEvent &&
    (message.event === VolcengineEventType.ConnectionStarted ||
      message.event === VolcengineEventType.ConnectionFailed ||
      message.event === VolcengineEventType.ConnectionFinished)
  ) {
    buffers.push(writeSizedUtf8(message.connectId ?? ""))
  }

  buffers.push(writeSizedBytes(message.payload))

  const totalLength = buffers.reduce((sum, chunk) => sum + chunk.length, 0)
  const result = new Uint8Array(totalLength)
  let offset = 0

  for (const chunk of buffers) {
    result.set(chunk, offset)
    offset += chunk.length
  }

  return result
}

export function unmarshalVolcengineMessage(
  data: Uint8Array,
): VolcengineMessage {
  if (data.length < 3) {
    throw new Error(`Volcengine frame too short: ${data.length}`)
  }

  let offset = 0
  const versionAndHeaderSize = data[offset++]
  const typeAndFlag = data[offset++]
  const serializationAndCompression = data[offset++]

  const message = createVolcengineMessage(
    (typeAndFlag >> 4) as VolcengineMessageType,
    typeAndFlag & 0b1111,
  )

  message.version = versionAndHeaderSize >> 4
  message.headerSize = versionAndHeaderSize & 0b1111
  message.serialization = serializationAndCompression >> 4
  message.compression = serializationAndCompression & 0b1111

  offset = HEADER_SIZE * message.headerSize

  if (message.flag === VolcengineMessageFlag.WithEvent) {
    ;[message.event, offset] = readInt32(data, offset)

    if (!SESSION_FREE_EVENTS.has(message.event)) {
      ;[message.sessionId, offset] = readSizedUtf8(data, offset)
    }
  }

  if (message.type === VolcengineMessageType.Error) {
    ;[message.errorCode, offset] = readUint32(data, offset)
  }

  if (
    message.flag === VolcengineMessageFlag.WithEvent &&
    (message.event === VolcengineEventType.ConnectionStarted ||
      message.event === VolcengineEventType.ConnectionFailed ||
      message.event === VolcengineEventType.ConnectionFinished)
  ) {
    ;[message.connectId, offset] = readSizedUtf8(data, offset)
  }

  ;[message.payload] = readSizedBytes(data, offset)
  return message
}

export function normalizeRawData(raw: RawData) {
  if (Buffer.isBuffer(raw)) {
    return new Uint8Array(raw.buffer, raw.byteOffset, raw.byteLength)
  }

  if (typeof raw === "string") {
    return new Uint8Array(Buffer.from(raw))
  }

  if (raw instanceof ArrayBuffer) {
    return new Uint8Array(raw)
  }

  if (Array.isArray(raw)) {
    return new Uint8Array(Buffer.concat(raw))
  }

  if (ArrayBuffer.isView(raw as object)) {
    const view = raw as ArrayBufferView
    return new Uint8Array(view.buffer, view.byteOffset, view.byteLength)
  }

  throw new Error("Unsupported Volcengine WebSocket payload")
}

export class VolcengineMessageChannel {
  private readonly queue: VolcengineMessage[] = []
  private readonly receivers: PendingReceiver[] = []
  private closed = false

  constructor(private readonly socket: VolcengineSocket) {
    socket.on("message", (raw) => {
      const message = unmarshalVolcengineMessage(normalizeRawData(raw))
      const receiver = this.receivers.shift()

      if (receiver) {
        receiver.resolve(message)
        return
      }

      this.queue.push(message)
    })

    socket.on("close", () => {
      this.closed = true

      while (this.receivers.length > 0) {
        this.receivers.shift()?.reject(new Error("Volcengine socket closed"))
      }
    })
  }

  async receive() {
    if (this.queue.length > 0) {
      return this.queue.shift() as VolcengineMessage
    }

    if (this.closed) {
      throw new Error("Volcengine socket closed")
    }

    return new Promise<VolcengineMessage>((resolve, reject) => {
      this.receivers.push({
        resolve,
        reject,
      })
    })
  }

  async waitFor(
    type: VolcengineMessageType,
    event: VolcengineEventType,
  ): Promise<VolcengineMessage> {
    while (true) {
      const message = await this.receive()

      if (message.type === type && message.event === event) {
        return message
      }

      throwIfVolcengineError(message)
    }
  }

  async send(message: VolcengineMessage) {
    const payload = marshalVolcengineMessage(message)

    await new Promise<void>((resolve, reject) => {
      this.socket.send(payload, (error) => {
        if (error) {
          reject(error)
          return
        }

        resolve()
      })
    })
  }

  async sendEvent(
    event: VolcengineEventType,
    payload: Uint8Array,
    sessionId?: string,
  ) {
    const message = createVolcengineMessage(
      VolcengineMessageType.FullClientRequest,
      VolcengineMessageFlag.WithEvent,
    )

    message.event = event
    message.sessionId = sessionId
    message.payload = payload

    await this.send(message)
  }
}

export function throwIfVolcengineError(message: VolcengineMessage) {
  if (message.type === VolcengineMessageType.Error) {
    throw new Error(
      `Volcengine TTS error${message.errorCode ? ` (${message.errorCode})` : ""}: ${decodePayload(message.payload)}`,
    )
  }

  if (
    message.event === VolcengineEventType.ConnectionFailed ||
    message.event === VolcengineEventType.SessionFailed
  ) {
    throw new Error(
      `Volcengine TTS request failed: ${decodePayload(message.payload)}`,
    )
  }
}

function writeInt32(value: number) {
  const buffer = new ArrayBuffer(4)
  new DataView(buffer).setInt32(0, value, false)
  return new Uint8Array(buffer)
}

function writeUint32(value: number) {
  const buffer = new ArrayBuffer(4)
  new DataView(buffer).setUint32(0, value, false)
  return new Uint8Array(buffer)
}

function writeSizedBytes(value: Uint8Array) {
  const size = writeUint32(value.length)
  const result = new Uint8Array(size.length + value.length)
  result.set(size, 0)
  result.set(value, size.length)
  return result
}

function writeSizedUtf8(value: string) {
  return writeSizedBytes(Buffer.from(value, "utf8"))
}

function readInt32(
  data: Uint8Array,
  offset: number,
): [VolcengineEventType, number] {
  ensureReadable(data, offset, 4)
  const value = new DataView(data.buffer, data.byteOffset + offset, 4).getInt32(
    0,
    false,
  )
  return [value as VolcengineEventType, offset + 4]
}

function readUint32(data: Uint8Array, offset: number): [number, number] {
  ensureReadable(data, offset, 4)
  const value = new DataView(
    data.buffer,
    data.byteOffset + offset,
    4,
  ).getUint32(0, false)
  return [value, offset + 4]
}

function readSizedUtf8(data: Uint8Array, offset: number): [string, number] {
  const [payload, nextOffset] = readSizedBytes(data, offset)
  return [Buffer.from(payload).toString("utf8"), nextOffset]
}

function readSizedBytes(
  data: Uint8Array,
  offset: number,
): [Uint8Array, number] {
  const [size, payloadOffset] = readUint32(data, offset)
  ensureReadable(data, payloadOffset, size)
  return [data.slice(payloadOffset, payloadOffset + size), payloadOffset + size]
}

function ensureReadable(data: Uint8Array, offset: number, length: number) {
  if (offset + length > data.length) {
    throw new Error("Malformed Volcengine frame")
  }
}

function decodePayload(payload: Uint8Array) {
  if (payload.byteLength === 0) return "empty payload"
  return Buffer.from(payload).toString("utf8")
}
