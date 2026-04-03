import { storage } from "../../storage"
import { findProjectByChannelId } from "../projects/service"
import { findWorkspaceById } from "../workspaces/service"
import { buildHostedAllowanceSnapshot } from "./allowance"
import { calculateCharge, ensurePreviewBillingRates } from "./rates"
import type { TtsUsageStatus, WorkspaceBillingSummary } from "./types"

export function getWorkspaceBillingSummary(workspaceId: string) {
  ensurePreviewBillingRates()

  const workspace = findWorkspaceById(workspaceId)
  if (!workspace) {
    return null
  }

  return {
    workspaceId,
    allowance: buildHostedAllowanceSnapshot(workspaceId),
    usage: storage.usageEvents.summarizeByWorkspace(workspaceId, "tts"),
    recentEvents: storage.usageEvents.listByWorkspace(workspaceId, 10),
  } satisfies WorkspaceBillingSummary
}

export function recordTtsUsageForChannel(input: {
  channelId: string
  requestId: string
  providerId: string
  status: TtsUsageStatus
  inputChars: number
  outputAudioBytes?: number
  outputAudioMs?: number
  errorMessage?: string | null
}) {
  ensurePreviewBillingRates()

  const ownership = findProjectByChannelId(input.channelId)
  const rate = storage.billingRates.findActive("tts", input.providerId)
  const measuredUsage = {
    inputChars: input.inputChars,
    outputAudioMs: input.outputAudioMs ?? 0,
  }
  const chargedCreditsMillis =
    input.status === "succeeded"
      ? calculateCharge({
          billingMetric: rate?.billingMetric ?? "input_chars",
          unitSize: rate?.unitSize ?? 0,
          amountPerUnitBlock: rate?.retailCreditsMillis ?? 0,
          ...measuredUsage,
        })
      : 0
  const estimatedProviderCostUsdMicros =
    input.status === "succeeded"
      ? calculateCharge({
          billingMetric: rate?.billingMetric ?? "input_chars",
          unitSize: rate?.unitSize ?? 0,
          amountPerUnitBlock: rate?.providerCostUsdMicros ?? 0,
          ...measuredUsage,
        })
      : 0

  const usageEvent = storage.usageEvents.create({
    workspaceId: ownership?.workspaceId ?? null,
    projectId: ownership?.id ?? null,
    channelId: input.channelId,
    requestId: input.requestId,
    feature: "tts",
    providerId: input.providerId,
    status: input.status,
    inputChars: input.inputChars,
    outputAudioBytes: input.outputAudioBytes ?? 0,
    outputAudioMs: input.outputAudioMs ?? 0,
    billingRateId: rate?.id ?? null,
    chargedCreditsMillis,
    estimatedProviderCostUsdMicros,
    errorMessage: input.errorMessage,
  })

  if (
    input.status === "succeeded" &&
    ownership?.workspaceId &&
    chargedCreditsMillis > 0
  ) {
    storage.allowanceLedger.ensureEntry({
      workspaceId: ownership.workspaceId,
      entryType: "usage",
      sourceType: "tts-usage",
      sourceId: usageEvent.id,
      creditsDeltaMillis: -chargedCreditsMillis,
      note: `${input.providerId} TTS usage`,
    })
  }

  return usageEvent
}
