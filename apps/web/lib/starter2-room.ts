import type { HostedOnboardingState } from "./hosted-onboarding-shared"

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

export async function fetchStarter2Room(
  serverUrl: string,
  onboarding: HostedOnboardingState | null,
) {
  try {
    const response = await fetch(
      new URL("/api/starter2/bootstrap", serverUrl),
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          workspaceId: onboarding?.workspace.id ?? null,
          workspaceName: onboarding?.workspace.name ?? null,
        }),
        cache: "no-store",
      },
    )

    if (!response.ok) {
      throw new Error(`starter2 ${response.status}`)
    }

    return (await response.json()) as Starter2RoomDefinition
  } catch {
    return buildFallbackStarter2Room(onboarding)
  }
}

function buildFallbackStarter2Room(
  onboarding: HostedOnboardingState | null,
): Starter2RoomDefinition {
  const workspaceId = onboarding?.workspace.id ?? "local"
  const workspaceName = onboarding?.workspace.name ?? "Local Workspace"

  return {
    channelId: `starter2-${workspaceId.toLowerCase().replace(/[^a-z0-9-_]/g, "-")}`,
    title: `${workspaceName} Starter 2 Room`,
    workspaceId,
    workspaceName,
    llmProvider: {
      id: "openrouter",
      baseUrl: "https://openrouter.ai/api/v1",
      configured: false,
    },
    agents: [
      {
        id: "claude",
        name: "Claude",
        modelProvider: "openrouter",
        model: "anthropic/claude-3.5-sonnet",
        prompt: "Claude fallback profile",
        preferredTtsProvider: "azure-streaming-tts",
        preferredTtsVoice: "en-US-AvaMultilingualNeural",
      },
      {
        id: "openai",
        name: "OpenAI",
        modelProvider: "openrouter",
        model: "openai/gpt-4.1-mini",
        prompt: "OpenAI fallback profile",
        preferredTtsProvider: "google-tts",
        preferredTtsVoice: "en-US-Chirp3-HD-Achernar",
      },
      {
        id: "gemini",
        name: "Gemini",
        modelProvider: "openrouter",
        model: "google/gemini-2.0-flash-001",
        prompt: "Gemini fallback profile",
        preferredTtsProvider: "google-batched-tts",
        preferredTtsVoice: "en-US-Neural2-F",
      },
      {
        id: "deepseek",
        name: "DeepSeek",
        modelProvider: "openrouter",
        model: "deepseek/deepseek-chat",
        prompt: "DeepSeek fallback profile",
        preferredTtsProvider: "tencent-streaming-tts",
        preferredTtsVoice: "101007",
      },
    ],
  }
}
