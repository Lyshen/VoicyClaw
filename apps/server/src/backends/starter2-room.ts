import { randomUUID } from "node:crypto"

import {
  findStarter2Agent,
  getStarter2RoomDefinition,
  resolveOpenRouterApiKey,
  resolveOpenRouterBaseUrl,
  type Starter2AgentDefinition,
  type Starter2RoomDefinition,
} from "../domains/starter2/service"
import type { ClientSession, RealtimeRuntime } from "../realtime-runtime"
import type {
  ConversationBackend,
  ConversationTurnInput,
} from "./conversation-backend"

export class Starter2RoomConversationBackend implements ConversationBackend {
  readonly kind = "starter2-room" as const
  readonly botId = "starter2-room"

  constructor(
    private readonly runtime: RealtimeRuntime,
    private readonly client: ClientSession,
  ) {}

  async *sendTurn(input: ConversationTurnInput) {
    const room = getStarter2RoomDefinition({ channelId: input.channelId })
    const targets = resolveTargetAgents(room, input)

    for (const agent of targets) {
      emitOrchestrationEvent(this.runtime, this.client, {
        utteranceId: input.utteranceId,
        action: "CLAIM",
        actorId: agent.id,
        actorName: agent.name,
        summary: `${agent.name} claimed the turn.`,
      })

      const reply = await generateAgentReply(agent, input.text)

      yield {
        utteranceId: input.utteranceId,
        botId: agent.id,
        botName: agent.name,
        text: reply,
        isFinal: true,
      }

      emitOrchestrationEvent(this.runtime, this.client, {
        utteranceId: input.utteranceId,
        action: "DROP",
        actorId: agent.id,
        actorName: agent.name,
        summary: `${agent.name} dropped the turn.`,
      })
    }
  }
}

function resolveTargetAgents(
  room: Starter2RoomDefinition,
  input: ConversationTurnInput,
) {
  const targets = input.orchestration?.resolution.targets ?? []

  if (targets.includes("*")) {
    return room.agents
  }

  const resolvedAgents = targets
    .map((targetId) =>
      typeof targetId === "string"
        ? findStarter2Agent(room, targetId)
        : undefined,
    )
    .filter((agent): agent is Starter2AgentDefinition => Boolean(agent))

  if (resolvedAgents.length > 0) {
    return resolvedAgents
  }

  return room.agents.slice(0, 1)
}

async function generateAgentReply(
  agent: Starter2AgentDefinition,
  userText: string,
) {
  const apiKey = resolveOpenRouterApiKey()
  if (!apiKey) {
    return buildFallbackReply(agent, userText)
  }

  try {
    return await requestOpenRouterReply(agent, userText, apiKey)
  } catch {
    return buildFallbackReply(agent, userText)
  }
}

async function requestOpenRouterReply(
  agent: Starter2AgentDefinition,
  userText: string,
  apiKey: string,
) {
  const response = await fetch(
    `${resolveOpenRouterBaseUrl()}/chat/completions`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://voicyclaw.local",
        "X-Title": "VoicyClaw Starter2",
      },
      body: JSON.stringify({
        model: agent.model,
        messages: [
          {
            role: "system",
            content: agent.prompt,
          },
          {
            role: "user",
            content: userText,
          },
        ],
        temperature: 0.7,
        stream: false,
      }),
    },
  )

  if (!response.ok) {
    throw new Error(`openrouter ${response.status}`)
  }

  const payload = (await response.json()) as {
    choices?: Array<{
      message?: {
        content?: string
      }
    }>
  }

  const text = payload.choices?.[0]?.message?.content?.trim()
  if (!text) {
    throw new Error("openrouter empty response")
  }

  return text
}

function buildFallbackReply(agent: Starter2AgentDefinition, userText: string) {
  const trimmed = userText.trim()
  return `${agent.name} (${agent.model}) heard: "${trimmed}". I am running in Starter 2 fallback mode right now, so this is a mock room reply. Once you add an OpenRouter key, I can answer with the configured model and keep the same room / CALL / CLAIM flow.`
}

function emitOrchestrationEvent(
  runtime: RealtimeRuntime,
  client: ClientSession,
  input: {
    utteranceId: string
    action: "CALL" | "CLAIM" | "DROP"
    actorId: string
    actorName: string
    targetId?: string | "*"
    targetName?: string
    summary: string
  },
) {
  runtime.sendJson(client.ws, {
    type: "ORCHESTRATION_EVENT",
    eventId: randomUUID(),
    roomId: client.channelId,
    utteranceId: input.utteranceId,
    action: input.action,
    actorId: input.actorId,
    actorName: input.actorName,
    targetId: input.targetId,
    targetName: input.targetName,
    summary: input.summary,
  })
}
