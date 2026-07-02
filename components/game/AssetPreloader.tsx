'use client'

import { useEffect } from 'react'

/**
 * Warms the browser cache for every asset the game will need mid-hand,
 * so cards/buttons never pop in the first time they're dealt.
 *
 * Runs during idle time after the table mounts; throttled in small
 * batches to avoid competing with the initial render for bandwidth.
 */

const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'] as const
const SUITS = ['hearts', 'diamonds', 'clubs', 'spades'] as const

const UI_ASSETS = [
  '/images/card-back.png',
  '/images/coin.png',
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

let preloaded = false

export function AssetPreloader() {
  useEffect(() => {
    if (preloaded) return
    preloaded = true

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
