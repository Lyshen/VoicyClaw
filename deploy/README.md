# Deploy VoicyClaw

The full deployment story now lives here:

- [Deployment Map](../docs/deployment-map.md)

Fast path:

```bash
cp config/voicyclaw.example.yaml config/voicyclaw.local.yaml
cp deploy/docker.env.example deploy/.env
docker compose -f deploy/docker-compose.yml --env-file deploy/.env up --build
```

Open:

- web: `http://localhost:3000`
- server: `http://localhost:3001`
