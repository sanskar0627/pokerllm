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
  slot:            number
  via:             string
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

type SlotKey = { userId_provider_slot: { userId: string; provider: string; slot: number } }

interface Delegate {
  findMany(args: { where: Partial<{ userId: string; provider: string; isActive: boolean }>; orderBy?: { updatedAt: 'desc' } | { slot: 'asc' } }): Promise<AiProviderConfigRow[]>
  findFirst(args: { where: Partial<{ userId: string; provider: string; isActive: boolean }> }): Promise<AiProviderConfigRow | null>
  findUnique(args: { where: SlotKey }): Promise<AiProviderConfigRow | null>
  upsert(args: {
    where: SlotKey
    create: Partial<AiProviderConfigRow> & { userId: string; provider: string; encryptedKey: string; keyLast4: string; model: string }
    update: Partial<AiProviderConfigRow>
  }): Promise<AiProviderConfigRow>
  update(args: { where: SlotKey; data: Partial<AiProviderConfigRow> }): Promise<AiProviderConfigRow>
  updateMany(args: { where: Partial<{ userId: string; provider: string }>; data: Partial<AiProviderConfigRow> }): Promise<{ count: number }>
  delete(args: { where: SlotKey }): Promise<AiProviderConfigRow>
}

function table(): Delegate {
  return (prisma as unknown as { aiProviderConfig: Delegate }).aiProviderConfig
}

/* ─── DTO mapping — the ONLY shape that ever leaves the server ─────────────── */

function toDTO(row: AiProviderConfigRow): ProviderConfigDTO {
  return {
    provider:        row.provider as ProviderId,
    slot:            row.slot,
    via:             (row.via === 'openrouter' ? 'openrouter' : 'official'),
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
  slot?:       number        // custom endpoints can occupy slots 0..N; others always 0
  via?:        'official' | 'openrouter'
  apiKey?:     string        // omitted on update = keep the existing key
  model:       string
  baseUrl?:    string | null
  customName?: string | null
}

export async function upsertConfig(userId: string, input: UpsertInput): Promise<ProviderConfigDTO> {
  const slot = input.provider === 'custom' ? (input.slot ?? 0) : 0
  const existing = await table().findUnique({
    where: { userId_provider_slot: { userId, provider: input.provider, slot } },
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
    where: { userId_provider_slot: { userId, provider: input.provider, slot } },
    create: {
      userId,
      provider: input.provider,
      slot,
      via: input.via ?? 'official',
      encryptedKey,
      keyLast4: last4,
      model: input.model,
      baseUrl: input.baseUrl ?? null,
      customName: input.customName ?? null,
      status: 'unverified',
      // first custom endpoint starts active; later slots start inactive
      isActive: input.provider === 'custom' ? slot === 0 || undefined : undefined,
    },
    update: {
      via: input.via ?? 'official',
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

export async function deleteConfig(userId: string, provider: ProviderId, slot = 0): Promise<void> {
  try {
    await table().delete({ where: { userId_provider_slot: { userId, provider, slot } } })
  } catch {
    throw new ServiceError('No configuration found for this provider', 404)
  }
  invalidateRuntimeCache(userId, provider)
}

/** Make one custom endpoint the active one (exclusive). */
export async function setActiveCustom(userId: string, slot: number): Promise<ProviderConfigDTO> {
  const target = await table().findUnique({ where: { userId_provider_slot: { userId, provider: 'custom', slot } } })
  if (!target) throw new ServiceError('No custom endpoint in that slot', 404)
  await table().updateMany({ where: { userId, provider: 'custom' }, data: { isActive: false } })
  const row = await table().update({ where: { userId_provider_slot: { userId, provider: 'custom', slot } }, data: { isActive: true } })
  invalidateRuntimeCache(userId, 'custom')
  return toDTO(row)
}

export async function setValidationResult(
  userId: string,
  provider: ProviderId,
  ok: boolean,
  message: string,
  slot = 0,
): Promise<ProviderConfigDTO> {
  const row = await table().update({
    where: { userId_provider_slot: { userId, provider, slot } },
    data: {
      status: ok ? 'valid' : 'invalid',
      lastValidatedAt: new Date(),
      lastError: ok ? null : message,
    },
  })
  return toDTO(row)
}

/** Decrypt the stored key for a live validation run. Server-side only. */
export async function getDecryptedKey(userId: string, provider: ProviderId, slot = 0): Promise<{ apiKey: string; baseUrl: string | null } | null> {
  const row = await table().findUnique({ where: { userId_provider_slot: { userId, provider, slot } } })
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
    // custom: the game seat uses whichever endpoint is marked active
    const row = provider === 'custom'
      ? await table().findFirst({ where: { userId, provider: 'custom', isActive: true } })
      : await table().findUnique({ where: { userId_provider_slot: { userId, provider, slot: 0 } } })
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
