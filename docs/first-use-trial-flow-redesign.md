---
title: First-use Trial Flow Redesign
---

# Goal

Improve first-use conversion after Product Hunt traffic by removing the login requirement from the product trial path and making the landing page move users from slogan to action faster.

# Problems In The Current Flow

- The current `Try now` path sends signed-out users to registration or sign-in.
- The first meaningful product interaction happens too late.
- The landing page explains the product, but does not move users quickly enough into a guided trial.
- The Product Hunt support CTA exists in the hero area, but it is disconnected from the point where users decide whether the product works.

# Product Changes

## 1. Landing page content removal

Remove the current three-item value prop block:

- `Talk, don't type`
- `Real-time replies`
- `Your own keys`

Reason:

- It does not help first-use conversion enough.
- It delays the user from reaching action-oriented content.

## 2. Landing page section order

Change the section order so that the user sees a guided action path immediately after the hero.

Target order:

1. Hero
2. `Three steps to make your agent speak`
3. `Everything you need to hear your agent work`
4. New trial card section
5. Footer

Notes:

- The waveform and Product Hunt area remain visually tied to the hero.
- The page should feel like: slogan -> steps -> proof -> try.

## 3. Try now behavior

Change `Try now` so it no longer sends signed-out users to auth.

New behavior:

- Hero `Try now` scrolls or jumps to the new trial card section on the landing page.
- The trial card section becomes the main conversion surface.
- From that section, the user can launch the anonymous live trial without logging in.

Recommended anchor:

- `#try-now`

## 4. Reuse Studio three-step card view

Reuse the visual language of the Studio step cards for a landing-page trial section.

Recommended cards:

- `01` Start your free try
- `02` Choose a voice path
- `03` Open the live trial studio
- `04` It works? Give us support

Notes:

- This section should look consistent with the Studio card design system.
- The Product Hunt support card should use the same card style, not a detached badge block.

## 5. Anonymous trial runtime

Add a dedicated anonymous trial entry point.

Recommended route:

- `/try`

Behavior:

- No login required.
- The page loads the existing Studio experience with a runtime created from a trial bootstrap response.
- This route should reuse as much of `ProductStudio` as possible.

## 6. Trial token changes

Change the anonymous trial token format and lifetime.

Requirements:

- Prefix: `try_`
- Expiration: `1 hour`

Recommended implementation:

- Introduce a dedicated platform key type for trial keys.
- Persist an `expires_at` field on platform keys.
- Enforce expiration during platform key authorization.

Reason:

- An explicit expiration field is clearer than inferring validity from `createdAt`.
- It creates a cleaner base for future temporary or guest access modes.

# Technical Design

## Web

### Landing page

Update `apps/web/components/landing-page.tsx`:

- remove the current value prop section
- move `HowItWorks` above `Features`
- add a new `TryNowSection`
- make hero and CTA `Try now` point to `/#try-now`
- move Product Hunt support into the trial card section

### Auth controls

Update `apps/web/components/auth-controls.tsx`:

- landing page `Try now` should no longer branch to `/sign-in`
- signed-in and signed-out users should both go to the same try entry anchor on the landing page
- `Open studio` remains available where appropriate for signed-in users

### Trial page

Add a new route in `apps/web/app`:

- `/try`

This page should:

- resolve `serverUrl`
- call a new server bootstrap endpoint for anonymous trial onboarding
- build a `WebRuntimePayload`
- render `ProductStudio`

## Server

### Trial bootstrap endpoint

Add a new endpoint:

- `POST /api/try/bootstrap`

It should:

- create or provision anonymous trial resources
- issue a temporary trial platform key
- return a payload shaped like hosted onboarding so the web runtime can reuse existing Studio logic

### Trial resource model

Recommended first version:

- create a synthetic user identity for anonymous trials
- create a default workspace for that trial user
- create a starter-like project for the trial
- issue a `trial` platform key

The exact user naming can be implementation-defined, but it should be easy to distinguish in storage.

### Platform keys

Update platform key storage and authorization:

- add a `trial` key type
- add `expiresAt` to `PlatformKeyRecord`
- store `expires_at` in SQLite
- use `try_` as the token prefix for trial keys
- reject expired trial keys during `authorizePlatformKey`

# UX Notes

- The landing page should not force account decisions before the user hears the product work.
- The trial page should feel fast and disposable.
- Users should only encounter sign-in when they want persistence, custom keys, or saved workspaces.

# Scope For This Change

## In scope

- landing page reorder
- remove low-value hero support block content section
- add landing-page trial card section
- add Product Hunt support card inside the try section
- add anonymous `/try` route
- add `try_` one-hour token flow

## Out of scope

- full guest session persistence across visits
- analytics redesign
- pricing or billing UX redesign
- major Studio IA changes beyond what is required for anonymous trial entry

# Acceptance Criteria

- Signed-out users can reach a product trial without login.
- `Try now` no longer routes signed-out users to sign-in.
- The landing page shows `Three steps to make your agent speak` before `Everything you need to hear your agent work`.
- The old three-item value prop section is removed.
- The landing page contains a new Studio-card-style try section.
- The try section includes a fourth Product Hunt support card.
- Anonymous trial keys use the `try_` prefix.
- Anonymous trial keys expire after one hour.
- Expired trial keys are rejected by server-side authorization.
