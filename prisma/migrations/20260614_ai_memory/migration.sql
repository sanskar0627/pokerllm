-- AI Memory Tables: Per-user, per-model permanent memory
-- Run: npx prisma migrate dev --name ai_memory

-- Per-user opponent profiles (one per AI model per user)
CREATE TABLE "AiPlayerProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "aiModel" TEXT NOT NULL,
    "gamesPlayed" INTEGER NOT NULL DEFAULT 0,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "losses" INTEGER NOT NULL DEFAULT 0,
    "overallStyle" TEXT NOT NULL DEFAULT 'Unknown',
    "traits" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "patterns" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiPlayerProfile_pkey" PRIMARY KEY ("id")
);

-- AI-authored notes (the AI decides what to remember)
CREATE TABLE "AiNote" (
    "id" TEXT NOT NULL,
    "aiModel" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "phase" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiNote_pkey" PRIMARY KEY ("id")
);

-- Global AI strategy insights (shared across all users, per model)
CREATE TABLE "AiGlobalInsight" (
    "id" TEXT NOT NULL,
    "aiModel" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiGlobalInsight_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX "AiPlayerProfile_aiModel_idx" ON "AiPlayerProfile"("aiModel");
CREATE UNIQUE INDEX "AiPlayerProfile_userId_aiModel_key" ON "AiPlayerProfile"("userId", "aiModel");

CREATE INDEX "AiNote_aiModel_userId_idx" ON "AiNote"("aiModel", "userId");
CREATE INDEX "AiNote_aiModel_idx" ON "AiNote"("aiModel");

CREATE INDEX "AiGlobalInsight_aiModel_idx" ON "AiGlobalInsight"("aiModel");
CREATE UNIQUE INDEX "AiGlobalInsight_aiModel_text_key" ON "AiGlobalInsight"("aiModel", "text");

-- Foreign keys
ALTER TABLE "AiPlayerProfile" ADD CONSTRAINT "AiPlayerProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiNote" ADD CONSTRAINT "AiNote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
