# VoicyClaw Artifact Standardization

> Version: 0.1
> Last Updated: 2026-03-22

---

## 1. Goal

Standardize VoicyClaw into releaseable artifacts that are easy to consume,
version, and automate.

The project now has two primary product surfaces:

- the OpenClaw plugin that other users install into their OpenClaw runtime
- the VoicyClaw service itself, which is the hosted or self-hosted web plus
  backend application

---

## 2. Recommended Artifact Model

### 2.1 Plugin artifact

Ship the OpenClaw plugin as a public npm package:

- package name: `@voicyclaw/voicyclaw`
- install command:

```bash
openclaw plugins install @voicyclaw/voicyclaw
```

This is the most standard delivery model for the OpenClaw-side integration.

### 2.2 Service artifacts

Ship the VoicyClaw service as Docker images:

- `ghcr.io/lyshen/voicyclaw-server`
- `ghcr.io/lyshen/voicyclaw-web`

And provide a source-controlled compose entrypoint:

- `deploy/docker-compose.yml`

This is the standard open-source pattern for runnable services:

- libraries/plugins -> npm
- runnable services -> Docker images
- simple self-hosting -> docker compose

### 2.3 Source deployment artifact

Keep a source deployment path for contributors and early adopters:

```bash
pnpm dev
```

That remains the fastest local development workflow, but it is not the main
release artifact.

---

## 3. Versioning Strategy

Use one repository release version for now:

- git tag: `vX.Y.Z`
- npm plugin version: `X.Y.Z`
- Docker image tags:
  - `X.Y.Z`
  - `X.Y`
  - `latest` on stable releases only

This keeps the plugin and hosted service aligned while the protocol is still
moving quickly.

---

## 4. Release Outputs

Each release should ideally produce:

- npm package for `@voicyclaw/voicyclaw`
- container image for `voicyclaw-server`
- container image for `voicyclaw-web`
- compose file from `deploy/docker-compose.yml`
- release notes / changelog entry

---

## 5. Compatibility Contract

Each release should document:

- VoicyClaw repo release version
- plugin package version
- required OpenClaw version
- VoicyClaw protocol compatibility

For now, plugin compatibility is anchored by:

- `peerDependencies.openclaw`
- protocol behavior covered by the plugin smoke tests

---

## 6. Local Validation

### 6.1 Plugin

```bash
pnpm release:prepare
```

### 6.2 Service containers

```bash
pnpm docker:build:server
pnpm docker:build:web
docker compose -f deploy/docker-compose.yml up --build
```

---

## 7. GitHub Release Automation

The standardized release pipeline should support:

- plugin packaging and optional npm publish
- Docker image build and publish to GHCR
- local dry-run packaging via `pnpm release:prepare`
- manual `workflow_dispatch` dry-runs before real publishing
- tag-driven release publishing from `vX.Y.Z`

Implementation entrypoint:

- `.github/workflows/release-artifacts.yml`

Required secrets:

- `NPM_TOKEN` for npm publish

Docker publishing can use:

- `GITHUB_TOKEN`

---

## 8. Why This Shape

This split matches common open-source practice:

- installable integration pieces are distributed as packages
- deployable apps are distributed as images
- compose files give a low-friction self-hosting path

It also keeps VoicyClaw flexible:

- hosted SaaS can run the same server and web images
- self-host users get a standard deployment artifact
- OpenClaw users can install the plugin without touching the service codebase
