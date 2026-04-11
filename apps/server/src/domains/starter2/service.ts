import {
  ensureChannelRecord,
  sanitizeId,
  titleFromChannelId,
} from "../../server-shared"

export interface Starter2AgentDefinition {
  id: string
  name: string
  modelProvider: "openrouter"
  model: string
  prompt: string
  preferredTtsProvider: string
  preferredTtsVoice?: string
}

export interface Starter2RoomDefinition {
  channelId: string
  title: string
  workspaceId: string | null
  workspaceName: string | null
  llmProvider: {
    id: "openrouter"
    baseUrl: string
    configured: boolean
  }
  agents: Starter2AgentDefinition[]
}

const DEFAULT_STARTER2_AGENTS: Starter2AgentDefinition[] = [
  {
    id: "claude",
    name: "Claude",
    modelProvider: "openrouter",
    model: "anthropic/claude-3.5-sonnet",
    prompt:
      "You are Claude in a multi-agent room. Be calm, structured, concise, and useful. Respond in under 120 words unless the user explicitly asks for depth.",
    preferredTtsProvider: "azure-streaming-tts",
    preferredTtsVoice: "en-US-AvaMultilingualNeural",
  },
  {
    id: "openai",
    name: "OpenAI",
    modelProvider: "openrouter",
    model: "openai/gpt-4.1-mini",
    prompt:
      "You are OpenAI in a multi-agent room. Be crisp, practical, and implementation-oriented. Respond in under 120 words unless the user explicitly asks for depth.",
    preferredTtsProvider: "google-tts",
    preferredTtsVoice: "en-US-Chirp3-HD-Achernar",
  },
  {
    id: "gemini",
    name: "Gemini",
    modelProvider: "openrouter",
    model: "google/gemini-2.0-flash-001",
    prompt:
      "You are Gemini in a multi-agent room. Be broad, exploratory, and synthesize alternatives clearly. Respond in under 120 words unless the user explicitly asks for depth.",
    preferredTtsProvider: "google-batched-tts",
    preferredTtsVoice: "en-US-Neural2-F",
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    modelProvider: "openrouter",
    model: "deepseek/deepseek-chat",
    prompt:
      "You are DeepSeek in a multi-agent room. Be analytical, direct, and strong on reasoning and tradeoffs. Respond in under 120 words unless the user explicitly asks for depth.",
    preferredTtsProvider: "tencent-streaming-tts",
    preferredTtsVoice: "101007",
  },
]

export async function ensureStarter2Room(input: {
  workspaceId?: string | null
  workspaceName?: string | null
  channelId?: string | null
}) {
  const room = getStarter2RoomDefinition(input)
  await ensureChannelRecord(room.channelId)
  return room
}

export function getStarter2RoomDefinition(input: {
  workspaceId?: string | null
  workspaceName?: string | null
  channelId?: string | null
}): Starter2RoomDefinition {
  const channelId = resolveStarter2ChannelId(input)
  const workspaceName = input.workspaceName?.trim() || null

  return {
    channelId,
    title: workspaceName
      ? `${workspaceName} Starter 2 Room`
      : titleFromChannelId(channelId),
    workspaceId: input.workspaceId?.trim() || null,
    workspaceName,
    llmProvider: {
      id: "openrouter",
      baseUrl: resolveOpenRouterBaseUrl(),
      configured: Boolean(resolveOpenRouterApiKey()),
    },
    agents: DEFAULT_STARTER2_AGENTS,
  }
}

export function isStarter2Channel(channelId: string) {
  return channelId.startsWith("starter2-")
}

export function findStarter2Agent(
  room: Starter2RoomDefinition,
  agentId: string,
) {
  return room.agents.find((agent) => agent.id === agentId)
}

export function resolveOpenRouterBaseUrl() {
  return (
    process.env.VOICYCLAW_OPENROUTER_BASE_URL?.trim() ||
    process.env.OPENROUTER_BASE_URL?.trim() ||
    "https://openrouter.ai/api/v1"
  )
}

export function resolveOpenRouterApiKey() {
  return (
    process.env.VOICYCLAW_OPENROUTER_API_KEY?.trim() ||
    process.env.OPENROUTER_API_KEY?.trim() ||
    ""
  )
}

function resolveStarter2ChannelId(input: {
  workspaceId?: string | null
  channelId?: string | null
}) {
  const explicitChannelId = sanitizeId(input.channelId, "")
  if (explicitChannelId) {
    return explicitChannelId
  }

  const workspaceSeed = sanitizeId(input.workspaceId, "local")
  return `starter2-${workspaceSeed}`
}
