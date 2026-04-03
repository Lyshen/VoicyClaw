import type { FastifyRequest } from "fastify"

import { ensureChannel } from "./db"

export const DEFAULT_PORT = Number(process.env.PORT ?? 3001)
export const DEFAULT_CHANNEL_ID = "demo-room"
const DEFAULT_CHANNEL_NAME = "Demo Room"

export function getRequestBaseUrl(request: FastifyRequest) {
  const host = request.headers.host ?? `localhost:${DEFAULT_PORT}`
  return `${request.protocol}://${host}`
}

export function toWsUrl(httpUrl: string) {
  return httpUrl.replace(/^http/i, "ws")
}

export function sanitizeId(input: string | null | undefined, fallback: string) {
  const cleaned = (input ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")

  return cleaned || fallback
}

export function titleFromChannelId(channelId: string) {
  return channelId
    .split(/[-_]/g)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ")
}

export function ensureChannelRecord(channelId: string) {
  ensureChannel(
    channelId,
    channelId === DEFAULT_CHANNEL_ID
      ? DEFAULT_CHANNEL_NAME
      : titleFromChannelId(channelId),
  )
}
