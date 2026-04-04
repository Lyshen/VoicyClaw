# Deployment Map

## One Config File

The public-facing config story is:

```bash
config/voicyclaw.local.yaml
```

That file can define:

- app ports and public server URL
- auth mode and Clerk keys
- storage driver and database URL
- demo bot defaults
- TTS / ASR provider credentials

`VOICYCLAW_CONFIG` is still supported for overrides, but the normal repo flow should start from `config/voicyclaw.local.yaml`.

## Local Development

```bash
cp config/voicyclaw.example.yaml config/voicyclaw.local.yaml
pnpm install
pnpm dev
```

What happens:

- the config package builds the runtime env from YAML
- the server runs from source
- the web app runs in Next dev mode
- the mock bot runs from source

Open:

- web: `http://localhost:3000`
- server: `http://localhost:3001`

## Built Demo Runtime

```bash
pnpm build
pnpm start:demo
```

What happens:

- server runs from `apps/server/dist`
- web runs from Next standalone output
- mock bot runs from `apps/mock-bot/dist`

This is the same runtime shape used by Playwright and the closest local match to Docker.

## E2E / CI

```bash
pnpm test:e2e
```

What happens:

1. build the repo
2. start the built demo runtime
3. run Playwright against it

That means CI no longer tests a special ad-hoc runtime path. It tests the same built runtime model used for demo verification.

## Docker Compose

```bash
cp config/voicyclaw.example.yaml config/voicyclaw.local.yaml
cp deploy/docker.env.example deploy/.env
docker compose -f deploy/docker-compose.yml --env-file deploy/.env up --build
```

Open:

- web: `http://localhost:3000`
- server: `http://localhost:3001`

Notes:

- Docker mounts `config/voicyclaw.local.yaml` into both services
- the server persists SQLite data in `voicyclaw-data`
- the web container runs the same standalone server artifact shape as the built demo runtime

## Storage Driver Path

Today:

- SQLite is the easiest local default
- MySQL is supported through the storage boundary

Practical rule:

- local dev and smoke demos: SQLite is fine
- hosted deployment: use MySQL when you need shared persistent infrastructure

The storage boundary is designed so domain code does not care which driver is underneath.
