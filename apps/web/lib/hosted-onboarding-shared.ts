export const STARTER_CONNECTOR_PACKAGE = "@voicyclaw/voicyclaw"
export const STARTER_KEY_LABEL = "Starter key"
const STARTER_PROJECT_NAME = "SayHello"
const STARTER_PROJECT_DISPLAY_NAME = "SayHello Connector"

export interface HostedWorkspace {
  id: string
  name: string
}

export interface HostedVoiceProject {
  id: string
  name: string
  channelId: string
  botId: string
  displayName: string
}

export interface HostedStarterKey {
  value: string
  label: string
  createdAt?: string
}

export interface HostedAllowance {
  label: string
  status: "preview"
  note: string
}

export interface HostedOnboardingRecord {
  version: 1
  workspace: HostedWorkspace
  project: HostedVoiceProject
  starterKey: HostedStarterKey | null
  allowance: HostedAllowance
}

export interface HostedOnboardingState extends HostedOnboardingRecord {
  connectorConfigJson: string | null
  connectorConfigLine: string | null
  connectorPackageName: string
  settingsStorageNamespace: string
  starterKeyProvisioningError?: string
}

type StarterUser = {
  firstName?: string | null
  fullName?: string | null
  username?: string | null
}

export function buildStarterWorkspaceName(user: StarterUser) {
  const preferredName =
    user.firstName?.trim() || user.fullName?.trim() || user.username?.trim()

  if (!preferredName) {
    return "My Workspace"
  }

  return `${preferredName} Workspace`
}

export function buildSettingsStorageNamespace(
  workspaceId: string,
  projectId: string,
) {
  return `${workspaceId}.${projectId}`
}

export function buildConnectorConfigJson(input: {
  serverUrl: string
  workspaceId: string
  channelId: string
  botId: string
  displayName: string
  apiKey: string
}) {
  return JSON.stringify(
    {
      channels: {
        voicyclaw: {
          url: input.serverUrl,
          token: input.apiKey,
          workspaceId: input.workspaceId,
          channelId: input.channelId,
          botId: input.botId,
          displayName: input.displayName,
        },
      },
    },
    null,
    2,
  )
}

export function buildConnectorConfigLine(input: {
  serverUrl: string
  channelId: string
  apiKey: string
}) {
  return JSON.stringify({
    channels: {
      voicyclaw: {
        url: input.serverUrl,
        token: input.apiKey,
        channelId: input.channelId,
      },
    },
  })
}

export function buildStarterOnboardingRecord(
  userId: string,
  user: StarterUser,
  source?: unknown,
): HostedOnboardingRecord {
  const root = asRecord(source)
  const workspace = asRecord(root.workspace)
  const project = asRecord(root.project)
  const starterKey = asRecord(root.starterKey)
  const allowance = asRecord(root.allowance)
  const seed = buildStableSeed(userId)

  const workspaceId = readString(workspace.id) ?? `ws-${seed}`
  const workspaceName =
    readString(workspace.name) ?? buildStarterWorkspaceName(user)
  const projectId = readString(project.id) ?? `sayhello-${seed}`
  const channelId = readString(project.channelId) ?? `sayhello-${seed}`
  const botId = readString(project.botId) ?? `openclaw-${seed}`
  const displayName =
    readString(project.displayName) ?? STARTER_PROJECT_DISPLAY_NAME

  return {
    version: 1,
    workspace: {
      id: workspaceId,
      name: workspaceName,
    },
    project: {
      id: projectId,
      name: readString(project.name) ?? STARTER_PROJECT_NAME,
      channelId,
      botId,
      displayName,
    },
    starterKey: readString(starterKey.value)
      ? {
          value: readString(starterKey.value) ?? "",
          label: readString(starterKey.label) ?? STARTER_KEY_LABEL,
          createdAt: readString(starterKey.createdAt),
        }
      : null,
    allowance: {
      label: readString(allowance.label) ?? "Free preview allowance",
      status: "preview",
      note:
        readString(allowance.note) ??
        "Starter preview allowance is active. Billing is not enforced yet.",
    },
  }
}

export function withHostedStarterKey(
  record: HostedOnboardingRecord,
  apiKey: string,
) {
  return {
    ...record,
    starterKey: {
      value: apiKey,
      label: STARTER_KEY_LABEL,
      createdAt: new Date().toISOString(),
    },
  } satisfies HostedOnboardingRecord
}

export function buildHostedOnboardingState(
  record: HostedOnboardingRecord,
  serverUrl: string,
  starterKeyProvisioningError?: string,
): HostedOnboardingState {
  return {
    ...record,
    connectorConfigJson: record.starterKey?.value
      ? buildConnectorConfigJson({
          serverUrl,
          workspaceId: record.workspace.id,
          channelId: record.project.channelId,
          botId: record.project.botId,
          displayName: record.project.displayName,
          apiKey: record.starterKey.value,
        })
      : null,
    connectorConfigLine: record.starterKey?.value
      ? buildConnectorConfigLine({
          serverUrl,
          channelId: record.project.channelId,
          apiKey: record.starterKey.value,
        })
      : null,
    connectorPackageName: STARTER_CONNECTOR_PACKAGE,
    settingsStorageNamespace: buildSettingsStorageNamespace(
      record.workspace.id,
      record.project.id,
    ),
    starterKeyProvisioningError,
  }
}

export function recordsEqual(source: unknown, target: HostedOnboardingRecord) {
  return JSON.stringify(source ?? null) === JSON.stringify(target)
}

function buildStableSeed(userId: string) {
  let hash = 0

  for (const character of userId) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0
  }

  return hash.toString(16).padStart(8, "0").slice(0, 8)
}

function asRecord(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {}
  }

  return value as Record<string, unknown>
}

function readString(value: unknown) {
  if (typeof value !== "string") {
    return undefined
  }

  const normalized = value.trim()
  return normalized || undefined
}
