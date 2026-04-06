import { storage } from "../../storage"
import { findProjectByChannelId } from "../projects/service"
import { findWorkspaceById } from "../workspaces/service"
import { buildHostedAllowanceSnapshot } from "./allowance"
import { calculateCharge, ensurePreviewBillingRates } from "./rates"
import type {
  TtsUsageStatus,
  WorkspaceCreditsSummary,
  WorkspaceUsageLogResult,
} from "./types"

export async function getWorkspaceCreditsSummary(
  workspaceId: string,
  limit = 50,
) {
  const context = await getWorkspaceBillingContext(workspaceId)
  if (!context) {
    return null
  }

  return {
    ...context,
    ledger: await storage.allowanceLedger.listByWorkspace(workspaceId, limit),
  } satisfies WorkspaceCreditsSummary
}

export async function getWorkspaceUsageLog(
  workspaceId: string,
  input: {
    startAt?: string | null
    endAt?: string | null
    limit?: number
  } = {},
) {
  const context = await getWorkspaceBillingContext(workspaceId)
  if (!context) {
    return null
  }

  const filters = normalizeUsageFilters(input)

  return {
    ...context,
    filters,
    events: await storage.usageEvents.listByWorkspace(workspaceId, "tts", {
      ...filters,
      limit: input.limit ?? 100,
    }),
  } satisfies WorkspaceUsageLogResult
}

export async function recordTtsUsageForChannel(input: {
  channelId: string
  requestId: string
  providerId: string
  status: TtsUsageStatus
  inputChars: number
  outputAudioBytes?: number
  outputAudioMs?: number
  errorMessage?: string | null
}) {
  await ensurePreviewBillingRates()

  const ownership = await findProjectByChannelId(input.channelId)
  const rate = await storage.billingRates.findActive("tts", input.providerId)
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

  const usageEvent = await storage.usageEvents.create({
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
    await storage.allowanceLedger.ensureEntry({
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

async function getWorkspaceBillingContext(workspaceId: string) {
  await ensurePreviewBillingRates()

  const workspace = await findWorkspaceById(workspaceId)
  if (!workspace) {
    return null
  }

  return {
    workspaceId,
    allowance: await buildHostedAllowanceSnapshot(workspaceId),
    usage: await storage.usageEvents.summarizeByWorkspace(workspaceId, "tts"),
  }
}

function normalizeUsageFilters(input: {
  startAt?: string | null
  endAt?: string | null
}) {
  const startAt = normalizeIsoTimestamp(input.startAt)
  const endAt = normalizeIsoTimestamp(input.endAt)

  if (startAt && endAt && startAt > endAt) {
    return {
      startAt: endAt,
      endAt: startAt,
    }
  }

  return {
    startAt,
    endAt,
  }
}

function normalizeIsoTimestamp(value?: string | null) {
  const trimmed = value?.trim()
  if (!trimmed) {
    return null
  }

  const parsed = new Date(trimmed)
  if (Number.isNaN(parsed.getTime())) {
    return null
  }

  return parsed.toISOString()
}
