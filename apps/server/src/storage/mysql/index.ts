import { randomUUID } from "node:crypto"
import { resolveStorageConfig } from "@voicyclaw/config"
import mysql, {
  type Pool,
  type PoolConnection,
  type RowDataPacket,
} from "mysql2/promise"
import type {
  AllowanceEntryType,
  AuthProvider,
  BillingFeature,
  BillingMetric,
  BillingRateRecord,
  PlatformKeyRecord,
  PlatformKeyType,
  ProjectRecord,
  ProjectType,
  UsageEventRecord,
  UsageStatus,
  UserIdentityRecord,
  UserRecord,
  WorkspaceAllowanceLedgerEntry,
  WorkspaceAllowanceSummary,
  WorkspaceRecord,
  WorkspaceUsageSummary,
} from "../types"

let pool: Pool | undefined
let initPromise: Promise<void> | undefined

function getMysqlUrl() {
  const mysqlUrl = resolveStorageConfig().mysqlUrl
  if (!mysqlUrl) {
    throw new Error(
      "VoicyClaw MySQL storage requires VOICYCLAW_MYSQL_URL to be set.",
    )
  }

  return mysqlUrl
}

function getPool() {
  if (!pool) {
    const storageConfig = resolveStorageConfig()
    pool = mysql.createPool({
      uri: getMysqlUrl(),
      connectionLimit: storageConfig.mysqlPoolSize,
      supportBigNumbers: true,
    })
  }

  return pool
}

export async function initStorage() {
  if (!initPromise) {
    initPromise = initializeMysqlStorage()
  }

  await initPromise
}

export async function closeStorage() {
  if (!pool) {
    return
  }

  const activePool = pool
  pool = undefined
  initPromise = undefined
  await activePool.end()
}

export function describeStorageTarget() {
  try {
    const url = new URL(getMysqlUrl())
    const database = url.pathname.replace(/^\//, "") || "(default)"
    return `MySQL ready at ${url.hostname}/${database}`
  } catch {
    return "MySQL ready"
  }
}

async function initializeMysqlStorage() {
  const connection = await getPool().getConnection()

  try {
    await connection.query(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(36) PRIMARY KEY,
        display_name VARCHAR(255) NULL,
        created_at VARCHAR(40) NOT NULL,
        updated_at VARCHAR(40) NOT NULL
      )
    `)

    await connection.query(`
      CREATE TABLE IF NOT EXISTS user_identities (
        id VARCHAR(36) PRIMARY KEY,
        user_id VARCHAR(36) NOT NULL,
        provider VARCHAR(32) NOT NULL,
        provider_subject VARCHAR(255) NOT NULL,
        email VARCHAR(320) NULL,
        created_at VARCHAR(40) NOT NULL,
        updated_at VARCHAR(40) NOT NULL,
        CONSTRAINT fk_user_identities_user
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE KEY user_identities_provider_subject_unique (provider, provider_subject)
      )
    `)

    await connection.query(`
      CREATE TABLE IF NOT EXISTS workspaces (
        id VARCHAR(36) PRIMARY KEY,
        owner_user_id VARCHAR(36) NOT NULL,
        name VARCHAR(255) NOT NULL,
        is_default TINYINT(1) NOT NULL DEFAULT 0,
        default_owner_key VARCHAR(36) NULL,
        created_at VARCHAR(40) NOT NULL,
        updated_at VARCHAR(40) NOT NULL,
        CONSTRAINT fk_workspaces_owner_user
          FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE KEY workspaces_default_owner_unique (default_owner_key)
      )
    `)

    await connection.query(`
      CREATE TABLE IF NOT EXISTS channels (
        id VARCHAR(191) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        created_at VARCHAR(40) NOT NULL,
        updated_at VARCHAR(40) NOT NULL
      )
    `)

    await connection.query(`
      CREATE TABLE IF NOT EXISTS projects (
        id VARCHAR(36) PRIMARY KEY,
        workspace_id VARCHAR(36) NOT NULL,
        name VARCHAR(255) NOT NULL,
        project_type VARCHAR(32) NOT NULL,
        channel_id VARCHAR(191) NOT NULL,
        bot_id VARCHAR(191) NOT NULL,
        display_name VARCHAR(255) NOT NULL,
        starter_workspace_key VARCHAR(36) NULL,
        created_at VARCHAR(40) NOT NULL,
        updated_at VARCHAR(40) NOT NULL,
        CONSTRAINT fk_projects_workspace
          FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
        CONSTRAINT fk_projects_channel
          FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE,
        UNIQUE KEY projects_channel_unique (channel_id),
        UNIQUE KEY projects_starter_workspace_unique (starter_workspace_key)
      )
    `)

    await connection.query(`
      CREATE TABLE IF NOT EXISTS platform_keys (
        id VARCHAR(36) PRIMARY KEY,
        token VARCHAR(64) NOT NULL,
        label VARCHAR(255) NULL,
        channel_id VARCHAR(191) NOT NULL,
        workspace_id VARCHAR(36) NULL,
        project_id VARCHAR(36) NULL,
        key_type VARCHAR(32) NOT NULL DEFAULT 'standard',
        created_by_user_id VARCHAR(36) NULL,
        created_at VARCHAR(40) NOT NULL,
        last_used_at VARCHAR(40) NULL,
        CONSTRAINT fk_platform_keys_channel
          FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE,
        UNIQUE KEY platform_keys_token_unique (token),
        KEY platform_keys_project_type_idx (project_id, key_type)
      )
    `)

    await connection.query(`
      CREATE TABLE IF NOT EXISTS bot_registrations (
        id VARCHAR(36) PRIMARY KEY,
        bot_id VARCHAR(191) NOT NULL,
        bot_name VARCHAR(255) NOT NULL,
        channel_id VARCHAR(191) NOT NULL,
        platform_key_id VARCHAR(36) NOT NULL,
        created_at VARCHAR(40) NOT NULL,
        updated_at VARCHAR(40) NOT NULL,
        last_connected_at VARCHAR(40) NULL,
        CONSTRAINT fk_bot_registrations_channel
          FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE,
        CONSTRAINT fk_bot_registrations_platform_key
          FOREIGN KEY (platform_key_id) REFERENCES platform_keys(id) ON DELETE CASCADE,
        UNIQUE KEY bot_registrations_bot_channel_unique (bot_id, channel_id)
      )
    `)

    await connection.query(`
      CREATE TABLE IF NOT EXISTS billing_rates (
        id VARCHAR(191) PRIMARY KEY,
        feature VARCHAR(64) NOT NULL,
        provider_id VARCHAR(64) NOT NULL,
        billing_metric VARCHAR(64) NOT NULL,
        unit_size INT NOT NULL,
        retail_credits_millis INT NOT NULL,
        provider_cost_usd_micros INT NULL,
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        created_at VARCHAR(40) NOT NULL,
        updated_at VARCHAR(40) NOT NULL,
        UNIQUE KEY billing_rates_feature_provider_metric_unique (feature, provider_id, billing_metric)
      )
    `)

    await connection.query(`
      CREATE TABLE IF NOT EXISTS usage_events (
        id VARCHAR(36) PRIMARY KEY,
        workspace_id VARCHAR(36) NULL,
        project_id VARCHAR(36) NULL,
        channel_id VARCHAR(191) NOT NULL,
        request_id VARCHAR(191) NOT NULL,
        feature VARCHAR(64) NOT NULL,
        provider_id VARCHAR(64) NOT NULL,
        status VARCHAR(32) NOT NULL,
        input_chars INT NOT NULL DEFAULT 0,
        output_audio_bytes INT NOT NULL DEFAULT 0,
        output_audio_ms INT NOT NULL DEFAULT 0,
        billing_rate_id VARCHAR(191) NULL,
        charged_credits_millis INT NOT NULL DEFAULT 0,
        estimated_provider_cost_usd_micros INT NULL,
        error_message TEXT NULL,
        created_at VARCHAR(40) NOT NULL,
        CONSTRAINT fk_usage_events_workspace
          FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE SET NULL,
        CONSTRAINT fk_usage_events_project
          FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
        CONSTRAINT fk_usage_events_channel
          FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE,
        CONSTRAINT fk_usage_events_billing_rate
          FOREIGN KEY (billing_rate_id) REFERENCES billing_rates(id) ON DELETE SET NULL,
        KEY usage_events_workspace_created_idx (workspace_id, created_at),
        KEY usage_events_channel_created_idx (channel_id, created_at)
      )
    `)

    await connection.query(`
      CREATE TABLE IF NOT EXISTS workspace_allowance_ledger (
        id VARCHAR(36) PRIMARY KEY,
        workspace_id VARCHAR(36) NOT NULL,
        entry_type VARCHAR(32) NOT NULL,
        source_type VARCHAR(64) NOT NULL,
        source_id VARCHAR(191) NOT NULL,
        credits_delta_millis INT NOT NULL,
        note TEXT NULL,
        created_at VARCHAR(40) NOT NULL,
        CONSTRAINT fk_workspace_allowance_workspace
          FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
        UNIQUE KEY workspace_allowance_source_unique (workspace_id, source_type, source_id),
        KEY workspace_allowance_created_idx (workspace_id, created_at)
      )
    `)
  } finally {
    connection.release()
  }
}

async function withConnection<T>(
  fn: (connection: PoolConnection) => Promise<T>,
) {
  await initStorage()
  const connection = await getPool().getConnection()

  try {
    return await fn(connection)
  } finally {
    connection.release()
  }
}

async function query<T extends RowDataPacket[] = RowDataPacket[]>(
  sql: string,
  params: unknown[] = [],
) {
  await initStorage()
  return await getPool().query<T>(sql, params)
}

function normalizeOptionalString(value: string | null | undefined) {
  if (typeof value !== "string") {
    return null
  }

  const normalized = value.trim()
  return normalized || null
}

function toBoolean(value: unknown) {
  return value === 1 || value === true
}

export async function ensureChannel(channelId: string, name: string) {
  const now = new Date().toISOString()
  await query(
    `
      INSERT INTO channels (id, name, created_at, updated_at)
      VALUES (?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        name = VALUES(name),
        updated_at = VALUES(updated_at)
    `,
    [channelId, name, now, now],
  )
}

export async function upsertUserForIdentity(input: {
  provider: AuthProvider
  providerSubject: string
  email?: string | null
  displayName?: string | null
}) {
  return await withConnection(async (connection) => {
    await connection.beginTransaction()

    try {
      const normalizedProviderSubject = input.providerSubject.trim()
      const normalizedEmail = normalizeOptionalString(input.email)
      const normalizedDisplayName = normalizeOptionalString(input.displayName)
      const now = new Date().toISOString()

      const [identityRows] = await connection.query<RowDataPacket[]>(
        `
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
        `,
        [input.provider, normalizedProviderSubject],
      )

      const existingIdentity = identityRows[0] as UserIdentityRecord | undefined

      if (existingIdentity) {
        const user = await selectUserById(connection, existingIdentity.userId)
        if (!user) {
          throw new Error(
            `VoicyClaw found identity ${existingIdentity.id} without a user.`,
          )
        }

        if (normalizedDisplayName !== user.displayName) {
          await connection.query(
            `
              UPDATE users
              SET display_name = ?, updated_at = ?
              WHERE id = ?
            `,
            [normalizedDisplayName, now, user.id],
          )
        }

        if (normalizedEmail !== existingIdentity.email) {
          await connection.query(
            `
              UPDATE user_identities
              SET email = ?, updated_at = ?
              WHERE id = ?
            `,
            [normalizedEmail, now, existingIdentity.id],
          )
        }

        await connection.commit()

        return {
          user: (await selectUserById(connection, user.id)) ?? user,
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

      await connection.query(
        `
          INSERT INTO users (id, display_name, created_at, updated_at)
          VALUES (?, ?, ?, ?)
        `,
        [user.id, user.displayName, user.createdAt, user.updatedAt],
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

      await connection.query(
        `
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
        `,
        [
          identity.id,
          identity.userId,
          identity.provider,
          identity.providerSubject,
          identity.email,
          identity.createdAt,
          identity.updatedAt,
        ],
      )

      await connection.commit()

      return {
        user,
        identity,
      }
    } catch (error) {
      await connection.rollback()
      throw error
    }
  })
}

export async function findDefaultWorkspaceByOwnerUserId(ownerUserId: string) {
  const [rows] = await query<RowDataPacket[]>(
    `
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
    `,
    [ownerUserId],
  )

  const record = rows[0] as WorkspaceRecord | undefined
  return record
    ? { ...record, isDefault: toBoolean(record.isDefault) }
    : undefined
}

export async function findWorkspaceById(id: string) {
  const [rows] = await query<RowDataPacket[]>(
    `
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
    `,
    [id],
  )

  const record = rows[0] as WorkspaceRecord | undefined
  return record
    ? { ...record, isDefault: toBoolean(record.isDefault) }
    : undefined
}

export async function createWorkspace(input: {
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

  await query(
    `
      INSERT INTO workspaces (
        id,
        owner_user_id,
        name,
        is_default,
        default_owner_key,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
    [
      workspace.id,
      workspace.ownerUserId,
      workspace.name,
      workspace.isDefault ? 1 : 0,
      workspace.isDefault ? workspace.ownerUserId : null,
      workspace.createdAt,
      workspace.updatedAt,
    ],
  )

  return workspace
}

export async function findStarterProjectByWorkspaceId(workspaceId: string) {
  const [rows] = await query<RowDataPacket[]>(
    `
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
    `,
    [workspaceId],
  )

  return rows[0] as ProjectRecord | undefined
}

export async function findProjectByChannelId(channelId: string) {
  const [rows] = await query<RowDataPacket[]>(
    `
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
    `,
    [channelId],
  )

  return rows[0] as ProjectRecord | undefined
}

export async function createProject(input: {
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

  await query(
    `
      INSERT INTO projects (
        id,
        workspace_id,
        name,
        project_type,
        channel_id,
        bot_id,
        display_name,
        starter_workspace_key,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      project.id,
      project.workspaceId,
      project.name,
      project.projectType,
      project.channelId,
      project.botId,
      project.displayName,
      project.projectType === "starter" ? project.workspaceId : null,
      project.createdAt,
      project.updatedAt,
    ],
  )

  return project
}

export async function findPlatformKeyByProjectIdAndType(
  projectId: string,
  keyType: PlatformKeyType,
) {
  const [rows] = await query<RowDataPacket[]>(
    `
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
    `,
    [projectId, keyType],
  )

  return rows[0] as PlatformKeyRecord | undefined
}

export async function createPlatformKey(
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

  await query(
    `
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
    `,
    [
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
    ],
  )

  return record
}

export async function findPlatformKeyByToken(token: string) {
  const [rows] = await query<RowDataPacket[]>(
    `
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
    `,
    [token],
  )

  return rows[0] as PlatformKeyRecord | undefined
}

export async function touchPlatformKey(id: string) {
  await query(
    `
      UPDATE platform_keys
      SET last_used_at = ?
      WHERE id = ?
    `,
    [new Date().toISOString(), id],
  )
}

export async function upsertBillingRate(input: {
  id: string
  feature: BillingFeature
  providerId: string
  billingMetric: BillingMetric
  unitSize: number
  retailCreditsMillis: number
  providerCostUsdMicros?: number | null
  isActive?: boolean
}) {
  const now = new Date().toISOString()

  await query(
    `
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
      ON DUPLICATE KEY UPDATE
        unit_size = VALUES(unit_size),
        retail_credits_millis = VALUES(retail_credits_millis),
        provider_cost_usd_micros = VALUES(provider_cost_usd_micros),
        is_active = VALUES(is_active),
        updated_at = VALUES(updated_at)
    `,
    [
      input.id,
      input.feature,
      input.providerId,
      input.billingMetric,
      input.unitSize,
      input.retailCreditsMillis,
      input.providerCostUsdMicros ?? null,
      input.isActive === false ? 0 : 1,
      now,
      now,
    ],
  )
}

export async function findActiveBillingRate(
  feature: BillingFeature,
  providerId: string,
) {
  const [rows] = await query<RowDataPacket[]>(
    `
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
    `,
    [feature, providerId],
  )

  const record = rows[0] as BillingRateRecord | undefined
  return record
    ? { ...record, isActive: toBoolean(record.isActive) }
    : undefined
}

export async function createUsageEvent(input: {
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

  await query(
    `
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
    `,
    [
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
    ],
  )

  return record
}

export async function createWorkspaceAllowanceLedgerEntry(input: {
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

  await query(
    `
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
    `,
    [
      record.id,
      record.workspaceId,
      record.entryType,
      record.sourceType,
      record.sourceId,
      record.creditsDeltaMillis,
      record.note,
      record.createdAt,
    ],
  )

  return record
}

export async function ensureWorkspaceAllowanceLedgerEntry(input: {
  workspaceId: string
  entryType: AllowanceEntryType
  sourceType: string
  sourceId: string
  creditsDeltaMillis: number
  note?: string | null
}) {
  await query(
    `
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
      ON DUPLICATE KEY UPDATE id = id
    `,
    [
      randomUUID(),
      input.workspaceId,
      input.entryType,
      input.sourceType,
      input.sourceId,
      input.creditsDeltaMillis,
      normalizeOptionalString(input.note),
      new Date().toISOString(),
    ],
  )
}

export async function getWorkspaceAllowanceSummary(workspaceId: string) {
  const [rows] = await query<RowDataPacket[]>(
    `
      SELECT
        COALESCE(SUM(CASE WHEN credits_delta_millis > 0 THEN credits_delta_millis ELSE 0 END), 0) AS grantedCreditsMillis,
        COALESCE(SUM(CASE WHEN credits_delta_millis < 0 THEN -credits_delta_millis ELSE 0 END), 0) AS usedCreditsMillis,
        COALESCE(SUM(credits_delta_millis), 0) AS remainingCreditsMillis
      FROM workspace_allowance_ledger
      WHERE workspace_id = ?
    `,
    [workspaceId],
  )

  const summary = rows[0] as WorkspaceAllowanceSummary | undefined

  return {
    grantedCreditsMillis: Number(summary?.grantedCreditsMillis ?? 0),
    usedCreditsMillis: Number(summary?.usedCreditsMillis ?? 0),
    remainingCreditsMillis: Number(summary?.remainingCreditsMillis ?? 0),
  } satisfies WorkspaceAllowanceSummary
}

export async function getWorkspaceUsageSummary(
  workspaceId: string,
  feature: BillingFeature,
) {
  const [rows] = await query<RowDataPacket[]>(
    `
      SELECT
        COUNT(*) AS totalEvents,
        COALESCE(SUM(CASE WHEN status = 'succeeded' THEN 1 ELSE 0 END), 0) AS successCount,
        COALESCE(SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END), 0) AS failureCount,
        COALESCE(SUM(input_chars), 0) AS inputChars,
        COALESCE(SUM(output_audio_ms), 0) AS outputAudioMs,
        COALESCE(SUM(charged_credits_millis), 0) AS chargedCreditsMillis
      FROM usage_events
      WHERE workspace_id = ? AND feature = ?
    `,
    [workspaceId, feature],
  )

  const summary = rows[0] as WorkspaceUsageSummary | undefined

  return {
    totalEvents: Number(summary?.totalEvents ?? 0),
    successCount: Number(summary?.successCount ?? 0),
    failureCount: Number(summary?.failureCount ?? 0),
    inputChars: Number(summary?.inputChars ?? 0),
    outputAudioMs: Number(summary?.outputAudioMs ?? 0),
    chargedCreditsMillis: Number(summary?.chargedCreditsMillis ?? 0),
  } satisfies WorkspaceUsageSummary
}

export async function listWorkspaceUsageEvents(
  workspaceId: string,
  limit = 20,
) {
  const [rows] = await query<RowDataPacket[]>(
    `
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
    `,
    [workspaceId, limit],
  )

  return rows as unknown as UsageEventRecord[]
}

export async function upsertBotRegistration(input: {
  botId: string
  botName: string
  channelId: string
  platformKeyId: string
  lastConnectedAt?: string
}) {
  const now = new Date().toISOString()

  await query(
    `
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
      ON DUPLICATE KEY UPDATE
        bot_name = VALUES(bot_name),
        platform_key_id = VALUES(platform_key_id),
        updated_at = VALUES(updated_at),
        last_connected_at = VALUES(last_connected_at)
    `,
    [
      randomUUID(),
      input.botId,
      input.botName,
      input.channelId,
      input.platformKeyId,
      now,
      now,
      input.lastConnectedAt ?? null,
    ],
  )
}

async function selectUserById(connection: PoolConnection, id: string) {
  const [rows] = await connection.query<RowDataPacket[]>(
    `
      SELECT
        id,
        display_name AS displayName,
        created_at AS createdAt,
        updated_at AS updatedAt
      FROM users
      WHERE id = ?
      LIMIT 1
    `,
    [id],
  )

  return rows[0] as UserRecord | undefined
}
