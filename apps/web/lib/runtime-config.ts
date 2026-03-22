type HeaderLookup = {
  get: (name: string) => string | null
}

type RuntimeConfigRequest = {
  headers: HeaderLookup
  nextUrl: Pick<URL, "protocol">
}

type RuntimeConfigEnv = {
  NEXT_PUBLIC_VOICYCLAW_SERVER_URL?: string
  VOICYCLAW_PUBLIC_SERVER_PORT?: string
  VOICYCLAW_PUBLIC_SERVER_URL?: string
  VOICYCLAW_SERVER_PORT?: string
  [key: string]: string | undefined
}

export function getRuntimeConfig(
  request: RuntimeConfigRequest,
  env: RuntimeConfigEnv = process.env,
) {
  return {
    serverUrl: resolvePublicServerUrl(request, env),
  }
}

export function resolvePublicServerUrl(
  request: RuntimeConfigRequest,
  env: RuntimeConfigEnv = process.env,
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
