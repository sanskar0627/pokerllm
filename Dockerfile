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

# Ensure public/ exists (may be missing if large media isn't in git)
RUN mkdir -p public

# Generate Prisma client
RUN bunx prisma generate

# Build Next.js (outputs to .next/)
RUN bun run build

# ── Stage 3: Production image ────────────────────────────────────────────────
FROM oven/bun:1-slim AS runner
WORKDIR /app

ENV NODE_ENV=production

# Don't run as root
RUN groupadd --system --gid 1001 nodejs && \
    useradd  --system --uid 1001 --gid nodejs pokerllm
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
COPY --from=builder --chown=pokerllm:nodejs /app/prisma.config.ts ./

EXPOSE 3000

# Boot: verify critical env vars are visible, apply DB migrations, start server.
CMD ["sh", "-c", "\
  MISSING=0; \
  for v in DATABASE_URL AUTH_SECRET NEXTAUTH_URL; do \
    if [ -z \"$(printenv $v)\" ]; then echo \"❌ MISSING ENV VAR: $v — set it in Railway → Variables\"; MISSING=1; fi; \
  done; \
  if [ \"$MISSING\" = \"1\" ]; then echo '🛑 Aborting: fix missing env vars above.'; exit 1; fi && \
  bunx prisma migrate deploy && bun server.ts"]
