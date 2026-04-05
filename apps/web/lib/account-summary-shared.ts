import type { HostedOnboardingState } from "./hosted-onboarding-shared"

export interface WorkspaceBillingEvent {
  id: string
  workspaceId: string | null
  projectId: string | null
  channelId: string
  requestId: string
  feature: "tts"
  providerId: string
  status: "succeeded" | "failed"
  inputChars: number
  outputAudioBytes: number
  outputAudioMs: number
  billingRateId: string | null
  chargedCreditsMillis: number
  estimatedProviderCostUsdMicros: number | null
  errorMessage: string | null
  createdAt: string
}

export interface WorkspaceBillingSummary {
  workspaceId: string
  allowance: HostedOnboardingState["allowance"]
  usage: {
    totalEvents: number
    successCount: number
    failureCount: number
    inputChars: number
    outputAudioMs: number
    chargedCreditsMillis: number
  }
  recentEvents: WorkspaceBillingEvent[]
}

export interface AccountSummary {
  user: AccountUserSummary
  onboarding: HostedOnboardingState
  billing: WorkspaceBillingSummary
}

export interface AccountUserSummary {
  id: string
  displayName: string
  email: string | null
  username: string | null
}

export type ClerkUserLike = {
  id: string
  fullName?: string | null
  username?: string | null
  firstName?: string | null
  primaryEmailAddress?: {
    emailAddress?: string | null
  } | null
  emailAddresses?: Array<{
    emailAddress?: string | null
  }>
}

export function buildAccountUserSummary(
  user: ClerkUserLike,
): AccountUserSummary {
  return {
    id: user.id,
    displayName:
      user.fullName ||
      user.username ||
      user.firstName ||
      user.primaryEmailAddress?.emailAddress ||
      "VoicyClaw user",
    email:
      user.primaryEmailAddress?.emailAddress ||
      user.emailAddresses?.[0]?.emailAddress ||
      null,
    username: user.username ?? null,
  }
}

export function buildAccountSummary(input: {
  user: ClerkUserLike
  onboarding: HostedOnboardingState
  billing: WorkspaceBillingSummary
}): AccountSummary {
  const { user, onboarding, billing } = input

  return {
    user: buildAccountUserSummary(user),
    onboarding,
    billing,
  }
}
