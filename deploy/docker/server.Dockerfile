FROM node:25.5.0-bookworm-slim AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN npm install --global pnpm@10.28.2

WORKDIR /app

FROM base AS build

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/server/package.json apps/server/package.json
COPY packages/asr/package.json packages/asr/package.json
COPY packages/config/package.json packages/config/package.json
COPY packages/protocol/package.json packages/protocol/package.json
COPY packages/tts/package.json packages/tts/package.json
COPY scripts scripts

RUN pnpm install --frozen-lockfile

COPY apps/server apps/server
COPY packages packages

RUN pnpm build:packages
RUN pnpm --filter @voicyclaw/server build

FROM node:25.5.0-bookworm-slim AS runner

ENV NODE_ENV="production"
ENV PORT="3001"
ENV VOICYCLAW_SQLITE_FILE="/data/voicyclaw.sqlite"

WORKDIR /app

COPY --from=build /app/package.json ./package.json
COPY --from=build /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages ./packages
COPY --from=build /app/apps/server/package.json ./apps/server/package.json
COPY --from=build /app/apps/server/node_modules ./apps/server/node_modules
COPY --from=build /app/apps/server/dist ./apps/server/dist

RUN mkdir -p /data

EXPOSE 3001

WORKDIR /app/apps/server

CMD ["node", "dist/index.js"]
