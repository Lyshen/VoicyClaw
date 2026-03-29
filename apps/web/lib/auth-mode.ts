export type AuthMode = "local" | "clerk"

const DEFAULT_AUTH_MODE: AuthMode = "local"

export function getRequestedAuthMode(): AuthMode {
  return process.env.NEXT_PUBLIC_VOICYCLAW_AUTH_MODE === "clerk"
    ? "clerk"
    : DEFAULT_AUTH_MODE
}

export function isClerkConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY &&
      process.env.CLERK_SECRET_KEY,
  )
}

export function getResolvedAuthMode(): AuthMode {
  return getRequestedAuthMode() === "clerk" && isClerkConfigured()
    ? "clerk"
    : DEFAULT_AUTH_MODE
}
