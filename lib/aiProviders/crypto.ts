// SERVER-ONLY MODULE — never import from client components.
import { createCipheriv, createDecipheriv, createHash, hkdfSync, randomBytes } from 'crypto'

/**
 * API-key vault — AES-256-GCM authenticated encryption.
 *
 * Security properties (see docs/AI_PROVIDER_SETTINGS.md):
 * - Fresh random 96-bit IV per encryption (GCM requirement: never reuse).
 * - The owner's userId is bound as AAD: a ciphertext moved to another user's
 *   row fails authentication. Ownership is enforced cryptographically.
 * - Versioned wire format `v1.<iv>.<ct>.<tag>` (base64url) → key rotation path.
 * - Master key comes from AI_KEY_ENCRYPTION_SECRET (32 bytes, base64).
 *   Generate one with: openssl rand -base64 32
 *   Dev fallback: HKDF-SHA256 derived from AUTH_SECRET with a vault-specific
 *   info tag, so it is independent of session-signing material.
 *
 * This module is the ONLY place that touches key material. Swapping in KMS
 * envelope encryption later is contained to this file.
 */

const VERSION = 'v1'

let cachedKey: Buffer | null = null

function masterKey(): Buffer {
  if (cachedKey) return cachedKey

  const explicit = process.env.AI_KEY_ENCRYPTION_SECRET
  if (explicit) {
    const buf = Buffer.from(explicit, 'base64')
    if (buf.length !== 32) {
      throw new Error('AI_KEY_ENCRYPTION_SECRET must be 32 bytes of base64 (openssl rand -base64 32)')
    }
    cachedKey = buf
    return buf
  }

  const authSecret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET
  if (!authSecret) {
    // Fail closed — with no secret we cannot protect anything.
    throw new Error('No AI_KEY_ENCRYPTION_SECRET or AUTH_SECRET configured — cannot encrypt API keys')
  }
  if (process.env.NODE_ENV === 'production') {
    console.warn('[aiProviders] ⚠ Deriving vault key from AUTH_SECRET. Set a dedicated AI_KEY_ENCRYPTION_SECRET in production.')
  }
  cachedKey = Buffer.from(hkdfSync('sha256', authSecret, 'pokerllm-ai-key-vault', 'ai-provider-keys-v1', 32))
  return cachedKey
}

const b64u = {
  enc: (b: Buffer) => b.toString('base64url'),
  dec: (s: string) => Buffer.from(s, 'base64url'),
}

/** Encrypt an API key for storage. `ownerUserId` is bound as AAD. */
export function encryptApiKey(plaintext: string, ownerUserId: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', masterKey(), iv)
  cipher.setAAD(Buffer.from(ownerUserId, 'utf8'))
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${VERSION}.${b64u.enc(iv)}.${b64u.enc(ct)}.${b64u.enc(tag)}`
}

/**
 * Decrypt a stored API key. Throws if the ciphertext was tampered with or
 * does not belong to `ownerUserId`. Never log the return value.
 */
export function decryptApiKey(stored: string, ownerUserId: string): string {
  const [version, ivB64, ctB64, tagB64] = stored.split('.')
  if (version !== VERSION || !ivB64 || !ctB64 || !tagB64) {
    throw new Error('Unrecognized encrypted key format')
  }
  const decipher = createDecipheriv('aes-256-gcm', masterKey(), b64u.dec(ivB64))
  decipher.setAAD(Buffer.from(ownerUserId, 'utf8'))
  decipher.setAuthTag(b64u.dec(tagB64))
  return Buffer.concat([decipher.update(b64u.dec(ctB64)), decipher.final()]).toString('utf8')
}

/** Last 4 characters for display ("••••abcd"). Safe to store & return. */
export function keyLast4(plaintext: string): string {
  return plaintext.slice(-4)
}

/** Stable non-reversible fingerprint — safe for cache keys / logs. */
export function fingerprint(plaintext: string): string {
  return createHash('sha256').update(plaintext).digest('hex').slice(0, 16)
}
