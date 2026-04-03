import { auth, clerkClient } from "@clerk/nextjs/server"
import { headers } from "next/headers"

import {
  type AccountSummary,
  buildAccountSummary,
  type WorkspaceBillingSummary,
} from "./account-summary-shared"
import { getResolvedAuthMode } from "./auth-mode"
import { getHostedOnboardingState } from "./hosted-onboarding"
import { resolvePublicServerUrl } from "./runtime-config"

export type {
  AccountSummary,
  WorkspaceBillingSummary,
} from "./account-summary-shared"

export async function getAccountSummary(): Promise<AccountSummary | null> {
  if (getResolvedAuthMode() !== "clerk") {
    return null
  }

  const { userId } = await auth()
  if (!userId) {
    return null
  }

  const requestHeaders = await headers()
  const forwardedProto =
    requestHeaders.get("x-forwarded-proto")?.split(",")[0]?.trim() || "http"
  const serverUrl = resolvePublicServerUrl({
    headers: requestHeaders,
    nextUrl: {
      protocol: `${forwardedProto}:`,
    },
  })

  const onboarding = await getHostedOnboardingState(serverUrl)
  if (!onboarding) {
    return null
  }

  const client = await clerkClient()
  const user = await client.users.getUser(userId)
  const billingResponse = await fetch(
    new URL(`/api/workspaces/${onboarding.workspace.id}/billing`, serverUrl),
    {
      cache: "no-store",
    },
  )

  if (!billingResponse.ok) {
    throw new Error(
      `VoicyClaw server returned ${billingResponse.status} while loading workspace billing summary.`,
    )
  }

  const billing = (await billingResponse.json()) as WorkspaceBillingSummary

  return buildAccountSummary({
    user,
    onboarding,
    billing,
  })
}
