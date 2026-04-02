import { auth, clerkClient } from "@clerk/nextjs/server"

import { getResolvedAuthMode } from "./auth-mode"
import {
  buildHostedOnboardingState,
  buildStarterOnboardingRecord,
  type HostedOnboardingState,
  recordsEqual,
  STARTER_KEY_LABEL,
  withHostedStarterKey,
} from "./hosted-onboarding-shared"

export type { HostedOnboardingState } from "./hosted-onboarding-shared"

const METADATA_KEY = "voicyclaw"

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
  const existing = asRecord(user.privateMetadata)[METADATA_KEY]
  const record = buildStarterOnboardingRecord(userId, user, existing)
  let nextRecord = record
  let starterKeyProvisioningError: string | undefined

  if (!record.starterKey?.value) {
    try {
      const starterKey = await issueStarterKey(
        serverUrl,
        record.project.channelId,
      )
      nextRecord = withHostedStarterKey(record, starterKey)
    } catch (error) {
      starterKeyProvisioningError =
        error instanceof Error
          ? error.message
          : "VoicyClaw could not issue the starter API key yet."
    }
  }

  if (!recordsEqual(existing, nextRecord)) {
    await client.users.updateUserMetadata(userId, {
      privateMetadata: {
        ...asRecord(user.privateMetadata),
        [METADATA_KEY]: nextRecord,
      },
    })
  }

  return buildHostedOnboardingState(
    nextRecord,
    serverUrl,
    starterKeyProvisioningError,
  )
}

async function issueStarterKey(serverUrl: string, channelId: string) {
  const response = await fetch(new URL("/api/keys", serverUrl), {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      channelId,
      label: STARTER_KEY_LABEL,
    }),
    cache: "no-store",
  })

  if (!response.ok) {
    throw new Error(
      `VoicyClaw server returned ${response.status} while issuing the starter API key.`,
    )
  }

  const payload = (await response.json()) as {
    apiKey?: string
  }
  const apiKey = payload.apiKey?.trim()

  if (!apiKey) {
    throw new Error("VoicyClaw server did not return a starter API key.")
  }

  return apiKey
}

function asRecord(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {}
  }

  return value as Record<string, unknown>
}
