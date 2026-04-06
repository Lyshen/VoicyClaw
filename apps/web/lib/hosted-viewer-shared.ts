import type { HostedOnboardingState } from "./hosted-onboarding-shared"

export interface HostedViewerUserSummary {
  id: string
  displayName: string
  email: string | null
  username: string | null
}

export interface HostedViewerSummary {
  user: HostedViewerUserSummary
  onboarding: HostedOnboardingState
}

export interface WorkspaceUsageSummary {
  totalEvents: number
  successCount: number
  failureCount: number
  inputChars: number
  outputAudioMs: number
  chargedCreditsMillis: number
}

export interface WorkspaceUsageEvent {
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

export interface WorkspaceCreditLedgerEntry {
  id: string
  workspaceId: string
  entryType: "grant" | "usage" | "adjustment"
  sourceType: string
  sourceId: string
  creditsDeltaMillis: number
  note: string | null
  createdAt: string
}

export interface WorkspaceCreditsSummary {
  workspaceId: string
  allowance: HostedOnboardingState["allowance"]
  usage: WorkspaceUsageSummary
  ledger: WorkspaceCreditLedgerEntry[]
}

export interface WorkspaceLogsSummary {
  workspaceId: string
  allowance: HostedOnboardingState["allowance"]
  usage: WorkspaceUsageSummary
  filters: {
    startAt: string | null
    endAt: string | null
  }
  events: WorkspaceUsageEvent[]
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

export function buildHostedViewerUserSummary(
  user: ClerkUserLike,
): HostedViewerUserSummary {
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

export function buildHostedViewerSummary(input: {
  user: ClerkUserLike
  onboarding: HostedOnboardingState
}): HostedViewerSummary {
  return {
    user: buildHostedViewerUserSummary(input.user),
    onboarding: input.onboarding,
  }
}
