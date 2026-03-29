# Extreme Onboarding Flow

## Goal

VoicyClaw should feel immediate.

The target product story is not:

- sign up
- read docs
- create a workspace
- create a project
- create a key
- guess how to connect OpenClaw

The target story is:

1. open VoicyClaw
2. click `Start now`
3. sign in
4. receive a ready-to-use default workspace
5. receive a ready-to-use first voice project
6. receive a ready-to-use API key
7. install the OpenClaw connector
8. see the bot come online
9. hear the bot speak

This is the shortest path to the core product moment:

> "My own OpenClaw bot is speaking to me now."

---

## Product Principles

### 1. No empty first session

After sign-in, the user should never face a blank dashboard that asks them to invent structure first.

VoicyClaw should prepare the minimum structure automatically.

### 2. Identity before configuration

The most important first impression is not provider switching or advanced settings.

The most important first impression is identity:

- this is my bot
- this is my voice connection
- this bot can now speak back to me

### 3. One primary path

The hosted product should have one obvious default path.

Advanced options stay available, but they should not appear before the first successful connection.

### 4. Do not break self-host mode

Local open-source mode should stay simple:

- no account requirement
- no hosted tenant dependency
- one default demo flow still works

Hosted onboarding is an added layer, not a replacement for the local demo path.

---

## Core Terms

We should keep the terms simple and stable.

### Workspace

`Workspace` is the right top-level term.

It maps well to the user-account-level container and is already familiar to most modern products.

Recommended meaning:

- one account can have one or more workspaces later
- in v1, every new account receives one default workspace automatically

### Project

`Project` is acceptable for now, even if it feels slightly SaaS-like.

Why keep it:

- it is simple
- it is already familiar
- it can map cleanly to one voice connection setup
- we can refine the visible label later without changing the internal model

Recommended user-facing framing:

- `Voice project`
- default starter project name: `SayHello`

This gives the first project a guided, action-oriented feel instead of a blank admin object.

### API Key

`API key` is the right term.

It is clear for both developers and semi-technical users, and it matches the current VoicyClaw server model.

---

## Recommended Default Objects

Every new hosted user should automatically receive:

### 1. Default workspace

Recommended shape:

- one workspace per new account
- created automatically on first sign-in
- user does not name it manually during onboarding

Recommended display strategy:

- visible name can be derived from the user identity, such as `<Name> Workspace`
- if user identity is incomplete, fall back to `My Workspace`

### 2. First voice project

Recommended starter project:

- name: `SayHello`
- role: the first guided OpenClaw voice connection

Recommended meaning:

- one project maps to one initial voice connection target
- in the current backend, this can still map to one `channelId`
- later, the project can hold more settings, provider preferences, usage, and connector state

### 3. Default API key

Recommended behavior:

- created automatically with the starter project
- already bound to the starter project's channel
- immediately usable for the OpenClaw `voicyclaw` plugin

The user should not need to click `Create key` before first success.

---

## Free Allowance Direction

Even before billing exists, the hosted product should reserve a place for a default free allowance policy.

Recommended v1 rule:

- every new hosted account receives a default free preview allowance
- ops can adjust the default quota later
- billing is not enforced yet

Important constraint:

- the first implementation only needs the allowance contract recorded
- usage enforcement can come later

This keeps product language honest while still preparing the right hosted model.

---

## Target First-Run Flow

### Landing

The landing page should offer two clear choices:

- `Start now`
- `Open on GitHub`

`Start now` is the hosted product path.

`Open on GitHub` is the self-host/open-source path.

### Authentication

If the user is not signed in:

- `Start now` routes to one consistent login page
- there should not be multiple different login surfaces with different styling or behavior

### First Sign-In Bootstrap

On the first successful hosted sign-in, VoicyClaw should automatically prepare:

- default workspace
- `SayHello` starter project
- default API key

This bootstrap should happen before the user starts configuring anything manually.

### First Protected Screen

The first protected screen should immediately help the user connect OpenClaw.

Recommended first screen behavior:

- show the starter project clearly
- show the connection status clearly
- show the install/config steps clearly
- show whether the bot is online or offline

### First Success Moment

The user finishes the first-run path only when:

- the plugin is connected
- the bot appears online
- the user can hear a spoken reply

That is the real activation event.

---

## Implementation Boundary

The onboarding layer should not force premature changes into the voice pipeline.

### Keep unchanged

- current server-side `channelId` model
- current API key issuance model
- current bot registration model
- current local demo mode
- current TTS business abstraction

### Add above the current runtime

The hosted onboarding layer can sit above the current runtime model:

- account
- workspace
- project
- starter API key
- install instructions
- online/offline presentation

This means the first hosted implementation can stay lightweight while the existing voice pipeline remains stable.

---

## Current Mapping Strategy

For v1, the cleanest mental model is:

- one hosted workspace contains one starter project
- one starter project maps to one VoicyClaw `channelId`
- one starter project owns one default API key

This lets us ship the hosted onboarding story without redesigning the current server runtime first.

Later, if usage, billing, or multi-project management become real product needs, the data model can expand behind the same user-facing concepts.

---

## Recommended Rollout Order

### Phase 1. Product contract

Document the onboarding contract clearly:

- default workspace exists
- default starter project exists
- default API key exists
- local mode stays unchanged

### Phase 2. Hosted bootstrap

On first hosted sign-in:

- create the default workspace
- create the `SayHello` starter project
- issue the default API key

### Phase 3. Guided connection UI

In the hosted Studio/Settings experience:

- show the starter project
- show the API key
- show the connector config snippet
- show online/offline state

### Phase 4. Plugin-first activation

Turn the starter project into the shortest possible install flow:

- copy install command
- copy config snippet
- restart OpenClaw
- see bot online

### Phase 5. Hosted controls

Only after activation is smooth:

- multi-project support
- editable quotas
- usage visibility
- billing

---

## UX Standard For This Flow

The hosted product should always answer these questions immediately:

- Where do I start?
- What did VoicyClaw already prepare for me?
- Which project is my first one?
- Which key should I use?
- What do I paste into OpenClaw?
- Is my bot online yet?
- Can I hear it speak yet?

If any of those answers are hidden behind extra clicks, the onboarding is still too heavy.

---

## Recommendation Summary

Recommended v1 decisions:

- keep `workspace` as the top-level term
- keep `project` for now, but frame it as a `voice project`
- auto-create one default workspace per new hosted account
- auto-create one starter voice project named `SayHello`
- auto-create one default API key bound to that starter project
- keep free allowance as a hosted contract, even before billing enforcement
- keep the current server runtime model unchanged underneath
- make the first hosted success moment: `plugin connected -> bot online -> spoken reply heard`

This should be the guiding document for the next implementation steps.
