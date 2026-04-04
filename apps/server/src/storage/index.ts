import { resolveStorageConfig as resolveBaseStorageConfig } from "@voicyclaw/config"
import type {
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
  WorkspaceAllowanceSummary,
  WorkspaceRecord,
  WorkspaceUsageSummary,
} from "./types"

export type Awaitable<T> = T | Promise<T>
export type StorageDriver = "sqlite" | "mysql"

type StorageAdapter = typeof import("./mysql")

export type {
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
} from "./types"

export interface Storage {
  users: {
    upsertForIdentity(input: {
      provider: AuthProvider
      providerSubject: string
      email?: string | null
      displayName?: string | null
    }): Awaitable<{
      user: UserRecord
      identity: UserIdentityRecord
    }>
  }
  channels: {
    ensure(channelId: string, name: string): Awaitable<void>
  }
  workspaces: {
    findById(id: string): Awaitable<WorkspaceRecord | undefined>
    findDefaultByOwnerUserId(
      ownerUserId: string,
    ): Awaitable<WorkspaceRecord | undefined>
    create(input: {
      ownerUserId: string
      name: string
      isDefault?: boolean
    }): Awaitable<WorkspaceRecord>
  }
  projects: {
    findStarterByWorkspaceId(
      workspaceId: string,
    ): Awaitable<ProjectRecord | undefined>
    findByChannelId(channelId: string): Awaitable<ProjectRecord | undefined>
    create(input: {
      workspaceId: string
      name: string
      projectType: ProjectType
      channelId: string
      botId: string
      displayName: string
    }): Awaitable<ProjectRecord>
  }
  platformKeys: {
    findByProjectIdAndType(
      projectId: string,
      keyType: PlatformKeyType,
    ): Awaitable<PlatformKeyRecord | undefined>
    create(
      channelId: string,
      label?: string | null,
      options?: {
        workspaceId?: string | null
        projectId?: string | null
        keyType?: PlatformKeyType
        createdByUserId?: string | null
      },
    ): Awaitable<PlatformKeyRecord>
    findByToken(token: string): Awaitable<PlatformKeyRecord | undefined>
    touch(id: string): Awaitable<void>
  }
  botRegistrations: {
    upsert(input: {
      botId: string
      botName: string
      channelId: string
      platformKeyId: string
      lastConnectedAt?: string
    }): Awaitable<void>
  }
  billingRates: {
    upsert(input: {
      id: string
      feature: BillingFeature
      providerId: string
      billingMetric: BillingMetric
      unitSize: number
      retailCreditsMillis: number
      providerCostUsdMicros?: number | null
      isActive?: boolean
    }): Awaitable<void>
    findActive(
      feature: BillingFeature,
      providerId: string,
    ): Awaitable<BillingRateRecord | undefined>
  }
  usageEvents: {
    create(input: {
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
    }): Awaitable<UsageEventRecord>
    summarizeByWorkspace(
      workspaceId: string,
      feature: BillingFeature,
    ): Awaitable<WorkspaceUsageSummary>
    listByWorkspace(
      workspaceId: string,
      limit?: number,
    ): Awaitable<UsageEventRecord[]>
  }
  allowanceLedger: {
    ensureEntry(input: {
      workspaceId: string
      entryType: "grant" | "usage" | "adjustment"
      sourceType: string
      sourceId: string
      creditsDeltaMillis: number
      note?: string | null
    }): Awaitable<void>
    summarizeByWorkspace(
      workspaceId: string,
    ): Awaitable<WorkspaceAllowanceSummary>
  }
  system: {
    init(): Awaitable<void>
    close(): Awaitable<void>
    describeTarget(): string
  }
}

export function resolveStorageDriver(
  env: NodeJS.ProcessEnv = process.env,
): StorageDriver {
  return resolveBaseStorageConfig(env).driver
}

export const storageDriver = resolveStorageDriver()

let adapterPromise: Promise<StorageAdapter> | undefined

function loadAdapter() {
  if (!adapterPromise) {
    adapterPromise =
      storageDriver === "mysql"
        ? import("./mysql")
        : import("./sqlite").then(
            (adapter) => adapter as unknown as StorageAdapter,
          )
  }

  return adapterPromise
}

async function callAdapter<TKey extends keyof StorageAdapter>(
  key: TKey,
  ...args: Parameters<StorageAdapter[TKey]>
): Promise<Awaited<ReturnType<StorageAdapter[TKey]>>> {
  const adapter = await loadAdapter()
  const fn = adapter[key] as (
    ...input: Parameters<StorageAdapter[TKey]>
  ) => ReturnType<StorageAdapter[TKey]>
  return await fn(...args)
}

function describeMysqlTarget(env: NodeJS.ProcessEnv = process.env) {
  try {
    const mysqlUrl = resolveBaseStorageConfig(env).mysqlUrl
    if (!mysqlUrl) {
      return "MySQL ready"
    }

    const url = new URL(mysqlUrl)
    const database = url.pathname.replace(/^\//, "") || "(default)"
    return `MySQL ready at ${url.hostname}/${database}`
  } catch {
    return "MySQL ready"
  }
}

function describeSqliteTarget(env: NodeJS.ProcessEnv = process.env) {
  return `SQLite ready at ${resolveBaseStorageConfig(env).sqliteFile}`
}

export const storage: Storage = {
  users: {
    upsertForIdentity: (input) => callAdapter("upsertUserForIdentity", input),
  },
  channels: {
    ensure: (channelId, name) => callAdapter("ensureChannel", channelId, name),
  },
  workspaces: {
    findById: (id) => callAdapter("findWorkspaceById", id),
    findDefaultByOwnerUserId: (ownerUserId) =>
      callAdapter("findDefaultWorkspaceByOwnerUserId", ownerUserId),
    create: (input) => callAdapter("createWorkspace", input),
  },
  projects: {
    findStarterByWorkspaceId: (workspaceId) =>
      callAdapter("findStarterProjectByWorkspaceId", workspaceId),
    findByChannelId: (channelId) =>
      callAdapter("findProjectByChannelId", channelId),
    create: (input) => callAdapter("createProject", input),
  },
  platformKeys: {
    findByProjectIdAndType: (projectId, keyType) =>
      callAdapter("findPlatformKeyByProjectIdAndType", projectId, keyType),
    create: (channelId, label, options) =>
      callAdapter("createPlatformKey", channelId, label, options),
    findByToken: (token) => callAdapter("findPlatformKeyByToken", token),
    touch: (id) => callAdapter("touchPlatformKey", id),
  },
  botRegistrations: {
    upsert: (input) => callAdapter("upsertBotRegistration", input),
  },
  billingRates: {
    upsert: (input) => callAdapter("upsertBillingRate", input),
    findActive: (feature, providerId) =>
      callAdapter("findActiveBillingRate", feature, providerId),
  },
  usageEvents: {
    create: (input) => callAdapter("createUsageEvent", input),
    summarizeByWorkspace: (workspaceId, feature) =>
      callAdapter("getWorkspaceUsageSummary", workspaceId, feature),
    listByWorkspace: (workspaceId, limit) =>
      callAdapter("listWorkspaceUsageEvents", workspaceId, limit),
  },
  allowanceLedger: {
    ensureEntry: (input) =>
      callAdapter("ensureWorkspaceAllowanceLedgerEntry", input),
    summarizeByWorkspace: (workspaceId) =>
      callAdapter("getWorkspaceAllowanceSummary", workspaceId),
  },
  system: {
    init: () => callAdapter("initStorage"),
    close: () => callAdapter("closeStorage"),
    describeTarget: () =>
      storageDriver === "mysql"
        ? describeMysqlTarget()
        : describeSqliteTarget(),
  },
}
