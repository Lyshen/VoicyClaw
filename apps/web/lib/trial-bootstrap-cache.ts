import type {
  HostedAllowance,
  HostedOnboardingRecord,
  HostedStarterKey,
  HostedVoiceProject,
  HostedWorkspace,
} from "./hosted-onboarding-shared"

const TRIAL_SUBJECT_STORAGE_KEY = "voicyclaw.try.subject"
const TRIAL_BOOTSTRAP_STORAGE_KEY = "voicyclaw.try.bootstrap"

type TrialBootstrapCacheRecord = {
  version: 1
  trialSubject: string
  record: HostedOnboardingRecord
}

export function getExistingTrialSubject() {
  if (typeof window === "undefined") {
    return null
  }

  return window.localStorage.getItem(TRIAL_SUBJECT_STORAGE_KEY)?.trim() ?? null
}

export function getOrCreateTrialSubject() {
  if (typeof window === "undefined") {
    return buildTrialSubject()
  }

  const existing = getExistingTrialSubject()
  if (existing) {
    return existing
  }

  const trialSubject = buildTrialSubject()
  window.localStorage.setItem(TRIAL_SUBJECT_STORAGE_KEY, trialSubject)
  return trialSubject
}

export function parseTrialBootstrapRecord(source: unknown) {
  const root = asRecord(source)
  const workspace = readHostedWorkspace(root.workspace)
  const project = readHostedVoiceProject(root.project)
  const allowance = readHostedAllowance(root.allowance)

  if (!workspace || !project || !allowance) {
    return null
  }

  return {
    version: 1,
    workspace,
    project,
    starterKey: readHostedStarterKey(root.starterKey),
    allowance,
  } satisfies HostedOnboardingRecord
}

export function readCachedTrialBootstrap(trialSubject: string) {
  if (typeof window === "undefined") {
    return null
  }

  try {
    const raw = window.localStorage.getItem(TRIAL_BOOTSTRAP_STORAGE_KEY)
    if (!raw) {
      return null
    }

    const parsed = asRecord(JSON.parse(raw))
    if (readString(parsed.trialSubject) !== trialSubject) {
      window.localStorage.removeItem(TRIAL_BOOTSTRAP_STORAGE_KEY)
      return null
    }

    const record = parseTrialBootstrapRecord(parsed.record)
    if (!record || !hasUsableTrialStarterKey(record)) {
      window.localStorage.removeItem(TRIAL_BOOTSTRAP_STORAGE_KEY)
      return null
    }

    return record
  } catch {
    window.localStorage.removeItem(TRIAL_BOOTSTRAP_STORAGE_KEY)
    return null
  }
}

export function writeCachedTrialBootstrap(
  trialSubject: string,
  record: HostedOnboardingRecord,
) {
  if (typeof window === "undefined") {
    return
  }

  const payload: TrialBootstrapCacheRecord = {
    version: 1,
    trialSubject,
    record,
  }

  window.localStorage.setItem(
    TRIAL_BOOTSTRAP_STORAGE_KEY,
    JSON.stringify(payload),
  )
}

export function clearCachedTrialBootstrap() {
  if (typeof window === "undefined") {
    return
  }

  window.localStorage.removeItem(TRIAL_BOOTSTRAP_STORAGE_KEY)
}

export function isHostedStarterKeyExpired(
  starterKey?: HostedStarterKey | null,
) {
  if (!starterKey?.value) {
    return true
  }

  if (!starterKey.expiresAt) {
    return false
  }

  const expiresAt = Date.parse(starterKey.expiresAt)
  if (Number.isNaN(expiresAt)) {
    return false
  }

  return expiresAt <= Date.now()
}

export function hasUsableTrialStarterKey(
  record: HostedOnboardingRecord | null | undefined,
) {
  if (!record?.starterKey?.value) {
    return false
  }

  return !isHostedStarterKeyExpired(record.starterKey)
}

function buildTrialSubject() {
  const suffix =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`

  return `try-session-${suffix}`
}

function readHostedWorkspace(source: unknown): HostedWorkspace | null {
  const workspace = asRecord(source)
  const id = readString(workspace.id)
  const name = readString(workspace.name)

  if (!id || !name) {
    return null
  }

  return { id, name }
}

function readHostedVoiceProject(source: unknown): HostedVoiceProject | null {
  const project = asRecord(source)
  const id = readString(project.id)
  const name = readString(project.name)
  const channelId = readString(project.channelId)
  const botId = readString(project.botId)
  const displayName = readString(project.displayName)

  if (!id || !name || !channelId || !botId || !displayName) {
    return null
  }

  return {
    id,
    name,
    channelId,
    botId,
    displayName,
  }
}

function readHostedStarterKey(source: unknown): HostedStarterKey | null {
  const starterKey = asRecord(source)
  const value = readString(starterKey.value)

  if (!value) {
    return null
  }

  return {
    value,
    label: readString(starterKey.label) ?? "Starter key",
    createdAt: readString(starterKey.createdAt),
    expiresAt: readNullableString(starterKey.expiresAt),
  }
}

function readHostedAllowance(source: unknown): HostedAllowance | null {
  const allowance = asRecord(source)
  const label = readString(allowance.label)
  const note = readString(allowance.note)
  const grantedCreditsMillis = readInteger(allowance.grantedCreditsMillis)
  const usedCreditsMillis = readInteger(allowance.usedCreditsMillis)
  const remainingCreditsMillis = readInteger(allowance.remainingCreditsMillis)

  if (
    !label ||
    !note ||
    grantedCreditsMillis === undefined ||
    usedCreditsMillis === undefined ||
    remainingCreditsMillis === undefined
  ) {
    return null
  }

  return {
    label,
    status: "preview",
    note,
    currency: "voice-credits",
    grantedCreditsMillis,
    usedCreditsMillis,
    remainingCreditsMillis,
  }
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

function readNullableString(value: unknown) {
  if (value === null || value === undefined) {
    return null
  }

  return readString(value) ?? null
}

function readInteger(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return undefined
  }

  return Math.trunc(value)
}
