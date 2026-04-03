import { randomUUID } from "node:crypto"
import { mkdirSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { DatabaseSync } from "node:sqlite"

export type AuthProvider = "clerk"
export type ProjectType = "starter" | "standard"
export type PlatformKeyType = "starter" | "standard"
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

const databaseFile =
  process.env.VOICYCLAW_SQLITE_FILE?.trim() ||
  resolve(process.cwd(), ".data", "voicyclaw.sqlite")

mkdirSync(dirname(databaseFile), { recursive: true })

const db = new DatabaseSync(databaseFile)

db.exec(`
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    display_name TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS user_identities (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    provider TEXT NOT NULL,
    provider_subject TEXT NOT NULL,
    email TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE UNIQUE INDEX IF NOT EXISTS user_identities_provider_subject_idx
  ON user_identities(provider, provider_subject);

  CREATE TABLE IF NOT EXISTS workspaces (
    id TEXT PRIMARY KEY,
    owner_user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    is_default INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE UNIQUE INDEX IF NOT EXISTS workspaces_default_owner_idx
  ON workspaces(owner_user_id)
  WHERE is_default = 1;

  CREATE TABLE IF NOT EXISTS channels (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    name TEXT NOT NULL,
    project_type TEXT NOT NULL,
    channel_id TEXT NOT NULL UNIQUE,
    bot_id TEXT NOT NULL,
    display_name TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
    FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE
  );

  CREATE UNIQUE INDEX IF NOT EXISTS projects_starter_workspace_idx
  ON projects(workspace_id)
  WHERE project_type = 'starter';

  CREATE TABLE IF NOT EXISTS platform_keys (
    id TEXT PRIMARY KEY,
    token TEXT NOT NULL UNIQUE,
    label TEXT,
    channel_id TEXT NOT NULL,
    workspace_id TEXT,
    project_id TEXT,
    key_type TEXT NOT NULL DEFAULT 'standard',
    created_by_user_id TEXT,
    created_at TEXT NOT NULL,
    last_used_at TEXT,
    FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS bot_registrations (
    id TEXT PRIMARY KEY,
    bot_id TEXT NOT NULL,
    bot_name TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    platform_key_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    last_connected_at TEXT,
    UNIQUE (bot_id, channel_id),
    FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE,
    FOREIGN KEY (platform_key_id) REFERENCES platform_keys(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS billing_rates (
    id TEXT PRIMARY KEY,
    feature TEXT NOT NULL,
    provider_id TEXT NOT NULL,
    billing_metric TEXT NOT NULL,
    unit_size INTEGER NOT NULL,
    retail_credits_millis INTEGER NOT NULL,
    provider_cost_usd_micros INTEGER,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE UNIQUE INDEX IF NOT EXISTS billing_rates_feature_provider_metric_idx
  ON billing_rates(feature, provider_id, billing_metric);

  CREATE TABLE IF NOT EXISTS usage_events (
    id TEXT PRIMARY KEY,
    workspace_id TEXT,
    project_id TEXT,
    channel_id TEXT NOT NULL,
    request_id TEXT NOT NULL,
    feature TEXT NOT NULL,
    provider_id TEXT NOT NULL,
    status TEXT NOT NULL,
    input_chars INTEGER NOT NULL DEFAULT 0,
    output_audio_bytes INTEGER NOT NULL DEFAULT 0,
    output_audio_ms INTEGER NOT NULL DEFAULT 0,
    billing_rate_id TEXT,
    charged_credits_millis INTEGER NOT NULL DEFAULT 0,
    estimated_provider_cost_usd_micros INTEGER,
    error_message TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE SET NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
    FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE,
    FOREIGN KEY (billing_rate_id) REFERENCES billing_rates(id) ON DELETE SET NULL
  );

  CREATE INDEX IF NOT EXISTS usage_events_workspace_created_idx
  ON usage_events(workspace_id, created_at DESC);

  CREATE INDEX IF NOT EXISTS usage_events_channel_created_idx
  ON usage_events(channel_id, created_at DESC);

  CREATE TABLE IF NOT EXISTS workspace_allowance_ledger (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    entry_type TEXT NOT NULL,
    source_type TEXT NOT NULL,
    source_id TEXT NOT NULL,
    credits_delta_millis INTEGER NOT NULL,
    note TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
  );

  CREATE UNIQUE INDEX IF NOT EXISTS workspace_allowance_source_idx
  ON workspace_allowance_ledger(workspace_id, source_type, source_id);

  CREATE INDEX IF NOT EXISTS workspace_allowance_created_idx
  ON workspace_allowance_ledger(workspace_id, created_at DESC);
`)

ensureColumn("platform_keys", "workspace_id", "TEXT")
ensureColumn("platform_keys", "project_id", "TEXT")
ensureColumn("platform_keys", "key_type", "TEXT NOT NULL DEFAULT 'standard'")
ensureColumn("platform_keys", "created_by_user_id", "TEXT")

db.exec(`
  CREATE INDEX IF NOT EXISTS platform_keys_project_type_idx
  ON platform_keys(project_id, key_type);
`)

const upsertChannelStatement = db.prepare(`
  INSERT INTO channels (id, name, created_at, updated_at)
  VALUES (?, ?, ?, ?)
  ON CONFLICT (id) DO UPDATE SET
    name = excluded.name,
    updated_at = excluded.updated_at
`)

const insertPlatformKeyStatement = db.prepare(`
  INSERT INTO platform_keys (
    id,
    token,
    label,
    channel_id,
    workspace_id,
    project_id,
    key_type,
    created_by_user_id,
    created_at,
    last_used_at
  )
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`)

const insertUserStatement = db.prepare(`
  INSERT INTO users (id, display_name, created_at, updated_at)
  VALUES (?, ?, ?, ?)
`)

const updateUserStatement = db.prepare(`
  UPDATE users
  SET display_name = ?, updated_at = ?
  WHERE id = ?
`)

const selectIdentityByProviderStatement = db.prepare(`
  SELECT
    id,
    user_id AS userId,
    provider,
    provider_subject AS providerSubject,
    email,
    created_at AS createdAt,
    updated_at AS updatedAt
  FROM user_identities
  WHERE provider = ? AND provider_subject = ?
  LIMIT 1
`)

const insertIdentityStatement = db.prepare(`
  INSERT INTO user_identities (
    id,
    user_id,
    provider,
    provider_subject,
    email,
    created_at,
    updated_at
  )
  VALUES (?, ?, ?, ?, ?, ?, ?)
`)

const updateIdentityStatement = db.prepare(`
  UPDATE user_identities
  SET email = ?, updated_at = ?
  WHERE id = ?
`)

const selectUserByIdStatement = db.prepare(`
  SELECT
    id,
    display_name AS displayName,
    created_at AS createdAt,
    updated_at AS updatedAt
  FROM users
  WHERE id = ?
  LIMIT 1
`)

const selectDefaultWorkspaceByOwnerStatement = db.prepare(`
  SELECT
    id,
    owner_user_id AS ownerUserId,
    name,
    is_default AS isDefault,
    created_at AS createdAt,
    updated_at AS updatedAt
  FROM workspaces
  WHERE owner_user_id = ? AND is_default = 1
  LIMIT 1
`)

const insertWorkspaceStatement = db.prepare(`
  INSERT INTO workspaces (
    id,
    owner_user_id,
    name,
    is_default,
    created_at,
    updated_at
  )
  VALUES (?, ?, ?, ?, ?, ?)
`)

const selectStarterProjectByWorkspaceStatement = db.prepare(`
  SELECT
    id,
    workspace_id AS workspaceId,
    name,
    project_type AS projectType,
    channel_id AS channelId,
    bot_id AS botId,
    display_name AS displayName,
    created_at AS createdAt,
    updated_at AS updatedAt
  FROM projects
  WHERE workspace_id = ? AND project_type = 'starter'
  LIMIT 1
`)

const selectProjectByChannelStatement = db.prepare(`
  SELECT
    id,
    workspace_id AS workspaceId,
    name,
    project_type AS projectType,
    channel_id AS channelId,
    bot_id AS botId,
    display_name AS displayName,
    created_at AS createdAt,
    updated_at AS updatedAt
  FROM projects
  WHERE channel_id = ?
  LIMIT 1
`)

const insertProjectStatement = db.prepare(`
  INSERT INTO projects (
    id,
    workspace_id,
    name,
    project_type,
    channel_id,
    bot_id,
    display_name,
    created_at,
    updated_at
  )
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`)

const selectPlatformKeyByProjectAndTypeStatement = db.prepare(`
  SELECT
    id,
    token,
    label,
    channel_id AS channelId,
    workspace_id AS workspaceId,
    project_id AS projectId,
    key_type AS keyType,
    created_by_user_id AS createdByUserId,
    created_at AS createdAt,
    last_used_at AS lastUsedAt
  FROM platform_keys
  WHERE project_id = ? AND key_type = ?
  LIMIT 1
`)

const selectPlatformKeyByTokenStatement = db.prepare(`
  SELECT
    id,
    token,
    label,
    channel_id AS channelId,
    workspace_id AS workspaceId,
    project_id AS projectId,
    key_type AS keyType,
    created_by_user_id AS createdByUserId,
    created_at AS createdAt,
    last_used_at AS lastUsedAt
  FROM platform_keys
  WHERE token = ?
  LIMIT 1
`)

const selectWorkspaceByIdStatement = db.prepare(`
  SELECT
    id,
    owner_user_id AS ownerUserId,
    name,
    is_default AS isDefault,
    created_at AS createdAt,
    updated_at AS updatedAt
  FROM workspaces
  WHERE id = ?
  LIMIT 1
`)

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

const touchPlatformKeyStatement = db.prepare(`
  UPDATE platform_keys
  SET last_used_at = ?
  WHERE id = ?
`)

const upsertBotRegistrationStatement = db.prepare(`
  INSERT INTO bot_registrations (
    id,
    bot_id,
    bot_name,
    channel_id,
    platform_key_id,
    created_at,
    updated_at,
    last_connected_at
  )
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT (bot_id, channel_id) DO UPDATE SET
    bot_name = excluded.bot_name,
    platform_key_id = excluded.platform_key_id,
    updated_at = excluded.updated_at,
    last_connected_at = excluded.last_connected_at
`)

export function ensureChannel(channelId: string, name: string) {
  const now = new Date().toISOString()
  upsertChannelStatement.run(channelId, name, now, now)
}

export function upsertUserForIdentity(input: {
  provider: AuthProvider
  providerSubject: string
  email?: string | null
  displayName?: string | null
}) {
  const normalizedProviderSubject = input.providerSubject.trim()
  const normalizedEmail = normalizeOptionalString(input.email)
  const normalizedDisplayName = normalizeOptionalString(input.displayName)
  const now = new Date().toISOString()
  const existingIdentity = selectIdentityByProviderStatement.get(
    input.provider,
    normalizedProviderSubject,
  ) as UserIdentityRecord | undefined

  if (existingIdentity) {
    const user = selectUserById(existingIdentity.userId)
    if (!user) {
      throw new Error(
        `VoicyClaw found identity ${existingIdentity.id} without a user.`,
      )
    }

    if (normalizedDisplayName !== user.displayName) {
      updateUserStatement.run(normalizedDisplayName, now, user.id)
    }

    if (normalizedEmail !== existingIdentity.email) {
      updateIdentityStatement.run(normalizedEmail, now, existingIdentity.id)
    }

    return {
      user: selectUserById(user.id) ?? user,
      identity: {
        ...existingIdentity,
        email: normalizedEmail,
        updatedAt: now,
      } satisfies UserIdentityRecord,
    }
  }

  const user: UserRecord = {
    id: randomUUID(),
    displayName: normalizedDisplayName,
    createdAt: now,
    updatedAt: now,
  }

  insertUserStatement.run(
    user.id,
    user.displayName,
    user.createdAt,
    user.updatedAt,
  )

  const identity: UserIdentityRecord = {
    id: randomUUID(),
    userId: user.id,
    provider: input.provider,
    providerSubject: normalizedProviderSubject,
    email: normalizedEmail,
    createdAt: now,
    updatedAt: now,
  }

  insertIdentityStatement.run(
    identity.id,
    identity.userId,
    identity.provider,
    identity.providerSubject,
    identity.email,
    identity.createdAt,
    identity.updatedAt,
  )

  return {
    user,
    identity,
  }
}

export function findDefaultWorkspaceByOwnerUserId(ownerUserId: string) {
  return selectDefaultWorkspaceByOwnerStatement.get(ownerUserId) as
    | WorkspaceRecord
    | undefined
}

export function findWorkspaceById(id: string) {
  return selectWorkspaceByIdStatement.get(id) as WorkspaceRecord | undefined
}

export function createWorkspace(input: {
  ownerUserId: string
  name: string
  isDefault?: boolean
}) {
  const now = new Date().toISOString()
  const workspace: WorkspaceRecord = {
    id: randomUUID(),
    ownerUserId: input.ownerUserId,
    name: input.name.trim(),
    isDefault: input.isDefault ?? false,
    createdAt: now,
    updatedAt: now,
  }

  insertWorkspaceStatement.run(
    workspace.id,
    workspace.ownerUserId,
    workspace.name,
    workspace.isDefault ? 1 : 0,
    workspace.createdAt,
    workspace.updatedAt,
  )

  return workspace
}

export function findStarterProjectByWorkspaceId(workspaceId: string) {
  return selectStarterProjectByWorkspaceStatement.get(workspaceId) as
    | ProjectRecord
    | undefined
}

export function findProjectByChannelId(channelId: string) {
  return selectProjectByChannelStatement.get(channelId) as
    | ProjectRecord
    | undefined
}

export function createProject(input: {
  workspaceId: string
  name: string
  projectType: ProjectType
  channelId: string
  botId: string
  displayName: string
}) {
  const now = new Date().toISOString()
  const project: ProjectRecord = {
    id: randomUUID(),
    workspaceId: input.workspaceId,
    name: input.name.trim(),
    projectType: input.projectType,
    channelId: input.channelId.trim(),
    botId: input.botId.trim(),
    displayName: input.displayName.trim(),
    createdAt: now,
    updatedAt: now,
  }

  insertProjectStatement.run(
    project.id,
    project.workspaceId,
    project.name,
    project.projectType,
    project.channelId,
    project.botId,
    project.displayName,
    project.createdAt,
    project.updatedAt,
  )

  return project
}

export function findPlatformKeyByProjectIdAndType(
  projectId: string,
  keyType: PlatformKeyType,
) {
  return selectPlatformKeyByProjectAndTypeStatement.get(projectId, keyType) as
    | PlatformKeyRecord
    | undefined
}

export function createPlatformKey(
  channelId: string,
  label?: string | null,
  options?: {
    workspaceId?: string | null
    projectId?: string | null
    keyType?: PlatformKeyType
    createdByUserId?: string | null
  },
) {
  const now = new Date().toISOString()
  const keyType = options?.keyType ?? "standard"
  const prefix = keyType === "starter" ? "vcs_" : "vc_"
  const record: PlatformKeyRecord = {
    id: randomUUID(),
    token: `${prefix}${randomUUID().replace(/-/g, "")}`,
    label: label?.trim() || "Prototype key",
    channelId,
    workspaceId: options?.workspaceId ?? null,
    projectId: options?.projectId ?? null,
    keyType,
    createdByUserId: options?.createdByUserId ?? null,
    createdAt: now,
    lastUsedAt: null,
  }

  insertPlatformKeyStatement.run(
    record.id,
    record.token,
    record.label,
    record.channelId,
    record.workspaceId,
    record.projectId,
    record.keyType,
    record.createdByUserId,
    record.createdAt,
    record.lastUsedAt,
  )

  return record
}

export function findPlatformKeyByToken(token: string) {
  return selectPlatformKeyByTokenStatement.get(token) as
    | PlatformKeyRecord
    | undefined
}

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

export function touchPlatformKey(id: string) {
  touchPlatformKeyStatement.run(new Date().toISOString(), id)
}

export function upsertBotRegistration(input: {
  botId: string
  botName: string
  channelId: string
  platformKeyId: string
  lastConnectedAt?: string
}) {
  const now = new Date().toISOString()
  upsertBotRegistrationStatement.run(
    randomUUID(),
    input.botId,
    input.botName,
    input.channelId,
    input.platformKeyId,
    now,
    now,
    input.lastConnectedAt ?? null,
  )
}

export function getDatabaseFile() {
  return databaseFile
}

function selectUserById(id: string) {
  return selectUserByIdStatement.get(id) as UserRecord | undefined
}

function normalizeOptionalString(value: string | null | undefined) {
  if (typeof value !== "string") {
    return null
  }

  const normalized = value.trim()
  return normalized || null
}

function ensureColumn(
  tableName: string,
  columnName: string,
  definition: string,
) {
  const columns = db.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{
    name?: string
  }>

  if (columns.some((column) => column.name === columnName)) {
    return
  }

  db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`)
}
