import {
  type BillingFeature,
  type BillingMetric,
  storage,
  type UsageEventRecord,
} from "../../storage"

const STARTER_PREVIEW_ALLOWANCE_SOURCE = "starter-preview"
const STARTER_PREVIEW_ALLOWANCE_VERSION = "starter-preview-v1"
const STARTER_PREVIEW_ALLOWANCE_LABEL = "Free preview allowance"
const STARTER_PREVIEW_ALLOWANCE_STATUS = "preview" as const
const STARTER_PREVIEW_ALLOWANCE_CURRENCY = "voice-credits" as const
const STARTER_PREVIEW_ALLOWANCE_CREDITS_MILLIS = 500_000
const BILLING_DISABLED_NOTE = "Billing is not enforced yet."

type BillingRateSeed = {
  providerId: string
  billingMetric: BillingMetric
  unitSize: number
  retailCreditsMillis: number
  providerCostUsdMicros?: number | null
}

type TtsUsageStatus = "succeeded" | "failed"

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

const DEFAULT_TTS_BILLING_RATES: BillingRateSeed[] = [
  {
    providerId: "demo",
    billingMetric: "input_chars",
    unitSize: 1_000_000,
    retailCreditsMillis: 10_000,
    providerCostUsdMicros: 0,
  },
  {
    providerId: "volcengine-tts",
    billingMetric: "input_chars",
    unitSize: 1_000_000,
    retailCreditsMillis: 16_000,
  },
  {
    providerId: "azure-tts",
    billingMetric: "input_chars",
    unitSize: 1_000_000,
    retailCreditsMillis: 16_000,
  },
  {
    providerId: "azure-streaming-tts",
    billingMetric: "input_chars",
    unitSize: 1_000_000,
    retailCreditsMillis: 18_000,
  },
  {
    providerId: "google-tts",
    billingMetric: "input_chars",
    unitSize: 1_000_000,
    retailCreditsMillis: 30_000,
  },
  {
    providerId: "google-batched-tts",
    billingMetric: "input_chars",
    unitSize: 1_000_000,
    retailCreditsMillis: 16_000,
  },
  {
    providerId: "tencent-tts",
    billingMetric: "input_chars",
    unitSize: 1_000_000,
    retailCreditsMillis: 16_000,
  },
  {
    providerId: "tencent-streaming-tts",
    billingMetric: "input_chars",
    unitSize: 1_000_000,
    retailCreditsMillis: 18_000,
  },
]

let billingRatesSeeded = false

export function formatCreditsMillis(value: number) {
  return (value / 1000).toFixed(3)
}

export function ensureStarterPreviewAllowance(workspaceId: string) {
  ensurePreviewBillingRates()
  storage.allowanceLedger.ensureEntry({
    workspaceId,
    entryType: "grant",
    sourceType: STARTER_PREVIEW_ALLOWANCE_SOURCE,
    sourceId: STARTER_PREVIEW_ALLOWANCE_VERSION,
    creditsDeltaMillis: STARTER_PREVIEW_ALLOWANCE_CREDITS_MILLIS,
    note: "Starter preview allowance grant",
  })
}

export function buildHostedAllowanceSnapshot(
  workspaceId: string,
): HostedAllowanceSnapshot {
  const summary = storage.allowanceLedger.summarizeByWorkspace(workspaceId)

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

export function getWorkspaceBillingSummary(workspaceId: string) {
  ensurePreviewBillingRates()

  const workspace = storage.workspaces.findById(workspaceId)
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

  const ownership = storage.projects.findByChannelId(input.channelId)
  const rate = storage.billingRates.findActive("tts", input.providerId)
  const chargedCreditsMillis =
    input.status === "succeeded"
      ? calculateCharge(
          rate?.billingMetric ?? "input_chars",
          rate?.unitSize ?? 0,
          rate?.retailCreditsMillis ?? 0,
          {
            inputChars: input.inputChars,
            outputAudioMs: input.outputAudioMs ?? 0,
          },
        )
      : 0
  const estimatedProviderCostUsdMicros =
    input.status === "succeeded"
      ? calculateCharge(
          rate?.billingMetric ?? "input_chars",
          rate?.unitSize ?? 0,
          rate?.providerCostUsdMicros ?? 0,
          {
            inputChars: input.inputChars,
            outputAudioMs: input.outputAudioMs ?? 0,
          },
        )
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

function ensurePreviewBillingRates() {
  if (billingRatesSeeded) {
    return
  }

  for (const rate of DEFAULT_TTS_BILLING_RATES) {
    storage.billingRates.upsert({
      id: buildBillingRateId("tts", rate.providerId, rate.billingMetric),
      feature: "tts",
      providerId: rate.providerId,
      billingMetric: rate.billingMetric,
      unitSize: rate.unitSize,
      retailCreditsMillis: rate.retailCreditsMillis,
      providerCostUsdMicros: rate.providerCostUsdMicros ?? null,
    })
  }

  billingRatesSeeded = true
}

function buildStarterPreviewAllowanceNote(remainingCreditsMillis: number) {
  return `Starter preview allowance is active. ${formatCreditsMillis(
    remainingCreditsMillis,
  )} voice credits remaining. ${BILLING_DISABLED_NOTE}`
}

function buildBillingRateId(
  feature: BillingFeature,
  providerId: string,
  billingMetric: BillingMetric,
) {
  return `rate-${feature}-${providerId}-${billingMetric.replace(/_/g, "-")}`
}

function calculateCharge(
  billingMetric: BillingMetric,
  unitSize: number,
  amountPerUnitBlock: number,
  usage: {
    inputChars: number
    outputAudioMs: number
  },
) {
  if (unitSize <= 0 || amountPerUnitBlock <= 0) {
    return 0
  }

  const measuredUnits =
    billingMetric === "output_audio_ms" ? usage.outputAudioMs : usage.inputChars
  if (measuredUnits <= 0) {
    return 0
  }

  return Math.ceil((measuredUnits * amountPerUnitBlock) / unitSize)
}
