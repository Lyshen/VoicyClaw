import {
  type AccountSummary,
  type AccountUserSummary,
  buildAccountSummary,
  buildAccountUserSummary,
  type WorkspaceBillingSummary,
} from "./account-summary-shared"
import { getWebRequestContext } from "./web-request-context"

export type {
  AccountSummary,
  AccountUserSummary,
  WorkspaceBillingSummary,
} from "./account-summary-shared"

export type AccountSummaryState =
  | {
      kind: "unavailable"
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
  const requestContext = await getWebRequestContext()
  const { auth, onboarding, serverUrl } = requestContext

  if (!auth.isEnabled) {
    return {
      kind: "unavailable",
      serverUrl,
    }
  }

  if (!auth.isSignedIn || !auth.user) {
    return {
      kind: "signed-out",
      serverUrl,
    }
  }

  if (!onboarding) {
    return {
      kind: "setup-pending",
      serverUrl,
      user: buildAccountUserSummary(auth.user),
    }
  }

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

  return {
    kind: "ready",
    serverUrl,
    summary: buildAccountSummary({
      user: auth.user,
      onboarding,
      billing,
    }),
  }
}
