import { storage, type UserRecord } from "../../storage"

export function upsertHostedUser(input: {
  provider: "clerk"
  providerSubject: string
  email?: string | null
  displayName?: string | null
  firstName?: string | null
  fullName?: string | null
  username?: string | null
}) {
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

  return user
}

export function normalizeOptionalString(value: string | null | undefined) {
  if (typeof value !== "string") {
    return null
  }

  const normalized = value.trim()
  return normalized || null
}

export type { UserRecord }
