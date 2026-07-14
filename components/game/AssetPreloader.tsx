'use client'

import { useEffect } from 'react'

/**
 * Game asset warming — two tiers:
 *
 * 1. CRITICAL: everything visible in the first frame of the table scene
 *    (room background, felt, top bar, card back, avatars, coin).
 *    `preloadCriticalAssets()` decodes these in parallel and resolves when
 *    they're paintable — the game page gates its scene reveal on this, so
 *    the table appears as one complete frame instead of assembling itself.
 *    Capped by a timeout so a slow network can never block the game.
 *
 * 2. EVERYTHING ELSE: all 52 card faces + action buttons, warmed during
 *    idle time in small batches. Mounted on the lobby too, so by the time
 *    a player navigates to /game/:id the cache is already hot.
 */

const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'] as const
const SUITS = ['hearts', 'diamonds', 'clubs', 'spades'] as const

/** First-frame scene assets — decoded before the table is revealed. */
const CRITICAL_ASSETS = [
  '/images/table-room-bg.png',
  '/images/tabletop-removebg-preview.png',
  '/images/topbar-bg.png',
  '/images/card-back.png',
  '/images/avatar-placeholder.png',
  '/images/coin.png',
]

const UI_ASSETS = [
  '/images/btn-minus.png',
  '/images/btn-plus.png',
  '/images/raise-input-bg.png',
  '/images/buttons/fold-btn.png',
  '/images/buttons/fold-btn-pressed.png',
  '/images/buttons/call-btn.png',
  '/images/buttons/call-btn-pressed.png',
  '/images/buttons/raise-btn.png',
  '/images/buttons/raise-btn-pressed.png',
  '/images/buttons/allin-btn.png',
]

function decodeImage(url: string): Promise<void> {
  return new Promise((resolve) => {
    const img = new Image()
    img.decoding = 'async'
    img.onload = () => {
      // decode() paints-readies the bitmap off the main thread where supported
      img.decode?.().then(resolve, () => resolve()) ?? resolve()
    }
    img.onerror = () => resolve() // missing asset must never block the game
    img.src = url
  })
}

let criticalPromise: Promise<void> | null = null

/**
 * Decode every first-frame asset in parallel. Memoized — instant on repeat
 * calls (route re-entry, next game). Never takes longer than `timeoutMs`.
 */
export function preloadCriticalAssets(timeoutMs = 2500): Promise<void> {
  if (!criticalPromise) {
    criticalPromise = Promise.all(CRITICAL_ASSETS.map(decodeImage)).then(() => undefined)
  }
  const cap = new Promise<void>(resolve => setTimeout(resolve, timeoutMs))
  return Promise.race([criticalPromise, cap])
}

let warmed = false

export function AssetPreloader() {
  useEffect(() => {
    if (warmed) return
    warmed = true

    // Kick the critical set immediately (no-op if already resolved)
    void preloadCriticalAssets()

    // Warm the long tail (52 cards + buttons) during idle time
    const urls = [
      ...UI_ASSETS,
      ...SUITS.flatMap(s => RANKS.map(r => `/images/cards/${r}_${s}.png`)),
    ]

    let i = 0
    const BATCH = 6

    function loadBatch() {
      const batch = urls.slice(i, i + BATCH)
      if (batch.length === 0) return
      i += BATCH
      let done = 0
      for (const url of batch) {
        const img = new Image()
        img.decoding = 'async'
        img.onload = img.onerror = () => {
          done++
          if (done === batch.length) schedule(loadBatch)
        }
        img.src = url
      }
    }

    function schedule(fn: () => void) {
      if ('requestIdleCallback' in window) {
        (window as Window & { requestIdleCallback: (cb: () => void) => void }).requestIdleCallback(fn)
      } else {
        setTimeout(fn, 60)
      }
    }

    schedule(loadBatch)
  }, [])

  return null
}
