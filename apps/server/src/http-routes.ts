import { PROTOCOL_VERSION } from "@voicyclaw/protocol"
import type { FastifyInstance } from "fastify"

import {
  getWorkspaceCreditsSummary,
  getWorkspaceUsageLog,
} from "./domains/billing/service"
import { bootstrapHostedResources } from "./domains/hosted-bootstrap/service"
import { issuePlatformKeyForChannel } from "./domains/platform-keys/service"
import { ensureStarter2Room } from "./domains/starter2/service"
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

  server.get("/api/workspaces/:workspaceId/credits", async (request, reply) => {
    const workspaceId = resolveWorkspaceId(request.params)
    const summary = workspaceId
      ? await getWorkspaceCreditsSummary(workspaceId)
      : null

    if (!summary) {
      reply.code(404)
      return {
        ok: false,
        message: "Workspace not found",
      }
    }

    return summary
  })

  server.get("/api/workspaces/:workspaceId/logs", async (request, reply) => {
    const workspaceId = resolveWorkspaceId(request.params)
    const query =
      (request.query as {
        start?: string
        end?: string
        limit?: string
      } | null) ?? {}
    const summary = workspaceId
      ? await getWorkspaceUsageLog(workspaceId, {
          startAt: normalizeIsoTimestamp(query.start),
          endAt: normalizeIsoTimestamp(query.end),
          limit: normalizeLimit(query.limit, 100),
        })
      : null

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

    return await bootstrapHostedResources({
      provider,
      providerSubject,
      email: body.email,
      displayName: body.displayName,
      firstName: body.firstName,
      fullName: body.fullName,
      username: body.username,
    })
  })

  server.post("/api/starter2/bootstrap", async (request, reply) => {
    const body =
      (request.body as {
        workspaceId?: string | null
        workspaceName?: string | null
        channelId?: string | null
      } | null) ?? {}

    const room = await ensureStarter2Room({
      workspaceId: body.workspaceId,
      workspaceName: body.workspaceName,
      channelId: body.channelId,
    })

    reply.code(201)
    return room
  })

  server.post("/api/keys", async (request, reply) => {
    const body =
      (request.body as { channelId?: string; label?: string } | null) ?? {}
    const channelId = sanitizeId(body.channelId, DEFAULT_CHANNEL_ID)
    await ensureChannelRecord(channelId)
    const key = await issuePlatformKeyForChannel({
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
}

function resolveWorkspaceId(params: unknown) {
  return sanitizeId(
    (params as { workspaceId?: string } | null)?.workspaceId,
    "",
  )
}

function normalizeIsoTimestamp(value?: string | null) {
  const trimmed = value?.trim()
  if (!trimmed) {
    return null
  }

  const parsed = new Date(trimmed)
  if (Number.isNaN(parsed.getTime())) {
    return null
  }

  return parsed.toISOString()
}

function normalizeLimit(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback
  }

  return Math.min(parsed, 200)
}
