# ── Stage 1: Install dependencies ────────────────────────────────────────────
FROM oven/bun:1 AS deps
WORKDIR /app

COPY package.json bun.lock ./
COPY prisma ./prisma/
RUN bun install --frozen-lockfile

# ── Stage 2: Build Next.js ───────────────────────────────────────────────────
FROM oven/bun:1 AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma client
RUN bunx prisma generate

# Build Next.js (outputs to .next/)
RUN bun run build

# ── Stage 3: Production image ────────────────────────────────────────────────
FROM oven/bun:1-slim AS runner
WORKDIR /app

ENV NODE_ENV=production

# Don't run as root
RUN addgroup --system --gid 1001 nodejs && \
    adduser  --system --uid 1001 pokerllm
USER pokerllm

# Copy built artifacts
COPY --from=builder --chown=pokerllm:nodejs /app/.next ./.next
COPY --from=builder --chown=pokerllm:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=pokerllm:nodejs /app/package.json ./
COPY --from=builder --chown=pokerllm:nodejs /app/server.ts ./
COPY --from=builder --chown=pokerllm:nodejs /app/next.config.ts ./
COPY --from=builder --chown=pokerllm:nodejs /app/tsconfig.json ./
COPY --from=builder --chown=pokerllm:nodejs /app/public ./public
COPY --from=builder --chown=pokerllm:nodejs /app/prisma ./prisma
COPY --from=builder --chown=pokerllm:nodejs /app/lib ./lib
COPY --from=builder --chown=pokerllm:nodejs /app/types ./types

EXPOSE 3000

CMD ["bun", "server.ts"]
