import { cache } from "react"

import {
  buildHostedOnboardingState,
  type HostedOnboardingRecord,
  type HostedOnboardingState,
} from "./hosted-onboarding-shared"
import { getRequestAuthContext, type RequestAuthUser } from "./request-auth"

export type { HostedOnboardingState } from "./hosted-onboarding-shared"

export async function getHostedOnboardingState(
  serverUrl: string,
): Promise<HostedOnboardingState | null> {
  const authContext = await getRequestAuthContext()

  if (!authContext.isEnabled || !authContext.isSignedIn || !authContext.user) {
    return null
  }

  return fetchHostedOnboardingState(serverUrl, authContext.user)
}

export const getRequestHostedOnboardingState = cache(async () => {
  const authContext = await getRequestAuthContext()

  if (!authContext.isEnabled || !authContext.isSignedIn || !authContext.user) {
    return null
  }

  return fetchHostedOnboardingState(authContext.serverUrl, authContext.user)
})

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
