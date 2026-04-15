import cors from "@fastify/cors"
import Fastify from "fastify"

import { registerApiRoutes } from "./http-routes"
import { createRealtimeGateway } from "./realtime-gateway"
import { DEFAULT_BOT_RESPONSE_TIMEOUT_MS } from "./realtime-runtime"
import {
  DEFAULT_CHANNEL_ID,
  DEFAULT_PORT,
  ensureChannelRecord,
} from "./server-shared"
import { storage } from "./storage"

const fastify = Fastify({ logger: true })
const realtimeGateway = createRealtimeGateway(fastify.log, {
  botResponseTimeoutMs:
    parsePositiveInt(process.env.VOICYCLAW_BOT_RESPONSE_TIMEOUT_MS) ??
    DEFAULT_BOT_RESPONSE_TIMEOUT_MS,
})

await storage.system.init()

await fastify.register(cors, {
  origin: true,
  credentials: false,
})

registerApiRoutes(fastify, realtimeGateway)
realtimeGateway.attach(fastify)
await ensureChannelRecord(DEFAULT_CHANNEL_ID)

await fastify.listen({
  port: DEFAULT_PORT,
  host: "0.0.0.0",
})

function parsePositiveInt(value: string | undefined) {
  if (!value) {
    return undefined
  }

  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return undefined
  }

  return Math.trunc(parsed)
}
