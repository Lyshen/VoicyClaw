# Deploy VoicyClaw

The full deployment story now lives here:

- [Deployment Map](../docs/deployment-map.md)

## Repo Checkout Fast Path

```bash
mkdir -p deploy/config
cp config/voicyclaw.example.yaml deploy/config/voicyclaw.local.yaml
cp deploy/docker.env.example deploy/.env
docker compose -f deploy/docker-compose.yml --env-file deploy/.env up --build
```

Open:

- web: `http://localhost:3000`
- server: `http://localhost:3001`

## Release Bundle / Prebuilt Image Path

If you have published the Docker images to GHCR, one machine only needs a small
deployment folder:

```text
deploy/
  docker-compose.yml
  docker.env.example
  .env
  config/
    voicyclaw.local.yaml
```

Inside that folder:

```bash
cp docker.env.example .env
mkdir -p config
cp config/voicyclaw.example.yaml config/voicyclaw.local.yaml
docker compose --env-file .env up -d
```

That is the simplest hosted story today:

- one machine
- two containers: `web` and `server`
- one persistent Docker volume for SQLite
- one YAML config file mounted into both containers
