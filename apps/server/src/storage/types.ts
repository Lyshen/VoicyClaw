export type AuthProvider = "clerk" | "trial"
export type ProjectType = "starter" | "standard"
export type PlatformKeyType = "starter" | "standard" | "trial"
export type BillingFeature = "tts"
export type BillingMetric = "input_chars" | "output_audio_ms"
export type UsageStatus = "succeeded" | "failed"
export type AllowanceEntryType = "grant" | "usage" | "adjustment"

export interface UserRecord {
  id: string
  displayName: string | null
  createdAt: string
  updatedAt: string
}

export interface UserIdentityRecord {
  id: string
  userId: string
  provider: AuthProvider
  providerSubject: string
  email: string | null
  createdAt: string
  updatedAt: string
}

export interface WorkspaceRecord {
  id: string
  ownerUserId: string
  name: string
  isDefault: boolean
  createdAt: string
  updatedAt: string
}

export interface ProjectRecord {
  id: string
  workspaceId: string
  name: string
  projectType: ProjectType
  channelId: string
  botId: string
  displayName: string
  createdAt: string
  updatedAt: string
}

export interface PlatformKeyRecord {
  id: string
  token: string
  label: string | null
  channelId: string
  workspaceId: string | null
  projectId: string | null
  keyType: PlatformKeyType
  createdByUserId: string | null
  createdAt: string
  expiresAt: string | null
  lastUsedAt: string | null
}

export interface BillingRateRecord {
  id: string
  feature: BillingFeature
  providerId: string
  billingMetric: BillingMetric
  unitSize: number
  retailCreditsMillis: number
  providerCostUsdMicros: number | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface UsageEventRecord {
  id: string
  workspaceId: string | null
  projectId: string | null
  channelId: string
  requestId: string
  feature: BillingFeature
  providerId: string
  status: UsageStatus
  inputChars: number
  outputAudioBytes: number
  outputAudioMs: number
  billingRateId: string | null
  chargedCreditsMillis: number
  estimatedProviderCostUsdMicros: number | null
  errorMessage: string | null
  createdAt: string
}

export interface WorkspaceAllowanceLedgerEntry {
  id: string
  workspaceId: string
  entryType: AllowanceEntryType
  sourceType: string
  sourceId: string
  creditsDeltaMillis: number
  note: string | null
  createdAt: string
}

export interface WorkspaceAllowanceSummary {
  grantedCreditsMillis: number
  usedCreditsMillis: number
  remainingCreditsMillis: number
}

export interface WorkspaceUsageSummary {
  totalEvents: number
  successCount: number
  failureCount: number
  inputChars: number
  outputAudioMs: number
  chargedCreditsMillis: number
}
