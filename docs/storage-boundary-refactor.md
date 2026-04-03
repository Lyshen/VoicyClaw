# VoicyClaw Storage Boundary Refactor

## Why now

VoicyClaw has already formed its first real product model:

- `workspace`
- `project`
- `platform key`
- `bot registration`
- `hosted bootstrap`
- `usage / allowance / billing`

That is exactly the point where storage coupling starts to become expensive.

Right now `apps/server/src/db.ts` is doing too many jobs at once:

1. owns the SQLite connection
2. defines schema and migration-ish setup
3. owns prepared statements
4. exposes repository-level reads and writes
5. leaks domain concepts directly from the storage file

This still works for SQLite, but it gets harder once we want:

- cleaner business modules
- MySQL later
- more features like allowance, billing, payment, entitlement
- easier code reading for new contributors

So yes: this is a good time to refactor.

Not because the code is broken.

Because the domain is finally stable enough to draw clean boundaries before the next wave of complexity lands.

## Goals

This refactor should do two things well.

### 1. Split business logic by domain

Business code should live by feature, not by storage file.

Example target grouping:

- `workspaces`
- `projects`
- `platform-keys`
- `channels`
- `bot-registrations`
- `hosted-bootstrap`
- `usage`
- `allowance`
- `billing`

Each module should read like product behavior, not like SQL plumbing.

### 2. Isolate storage implementation

The rest of the server should not care whether storage is:

- SQLite today
- MySQL later
- another adapter in the future

That does **not** mean over-engineering a giant generic ORM layer.

It means adding a thin storage boundary with clear repository ports.

## Non-goals

This branch should not:

- switch production storage to MySQL yet
- introduce a new ORM just for the sake of abstraction
- redesign business objects
- rewrite every server file at once
- mix payment/subscription work into the same refactor

## Current pain points

### Domain leakage from `db.ts`

`db.ts` currently exports both storage primitives and domain-shaped operations:

- `createWorkspace`
- `createProject`
- `createPlatformKey`
- `findStarterProjectByWorkspaceId`
- `findProjectByChannelId`
- `findPlatformKeyByToken`
- `upsertBotRegistration`
- `upsertBillingRate`
- `createUsageEvent`
- `getWorkspaceAllowanceSummary`

That means storage and business meaning are currently fused together.

### Feature code depends on storage details directly

Example today:

- `hosted-resources.ts` imports workspace/project/key operations directly from `db.ts`
- `http-routes.ts` reaches into `db.ts` for keys, projects, workspaces, bot registrations
- `realtime-gateway.ts` validates API keys and updates registrations directly through `db.ts`
- `server-shared.ts` still reaches into `db.ts` just to ensure channels exist

So the dependency direction is currently:

`route/gateway/business -> db.ts`

The target should be:

`route/gateway -> business service -> repository port -> sqlite adapter`

## Target design

## Layer 1: Business modules

Create feature-first modules under something like:

- `apps/server/src/domains/workspaces/`
- `apps/server/src/domains/projects/`
- `apps/server/src/domains/platform-keys/`
- `apps/server/src/domains/channels/`
- `apps/server/src/domains/bot-registrations/`
- `apps/server/src/domains/hosted-bootstrap/`
- `apps/server/src/domains/billing/`

Each module should expose product-shaped functions.

Examples:

- `ensureDefaultWorkspaceForUser(...)`
- `ensureStarterProject(...)`
- `issuePlatformKey(...)`
- `registerBot(...)`
- `bootstrapHostedWorkspace(...)`
- `recordTtsUsage(...)`
- `getWorkspaceBillingSummary(...)`

These modules may coordinate multiple repositories.

They should not know about SQLite statements.

## Layer 2: Repository ports

Define narrow interfaces for the business modules.

Examples:

- `WorkspaceRepository`
- `ProjectRepository`
- `PlatformKeyRepository`
- `ChannelRepository`
- `BotRegistrationRepository`
- `BillingRateRepository`
- `UsageEventRepository`
- `AllowanceLedgerRepository`
- `UserRepository`

Important point:

These ports should be shaped around **VoicyClaw needs**, not generic CRUD purity.

For example:

- `findDefaultByOwnerUserId(ownerUserId)`
- `findStarterByWorkspaceId(workspaceId)`
- `findByToken(token)`
- `ensureChannel(id, name)`
- `summarizeAllowance(workspaceId)`

That keeps the code compact and avoids fake abstraction.

## Layer 3: Storage adapter

Move SQLite details into an adapter area, for example:

- `apps/server/src/storage/types.ts`
- `apps/server/src/storage/sqlite/client.ts`
- `apps/server/src/storage/sqlite/schema.ts`
- `apps/server/src/storage/sqlite/users-repository.ts`
- `apps/server/src/storage/sqlite/workspaces-repository.ts`
- `apps/server/src/storage/sqlite/projects-repository.ts`
- `apps/server/src/storage/sqlite/platform-keys-repository.ts`
- `apps/server/src/storage/sqlite/billing-repository.ts`

Later, MySQL can implement the same repository ports:

- `apps/server/src/storage/mysql/...`

## Layer 4: Composition root

Create one small place that wires repositories into business services.

Example:

- `apps/server/src/app-context.ts`

This can expose something like:

- `createAppContext()`

And the returned context contains:

- repositories
- business services

Then routes and realtime code depend on that context, not on `db.ts`.

## What should stay simple

We should **not** add heavyweight patterns just to sound enterprise.

Keep these constraints:

- no generic repository base class
- no giant dependency injection framework
- no unit-of-work abstraction unless we truly need cross-repository transactions
- no separate domain entity classes unless there is real behavior inside them

Prefer:

- plain TypeScript interfaces
- plain objects
- thin service modules
- thin adapter modules

## Recommended implementation order

This should be done in small, low-risk steps.

### Step 1. Split storage boundary without changing behavior

Move `db.ts` responsibilities into:

- SQLite client/schema setup
- SQLite repository modules
- shared storage types

At the end of this step, app behavior should be identical.

### Step 2. Pull business flows into feature modules

Start with the highest-value business flows:

1. hosted bootstrap
2. platform key issuance / lookup
3. bot registration
4. billing usage recording

These are already clear business seams.

### Step 3. Remove direct `db.ts` imports from app code

Target files:

- `hosted-resources.ts`
- `http-routes.ts`
- `realtime-gateway.ts`
- `server-shared.ts`

They should depend on services or repositories, not the old storage file.

### Step 4. Shrink `db.ts` until it disappears or becomes adapter-only

Best outcome:

- `db.ts` no longer exists as the business center of gravity

Acceptable outcome:

- `db.ts` becomes a small SQLite bootstrap file only

## Suggested first branch scope

To keep this branch focused, the best slice is:

### Branch goal

Introduce the storage boundary and move the first few business flows onto it, without changing product behavior.

### In scope

- define repository interfaces
- add SQLite repository implementations
- add a small app context/composition layer
- move hosted bootstrap, key lookup/issue, and bot registration off direct `db.ts` imports

### Out of scope

- MySQL adapter implementation
- payment work
- new product UI
- schema redesign

## Success criteria

This refactor is successful if:

1. feature modules read like product logic
2. routes and realtime code no longer import `db.ts` directly
3. SQLite is just one adapter implementation
4. adding MySQL later means implementing repository ports, not rewriting business code
5. the codebase becomes easier to read top-down

## Recommendation

Yes, this is the right time.

And the right strategy is not a big rewrite.

It is:

1. draw the storage boundary now
2. move business flows feature by feature
3. keep SQLite working the whole time
4. make MySQL a later adapter, not today’s distraction
