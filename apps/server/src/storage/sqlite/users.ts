import { randomUUID } from "node:crypto"
import type { AuthProvider, UserIdentityRecord, UserRecord } from "../types"
import { db } from "./client"
import "./schema"
import { normalizeOptionalString } from "./shared"

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

function selectUserById(id: string) {
  return selectUserByIdStatement.get(id) as UserRecord | undefined
}
