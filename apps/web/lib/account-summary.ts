import {
  type AccountSummary,
  type AccountUserSummary,
  buildAccountSummary,
  buildAccountUserSummary,
  type WorkspaceBillingSummary,
} from "./account-summary-shared"
import { getRequestHostedOnboardingState } from "./hosted-onboarding"
import { getRequestAuthContext } from "./request-auth"

export type {
  AccountSummary,
  AccountUserSummary,
  WorkspaceBillingSummary,
} from "./account-summary-shared"

export type AccountSummaryState =
  | {
      kind: "auth-disabled"
      serverUrl: string
    }
  | {
      kind: "signed-out"
      serverUrl: string
    }
  | {
      kind: "setup-pending"
      serverUrl: string
      user: AccountUserSummary
    }
  | {
      kind: "ready"
      serverUrl: string
      summary: AccountSummary
    }

export async function getAccountSummary(): Promise<AccountSummary | null> {
  const state = await getAccountSummaryState()
  return state.kind === "ready" ? state.summary : null
}

export async function getAccountSummaryState(): Promise<AccountSummaryState> {
  const authContext = await getRequestAuthContext()

  if (!authContext.isEnabled) {
    return {
      kind: "auth-disabled",
      serverUrl: authContext.serverUrl,
    }
  }

  if (!authContext.isSignedIn || !authContext.user) {
    return {
      kind: "signed-out",
      serverUrl: authContext.serverUrl,
    }
  }

  const onboarding = await getRequestHostedOnboardingState()
  if (!onboarding) {
    return {
      kind: "setup-pending",
      serverUrl: authContext.serverUrl,
      user: buildAccountUserSummary(authContext.user),
    }
  }

  const billingResponse = await fetch(
    new URL(
      `/api/workspaces/${onboarding.workspace.id}/billing`,
      authContext.serverUrl,
    ),
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

  return {
    kind: "ready",
    serverUrl: authContext.serverUrl,
    summary: buildAccountSummary({
      user: authContext.user,
      onboarding,
      billing,
    }),
  }
}
