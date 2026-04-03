import { randomUUID } from "node:crypto"
import type {
  PlatformKeyRecord,
  ProjectRecord,
  WorkspaceRecord,
} from "../../storage"
import { storage } from "../../storage"
import {
  buildHostedAllowanceSnapshot,
  ensureStarterPreviewAllowance,
} from "../billing/service"
import { ensureStoredChannel } from "../channels/service"
import {
  findPlatformKeyByProjectIdAndType,
  issuePlatformKeyForChannel,
} from "../platform-keys/service"

const STARTER_KEY_LABEL = "Starter key"
const STARTER_PROJECT_NAME = "SayHello"
const STARTER_PROJECT_SLUG = "sayhello"
const STARTER_PROJECT_DISPLAY_NAME = "SayHello Connector"

export interface HostedBootstrapInput {
  provider: "clerk"
  providerSubject: string
  email?: string | null
  displayName?: string | null
  firstName?: string | null
  fullName?: string | null
  username?: string | null
}

export interface HostedBootstrapRecord {
  version: 1
  workspace: {
    id: string
    name: string
  }
  project: {
    id: string
    name: string
    channelId: string
    botId: string
    displayName: string
  }
  starterKey: {
    value: string
    label: string
    createdAt: string
  } | null
  allowance: {
    label: string
    status: "preview"
    note: string
    currency: "voice-credits"
    grantedCreditsMillis: number
    usedCreditsMillis: number
    remainingCreditsMillis: number
  }
}

export function bootstrapHostedResources(
  input: HostedBootstrapInput,
): HostedBootstrapRecord {
  const { user } = storage.users.upsertForIdentity({
    provider: input.provider,
    providerSubject: input.providerSubject,
    email: input.email,
    displayName:
      normalizeOptionalString(input.displayName) ??
      normalizeOptionalString(input.fullName) ??
      normalizeOptionalString(input.username) ??
      normalizeOptionalString(input.firstName),
  })

  const workspace =
    storage.workspaces.findDefaultByOwnerUserId(user.id) ??
    storage.workspaces.create({
      ownerUserId: user.id,
      name: buildStarterWorkspaceName(input),
      isDefault: true,
    })

  const project =
    storage.projects.findStarterByWorkspaceId(workspace.id) ??
    createStarterProject(workspace.id)

  ensureStoredChannel(project.channelId, STARTER_PROJECT_NAME)

  const starterKey =
    findPlatformKeyByProjectIdAndType(project.id, "starter") ??
    issuePlatformKeyForChannel({
      channelId: project.channelId,
      label: STARTER_KEY_LABEL,
      workspaceId: workspace.id,
      projectId: project.id,
      keyType: "starter",
      createdByUserId: user.id,
    })

  ensureStarterPreviewAllowance(workspace.id)

  return buildHostedBootstrapRecord(workspace, project, starterKey)
}

function buildStarterWorkspaceName(input: {
  firstName?: string | null
  fullName?: string | null
  username?: string | null
}) {
  const preferredName =
    normalizeOptionalString(input.firstName) ??
    normalizeOptionalString(input.fullName) ??
    normalizeOptionalString(input.username)

  if (!preferredName) {
    return "My Workspace"
  }

  return `${preferredName} Workspace`
}

function createStarterProject(workspaceId: string) {
  const suffix = randomUUID().replace(/-/g, "").slice(0, 8)
  const channelId = `${STARTER_PROJECT_SLUG}-${suffix}`

  ensureStoredChannel(channelId, STARTER_PROJECT_NAME)

  return storage.projects.create({
    workspaceId,
    name: STARTER_PROJECT_NAME,
    projectType: "starter",
    channelId,
    botId: `openclaw-${suffix}`,
    displayName: STARTER_PROJECT_DISPLAY_NAME,
  })
}

function buildHostedBootstrapRecord(
  workspace: WorkspaceRecord,
  project: ProjectRecord,
  starterKey: PlatformKeyRecord,
): HostedBootstrapRecord {
  const allowance = buildHostedAllowanceSnapshot(workspace.id)

  return {
    version: 1,
    workspace: {
      id: workspace.id,
      name: workspace.name,
    },
    project: {
      id: project.id,
      name: project.name,
      channelId: project.channelId,
      botId: project.botId,
      displayName: project.displayName,
    },
    starterKey: {
      value: starterKey.token,
      label: starterKey.label ?? STARTER_KEY_LABEL,
      createdAt: starterKey.createdAt,
    },
    allowance,
  }
}

function normalizeOptionalString(value: string | null | undefined) {
  if (typeof value !== "string") {
    return null
  }

  const normalized = value.trim()
  return normalized || null
}
