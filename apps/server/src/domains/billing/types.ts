import type {
  UsageEventRecord,
  WorkspaceAllowanceLedgerEntry,
  WorkspaceUsageSummary,
} from "../../storage"

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

export type WorkspaceCreditsSummary = {
  workspaceId: string
  allowance: HostedAllowanceSnapshot
  usage: WorkspaceUsageSummary
  ledger: WorkspaceAllowanceLedgerEntry[]
}

export type WorkspaceUsageLogResult = {
  workspaceId: string
  allowance: HostedAllowanceSnapshot
  usage: WorkspaceUsageSummary
  filters: {
    startAt: string | null
    endAt: string | null
  }
  events: UsageEventRecord[]
}
