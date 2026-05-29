'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

// ─── Background music singleton ──────────────────────────────────────────────

let bgMusic: HTMLAudioElement | null = null

function getBgMusic(): HTMLAudioElement {
  if (!bgMusic) {
    bgMusic = new Audio('/music/funoro-youx27re-gonna-like-it-here-469728.mp3')
    bgMusic.loop = true
    bgMusic.volume = 0.3
  }
  return bgMusic
}

// ─── Sound effects ───────────────────────────────────────────────────────────

const sfxCache = new Map<string, HTMLAudioElement>()

function getSfx(path: string): HTMLAudioElement {
  let audio = sfxCache.get(path)
  if (!audio) {
    audio = new Audio(path)
    audio.volume = 0.5
    sfxCache.set(path, audio)
  }
  return audio
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useAudio() {
  const [musicOn, setMusicOn] = useState(false)
  const [soundOn, setSoundOn] = useState(true)

  useEffect(() => {
    const music = getBgMusic()
    if (musicOn) {
      music.play().catch(() => {})
    } else {
      music.pause()
    }
  }, [musicOn])

  const toggleMusic = useCallback(() => setMusicOn(v => !v), [])
  const toggleSound = useCallback(() => setSoundOn(v => !v), [])

  const playSound = useCallback((name: 'card-shuffle' | 'chip-toss' | 'win-coins') => {
    if (!soundOn) return
    const sfx = getSfx(`/sounds/${name}.mp3`)
    sfx.currentTime = 0
    sfx.play().catch(() => {})
  }, [soundOn])

  return { musicOn, soundOn, toggleMusic, toggleSound, playSound }
}
