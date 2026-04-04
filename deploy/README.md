# Deploy VoicyClaw

## Local self-host with Docker Compose

1. Copy the unified config file:

```bash
cp config/voicyclaw.example.yaml config/voicyclaw.local.yaml
```

2. Copy the example env file if you want to customize published ports or the public server URL:

```bash
cp deploy/docker.env.example deploy/.env
```

3. Start the stack:

```bash
docker compose -f deploy/docker-compose.yml --env-file deploy/.env up --build
```

4. Open:

- web: `http://localhost:3000`
- server: `http://localhost:3001`

## Notes

- Docker Compose mounts `config/voicyclaw.local.yaml` into the stack so the
  server-side runtime reads one repo-local YAML file for storage, demo bot, and
  provider credentials
- `VOICYCLAW_PUBLIC_SERVER_URL` is optional
- if it is empty, the web app derives the public server URL from the incoming
  request host and `VOICYCLAW_PUBLIC_SERVER_PORT`
- SQLite data is persisted in the `voicyclaw-data` named volume
- to prepare release artifacts locally, run `pnpm release:prepare`
