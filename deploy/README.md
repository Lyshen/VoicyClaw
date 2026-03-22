# Deploy VoicyClaw

## Local self-host with Docker Compose

1. Copy the example env file:

```bash
cp deploy/docker.env.example deploy/.env
```

2. Start the stack:

```bash
docker compose -f deploy/docker-compose.yml --env-file deploy/.env up --build
```

3. Open:

- web: `http://localhost:3000`
- server: `http://localhost:3001`

## Notes

- `VOICYCLAW_PUBLIC_SERVER_URL` is optional
- if it is empty, the web app derives the public server URL from the incoming
  request host and `VOICYCLAW_PUBLIC_SERVER_PORT`
- SQLite data is persisted in the `voicyclaw-data` named volume
- to prepare release artifacts locally, run `pnpm release:prepare`
