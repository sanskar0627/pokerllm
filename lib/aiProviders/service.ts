// SERVER-ONLY MODULE — persistence + credential resolution for BYOK providers.
import { prisma } from '@/lib/db'
import { encryptApiKey, decryptApiKey, keyLast4 } from './crypto'
import { isProviderId, type ProviderId, type ProviderConfigDTO } from './catalog'

/* ─────────────────────────────────────────────────────────────────────────────
   Typed delegate for the AiProviderConfig model.
   (Local interface keeps this file strongly typed even before `prisma generate`
   has been re-run after the schema migration.)
   ──────────────────────────────────────────────────────────────────────────── */

export interface AiProviderConfigRow {
  id:              string
  userId:          string
  provider:        string
  encryptedKey:    string
  keyLast4:        string
  model:           string
  customName:      string | null
  baseUrl:         string | null
  isActive:        boolean
  status:          string
  lastValidatedAt: Date | null
  lastError:       string | null
  createdAt:       Date
  updatedAt:       Date
}

interface Delegate {
  findMany(args: { where: { userId: string }; orderBy?: { updatedAt: 'desc' } }): Promise<AiProviderConfigRow[]>
  findUnique(args: { where: { userId_provider: { userId: string; provider: string } } }): Promise<AiProviderConfigRow | null>
  upsert(args: {
    where: { userId_provider: { userId: string; provider: string } }
    create: Partial<AiProviderConfigRow> & { userId: string; provider: string; encryptedKey: string; keyLast4: string; model: string }
    update: Partial<AiProviderConfigRow>
  }): Promise<AiProviderConfigRow>
  update(args: { where: { userId_provider: { userId: string; provider: string } }; data: Partial<AiProviderConfigRow> }): Promise<AiProviderConfigRow>
  delete(args: { where: { userId_provider: { userId: string; provider: string } } }): Promise<AiProviderConfigRow>
}

function table(): Delegate {
  return (prisma as unknown as { aiProviderConfig: Delegate }).aiProviderConfig
}

/* ─── DTO mapping — the ONLY shape that ever leaves the server ─────────────── */

function toDTO(row: AiProviderConfigRow): ProviderConfigDTO {
  return {
    provider:        row.provider as ProviderId,
    model:           row.model,
    keyLast4:        row.keyLast4,
    customName:      row.customName,
    baseUrl:         row.baseUrl,
    isActive:        row.isActive,
    status:          (row.status as ProviderConfigDTO['status']) ?? 'unverified',
    lastValidatedAt: row.lastValidatedAt?.toISOString() ?? null,
    lastError:       row.lastError,
    updatedAt:       row.updatedAt.toISOString(),
  }
}

export async function listConfigs(userId: string): Promise<ProviderConfigDTO[]> {
  const rows = await table().findMany({ where: { userId }, orderBy: { updatedAt: 'desc' } })
  return rows.map(toDTO)
}

export interface UpsertInput {
  provider:    ProviderId
  apiKey?:     string        // omitted on update = keep the existing key
  model:       string
  baseUrl?:    string | null
  customName?: string | null
}

export async function upsertConfig(userId: string, input: UpsertInput): Promise<ProviderConfigDTO> {
  const existing = await table().findUnique({
    where: { userId_provider: { userId, provider: input.provider } },
  })

  let encryptedKey = existing?.encryptedKey
  let last4 = existing?.keyLast4
  if (input.apiKey) {
    encryptedKey = encryptApiKey(input.apiKey, userId)
    last4 = keyLast4(input.apiKey)
  }
  if (!encryptedKey || !last4) {
    throw new ServiceError('API key is required for a new provider', 400)
  }

  const keyChanged = Boolean(input.apiKey)
  const row = await table().upsert({
    where: { userId_provider: { userId, provider: input.provider } },
    create: {
      userId,
      provider: input.provider,
      encryptedKey,
      keyLast4: last4,
      model: input.model,
      baseUrl: input.baseUrl ?? null,
      customName: input.customName ?? null,
      status: 'unverified',
    },
    update: {
      encryptedKey,
      keyLast4: last4,
      model: input.model,
      baseUrl: input.baseUrl ?? null,
      customName: input.customName ?? null,
      // A new key invalidates previous validation; a model-only change keeps it.
      ...(keyChanged ? { status: 'unverified', lastError: null, lastValidatedAt: null } : {}),
    },
  })

  invalidateRuntimeCache(userId, input.provider)
  return toDTO(row)
}

export async function deleteConfig(userId: string, provider: ProviderId): Promise<void> {
  try {
    await table().delete({ where: { userId_provider: { userId, provider } } })
  } catch {
    throw new ServiceError('No configuration found for this provider', 404)
  }
  invalidateRuntimeCache(userId, provider)
}

export async function setValidationResult(
  userId: string,
  provider: ProviderId,
  ok: boolean,
  message: string,
): Promise<ProviderConfigDTO> {
  const row = await table().update({
    where: { userId_provider: { userId, provider } },
    data: {
      status: ok ? 'valid' : 'invalid',
      lastValidatedAt: new Date(),
      lastError: ok ? null : message,
    },
  })
  return toDTO(row)
}

/** Decrypt the stored key for a live validation run. Server-side only. */
export async function getDecryptedKey(userId: string, provider: ProviderId): Promise<{ apiKey: string; baseUrl: string | null } | null> {
  const row = await table().findUnique({ where: { userId_provider: { userId, provider } } })
  if (!row) return null
  return { apiKey: decryptApiKey(row.encryptedKey, userId), baseUrl: row.baseUrl }
}

export class ServiceError extends Error {
  constructor(message: string, public status: number) {
    super(message)
  }
}

/* ─────────────────────────────────────────────────────────────────────────────
   Game-time credential resolution.

   Poker fires an AI call every betting action, so we keep a short-TTL
   in-process cache of decrypted credentials to avoid a DB roundtrip + decrypt
   per action. The cache is invalidated on any settings change and entries
   expire after 60s. Plaintext never leaves this process.
   ──────────────────────────────────────────────────────────────────────────── */

export interface ProviderRuntime {
  apiKey:  string
  model:   string
  baseUrl: string | null
}

const RUNTIME_TTL_MS = 60_000
const runtimeCache = new Map<string, { value: ProviderRuntime | null; expires: number }>()

function invalidateRuntimeCache(userId: string, provider: string): void {
  runtimeCache.delete(`${userId}:${provider}`)
}

/**
 * Resolve a user's BYOK credentials for a provider, or null if they haven't
 * configured one (caller falls back to server env keys).
 * Inactive or unparseable configs resolve to null — the game must never crash
 * because of a settings problem.
 */
export async function resolveProviderRuntime(
  userId: string | undefined,
  provider: string,
): Promise<ProviderRuntime | null> {
  if (!userId || !isProviderId(provider)) return null

  const cacheKey = `${userId}:${provider}`
  const hit = runtimeCache.get(cacheKey)
  if (hit && hit.expires > Date.now()) return hit.value

  let value: ProviderRuntime | null = null
  try {
    const row = await table().findUnique({ where: { userId_provider: { userId, provider } } })
    if (row && row.isActive && row.status !== 'invalid') {
      value = {
        apiKey: decryptApiKey(row.encryptedKey, userId),
        model: row.model,
        baseUrl: row.baseUrl,
      }
    }
  } catch (err) {
    // Never log key material — only the failure class.
    console.error(`[aiProviders] credential resolution failed for provider=${provider}: ${err instanceof Error ? err.name : 'unknown'}`)
    value = null
  }

  runtimeCache.set(cacheKey, { value, expires: Date.now() + RUNTIME_TTL_MS })
  return value
}
