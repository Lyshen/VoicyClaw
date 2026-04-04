# Deployment Map

## Core Answer

Today the deployment story is close to:

- one machine
- two Docker containers
- one mounted YAML config file

If you stay on SQLite, a single machine is enough for the first hosted version.
If you move to MySQL later, the app containers still stay the same and only the
storage target changes.

## One Config File

The public-facing config story is:

```bash
deploy/config/voicyclaw.local.yaml
```

That file can define:

- app ports and public server URL
- auth mode and Clerk keys
- storage driver and database URL
- demo bot defaults
- TTS / ASR provider credentials

`VOICYCLAW_CONFIG` is still supported for overrides, but the normal Docker
deployment flow should start from `deploy/config/voicyclaw.local.yaml`.

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

## Docker Compose From A Repo Checkout

```bash
mkdir -p deploy/config
cp config/voicyclaw.example.yaml deploy/config/voicyclaw.local.yaml
cp deploy/docker.env.example deploy/.env
docker compose -f deploy/docker-compose.yml --env-file deploy/.env up --build
```

Open:

- web: `http://localhost:3000`
- server: `http://localhost:3001`

Notes:

- Docker mounts `deploy/config/voicyclaw.local.yaml` into both services
- the server persists SQLite data in `voicyclaw-data`
- the web container runs the same standalone server artifact shape as the built demo runtime

## Docker Compose From A Release Bundle

The release workflow can publish Docker images to GHCR and upload a small
deploy bundle. In that mode, the target machine does not need the full repo.

Expected folder:

```text
deploy/
  docker-compose.yml
  docker.env.example
  README.md
  config/
    voicyclaw.example.yaml
    voicyclaw.local.yaml
```

Commands on the machine:

```bash
cp docker.env.example .env
cp config/voicyclaw.example.yaml config/voicyclaw.local.yaml
docker compose --env-file .env up -d
```

That is the cleanest answer to “is it just images + config now?”:

- yes, if images are already published
- otherwise use repo checkout plus `--build`

## Machine Checklist

For the first hosted machine:

- Linux host with Docker Engine and Docker Compose
- 2 vCPU minimum
- 4 GB RAM recommended
- 1 public domain for the web app
- SQLite is fine for single-machine alpha deployment

Add MySQL when you want:

- stronger persistence guarantees
- easier backups
- future multi-instance scaling

## Storage Driver Path

Today:

- SQLite is the easiest local default
- MySQL is supported through the storage boundary

Practical rule:

- local dev and smoke demos: SQLite is fine
- hosted deployment: use MySQL when you need shared persistent infrastructure

The storage boundary is designed so domain code does not care which driver is underneath.
