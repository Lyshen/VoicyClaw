import { storage } from "../../storage"
import { ensurePreviewBillingRates } from "./rates"
import type { HostedAllowanceSnapshot } from "./types"

const STARTER_PREVIEW_ALLOWANCE_SOURCE = "starter-preview"
const STARTER_PREVIEW_ALLOWANCE_VERSION = "starter-preview-v1"
const STARTER_PREVIEW_ALLOWANCE_LABEL = "Free preview allowance"
const STARTER_PREVIEW_ALLOWANCE_STATUS = "preview" as const
const STARTER_PREVIEW_ALLOWANCE_CURRENCY = "voice-credits" as const
const STARTER_PREVIEW_ALLOWANCE_CREDITS_MILLIS = 500_000
const BILLING_DISABLED_NOTE = "Billing is not enforced yet."

export async function ensureStarterPreviewAllowance(workspaceId: string) {
  await ensurePreviewBillingRates()
  await storage.allowanceLedger.ensureEntry({
    workspaceId,
    entryType: "grant",
    sourceType: STARTER_PREVIEW_ALLOWANCE_SOURCE,
    sourceId: STARTER_PREVIEW_ALLOWANCE_VERSION,
    creditsDeltaMillis: STARTER_PREVIEW_ALLOWANCE_CREDITS_MILLIS,
    note: "Starter preview allowance grant",
  })
}

export async function buildHostedAllowanceSnapshot(
  workspaceId: string,
): Promise<HostedAllowanceSnapshot> {
  const summary =
    await storage.allowanceLedger.summarizeByWorkspace(workspaceId)

  return {
    label: STARTER_PREVIEW_ALLOWANCE_LABEL,
    status: STARTER_PREVIEW_ALLOWANCE_STATUS,
    note: buildStarterPreviewAllowanceNote(summary.remainingCreditsMillis),
    currency: STARTER_PREVIEW_ALLOWANCE_CURRENCY,
    grantedCreditsMillis: summary.grantedCreditsMillis,
    usedCreditsMillis: summary.usedCreditsMillis,
    remainingCreditsMillis: summary.remainingCreditsMillis,
  }
}

function formatCreditsMillis(value: number) {
  return (value / 1000).toFixed(3)
}

function buildStarterPreviewAllowanceNote(remainingCreditsMillis: number) {
  return `Starter preview allowance is active. ${formatCreditsMillis(
    remainingCreditsMillis,
  )} voice credits remaining. ${BILLING_DISABLED_NOTE}`
}
