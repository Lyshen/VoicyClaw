import {
  getHostedOnboardingState,
  type HostedOnboardingState,
} from "./hosted-onboarding"
import {
  type PublicServerUrlEnv,
  type PublicServerUrlRequest,
  resolvePublicServerUrl,
} from "./public-server-url"
import type { StudioSettings } from "./studio-settings"

export interface WebRuntimePayload {
  initialSettings: Partial<StudioSettings>
  settingsNamespace?: string
  onboarding: HostedOnboardingState | null
}

type WebRuntimeOptions = {
  getHostedOnboardingState?: (
    serverUrl: string,
  ) => Promise<HostedOnboardingState | null>
}

export function getWebRuntimePayload(
  request: PublicServerUrlRequest,
  env: PublicServerUrlEnv = process.env,
  options: WebRuntimeOptions = {},
): Promise<WebRuntimePayload> {
  return resolveWebRuntimePayload(request, env, options)
}

async function resolveWebRuntimePayload(
  request: PublicServerUrlRequest,
  env: PublicServerUrlEnv,
  options: WebRuntimeOptions,
) {
  const serverUrl = resolvePublicServerUrl(request, env)
  const onboardingResolver =
    options.getHostedOnboardingState ?? getHostedOnboardingState
  const onboarding = await onboardingResolver(serverUrl)

  return {
    initialSettings: {
      serverUrl,
      channelId: onboarding?.project.channelId,
      conversationBackend: onboarding ? ("local-bot" as const) : undefined,
    },
    settingsNamespace: onboarding?.settingsNamespace,
    onboarding,
  }
}

export { resolvePublicServerUrl } from "./public-server-url"
