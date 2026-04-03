import cors from "@fastify/cors"
import Fastify from "fastify"

import { registerApiRoutes } from "./http-routes"
import { createRealtimeGateway } from "./realtime-gateway"
import {
  DEFAULT_CHANNEL_ID,
  DEFAULT_PORT,
  ensureChannelRecord,
} from "./server-shared"

const fastify = Fastify({ logger: true })
const realtimeGateway = createRealtimeGateway(fastify.log)

await fastify.register(cors, {
  origin: true,
  credentials: false,
})

registerApiRoutes(fastify, realtimeGateway)
realtimeGateway.attach(fastify)
ensureChannelRecord(DEFAULT_CHANNEL_ID)

await fastify.listen({
  port: DEFAULT_PORT,
  host: "0.0.0.0",
})
