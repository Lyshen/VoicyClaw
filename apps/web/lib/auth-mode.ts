export type AuthMode = "local" | "clerk"

const DEFAULT_AUTH_MODE: AuthMode = "local"

type WebAuthEnvironment = NodeJS.ProcessEnv & {
  NEXT_PUBLIC_VOICYCLAW_AUTH_MODE?: string
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?: string
  CLERK_SECRET_KEY?: string
}

export type ResolvedWebAuthConfig = {
  requestedMode: AuthMode
  resolvedMode: AuthMode
  isEnabled: boolean
  clerkPublishableKey: string | null
  clerkSecretKey: string | null
}

export function getRequestedAuthMode(
  env: WebAuthEnvironment = process.env,
): AuthMode {
  return readConfiguredValue(env.NEXT_PUBLIC_VOICYCLAW_AUTH_MODE) === "clerk"
    ? "clerk"
    : DEFAULT_AUTH_MODE
}

export function getResolvedAuthConfig(
  env: WebAuthEnvironment = process.env,
): ResolvedWebAuthConfig {
  const requestedMode = getRequestedAuthMode(env)
  const configuredPublishableKey = readConfiguredValue(
    env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
  )
  const configuredSecretKey = readConfiguredValue(env.CLERK_SECRET_KEY)
  const resolvedMode =
    requestedMode === "clerk" && configuredPublishableKey && configuredSecretKey
      ? "clerk"
      : DEFAULT_AUTH_MODE

  return {
    requestedMode,
    resolvedMode,
    isEnabled: resolvedMode === "clerk",
    clerkPublishableKey:
      resolvedMode === "clerk" ? configuredPublishableKey : null,
    clerkSecretKey: resolvedMode === "clerk" ? configuredSecretKey : null,
  }
}

export function isClerkConfigured(
  env: WebAuthEnvironment = process.env,
): boolean {
  return getResolvedAuthConfig(env).isEnabled
}

export function getResolvedAuthMode(
  env: WebAuthEnvironment = process.env,
): AuthMode {
  return getResolvedAuthConfig(env).resolvedMode
}

function readConfiguredValue(value: string | undefined) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}
