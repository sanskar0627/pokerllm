-- Add OpenRouter routing option + multi-slot custom endpoints
ALTER TABLE "AiProviderConfig" ADD COLUMN "slot" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "AiProviderConfig" ADD COLUMN "via" TEXT NOT NULL DEFAULT 'official';

-- Replace the uniqueness: one config per (user, provider, slot)
DROP INDEX "AiProviderConfig_userId_provider_key";
CREATE UNIQUE INDEX "AiProviderConfig_userId_provider_slot_key" ON "AiProviderConfig"("userId", "provider", "slot");
