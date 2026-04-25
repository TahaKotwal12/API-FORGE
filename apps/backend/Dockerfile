# ─── Stage 1: install dependencies ──────────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app

RUN npm install -g pnpm@9

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/config/tsconfig.base.json packages/config/
COPY packages/db/package.json packages/db/
COPY apps/backend/package.json apps/backend/

RUN pnpm install --frozen-lockfile --filter @apiforge/backend... --ignore-scripts

# ─── Stage 2: generate Prisma client + build ─────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

RUN npm install -g pnpm@9

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/db/node_modules ./packages/db/node_modules
COPY --from=deps /app/apps/backend/node_modules ./apps/backend/node_modules

COPY pnpm-workspace.yaml turbo.json ./
COPY packages/config ./packages/config
COPY packages/db ./packages/db
COPY apps/backend ./apps/backend

# Generate Prisma client
RUN pnpm --filter @apiforge/db exec prisma generate

# Build backend
RUN pnpm --filter @apiforge/backend run build

# ─── Stage 3: distroless production image ────────────────────────────────────
FROM gcr.io/distroless/nodejs20-debian12:nonroot AS runner
WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/apps/backend/dist ./dist
COPY --from=builder /app/packages/db/src/generated ./packages/db/src/generated
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/backend/node_modules ./apps/backend/node_modules

EXPOSE 4000

USER nonroot
CMD ["dist/main"]
