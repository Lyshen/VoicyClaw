import { type BillingFeature, type BillingMetric, storage } from "../../storage"

type BillingRateSeed = {
  providerId: string
  billingMetric: BillingMetric
  unitSize: number
  retailCreditsMillis: number
  providerCostUsdMicros?: number | null
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
let billingRatesSeedPromise: Promise<void> | undefined

export async function ensurePreviewBillingRates() {
  if (billingRatesSeeded) {
    return
  }

  if (!billingRatesSeedPromise) {
    billingRatesSeedPromise = (async () => {
      for (const rate of DEFAULT_TTS_BILLING_RATES) {
        await storage.billingRates.upsert({
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
    })()
  }

  await billingRatesSeedPromise
}

export function calculateCharge(input: {
  billingMetric: BillingMetric
  unitSize: number
  amountPerUnitBlock: number
  inputChars: number
  outputAudioMs: number
}) {
  if (input.unitSize <= 0 || input.amountPerUnitBlock <= 0) {
    return 0
  }

  const measuredUnits =
    input.billingMetric === "output_audio_ms"
      ? input.outputAudioMs
      : input.inputChars
  if (measuredUnits <= 0) {
    return 0
  }

  return Math.ceil((measuredUnits * input.amountPerUnitBlock) / input.unitSize)
}

function buildBillingRateId(
  feature: BillingFeature,
  providerId: string,
  billingMetric: BillingMetric,
) {
  return `rate-${feature}-${providerId}-${billingMetric.replace(/_/g, "-")}`
}
