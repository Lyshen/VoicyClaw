import { randomUUID } from "node:crypto"
import type {
  AllowanceEntryType,
  BillingFeature,
  BillingMetric,
  BillingRateRecord,
  UsageEventRecord,
  UsageStatus,
  WorkspaceAllowanceLedgerEntry,
  WorkspaceAllowanceSummary,
  WorkspaceUsageSummary,
} from "../types"
import { db } from "./client"
import "./schema"
import { normalizeOptionalString } from "./shared"

const upsertBillingRateStatement = db.prepare(`
  INSERT INTO billing_rates (
    id,
    feature,
    provider_id,
    billing_metric,
    unit_size,
    retail_credits_millis,
    provider_cost_usd_micros,
    is_active,
    created_at,
    updated_at
  )
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT (feature, provider_id, billing_metric) DO UPDATE SET
    unit_size = excluded.unit_size,
    retail_credits_millis = excluded.retail_credits_millis,
    provider_cost_usd_micros = excluded.provider_cost_usd_micros,
    is_active = excluded.is_active,
    updated_at = excluded.updated_at
`)

const selectActiveBillingRateByFeatureAndProviderStatement = db.prepare(`
  SELECT
    id,
    feature,
    provider_id AS providerId,
    billing_metric AS billingMetric,
    unit_size AS unitSize,
    retail_credits_millis AS retailCreditsMillis,
    provider_cost_usd_micros AS providerCostUsdMicros,
    is_active AS isActive,
    created_at AS createdAt,
    updated_at AS updatedAt
  FROM billing_rates
  WHERE feature = ? AND provider_id = ? AND is_active = 1
  LIMIT 1
`)

const insertUsageEventStatement = db.prepare(`
  INSERT INTO usage_events (
    id,
    workspace_id,
    project_id,
    channel_id,
    request_id,
    feature,
    provider_id,
    status,
    input_chars,
    output_audio_bytes,
    output_audio_ms,
    billing_rate_id,
    charged_credits_millis,
    estimated_provider_cost_usd_micros,
    error_message,
    created_at
  )
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`)

const insertWorkspaceAllowanceLedgerStatement = db.prepare(`
  INSERT INTO workspace_allowance_ledger (
    id,
    workspace_id,
    entry_type,
    source_type,
    source_id,
    credits_delta_millis,
    note,
    created_at
  )
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`)

const ensureWorkspaceAllowanceLedgerStatement = db.prepare(`
  INSERT INTO workspace_allowance_ledger (
    id,
    workspace_id,
    entry_type,
    source_type,
    source_id,
    credits_delta_millis,
    note,
    created_at
  )
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT (workspace_id, source_type, source_id) DO NOTHING
`)

const selectWorkspaceAllowanceSummaryStatement = db.prepare(`
  SELECT
    COALESCE(SUM(CASE WHEN credits_delta_millis > 0 THEN credits_delta_millis ELSE 0 END), 0) AS grantedCreditsMillis,
    COALESCE(SUM(CASE WHEN credits_delta_millis < 0 THEN -credits_delta_millis ELSE 0 END), 0) AS usedCreditsMillis,
    COALESCE(SUM(credits_delta_millis), 0) AS remainingCreditsMillis
  FROM workspace_allowance_ledger
  WHERE workspace_id = ?
`)

const selectWorkspaceUsageSummaryStatement = db.prepare(`
  SELECT
    COUNT(*) AS totalEvents,
    COALESCE(SUM(CASE WHEN status = 'succeeded' THEN 1 ELSE 0 END), 0) AS successCount,
    COALESCE(SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END), 0) AS failureCount,
    COALESCE(SUM(input_chars), 0) AS inputChars,
    COALESCE(SUM(output_audio_ms), 0) AS outputAudioMs,
    COALESCE(SUM(charged_credits_millis), 0) AS chargedCreditsMillis
  FROM usage_events
  WHERE workspace_id = ? AND feature = ?
`)

const selectWorkspaceUsageEventsStatement = db.prepare(`
  SELECT
    id,
    workspace_id AS workspaceId,
    project_id AS projectId,
    channel_id AS channelId,
    request_id AS requestId,
    feature,
    provider_id AS providerId,
    status,
    input_chars AS inputChars,
    output_audio_bytes AS outputAudioBytes,
    output_audio_ms AS outputAudioMs,
    billing_rate_id AS billingRateId,
    charged_credits_millis AS chargedCreditsMillis,
    estimated_provider_cost_usd_micros AS estimatedProviderCostUsdMicros,
    error_message AS errorMessage,
    created_at AS createdAt
  FROM usage_events
  WHERE workspace_id = ?
  ORDER BY created_at DESC
  LIMIT ?
`)

export function upsertBillingRate(input: {
  id: string
  feature: BillingFeature
  providerId: string
  billingMetric: BillingMetric
  unitSize: number
  retailCreditsMillis: number
  providerCostUsdMicros?: number | null
  isActive?: boolean
}) {
  const existing = findActiveBillingRate(input.feature, input.providerId)
  const now = new Date().toISOString()

  upsertBillingRateStatement.run(
    input.id,
    input.feature,
    input.providerId,
    input.billingMetric,
    input.unitSize,
    input.retailCreditsMillis,
    input.providerCostUsdMicros ?? null,
    input.isActive === false ? 0 : 1,
    existing?.createdAt ?? now,
    now,
  )
}

export function findActiveBillingRate(
  feature: BillingFeature,
  providerId: string,
) {
  const record = selectActiveBillingRateByFeatureAndProviderStatement.get(
    feature,
    providerId,
  ) as BillingRateRecord | undefined

  if (!record) {
    return undefined
  }

  return {
    ...record,
    isActive: Boolean(record.isActive),
  }
}

export function createUsageEvent(input: {
  workspaceId?: string | null
  projectId?: string | null
  channelId: string
  requestId: string
  feature: BillingFeature
  providerId: string
  status: UsageStatus
  inputChars?: number
  outputAudioBytes?: number
  outputAudioMs?: number
  billingRateId?: string | null
  chargedCreditsMillis?: number
  estimatedProviderCostUsdMicros?: number | null
  errorMessage?: string | null
}) {
  const record: UsageEventRecord = {
    id: randomUUID(),
    workspaceId: input.workspaceId ?? null,
    projectId: input.projectId ?? null,
    channelId: input.channelId,
    requestId: input.requestId,
    feature: input.feature,
    providerId: input.providerId,
    status: input.status,
    inputChars: input.inputChars ?? 0,
    outputAudioBytes: input.outputAudioBytes ?? 0,
    outputAudioMs: input.outputAudioMs ?? 0,
    billingRateId: input.billingRateId ?? null,
    chargedCreditsMillis: input.chargedCreditsMillis ?? 0,
    estimatedProviderCostUsdMicros:
      input.estimatedProviderCostUsdMicros ?? null,
    errorMessage: normalizeOptionalString(input.errorMessage),
    createdAt: new Date().toISOString(),
  }

  insertUsageEventStatement.run(
    record.id,
    record.workspaceId,
    record.projectId,
    record.channelId,
    record.requestId,
    record.feature,
    record.providerId,
    record.status,
    record.inputChars,
    record.outputAudioBytes,
    record.outputAudioMs,
    record.billingRateId,
    record.chargedCreditsMillis,
    record.estimatedProviderCostUsdMicros,
    record.errorMessage,
    record.createdAt,
  )

  return record
}

export function createWorkspaceAllowanceLedgerEntry(input: {
  workspaceId: string
  entryType: AllowanceEntryType
  sourceType: string
  sourceId: string
  creditsDeltaMillis: number
  note?: string | null
}) {
  const record: WorkspaceAllowanceLedgerEntry = {
    id: randomUUID(),
    workspaceId: input.workspaceId,
    entryType: input.entryType,
    sourceType: input.sourceType,
    sourceId: input.sourceId,
    creditsDeltaMillis: input.creditsDeltaMillis,
    note: normalizeOptionalString(input.note),
    createdAt: new Date().toISOString(),
  }

  insertWorkspaceAllowanceLedgerStatement.run(
    record.id,
    record.workspaceId,
    record.entryType,
    record.sourceType,
    record.sourceId,
    record.creditsDeltaMillis,
    record.note,
    record.createdAt,
  )

  return record
}

export function ensureWorkspaceAllowanceLedgerEntry(input: {
  workspaceId: string
  entryType: AllowanceEntryType
  sourceType: string
  sourceId: string
  creditsDeltaMillis: number
  note?: string | null
}) {
  ensureWorkspaceAllowanceLedgerStatement.run(
    randomUUID(),
    input.workspaceId,
    input.entryType,
    input.sourceType,
    input.sourceId,
    input.creditsDeltaMillis,
    normalizeOptionalString(input.note),
    new Date().toISOString(),
  )
}

export function getWorkspaceAllowanceSummary(workspaceId: string) {
  const summary = selectWorkspaceAllowanceSummaryStatement.get(workspaceId) as
    | WorkspaceAllowanceSummary
    | undefined

  return {
    grantedCreditsMillis: Number(summary?.grantedCreditsMillis ?? 0),
    usedCreditsMillis: Number(summary?.usedCreditsMillis ?? 0),
    remainingCreditsMillis: Number(summary?.remainingCreditsMillis ?? 0),
  } satisfies WorkspaceAllowanceSummary
}

export function getWorkspaceUsageSummary(
  workspaceId: string,
  feature: BillingFeature,
) {
  const summary = selectWorkspaceUsageSummaryStatement.get(
    workspaceId,
    feature,
  ) as WorkspaceUsageSummary | undefined

  return {
    totalEvents: Number(summary?.totalEvents ?? 0),
    successCount: Number(summary?.successCount ?? 0),
    failureCount: Number(summary?.failureCount ?? 0),
    inputChars: Number(summary?.inputChars ?? 0),
    outputAudioMs: Number(summary?.outputAudioMs ?? 0),
    chargedCreditsMillis: Number(summary?.chargedCreditsMillis ?? 0),
  } satisfies WorkspaceUsageSummary
}

export function listWorkspaceUsageEvents(workspaceId: string, limit = 20) {
  return selectWorkspaceUsageEventsStatement.all(
    workspaceId,
    limit,
  ) as unknown as UsageEventRecord[]
}
