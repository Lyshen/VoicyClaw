import * as sqlite from "./sqlite"
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
    }): {
      user: UserRecord
      identity: UserIdentityRecord
    }
  }
  channels: {
    ensure(channelId: string, name: string): void
  }
  workspaces: {
    findById(id: string): WorkspaceRecord | undefined
    findDefaultByOwnerUserId(ownerUserId: string): WorkspaceRecord | undefined
    create(input: {
      ownerUserId: string
      name: string
      isDefault?: boolean
    }): WorkspaceRecord
  }
  projects: {
    findStarterByWorkspaceId(workspaceId: string): ProjectRecord | undefined
    findByChannelId(channelId: string): ProjectRecord | undefined
    create(input: {
      workspaceId: string
      name: string
      projectType: ProjectType
      channelId: string
      botId: string
      displayName: string
    }): ProjectRecord
  }
  platformKeys: {
    findByProjectIdAndType(
      projectId: string,
      keyType: PlatformKeyType,
    ): PlatformKeyRecord | undefined
    create(
      channelId: string,
      label?: string | null,
      options?: {
        workspaceId?: string | null
        projectId?: string | null
        keyType?: PlatformKeyType
        createdByUserId?: string | null
      },
    ): PlatformKeyRecord
    findByToken(token: string): PlatformKeyRecord | undefined
    touch(id: string): void
  }
  botRegistrations: {
    upsert(input: {
      botId: string
      botName: string
      channelId: string
      platformKeyId: string
      lastConnectedAt?: string
    }): void
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
    }): void
    findActive(
      feature: BillingFeature,
      providerId: string,
    ): BillingRateRecord | undefined
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
    }): UsageEventRecord
    summarizeByWorkspace(
      workspaceId: string,
      feature: BillingFeature,
    ): WorkspaceUsageSummary
    listByWorkspace(workspaceId: string, limit?: number): UsageEventRecord[]
  }
  allowanceLedger: {
    ensureEntry(input: {
      workspaceId: string
      entryType: "grant" | "usage" | "adjustment"
      sourceType: string
      sourceId: string
      creditsDeltaMillis: number
      note?: string | null
    }): void
    summarizeByWorkspace(workspaceId: string): WorkspaceAllowanceSummary
  }
  system: {
    getDatabaseFile(): string
  }
}

export const storage: Storage = {
  users: {
    upsertForIdentity: sqlite.upsertUserForIdentity,
  },
  channels: {
    ensure: sqlite.ensureChannel,
  },
  workspaces: {
    findById: sqlite.findWorkspaceById,
    findDefaultByOwnerUserId: sqlite.findDefaultWorkspaceByOwnerUserId,
    create: sqlite.createWorkspace,
  },
  projects: {
    findStarterByWorkspaceId: sqlite.findStarterProjectByWorkspaceId,
    findByChannelId: sqlite.findProjectByChannelId,
    create: sqlite.createProject,
  },
  platformKeys: {
    findByProjectIdAndType: sqlite.findPlatformKeyByProjectIdAndType,
    create: sqlite.createPlatformKey,
    findByToken: sqlite.findPlatformKeyByToken,
    touch: sqlite.touchPlatformKey,
  },
  botRegistrations: {
    upsert: sqlite.upsertBotRegistration,
  },
  billingRates: {
    upsert: sqlite.upsertBillingRate,
    findActive: sqlite.findActiveBillingRate,
  },
  usageEvents: {
    create: sqlite.createUsageEvent,
    summarizeByWorkspace: sqlite.getWorkspaceUsageSummary,
    listByWorkspace: sqlite.listWorkspaceUsageEvents,
  },
  allowanceLedger: {
    ensureEntry: sqlite.ensureWorkspaceAllowanceLedgerEntry,
    summarizeByWorkspace: sqlite.getWorkspaceAllowanceSummary,
  },
  system: {
    getDatabaseFile: sqlite.getDatabaseFile,
  },
}
