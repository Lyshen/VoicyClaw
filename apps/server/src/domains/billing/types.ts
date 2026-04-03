import type { UsageEventRecord } from "../../storage"

export type TtsUsageStatus = "succeeded" | "failed"

export type HostedAllowanceSnapshot = {
  label: string
  status: "preview"
  note: string
  currency: "voice-credits"
  grantedCreditsMillis: number
  usedCreditsMillis: number
  remainingCreditsMillis: number
}

export type WorkspaceBillingSummary = {
  workspaceId: string
  allowance: HostedAllowanceSnapshot
  usage: {
    totalEvents: number
    successCount: number
    failureCount: number
    inputChars: number
    outputAudioMs: number
    chargedCreditsMillis: number
  }
  recentEvents: UsageEventRecord[]
}
