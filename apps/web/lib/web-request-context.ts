import { auth, clerkClient } from "@clerk/nextjs/server"
import { headers } from "next/headers"
import { cache } from "react"

import { getResolvedAuthConfig } from "./auth-mode"
import {
  buildHostedOnboardingState,
  type HostedOnboardingRecord,
  type HostedOnboardingState,
} from "./hosted-onboarding-shared"
import { resolvePublicServerUrl } from "./public-server-url"
import { buildWebRuntimePayload, type WebRuntimePayload } from "./web-runtime"

export type RequestAuthUser = {
  id: string
  firstName?: string | null
  fullName?: string | null
  username?: string | null
  primaryEmailAddress?: {
    emailAddress?: string | null
  } | null
  emailAddresses?: Array<{
    emailAddress?: string | null
  }>
}

export type RequestAuthContext = {
  isEnabled: boolean
  isSignedIn: boolean
  serverUrl: string
  userId: string | null
  user: RequestAuthUser | null
  clerkPublishableKey: string | null
}

export type WebRequestContext = {
  serverUrl: string
  auth: RequestAuthContext
  onboarding: HostedOnboardingState | null
  runtime: WebRuntimePayload
}

export const getWebRequestContext = cache(
  async (): Promise<WebRequestContext> => {
    const authConfig = getResolvedAuthConfig()
    const requestHeaders = await headers()
    const forwardedProto =
      requestHeaders.get("x-forwarded-proto")?.split(",")[0]?.trim() || "http"
    const serverUrl = resolvePublicServerUrl({
      headers: requestHeaders,
      nextUrl: {
        protocol: `${forwardedProto}:`,
      },
    })

    const authContext = await resolveRequestAuthContext({
      isAuthEnabled: authConfig.isEnabled,
      serverUrl,
      clerkPublishableKey: authConfig.clerkPublishableKey,
    })
    const onboarding =
      authContext.isSignedIn && authContext.user
        ? await fetchHostedOnboardingState(serverUrl, authContext.user)
        : null

    return {
      serverUrl,
      auth: authContext,
      onboarding,
      runtime: buildWebRuntimePayload({
        serverUrl,
        onboarding,
      }),
    }
  },
)

async function resolveRequestAuthContext({
  isAuthEnabled,
  serverUrl,
  clerkPublishableKey,
}: {
  isAuthEnabled: boolean
  serverUrl: string
  clerkPublishableKey: string | null
}): Promise<RequestAuthContext> {
  if (!isAuthEnabled) {
    return {
      isEnabled: false,
      isSignedIn: false,
      serverUrl,
      userId: null,
      user: null,
      clerkPublishableKey,
    }
  }

  const { userId } = await auth()
  if (!userId) {
    return {
      isEnabled: true,
      isSignedIn: false,
      serverUrl,
      userId: null,
      user: null,
      clerkPublishableKey,
    }
  }

  const client = await clerkClient()
  const user = (await client.users.getUser(userId)) as RequestAuthUser

  return {
    isEnabled: true,
    isSignedIn: true,
    serverUrl,
    userId,
    user,
    clerkPublishableKey,
  }
}

async function fetchHostedOnboardingState(
  serverUrl: string,
  user: RequestAuthUser,
) {
  const response = await fetch(new URL("/api/hosted/bootstrap", serverUrl), {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      provider: "clerk",
      providerSubject: user.id,
      email:
        user.primaryEmailAddress?.emailAddress ??
        user.emailAddresses?.[0]?.emailAddress ??
        null,
      displayName: user.fullName ?? user.username ?? user.firstName ?? null,
      firstName: user.firstName,
      fullName: user.fullName,
      username: user.username,
    }),
    cache: "no-store",
  })

  if (!response.ok) {
    let message = `${response.status}`

    try {
      const payload = (await response.json()) as {
        message?: string
      }

      if (payload.message?.trim()) {
        message = `${message}: ${payload.message.trim()}`
      }
    } catch {
      // Ignore JSON parse failures and keep the HTTP status in the error text.
    }

    throw new Error(
      `VoicyClaw server returned ${message} while bootstrapping hosted resources.`,
    )
  }

  const record = (await response.json()) as HostedOnboardingRecord
  return buildHostedOnboardingState(record, serverUrl)
}
