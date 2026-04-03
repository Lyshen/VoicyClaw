# Hosted Resource Model

## Goal

Move hosted onboarding from a UI-first prototype into a real backend-owned
resource model.

The hosted product should still feel immediate:

1. sign in
2. get one default workspace
3. get one starter project
4. get one starter key
5. paste one config line into OpenClaw
6. hear the bot speak

But the backing state should now live in VoicyClaw's own database instead of
mainly being derived from Clerk metadata.

---

## Product Boundary

### Keep simple in v1

The current hosted trial should stay minimal.

The user-facing product concepts remain:

- workspace
- voice project
- starter key

We do **not** introduce extra user-facing concepts like:

- starter bot
- starter room
- starter channel

Those stay implementation details for now.

### Internal model vs. user-facing model

Internally, the backend needs enough structure to grow later.

For v1, the formal backend resources are:

- user
- user identity
- workspace
- project
- api key

Bot, room, and channel are not promoted to top-level business resources yet.
They remain fields stored on the project for now.

---

## Identity Model

### Principle

Clerk is the current authentication source, but it should not leak directly
into every business table.

The business layer should refer to an internal `user.id`.

### v1 design

#### `users`

Internal account record used by the business domain.

Suggested fields:

- `id`
- `display_name`
- `created_at`
- `updated_at`

#### `user_identities`

Maps an external auth source to an internal user.

Suggested fields:

- `id`
- `user_id`
- `provider`
- `provider_subject`
- `email`
- `created_at`
- `updated_at`

Constraints:

- unique `(provider, provider_subject)`

### v1 auth flow

1. Next.js resolves the signed-in Clerk user.
2. VoicyClaw sends the identity payload to the VoicyClaw server.
3. The VoicyClaw server upserts:
   - one internal user
   - one `user_identities` row for provider `clerk`
4. All business resources then attach to the internal `user.id`.

This keeps the auth layer lightweight while preserving future flexibility.

---

## Workspace Model

### Meaning

`Workspace` is the hosted SaaS boundary.

It is the top-level scope for:

- projects
- API keys
- future allowance / usage / billing

### v1 rule

Each new hosted account receives one default workspace automatically.

Suggested fields:

- `id`
- `owner_user_id`
- `name`
- `is_default`
- `created_at`
- `updated_at`

v1 constraint:

- one default workspace per user

Recommended naming:

- `<FirstName> Workspace`
- fallback: `My Workspace`

---

## Project Model

### Meaning

`Project` stays as the internal container term.

In v1, one project represents one voice connection setup bundle:

- one default channel target
- one default bot identifier
- one display name
- one default starter key

This is intentionally lightweight.

### Important boundary

In v1:

- project is a first-class resource
- bot is not yet a first-class resource
- room is not yet a first-class resource

So the project stores implementation details like:

- `channel_id`
- `bot_id`
- `display_name`

That keeps the first hosted model simple without blocking later expansion.

### v1 starter project

Every new hosted user receives one starter project automatically.

Recommended defaults:

- `name`: `SayHello`
- `project_type`: `starter`

User-facing UI can still describe it as:

- `Voice project`
- `Starter`
- `Get started`

Suggested fields:

- `id`
- `workspace_id`
- `name`
- `project_type`
- `channel_id`
- `bot_id`
- `display_name`
- `created_at`
- `updated_at`

v1 constraints:

- one starter project per workspace
- `channel_id` unique

---

## API Key Model

### Meaning

`API key` remains the correct internal term.

It is the connector credential used by the OpenClaw plugin.

### v1 starter distinction

Starter-issued keys should be distinguishable from regular user-created keys in
two ways:

1. database type
2. token prefix

Recommended v1 types:

- `starter`
- `standard`

Recommended prefixes:

- starter key: `vcs_`
- standard key: `vc_`

The prefix is only a convenience marker.
Authorization logic should still rely on the stored record, not on the prefix
alone.

### Suggested fields

- `id`
- `workspace_id`
- `project_id`
- `channel_id`
- `key_type`
- `token`
- `label`
- `created_by_user_id`
- `created_at`
- `last_used_at`
- `revoked_at`

### v1 rule

Each starter project receives one starter key automatically.

Recommended default label:

- `Starter key`

---

## Starter Bootstrap Contract

### Trigger

The bootstrap runs when a signed-in hosted user enters the protected experience
and VoicyClaw needs starter resources.

### Required behavior

The bootstrap must be idempotent.

Repeated calls should not create duplicate:

- users
- identities
- workspaces
- starter projects
- starter keys

### Bootstrap result

For a brand new hosted user, VoicyClaw creates:

1. one internal user
2. one Clerk identity binding
3. one default workspace
4. one starter project
5. one starter key
6. one channel record for the starter project

For a returning user, VoicyClaw returns the existing resources.

---

## Runtime Config Flow

### Current direction

The web app should no longer treat Clerk private metadata as the main hosted
resource store.

### New direction

`runtime-config` should call the VoicyClaw server for starter bootstrap data.

Then the web app maps that server response into the existing onboarding UI
state.

This means:

- Clerk proves identity
- VoicyClaw server owns hosted resources
- the Studio UI reads real backend state

---

## API Direction

### v1 endpoint

Add one server endpoint for starter bootstrap.

Suggested shape:

- `POST /api/hosted/bootstrap`

Suggested input:

- `provider`
- `providerSubject`
- `email`
- `firstName`
- `fullName`
- `username`

Suggested output:

- `user`
- `workspace`
- `project`
- `starterKey`
- `allowance`

This endpoint is called by the web app's server-side runtime config loader.

### Why one endpoint first

One idempotent bootstrap/read endpoint is enough for v1 because the hosted
product still has one obvious default path.

More granular resource APIs can come later.

---

## v1 Database Set

The v1 hosted resource model should formalize these tables:

- `users`
- `user_identities`
- `workspaces`
- `projects`
- `platform_keys` (extended)
- `channels` (existing)
- `bot_registrations` (existing)

### Notes

- `platform_keys` remains the existing key table, but it should gain hosted
  ownership fields.
- `channels` and `bot_registrations` stay in place as runtime tables.
- project-level `channel_id` continues to point to the current runtime channel
  abstraction.

---

## Explicit Non-Goals For This Branch

Do not implement these yet:

- allowance enforcement
- usage metering
- billing
- multi-workspace UI
- multi-project management UI
- bot as a first-class backend resource
- room as a first-class backend resource

This branch is about moving hosted onboarding onto a real backend-owned
resource model, not about finishing the entire hosted SaaS stack.

---

## Implementation Order

### Phase 1

Add the new backend tables and migration-safe schema updates.

### Phase 2

Implement idempotent hosted bootstrap on the server.

### Phase 3

Return starter resources from a server bootstrap endpoint.

### Phase 4

Update web hosted onboarding to consume the backend-owned resources.

### Phase 5

Add tests for:

- bootstrap idempotency
- starter key typing and prefix
- runtime config integration

---

## Recommendation Summary

Recommended v1 decisions:

- keep Clerk as the current auth source
- add an internal `users` layer plus `user_identities`
- make `workspace` the hosted top-level scope
- keep `project` as the internal container term
- treat bot / room / channel as project details for now
- auto-create one default workspace
- auto-create one starter project named `SayHello`
- auto-create one starter key with a distinct `starter` type and prefix
- move hosted onboarding state ownership into the VoicyClaw server database
- leave usage, allowance, and billing for later branches
