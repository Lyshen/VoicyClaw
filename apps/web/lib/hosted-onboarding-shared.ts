export const STARTER_CONNECTOR_PACKAGE = "@voicyclaw/voicyclaw"
export const STARTER_KEY_LABEL = "Starter key"
const STARTER_PROJECT_NAME = "SayHello"
const STARTER_PROJECT_DISPLAY_NAME = "SayHello Connector"
const DEFAULT_VOICYCLAW_CONNECTOR_URL = "https://api.voicyclaw.com"

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
  expiresAt?: string | null
}

export interface HostedAllowance {
  label: string
  status: "preview"
  note: string
  currency: "voice-credits"
  grantedCreditsMillis: number
  usedCreditsMillis: number
  remainingCreditsMillis: number
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
  settingsNamespace: string
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
  apiKey: string
  serverUrl?: string
}) {
  return JSON.stringify(buildConnectorConfigObject(input), null, 2)
}

export function buildConnectorConfigLine(input: {
  apiKey: string
  serverUrl?: string
}) {
  return JSON.stringify(buildConnectorConfigObject(input))
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
          expiresAt: readString(starterKey.expiresAt) ?? null,
        }
      : null,
    allowance: {
      label: readString(allowance.label) ?? "Free preview allowance",
      status: "preview",
      note:
        readString(allowance.note) ??
        "Starter preview allowance is active. 0.000 voice credits remaining. Billing is not enforced yet.",
      currency: "voice-credits",
      grantedCreditsMillis: readInteger(allowance.grantedCreditsMillis) ?? 0,
      usedCreditsMillis: readInteger(allowance.usedCreditsMillis) ?? 0,
      remainingCreditsMillis:
        readInteger(allowance.remainingCreditsMillis) ?? 0,
    },
  }
}

export function withHostedStarterKey(
  record: HostedOnboardingRecord,
  apiKey: string,
  expiresAt?: string | null,
) {
  return {
    ...record,
    starterKey: {
      value: apiKey,
      label: STARTER_KEY_LABEL,
      createdAt: new Date().toISOString(),
      expiresAt: expiresAt ?? null,
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
          apiKey: record.starterKey.value,
        })
      : null,
    connectorConfigLine: record.starterKey?.value
      ? buildConnectorConfigLine({
          serverUrl,
          apiKey: record.starterKey.value,
        })
      : null,
    connectorPackageName: STARTER_CONNECTOR_PACKAGE,
    settingsNamespace: buildSettingsStorageNamespace(
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

function buildConnectorConfigObject(input: {
  apiKey: string
  serverUrl?: string
}) {
  const connectorConfig: {
    token: string
    url?: string
  } = {
    token: input.apiKey,
  }
  const normalizedServerUrl = normalizeConnectorServerUrl(input.serverUrl)

  if (normalizedServerUrl) {
    connectorConfig.url = normalizedServerUrl
  }

  return {
    channels: {
      voicyclaw: connectorConfig,
    },
  }
}

function normalizeConnectorServerUrl(serverUrl?: string) {
  const normalized = readString(serverUrl)
  if (!normalized || normalized === DEFAULT_VOICYCLAW_CONNECTOR_URL) {
    return undefined
  }

  return normalized
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

function readInteger(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return undefined
  }

  return Math.trunc(value)
}
