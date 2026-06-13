'use client'

import { useEffect } from 'react'

/**
 * Handles bfcache restoration (back/forward cache).
 * If the browser restores the page from bfcache, reload to get fresh state.
 */
export function BfcacheFix() {
  useEffect(() => {
    function handlePageShow(e: PageTransitionEvent) {
      if (e.persisted) {
        window.location.reload()
      }
    }
    window.addEventListener('pageshow', handlePageShow)
    return () => window.removeEventListener('pageshow', handlePageShow)
  }, [])

  return null
}
