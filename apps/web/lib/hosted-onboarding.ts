import { auth, clerkClient } from "@clerk/nextjs/server"

import { getResolvedAuthMode } from "./auth-mode"
import {
  buildHostedOnboardingState,
  type HostedOnboardingRecord,
  type HostedOnboardingState,
} from "./hosted-onboarding-shared"

export type { HostedOnboardingState } from "./hosted-onboarding-shared"

export async function getHostedOnboardingState(
  serverUrl: string,
): Promise<HostedOnboardingState | null> {
  if (getResolvedAuthMode() !== "clerk") {
    return null
  }

  const { userId } = await auth()
  if (!userId) {
    return null
  }

  const client = await clerkClient()
  const user = await client.users.getUser(userId)
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
        user.emailAddresses[0]?.emailAddress ??
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
