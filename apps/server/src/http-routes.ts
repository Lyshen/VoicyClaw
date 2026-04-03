import { PROTOCOL_VERSION } from "@voicyclaw/protocol"
import type { FastifyInstance } from "fastify"
import { getWorkspaceBillingSummary } from "./billing"
import {
  createPlatformKey,
  findPlatformKeyByToken,
  findProjectByChannelId,
  findWorkspaceById,
  upsertBotRegistration,
} from "./db"
import { bootstrapHostedResources } from "./hosted-resources"
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

    if (!workspaceId || !findWorkspaceById(workspaceId)) {
      reply.code(404)
      return {
        ok: false,
        message: "Workspace not found",
      }
    }

    return getWorkspaceBillingSummary(workspaceId)
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
    const project = findProjectByChannelId(channelId)
    const key = createPlatformKey(channelId, body.label, {
      workspaceId: project?.workspaceId ?? null,
      projectId: project?.id ?? null,
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

    const keyRecord = findPlatformKeyByToken(apiKey)

    if (!keyRecord || keyRecord.channelId !== channelId) {
      reply.code(401)
      return {
        ok: false,
        message: "API key is invalid for this channel",
      }
    }

    const botName = body.botName?.trim() || titleFromChannelId(botId)
    ensureChannelRecord(channelId)

    upsertBotRegistration({
      botId,
      botName,
      channelId,
      platformKeyId: keyRecord.id,
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
