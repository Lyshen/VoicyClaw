import {
  getHostedOnboardingState,
  type HostedOnboardingState,
} from "./hosted-onboarding"
import type { StudioSettings } from "./studio-settings"

type HeaderLookup = {
  get: (name: string) => string | null
}

type WebRuntimeRequest = {
  headers: HeaderLookup
  nextUrl: Pick<URL, "protocol">
}

type WebRuntimeEnv = {
  NEXT_PUBLIC_VOICYCLAW_SERVER_URL?: string
  VOICYCLAW_PUBLIC_SERVER_PORT?: string
  VOICYCLAW_PUBLIC_SERVER_URL?: string
  VOICYCLAW_SERVER_PORT?: string
  [key: string]: string | undefined
}

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
  request: WebRuntimeRequest,
  env: WebRuntimeEnv = process.env,
  options: WebRuntimeOptions = {},
): Promise<WebRuntimePayload> {
  return resolveWebRuntimePayload(request, env, options)
}

export function resolvePublicServerUrl(
  request: WebRuntimeRequest,
  env: WebRuntimeEnv = process.env,
) {
  const explicitUrl =
    env.VOICYCLAW_PUBLIC_SERVER_URL?.trim() ||
    env.NEXT_PUBLIC_VOICYCLAW_SERVER_URL?.trim()

  if (explicitUrl) {
    return explicitUrl
  }

  const forwardedProto =
    request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || ""
  const protocol =
    forwardedProto || request.nextUrl.protocol.replace(/:$/, "") || "http"
  const host =
    request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ||
    request.headers.get("host") ||
    "localhost:3000"
  const publicPort =
    env.VOICYCLAW_PUBLIC_SERVER_PORT?.trim() ||
    env.VOICYCLAW_SERVER_PORT?.trim() ||
    "3001"
  const url = new URL(`${protocol}://${host}`)

  url.port = publicPort
  return `${url.protocol}//${url.host}`
}

async function resolveWebRuntimePayload(
  request: WebRuntimeRequest,
  env: WebRuntimeEnv,
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
