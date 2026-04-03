import { PROTOCOL_VERSION } from "@voicyclaw/protocol"
import type { FastifyInstance } from "fastify"
import { getWorkspaceBillingSummary } from "./domains/billing/service"
import { upsertBotRegistrationRecord } from "./domains/bot-registrations/service"
import { bootstrapHostedResources } from "./domains/hosted-bootstrap/service"
import {
  authorizePlatformKeyForChannel,
  issuePlatformKeyForChannel,
} from "./domains/platform-keys/service"
import type { RealtimeGateway } from "./realtime-gateway"
import {
  DEFAULT_CHANNEL_ID,
  ensureChannelRecord,
  getRequestBaseUrl,
  sanitizeId,
  titleFromChannelId,
  toWsUrl,
} from "./server-shared"

export function registerApiRoutes(
  server: FastifyInstance,
  realtimeGateway: RealtimeGateway,
) {
  server.get("/api/health", async () => {
    return {
      ok: true,
      protocolVersion: PROTOCOL_VERSION,
      ...realtimeGateway.getHealthSnapshot(),
    }
  })

  server.get("/api/channels/:channelId", async (request) => {
    const channelId = sanitizeId(
      (request.params as { channelId: string }).channelId,
      DEFAULT_CHANNEL_ID,
    )

    return realtimeGateway.getChannelSnapshot(channelId)
  })

  server.get("/api/workspaces/:workspaceId/billing", async (request, reply) => {
    const workspaceId = sanitizeId(
      (request.params as { workspaceId: string }).workspaceId,
      "",
    )

    const summary = workspaceId ? getWorkspaceBillingSummary(workspaceId) : null

    if (!summary) {
      reply.code(404)
      return {
        ok: false,
        message: "Workspace not found",
      }
    }

    return summary
  })

  server.post("/api/hosted/bootstrap", async (request, reply) => {
    const body =
      (request.body as {
        provider?: string
        providerSubject?: string
        email?: string | null
        displayName?: string | null
        firstName?: string | null
        fullName?: string | null
        username?: string | null
      } | null) ?? {}

    const provider = body.provider === "clerk" ? "clerk" : null
    const providerSubject = body.providerSubject?.trim()

    if (!provider || !providerSubject) {
      reply.code(400)
      return {
        ok: false,
        message: "provider and providerSubject are required",
      }
    }

    return bootstrapHostedResources({
      provider,
      providerSubject,
      email: body.email,
      displayName: body.displayName,
      firstName: body.firstName,
      fullName: body.fullName,
      username: body.username,
    })
  })

  server.post("/api/keys", async (request, reply) => {
    const body =
      (request.body as { channelId?: string; label?: string } | null) ?? {}
    const channelId = sanitizeId(body.channelId, DEFAULT_CHANNEL_ID)
    ensureChannelRecord(channelId)
    const key = issuePlatformKeyForChannel({
      channelId,
      label: body.label,
    })
    const baseUrl = getRequestBaseUrl(request)

    reply.code(201)
    return {
      apiKey: key.token,
      channelId,
      channelName: titleFromChannelId(channelId),
      wsUrl: `${toWsUrl(baseUrl)}/bot/connect`,
      protocolVersion: PROTOCOL_VERSION,
    }
  })

  server.post("/api/bot/register", async (request, reply) => {
    const body =
      (request.body as {
        apiKey?: string
        botId?: string
        botName?: string
        channelId?: string
      } | null) ?? {}

    const apiKey = body.apiKey?.trim()
    const botId = sanitizeId(body.botId, "local-bot")
    const channelId = sanitizeId(body.channelId, DEFAULT_CHANNEL_ID)

    if (!apiKey) {
      reply.code(400)
      return {
        ok: false,
        message: "apiKey is required",
      }
    }

    const authorization = authorizePlatformKeyForChannel(apiKey, channelId)

    if (!authorization.ok) {
      reply.code(401)
      return {
        ok: false,
        message: "API key is invalid for this channel",
      }
    }

    const botName = body.botName?.trim() || titleFromChannelId(botId)
    ensureChannelRecord(channelId)

    upsertBotRegistrationRecord({
      botId,
      botName,
      channelId,
      platformKeyId: authorization.key.id,
    })

    return {
      ok: true,
      botId,
      botName,
      channelId,
      wsUrl: `${toWsUrl(getRequestBaseUrl(request))}/bot/connect`,
      protocolVersion: PROTOCOL_VERSION,
    }
  })
}
