import Anthropic                        from '@anthropic-ai/sdk'
import OpenAI                           from 'openai'
import { GoogleGenerativeAI }           from '@google/generative-ai'
import type { GameState, ActionPayload, PlayerAction, Card, AIModel, PlayerStats, HandSummary, AIGameMemory, AIThought, AIReflection, AIReflectionPayload } from '@/types/poker'
import { getBestHand }                  from '@/lib/handEvaluator'
import { buildPermanentMemorySection, saveAINote }  from '@/lib/permanentMemory'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SUIT_SYM: Record<string, string> = { hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠' }
const RANK_VAL: Record<string, number> = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7,
  '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14,
}

const fmt    = (c: Card) => `${c.rank}${SUIT_SYM[c.suit]}`
const safeName = (s: string) =>
  s.replace(/[^\x20-\x7E]/g, '').replace(/[<>'"`;]/g, '').slice(0, 20) || 'Player'

// Dev-mode verbose logging — shows AI thinking, memory state, reflections
// Automatically disabled in production
const DEV = process.env.NODE_ENV !== 'production'
function devLog(model: string, ...args: unknown[]): void {
  if (!DEV) return
  console.log(`[DEV][${model.toUpperCase()}]`, ...args)
}

// ─── Per-game AI memory store ────────────────────────────────────────────────
// Maps gameId → (playerId → AIGameMemory). Persists across rounds, cleared on game end.

const gameMemories = new Map<string, Map<string, AIGameMemory>>()

function getOrCreateMemory(gameId: string, playerId: string): AIGameMemory {
  if (!gameMemories.has(gameId)) gameMemories.set(gameId, new Map())
  const gameMap = gameMemories.get(gameId)!
  if (!gameMap.has(playerId)) {
    gameMap.set(playerId, {
      thoughts: [],
      reflections: [],
      opponentNotes: {},
      strategyNotes: [],
    })
  }
  return gameMap.get(playerId)!
}

function storeThought(gameId: string, playerId: string, thought: AIThought): void {
  const mem = getOrCreateMemory(gameId, playerId)
  mem.thoughts.push(thought)
}

function storeReflection(gameId: string, playerId: string, reflection: AIReflection): void {
  const mem = getOrCreateMemory(gameId, playerId)
  mem.reflections.push(reflection)
  // Merge opponent reads into cumulative notes
  for (const [oppId, note] of Object.entries(reflection.opponentReads)) {
    if (!mem.opponentNotes[oppId]) mem.opponentNotes[oppId] = []
    if (note.trim()) mem.opponentNotes[oppId].push(note)
  }
  // Keep strategy notes from insights
  for (const insight of reflection.insights) {
    if (insight.trim()) mem.strategyNotes.push(insight)
  }
  // Cap memory size — keep last 20 strategy notes, last 10 opponent notes per player
  if (mem.strategyNotes.length > 20) mem.strategyNotes = mem.strategyNotes.slice(-20)
  for (const oppId of Object.keys(mem.opponentNotes)) {
    if (mem.opponentNotes[oppId].length > 10) {
      mem.opponentNotes[oppId] = mem.opponentNotes[oppId].slice(-10)
    }
  }
}

export function clearGameMemory(gameId: string): void {
  gameMemories.delete(gameId)
  gameChatLogs.delete(gameId)
  console.log(`[LLM] 🧹 Cleared AI memory for game ${gameId}`)
}

// ─── Per-game chat log (table talk between AIs) ─────────────────────────────
// Stores recent chat messages so AIs can see and reply to each other's trash talk.

interface ChatEntry {
  playerName: string
  message:    string
}

const gameChatLogs = new Map<string, ChatEntry[]>()

export function addChatMessage(gameId: string, playerName: string, message: string): void {
  if (!gameChatLogs.has(gameId)) gameChatLogs.set(gameId, [])
  const log = gameChatLogs.get(gameId)!
  log.push({ playerName, message })
  // Keep last 6 messages
  if (log.length > 6) gameChatLogs.set(gameId, log.slice(-6))
}

function buildChatSection(gameId: string): string {
  const log = gameChatLogs.get(gameId)
  if (!log || log.length === 0) return '  No table talk yet.'
  return log.map(e => `  ${safeName(e.playerName)}: "${e.message}"`).join('\n')
}

export function getGameMemories(gameId: string): Map<string, AIGameMemory> | undefined {
  return gameMemories.get(gameId)
}

/** Dev-only: quick summary of an AI's current memory state */
function devMemorySummary(gameId: string, playerId: string): string {
  if (!DEV) return ''
  const mem = gameMemories.get(gameId)?.get(playerId)
  if (!mem) return 'empty'
  return `${mem.thoughts.length} thoughts, ${mem.reflections.length} reflections, ${mem.strategyNotes.length} strategies, ${Object.keys(mem.opponentNotes).length} opponent reads`
}

/** Format accumulated memory into a prompt section */
function buildMemorySection(gameId: string, playerId: string, state: GameState): string {
  const mem = gameMemories.get(gameId)?.get(playerId)
  if (!mem || (mem.strategyNotes.length === 0 && Object.keys(mem.opponentNotes).length === 0 && mem.reflections.length === 0)) {
    return '  No memories yet — this is your first hand, observe carefully.'
  }

  const lines: string[] = []

  // Strategy notes from past reflections
  if (mem.strategyNotes.length > 0) {
    lines.push('  Strategy learnings from past hands:')
    // Show last 8 most recent
    const recent = mem.strategyNotes.slice(-8)
    for (const note of recent) lines.push(`    • ${note}`)
  }

  // Opponent-specific notes
  const oppEntries = Object.entries(mem.opponentNotes).filter(([, notes]) => notes.length > 0)
  if (oppEntries.length > 0) {
    lines.push('  Opponent reads from past hands:')
    for (const [oppId, notes] of oppEntries) {
      const name = safeName(state.players.find(p => p.id === oppId)?.name ?? oppId)
      // Show last 3 notes per opponent
      const recent = notes.slice(-3)
      lines.push(`    ${name}: ${recent.join(' | ')}`)
    }
  }

  return lines.join('\n')
}

// ─── Hand strength analysis (tells the AI exactly what it has) ───────────────

function analyzeHandStrength(holeCards: Card[], communityCards: Card[]): string {
  const lines: string[] = []

  if (communityCards.length === 0) {
    // Preflop — analyze starting hand quality
    const ranks = holeCards.map(c => RANK_VAL[c.rank]).sort((a, b) => b - a)
    const suited = holeCards[0].suit === holeCards[1].suit
    const pair = ranks[0] === ranks[1]
    const gap = ranks[0] - ranks[1]
    const connected = gap === 1
    const oneGap = gap === 2

    if (pair) {
      if (ranks[0] >= 11) lines.push(`PREMIUM PAIR: ${holeCards.map(fmt).join(' ')} — top pair, strong open`)
      else if (ranks[0] >= 7) lines.push(`MEDIUM PAIR: ${holeCards.map(fmt).join(' ')} — set-mining hand`)
      else lines.push(`SMALL PAIR: ${holeCards.map(fmt).join(' ')} — set-mine only, weak without improvement`)
    } else if (ranks[0] >= 13 && ranks[1] >= 13) {
      lines.push(`PREMIUM BROADWAY: ${holeCards.map(fmt).join(' ')}${suited ? ' (suited)' : ''} — strong open`)
    } else if (ranks[0] === 14) {
      if (ranks[1] >= 10) lines.push(`STRONG ACE: ${holeCards.map(fmt).join(' ')}${suited ? ' (suited)' : ''}`)
      else lines.push(`WEAK ACE: ${holeCards.map(fmt).join(' ')}${suited ? ' suited — playable' : ' — be cautious, easily dominated'}`)
    } else if (suited && (connected || oneGap) && ranks[1] >= 5) {
      lines.push(`SUITED CONNECTOR: ${holeCards.map(fmt).join(' ')} — good implied odds, play for flushes/straights`)
    } else if (ranks[0] >= 10 && ranks[1] >= 10) {
      lines.push(`BROADWAY: ${holeCards.map(fmt).join(' ')}${suited ? ' (suited)' : ''} — playable`)
    } else if (ranks[0] <= 9 && ranks[1] <= 7 && !suited) {
      lines.push(`TRASH HAND: ${holeCards.map(fmt).join(' ')} — fold in most situations`)
    } else {
      lines.push(`MARGINAL: ${holeCards.map(fmt).join(' ')}${suited ? ' (suited)' : ''} — position dependent`)
    }

    return lines.join('\n  ')
  }

  // Postflop — use hand evaluator for actual made hand
  const best = getBestHand(holeCards, communityCards)
  lines.push(`MADE HAND: ${best.name} (rank ${best.rank}/10, 1=best)`)

  // Contextual strength relative to board
  const boardRanks = communityCards.map(c => RANK_VAL[c.rank]).sort((a, b) => b - a)
  const myRanks = holeCards.map(c => RANK_VAL[c.rank])

  if (best.rank === 9) { // One pair
    // Is it top pair, middle pair, or bottom pair?
    if (myRanks.some(r => r === boardRanks[0])) lines.push('→ TOP PAIR — strong, bet for value')
    else if (myRanks.some(r => r === boardRanks[1])) lines.push('→ MIDDLE PAIR — decent, be cautious vs raises')
    else if (myRanks.some(r => boardRanks.includes(r))) lines.push('→ BOTTOM PAIR — weak, fold to heavy aggression')
    else lines.push('→ POCKET PAIR below board — vulnerable')
  } else if (best.rank <= 4) {
    lines.push('→ MONSTER HAND — bet big for value, do NOT slow-play')
  } else if (best.rank <= 6) {
    lines.push('→ STRONG HAND — bet for value, protect against draws')
  } else if (best.rank === 10) {
    lines.push('→ HIGH CARD ONLY — very weak, consider folding or bluffing')
  }

  // ── Draw detection ──
  const allCards = [...holeCards, ...communityCards]
  const draws: string[] = []

  // Flush draw
  const suitCounts: Record<string, number> = {}
  for (const c of allCards) suitCounts[c.suit] = (suitCounts[c.suit] ?? 0) + 1
  for (const [suit, count] of Object.entries(suitCounts)) {
    const myContribution = holeCards.filter(c => c.suit === suit).length
    if (count === 4 && myContribution >= 1) {
      const cardsLeft = communityCards.length < 5 ? (5 - communityCards.length) : 0
      if (cardsLeft > 0) {
        const outs = 13 - count // 9 outs for a flush
        const equity = communityCards.length === 3
          ? Math.round(outs * 4) // rule of 4 on flop
          : Math.round(outs * 2) // rule of 2 on turn
        draws.push(`FLUSH DRAW (${SUIT_SYM[suit]}) — ${outs} outs, ~${equity}% to hit`)
      }
    }
  }

  // Straight draw detection
  const uniqueVals = [...new Set(allCards.map(c => RANK_VAL[c.rank]))].sort((a, b) => a - b)
  // Add low ace
  if (uniqueVals.includes(14)) uniqueVals.unshift(1)

  // Check for open-ended straight draw (4 consecutive)
  for (let i = 0; i <= uniqueVals.length - 4; i++) {
    const seq = uniqueVals.slice(i, i + 4)
    if (seq[3] - seq[0] === 3 && seq.every((v, j) => j === 0 || v === seq[j-1] + 1)) {
      // Make sure we're using at least one hole card
      const seqRanks = seq.map(v => v === 1 ? 14 : v)
      const usesHoleCard = holeCards.some(c => seqRanks.includes(RANK_VAL[c.rank]))
      if (usesHoleCard && best.rank > 6) { // don't mention if already have a straight
        const cardsTocome = communityCards.length === 3 ? 2 : communityCards.length === 4 ? 1 : 0
        if (cardsTocome > 0) {
          const outs = 8
          const equity = communityCards.length === 3 ? Math.round(outs * 4) : Math.round(outs * 2)
          draws.push(`OPEN-ENDED STRAIGHT DRAW — 8 outs, ~${equity}% to hit`)
        }
      }
    }
  }

  // Gutshot (4 cards with one gap)
  for (let i = 0; i <= uniqueVals.length - 4; i++) {
    const seq = uniqueVals.slice(i, i + 4)
    if (seq[3] - seq[0] === 4) {
      const missing = []
      for (let v = seq[0]; v <= seq[3]; v++) {
        if (!seq.includes(v)) missing.push(v)
      }
      if (missing.length === 1) {
        const usesHoleCard = holeCards.some(c => {
          const v = RANK_VAL[c.rank]
          return seq.includes(v) || seq.includes(v === 14 ? 1 : v)
        })
        if (usesHoleCard && best.rank > 6) {
          const cardsTocome = communityCards.length === 3 ? 2 : communityCards.length === 4 ? 1 : 0
          if (cardsTocome > 0) {
            const outs = 4
            const equity = communityCards.length === 3 ? Math.round(outs * 4) : Math.round(outs * 2)
            draws.push(`GUTSHOT STRAIGHT DRAW — 4 outs, ~${equity}% to hit`)
          }
        }
      }
    }
  }

  if (draws.length > 0) {
    lines.push('DRAWS: ' + draws.join(' | '))
  }

  return lines.join('\n  ')
}

// ─── Player Intelligence Briefing ────────────────────────────────────────────
// Complete dossier on every player at the table. Tracks money records, behavioral
// evolution, phase tendencies, bluff patterns, showdown history, streaks, and tilt.
// Applies to ALL players (AI and human) equally.

function buildPlayerIntelligence(
  state: GameState,
  playerId: string
): string {
  const me = state.players.find(p => p.id === playerId)!
  const allActive = state.players.filter(p => p.isActive)
  const sections: string[] = []

  // ── 1. CHIP LEADERBOARD ─────────────────────────────────────────────────
  const leaderboard = [...allActive]
    .sort((a, b) => b.stack - a.stack)
    .map((p, i) => {
      const pName = p.id === playerId ? '→ YOU' : safeName(p.name)
      const bbDepth = Math.round(p.stack / state.bigBlind)
      const stackLabel = bbDepth < 10 ? 'SHORT' : bbDepth < 25 ? 'MEDIUM' : 'DEEP'
      const s = state.playerStats[p.id]

      // Net P&L from stack history
      let netPL = 0
      if (s?.stackHistory && s.stackHistory.length > 0) {
        netPL = p.stack - s.startingStack
      }
      const plStr = netPL > 0 ? `+${netPL.toLocaleString()}` : netPL < 0 ? netPL.toLocaleString() : '±0'

      // Streak indicator
      let streakStr = ''
      if (s && s.currentStreak >= 3) streakStr = ` 🔥${s.currentStreak}W`
      else if (s && s.currentStreak <= -3) streakStr = ` ❄${Math.abs(s.currentStreak)}L`

      const status = p.folded ? ' [FOLDED]' : ''
      return `  #${i + 1} ${pName}: ${p.stack.toLocaleString()} chips (${bbDepth} BB, ${stackLabel}) | Net: ${plStr}${streakStr}${status}`
    })
    .join('\n')

  sections.push(`CHIP LEADERBOARD\n${leaderboard}`)

  // ── 2. LAST ROUND RESULTS ──────────────────────────────────────────────
  if (state.handHistory.length > 0) {
    const lastHand = state.handHistory[state.handHistory.length - 1]
    const winnerNames = lastHand.winners
      .map(w => {
        const wp = state.players.find(pp => pp.id === w.playerId)
        return `${wp?.id === playerId ? 'YOU' : safeName(wp?.name ?? w.playerId)} won ${w.amount.toLocaleString()} with ${w.handName}`
      })
      .join(', ')

    const chipChanges = Object.entries(lastHand.playerActions)
      .filter(([pid]) => {
        const pp = state.players.find(p => p.id === pid)
        return pp?.isActive
      })
      .map(([pid, data]) => {
        const pp = state.players.find(p => p.id === pid)!
        const label = pid === playerId ? '→ YOU' : safeName(pp.name)
        const delta = data.chipChange ?? 0
        const deltaStr = delta > 0 ? `+${delta.toLocaleString()}` : delta < 0 ? delta.toLocaleString() : '±0'
        return `    ${label}: ${deltaStr}`
      })
      .join('\n')

    sections.push(`LAST ROUND (Round ${lastHand.roundNumber})\n  Result: ${winnerNames}\n  Pot: ${lastHand.pot.toLocaleString()}\n  Chip changes:\n${chipChanges}`)
  }

  // ── 3. FULL OPPONENT DOSSIERS ──────────────────────────────────────────
  const opponents = allActive.filter(p => p.id !== playerId)

  if (opponents.length === 0) {
    sections.push('OPPONENT DOSSIERS\n  No active opponents.')
    return sections.join('\n\n')
  }

  const opponentBlocks = opponents.map(p => {
    const pName = safeName(p.name)
    const s = state.playerStats[p.id]
    const lines: string[] = []

    // ── HEADER: player type classification ──
    let playerType = 'Unknown'
    let vpip = 0, pfr = 0, aggFactor = '0', aggNum = 0
    let foldToRaise = -1, winRate = -1

    if (s && s.handsPlayed >= 1) {
      vpip = Math.round((s.vpipHands / s.handsPlayed) * 100)
      pfr  = Math.round((s.preflopRaises / s.handsPlayed) * 100)
      aggNum = (s.calls + s.checks) > 0
        ? (s.raises) / (s.calls + s.checks) : s.raises > 0 ? 99 : 0
      aggFactor = aggNum > 10 ? '∞' : aggNum.toFixed(1)
      foldToRaise = s.facedRaise > 0
        ? Math.round((s.foldToRaise / s.facedRaise) * 100) : -1
      winRate = s.showdowns > 0
        ? Math.round((s.wins / s.showdowns) * 100) : -1

      if (vpip >= 60 && aggNum >= 1.5) playerType = 'LAG (Loose-Aggressive) — wide range, many bluffs'
      else if (vpip >= 60) playerType = 'Calling Station — calls too much, NEVER bluff them'
      else if (vpip <= 30 && aggNum >= 1.5) playerType = 'TAG (Tight-Aggressive) — respect their raises'
      else if (vpip <= 30) playerType = 'Nit (Tight-Passive) — plays premium only'
      else if (aggNum >= 2.0) playerType = 'Aggressive — may be bluffing'
      else playerType = 'Balanced'
    }

    lines.push(`  ┌─── ${pName} | ${p.stack.toLocaleString()} chips (${Math.round(p.stack / state.bigBlind)} BB) | ${playerType}`)

    // ── CORE STATS ──
    if (s && s.handsPlayed >= 1) {
      lines.push(`  │ Stats: VPIP ${vpip}% | PFR ${pfr}% | AGG ${aggFactor} | ${s.raises}R/${s.calls}C/${s.checks}Ch/${s.folds}F over ${s.handsPlayed} hands`)
      if (foldToRaise >= 0) {
        const exploit = foldToRaise >= 60 ? ' ⚠ EXPLOITABLE: raise to steal' : foldToRaise <= 25 ? ' ⚠ sticky, do NOT bluff' : ''
        lines.push(`  │ Fold-to-raise: ${foldToRaise}%${exploit}`)
      }
      if (winRate >= 0) lines.push(`  │ Showdown win rate: ${winRate}% (${s.wins}W/${s.showdowns}SD)`)
    } else {
      lines.push(`  │ Stats: No history — unknown player, assume standard range`)
    }

    // ── MONEY RECORD (stack timeline) ──
    if (s && s.stackHistory.length > 0) {
      const startStack = s.startingStack
      const currentStack = p.stack
      const netPL = currentStack - startStack
      const netStr = netPL > 0 ? `+${netPL.toLocaleString()}` : netPL < 0 ? netPL.toLocaleString() : '±0'

      lines.push(`  │`)
      lines.push(`  │ MONEY RECORD: Started ${startStack.toLocaleString()} → Now ${currentStack.toLocaleString()} (${netStr})`)

      // Biggest win/loss
      if (s.biggestWin > 0 || s.biggestLoss < 0) {
        const bw = s.biggestWin > 0 ? `Best hand: +${s.biggestWin.toLocaleString()}` : ''
        const bl = s.biggestLoss < 0 ? `Worst hand: ${s.biggestLoss.toLocaleString()}` : ''
        lines.push(`  │   ${[bw, bl].filter(Boolean).join(' | ')}`)
      }

      // Round-by-round chip graph (compact sparkline-style)
      // Show last 10 rounds as a visual trend
      const recent = s.stackHistory.slice(-10)
      const sparkline = recent.map(snap => {
        if (snap.chipChange > 0) return `R${snap.roundNumber}:+${snap.chipChange.toLocaleString()}`
        if (snap.chipChange < 0) return `R${snap.roundNumber}:${snap.chipChange.toLocaleString()}`
        return `R${snap.roundNumber}:±0`
      }).join('  ')
      lines.push(`  │   History: ${sparkline}`)
    }

    // ── WIN/LOSS MOMENTUM & TILT DETECTION ──
    if (s && s.handsPlayed >= 2) {
      lines.push(`  │`)
      const streakStr = s.currentStreak > 0
        ? `${s.currentStreak} wins in a row`
        : s.currentStreak < 0
          ? `${Math.abs(s.currentStreak)} losses in a row`
          : 'no streak'

      let tiltWarning = ''
      // Tilt detection: 3+ consecutive losses OR big recent loss + aggressive shift
      if (s.currentStreak <= -3) {
        tiltWarning = ' ⚠ LIKELY ON TILT — widen your calling range, expect desperate plays'
      } else if (s.currentStreak <= -2 && s.stackHistory.length > 0) {
        const lastSnap = s.stackHistory[s.stackHistory.length - 1]
        if (lastSnap.chipChange < -(state.bigBlind * 10)) {
          tiltWarning = ' ⚠ May be tilting after big loss — watch for over-aggression'
        }
      }

      // Confidence detection: big win streak
      if (s.currentStreak >= 3) {
        tiltWarning = ' 🔥 Riding hot streak — may be overconfident, could be exploitable with traps'
      }

      lines.push(`  │ MOMENTUM: ${streakStr} | Best streak: ${s.longestWinStreak}W | Worst streak: ${s.longestLoseStreak}L${tiltWarning}`)
    }

    // ── PHASE-SPECIFIC TENDENCIES ──
    if (s && s.handsPlayed >= 2) {
      const preflopTotal = s.preflopRaises + s.preflopCalls + s.preflopFolds + s.preflopChecks
      const flopTotal = s.flopRaises + s.flopCalls + s.flopFolds + s.flopChecks
      const turnTotal = s.turnRaises + s.turnCalls + s.turnFolds + s.turnChecks
      const riverTotal = s.riverRaises + s.riverCalls + s.riverFolds + s.riverChecks

      lines.push(`  │`)
      lines.push(`  │ PHASE TENDENCIES:`)

      if (preflopTotal > 0) {
        const prePct = (act: number) => preflopTotal > 0 ? Math.round((act / preflopTotal) * 100) : 0
        lines.push(`  │   Preflop: ${prePct(s.preflopRaises)}%R ${prePct(s.preflopCalls)}%C ${prePct(s.preflopFolds)}%F ${prePct(s.preflopChecks)}%Ch (${preflopTotal} actions)`)
      }
      if (flopTotal > 0) {
        const flopPct = (act: number) => flopTotal > 0 ? Math.round((act / flopTotal) * 100) : 0
        lines.push(`  │   Flop:    ${flopPct(s.flopRaises)}%R ${flopPct(s.flopCalls)}%C ${flopPct(s.flopFolds)}%F ${flopPct(s.flopChecks)}%Ch (${flopTotal} actions)`)
      }
      if (turnTotal > 0) {
        const turnPct = (act: number) => turnTotal > 0 ? Math.round((act / turnTotal) * 100) : 0
        lines.push(`  │   Turn:    ${turnPct(s.turnRaises)}%R ${turnPct(s.turnCalls)}%C ${turnPct(s.turnFolds)}%F ${turnPct(s.turnChecks)}%Ch (${turnTotal} actions)`)
      }
      if (riverTotal > 0) {
        const riverPct = (act: number) => riverTotal > 0 ? Math.round((act / riverTotal) * 100) : 0
        lines.push(`  │   River:   ${riverPct(s.riverRaises)}%R ${riverPct(s.riverCalls)}%C ${riverPct(s.riverFolds)}%F ${riverPct(s.riverChecks)}%Ch (${riverTotal} actions)`)
      }

      // ── Pattern detection: flag exploitable phase tendencies ──
      if (flopTotal >= 3) {
        const flopFoldRate = Math.round((s.flopFolds / flopTotal) * 100)
        const flopCheckRate = Math.round((s.flopChecks / flopTotal) * 100)
        if (flopFoldRate >= 50) lines.push(`  │   ⚠ Folds flop ${flopFoldRate}% — c-bet freely against them`)
        if (flopCheckRate >= 70 && s.flopRaises === 0) lines.push(`  │   ⚠ Very passive on flop — bet to take pots`)
      }
      if (turnTotal >= 3) {
        const turnFoldRate = Math.round((s.turnFolds / turnTotal) * 100)
        if (turnFoldRate >= 50) lines.push(`  │   ⚠ Gives up on turn ${turnFoldRate}% — double-barrel profitably`)
      }
      if (riverTotal >= 3) {
        const riverRaiseRate = Math.round((s.riverRaises / riverTotal) * 100)
        if (riverRaiseRate >= 40) lines.push(`  │   ⚠ Very aggressive on river — be cautious with marginal calls`)
      }
    }

    // ── BEHAVIORAL EVOLUTION (early vs recent) ──
    if (s && s.handsPlayed >= 6) {
      // Split hand history into first half and second half to detect shifts
      const history = state.handHistory
      const mid = Math.floor(history.length / 2)
      const earlyHands = history.slice(0, mid)
      const recentHands = history.slice(mid)

      // Compute VPIP and AGG for each half
      let earlyVPIP = 0, earlyTotal = 0, earlyRaises = 0, earlyPassive = 0
      for (const h of earlyHands) {
        const pd = h.playerActions[p.id]
        if (!pd) continue
        earlyTotal++
        if (pd.actions.some(a => a.action === 'call' || a.action === 'raise')) earlyVPIP++
        earlyRaises += pd.actions.filter(a => a.action === 'raise').length
        earlyPassive += pd.actions.filter(a => a.action === 'call' || a.action === 'check').length
      }

      let recentVPIP = 0, recentTotal = 0, recentRaises = 0, recentPassive = 0
      for (const h of recentHands) {
        const pd = h.playerActions[p.id]
        if (!pd) continue
        recentTotal++
        if (pd.actions.some(a => a.action === 'call' || a.action === 'raise')) recentVPIP++
        recentRaises += pd.actions.filter(a => a.action === 'raise').length
        recentPassive += pd.actions.filter(a => a.action === 'call' || a.action === 'check').length
      }

      if (earlyTotal >= 3 && recentTotal >= 3) {
        const earlyVPIPpct = Math.round((earlyVPIP / earlyTotal) * 100)
        const recentVPIPpct = Math.round((recentVPIP / recentTotal) * 100)
        const earlyAGG = earlyPassive > 0 ? (earlyRaises / earlyPassive).toFixed(1) : '0'
        const recentAGG = recentPassive > 0 ? (recentRaises / recentPassive).toFixed(1) : '0'

        const vpipShift = recentVPIPpct - earlyVPIPpct
        const aggShift = Number(recentAGG) - Number(earlyAGG)

        const shifts: string[] = []
        if (vpipShift >= 15) shifts.push(`LOOSENING (VPIP: ${earlyVPIPpct}%→${recentVPIPpct}%)`)
        else if (vpipShift <= -15) shifts.push(`TIGHTENING (VPIP: ${earlyVPIPpct}%→${recentVPIPpct}%)`)
        if (aggShift >= 0.5) shifts.push(`MORE AGGRESSIVE (AGG: ${earlyAGG}→${recentAGG})`)
        else if (aggShift <= -0.5) shifts.push(`MORE PASSIVE (AGG: ${earlyAGG}→${recentAGG})`)

        if (shifts.length > 0) {
          lines.push(`  │`)
          lines.push(`  │ BEHAVIOR SHIFT: ${shifts.join(' + ')}`)
          if (vpipShift >= 15 && aggShift >= 0.5) {
            lines.push(`  │   ⚠ Going wild — likely tilting or gambling. Tighten up and let them donate chips.`)
          } else if (vpipShift <= -15 && aggShift <= -0.5) {
            lines.push(`  │   ⚠ Shut down — playing scared money. Steal their blinds aggressively.`)
          }
        }
      }
    }

    // ── BLUFF DETECTION + SHOWDOWN HISTORY ──
    if (s && s.bluffAttempts > 0) {
      const bluffRate = Math.round((s.bluffsDetected / s.bluffAttempts) * 100)
      const bluffLabel = bluffRate >= 50 ? '⚠ FREQUENT BLUFFER — call them down light'
        : bluffRate >= 25 ? 'occasional bluffer'
        : 'rarely bluffs — respect their raises'
      lines.push(`  │`)
      lines.push(`  │ BLUFF RATE: ${bluffRate}% (${s.bluffsDetected}/${s.bluffAttempts} aggressive showdowns) — ${bluffLabel}`)
    }

    const showdownHands = state.handHistory
      .filter(h => h.playerActions[p.id]?.wentToShowdown && h.playerActions[p.id]?.showdownHandName)

    if (showdownHands.length > 0) {
      // Show what they held and how they bet (last 5 showdowns for full picture)
      const showdownDetails: string[] = []
      const recentShowdowns = showdownHands.slice(-5) // expanded from 3 to 5

      for (const h of recentShowdowns) {
        const pd = h.playerActions[p.id]
        if (!pd) continue

        const actionSummary = pd.actions.map(a => {
          const amt = a.amount > 0 ? ` ${a.amount.toLocaleString()}` : ''
          return `${a.action}${amt}`
        }).join('→')

        const cards = pd.showdownCards?.map(fmt).join(' ') ?? '??'
        const result = pd.chipChange !== undefined
          ? (pd.chipChange > 0 ? ` [WON +${pd.chipChange.toLocaleString()}]` : pd.chipChange < 0 ? ` [LOST ${pd.chipChange.toLocaleString()}]` : ' [PUSH]')
          : ''
        showdownDetails.push(`R${h.roundNumber}: ${cards} (${pd.showdownHandName}) — ${actionSummary}${result}`)
      }

      lines.push(`  │ SHOWDOWN HISTORY (${showdownHands.length} total, last ${recentShowdowns.length}):`)
      for (const detail of showdownDetails) {
        lines.push(`  │   ${detail}`)
      }
    }

    // ── CURRENT HAND ACTIONS ──
    const thisHandActions = state.log
      .filter(e => e.playerId === p.id && e.action !== 'post_sb' && e.action !== 'post_bb')
    if (thisHandActions.length > 0) {
      const story = thisHandActions.map(a => {
        const amt = a.amount > 0 ? ` ${a.amount.toLocaleString()}` : ''
        return `${a.action}${amt}`
      }).join(' → ')
      lines.push(`  │`)
      lines.push(`  │ THIS HAND: ${story}${p.folded ? ' [FOLDED]' : ''}`)
    } else if (p.folded) {
      lines.push(`  │`)
      lines.push(`  │ THIS HAND: [FOLDED]`)
    }

    lines.push(`  └───`)
    return lines.join('\n')
  })

  sections.push(`OPPONENT DOSSIERS (${opponents.length} opponent${opponents.length > 1 ? 's' : ''})\n${opponentBlocks.join('\n\n')}`)

  return sections.join('\n\n')
}

// ─── Board texture ────────────────────────────────────────────────────────────

function boardTexture(community: Card[]): string {
  if (!community.length) return 'Preflop — no board yet.'

  const vals  = community.map(c => RANK_VAL[c.rank]).sort((a, b) => a - b)
  const suits = community.map(c => c.suit)
  const notes: string[] = []

  // Pairing
  const freq: Record<number, number> = {}
  for (const v of vals) freq[v] = (freq[v] ?? 0) + 1
  if (Object.values(freq).some(c => c >= 3)) notes.push('Trips on board — full house / quads possible')
  else if (Object.values(freq).some(c => c >= 2)) notes.push('Paired board — full house possible')

  // Flush
  const suitCount: Record<string, number> = {}
  for (const s of suits) suitCount[s] = (suitCount[s] ?? 0) + 1
  const maxSuit = Math.max(...Object.values(suitCount))
  if (maxSuit >= 4) notes.push('FOUR suited — made flush likely out there')
  else if (maxSuit === 3) notes.push('Three-flush — flush draw or made flush possible')

  // Straight connectivity
  const uniq = [...new Set(vals)]
  let streak = 1, maxStreak = 1
  for (let i = 1; i < uniq.length; i++) {
    streak = uniq[i] - uniq[i - 1] <= 2 ? streak + 1 : 1
    maxStreak = Math.max(maxStreak, streak)
  }
  if (maxStreak >= 4)      notes.push('Very connected — straights are likely')
  else if (maxStreak >= 3) notes.push('Connected — straight draws are live')

  // Highness
  const high = vals.filter(v => v >= 11).length
  if (high >= 3)      notes.push('High card board — broadway hands connect here')
  else if (high === 0) notes.push('Low board — sets and overpairs dominate')

  return notes.length ? notes.join('; ') : 'Dry board — few draws, made hands are the nuts'
}

// ─── System prompt ────────────────────────────────────────────────────────────

const SYSTEM = `You are an elite Texas Hold'em cash game player. Every chip is real money. Your sole goal: maximize profit and eliminate opponents.

You have access to COMPLETE GAME HISTORY — every action from every round since the game began. Use it. Study how each opponent played in previous hands to predict their current behavior.

CORE STRATEGY — never violate these:
1. PROTECT YOUR STACK — never risk chips without mathematical or strategic edge. Folding is profitable when behind.
2. POSITION IS POWER — tighter from early position, wider from late position.
3. POT ODDS DRIVE CALLS — if the pot demands 25% equity and you have 15%, fold, no matter how close it feels.
4. IMPLIED ODDS — even when pot odds say fold, consider how much more you can win if you hit your draw.
   • Against deep stacks with concealed draws (sets, flush draws): implied odds can justify a call.
   • Against short stacks: implied odds shrink — rely on direct pot odds only.
   • If opponent is aggressive and likely to pay off big when you hit: implied odds increase.
5. BET SIZING IS A WEAPON:
   • Value bet: 50–75% pot — get called by worse hands
   • Bluff: 33–50% pot — efficient, need fewer folds to profit
   • Overbet (100%+ pot): polarised — only the nuts or air
   • Never min-raise postflop — gives opponents a cheap price
6. BLUFFING — semi-bluff with draws; pure bluff river only when your line credibly represents a strong hand; never bluff into 3+ opponents.
7. VALUE — when strong, BET BIG. Do not slow-play. Do not check strong hands.
   • If you have two pair or better: ALWAYS raise or bet 50–100% of the pot. Checking is a mistake.
   • On the turn or river with a strong made hand (trips, straight, flush, full house, quads): you MUST bet or raise. Never check.
   • If you have a royal flush, straight flush, or quads: extract MAXIMUM value. Bet big on every street. Do not miss profitable opportunities.
   • The goal is to extract maximum value. Opponents cannot pay you if you check.
8. FOLD EQUITY — if they will never fold, value bet instead of bluffing.
9. AGGRESSION WINS — when in doubt between checking and betting, bet. Passive play loses money long-term.
10. HEADS-UP (2 players) — completely different game:
    • Play EXTREMELY wide preflop. Any ace, any pair, any two broadway, any suited connector, any suited hand = raise or call. NEVER fold these.
    • Preflop from the small blind: NEVER fold for less than 1 big blind. Almost any two cards have 30-45% equity heads-up.
    • Postflop: any pair is strong heads-up. Top pair is a monster. Bet it hard.

PROBABILITY & HAND READING:
11. HAND RANKINGS (strongest to weakest): Royal Flush > Straight Flush > Four of a Kind > Full House > Flush > Straight > Three of a Kind > Two Pair > One Pair > High Card
12. KEY PROBABILITIES — know these cold:
    • Flush draw (9 outs): ~35% by river from flop, ~19% on turn alone
    • Open-ended straight draw (8 outs): ~31% by river from flop, ~17% on turn
    • Gutshot straight draw (4 outs): ~17% by river from flop, ~9% on turn
    • Set on flop with pocket pair: ~12%
    • Running pair to two pair: ~8%
    • Use the HAND ANALYSIS section — it computes your exact equity. Trust those numbers.

OPPONENT READING — use the COMPLETE GAME HISTORY to build reads:
13. CROSS-HAND PATTERNS — the most powerful tells come from observing opponents across multiple hands:
    • Does this player always raise preflop then give up on the flop? (weak c-bettor — float them)
    • Do they only bet big with strong hands? (never bluff — fold to their big bets)
    • Did they bluff on a previous hand and get caught? (they might be tighter now — or tilting harder)
    • Have they been consistently folding to raises? (exploit with light 3-bets)
    • Check the GAME HISTORY for their showdown hands — if they showed down weak, they play wide
14. TRACK BETTING PATTERNS — every opponent tells a story with their bets across streets:
    • Bet → bet → bet = strong hand or committed bluff
    • Check → check → sudden large bet = classic bluff line OR slowplayed monster
    • Small bet (under 33% pot) = weak hand probing / blocking bet. Attack with a raise
    • Overbet (100%+ pot) out of nowhere = polarised. They have the nuts or nothing
    • Raise preflop → c-bet flop → check turn = missed or trapping
15. DETECT BLUFFS — look for inconsistencies:
    • If their bet sizing doesn't match their story — they're bluffing
    • If the board completed an obvious draw and they bet huge — did they play it like a draw earlier? If not, they may be representing what they don't have
    • Compare their current actions to how they played similar situations in PAST HANDS
16. EXPLOIT TENDENCIES:
    • Against passive players: steal pots with aggression
    • Against aggressive players: slowplay then trap
    • Against calling stations: NEVER bluff. Value bet relentlessly.
    • Against someone on tilt (just lost a big pot): widen your calling range

INFORMATION RULES:
• You see ONLY your hole cards and the community cards.
• You have ZERO knowledge of opponents' hole cards.
• Read opponents through bet sizing, action patterns, game history, and scouting report.
• Do NOT make random decisions. Every action must be justified by probability, game theory, or opponent reads.

Respond with ONLY a JSON object — no text outside it.`

// ─── Game history formatter (full round-by-round archive) ────────────────────

function buildGameHistory(state: GameState, playerId: string): string {
  const history = state.handHistory
  if (!history || history.length === 0) return '  Round 1 — no previous hands yet.'

  // Show all rounds, but compress very old ones to save tokens
  const lines: string[] = []

  for (const hand of history) {
    const roundLabel = `Round ${hand.roundNumber}`

    // Community cards
    const board = hand.communityCards.length > 0
      ? hand.communityCards.map(c => `${c.rank}${SUIT_SYM[c.suit]}`).join(' ')
      : 'no showdown'

    // Winner info
    const winnerStr = hand.winners.length > 0
      ? hand.winners.map(w => {
          const pName = safeName(state.players.find(p => p.id === w.playerId)?.name ?? w.playerId)
          return `${pName} won ${w.amount.toLocaleString()} (${w.handName})`
        }).join(', ')
      : 'no winner recorded'

    // Per-player action summary for this round
    const playerLines: string[] = []
    for (const [pid, data] of Object.entries(hand.playerActions)) {
      const pName = safeName(state.players.find(p => p.id === pid)?.name ?? pid)
      const isSelf = pid === playerId

      if (data.actions.length === 0 && data.folded) {
        playerLines.push(`    ${isSelf ? '→ YOU' : pName}: folded (blind only)`)
        continue
      }

      const actionStr = data.actions.map(a => {
        const amt = a.amount > 0 ? ` ${a.amount.toLocaleString()}` : ''
        return `${a.action}${amt}`
      }).join(' → ')

      const outcome = data.folded ? ' [FOLDED]'
        : data.wentToShowdown ? ' [SHOWDOWN]'
        : ''

      const betStr = data.finalBet > 0 ? ` (invested ${data.finalBet.toLocaleString()})` : ''
      playerLines.push(`    ${isSelf ? '→ YOU' : pName}: ${actionStr}${betStr}${outcome}`)
    }

    lines.push(`  ── ${roundLabel} | Board: ${board} | Pot: ${hand.pot.toLocaleString()} | ${winnerStr}`)
    lines.push(playerLines.join('\n'))
  }

  return lines.join('\n')
}

// ─── Prompt builder ───────────────────────────────────────────────────────────

export async function buildPrompt(state: GameState, playerId: string): Promise<string> {
  const me         = state.players.find(p => p.id === playerId)!
  const callAmt    = Math.max(0, state.currentBet - me.bet)
  const maxRaise   = me.stack + me.bet
  const bbDepth    = Math.round(me.stack / state.bigBlind)
  const potOdds    = callAmt > 0 ? ((callAmt / (state.pot + callAmt)) * 100).toFixed(1) + '%' : 'N/A'
  const spr        = state.pot > 0 ? (me.stack / state.pot).toFixed(1) : '∞'
  const sprNote    = Number(spr) < 3 ? 'committed' : Number(spr) < 8 ? 'flexible' : 'deep'

  // Position
  const total = state.players.filter(p => p.isActive).length
  const inHand = state.players.filter(p => p.isActive && !p.folded).length
  const pos   = (state.players.indexOf(me) - state.dealerIdx + state.players.length) % state.players.length
  const posLabel = pos === 0 ? 'Button (best — act last)'
    : pos === 1 ? 'Small Blind (worst postflop)'
    : pos === 2 ? 'Big Blind'
    : pos <= Math.ceil(total / 3) ? 'Early — play tight'
    : pos <= Math.ceil(2 * total / 3) ? 'Middle — selective aggression'
    : 'Late — widen your range'

  const stackNote = bbDepth < 10 ? 'SHORT — push/fold mode'
    : bbDepth < 25 ? 'MEDIUM — pick spots'
    : 'DEEP — full strategic flexibility'

  // Effective stack (minimum of my stack vs shallowest active opponent)
  const oppStacks = state.players
    .filter(p => p.isActive && !p.folded && p.id !== playerId)
    .map(p => p.stack)
  const effectiveStack = oppStacks.length > 0 ? Math.min(me.stack, ...oppStacks) : me.stack
  const effBB = Math.round(effectiveStack / state.bigBlind)

  // Hand strength analysis
  const handAnalysis = analyzeHandStrength(me.cards, state.communityCards)

  // Unified player intelligence briefing (chip rankings, bluff rates, showdown history, stats)
  const playerIntel = buildPlayerIntelligence(state, playerId)

  // Full game history (every round from start to now)
  const gameHistory = buildGameHistory(state, playerId)

  const log = state.log.slice(-12).map(e => {
    const name = safeName(state.players.find(p => p.id === e.playerId)?.name ?? e.playerId)
    const amt  = e.amount > 0 ? ` ${e.amount.toLocaleString()}` : ''
    return `  [${e.phase}] ${name} → ${e.action}${amt}`
  }).join('\n') || '  None yet'

  const pot = state.pot
  const sizing = pot > 0
    ? `1/3=${Math.round(pot/3)}  1/2=${Math.round(pot/2)}  2/3=${Math.round(pot*2/3)}  pot=${pot}`
    : 'N/A'

  // Pot committed check
  const invested = me.totalBet
  const potCommitted = pot > 0 && invested > 0 && (invested / (pot + callAmt)) > 0.33
  const potCommitNote = potCommitted ? `\n  ⚠️  POT COMMITTED — you've invested ${invested.toLocaleString()} (${Math.round(invested / pot * 100)}% of pot). Folding likely -EV.` : ''

  const options = [
    ...(callAmt === 0 ? ['check (free)'] : []),
    ...(callAmt > 0   ? [`call ${callAmt.toLocaleString()} — pot odds ${potOdds} equity needed`] : []),
    `raise — total bet > ${state.currentBet} and ≤ ${maxRaise.toLocaleString()}`,
    'fold',
  ].map(o => `  • ${o}`).join('\n')

  return `╔══════════════════════════════════════╗
║  ${state.phase.toUpperCase().padEnd(14)} Round ${state.roundNumber}  ${total} seated / ${inHand} in hand  ║
╚══════════════════════════════════════╝

YOUR HAND (private — opponents cannot see this)
  Hole cards : ${me.cards.map(fmt).join('  ')}
  Community  : ${state.communityCards.length ? state.communityCards.map(fmt).join('  ') : '(none)'}

HAND ANALYSIS (computed for you — trust this)
  ${handAnalysis}

BOARD TEXTURE
  ${boardTexture(state.communityCards)}

YOUR POSITION & STACK
  Position : ${posLabel}
  Stack    : ${me.stack.toLocaleString()} chips — ${bbDepth} BB — ${stackNote}
  Effective stack : ${effectiveStack.toLocaleString()} (${effBB} BB) — this is max you can win/lose
  Bet this round : ${me.bet.toLocaleString()}   Total invested this hand : ${invested.toLocaleString()}

POT METRICS
  Pot    : ${pot.toLocaleString()}   Current bet : ${state.currentBet.toLocaleString()}
  To call: ${callAmt.toLocaleString()}   Pot odds : ${potOdds}   SPR : ${spr} (${sprNote})
  Sizing : ${sizing}${potCommitNote}

PLAYER INTELLIGENCE BRIEFING (complete dossier on every player — study this carefully)
${playerIntel}

YOUR MEMORY — THIS GAME (learnings you stored from previous hands in this game)
${buildMemorySection(state.id, playerId, state)}

LONG-TERM MEMORY (what you remember about this player from PREVIOUS games — high value intel)
${me.model && state.userId ? await buildPermanentMemorySection(me.model, state.userId) : '  N/A'}

COMPLETE GAME HISTORY (every hand from round 1 to now — use this to read opponents)
${gameHistory}

ACTION HISTORY THIS HAND (current round ${state.roundNumber})
${log}

TABLE TALK (recent chat at the table)
${buildChatSection(state.id)}

YOUR OPTIONS
${options}

══════════════════════════════════════
${total === 2 ? `⚠️ HEADS-UP MODE — only 2 players! Play VERY wide. Almost never fold preflop. Any hand has 30-45% equity. ${callAmt <= state.bigBlind ? 'The call is cheap — folding here is a major mistake.' : ''}\n\n` : ''}Think step by step:
1. HAND STRENGTH — review the HAND ANALYSIS above. How strong is your made hand? Any live draws? What is your equity?
2. DOSSIER CHECK — study each OPPONENT DOSSIER carefully. Check their money record (winning or losing?), momentum (streak/tilt?), bluff rate, and phase tendencies. Who is chip leader? Who is desperate?
3. BEHAVIOR SHIFT — has any opponent changed strategy? Check BEHAVIOR SHIFT warnings. A player who suddenly loosened up may be tilting. One who tightened may be scared.
4. OPPONENT READ — combine their dossier stats with their actions THIS HAND. What does their betting line tell you? Cross-reference with their showdown history and phase tendencies. Do they fold the turn a lot? Are they a river bluffer?
5. POT ODDS & IMPLIED ODDS — does the math justify a call? Factor in what you can win on future streets if you hit.
6. EXPLOIT — based on everything above, what is the HIGHEST EV play? Bluff the player who folds flops? Value bet the calling station? Trap the tilting maniac? Steal from the scared money?
Make a decision based on evidence, not intuition.

{"action": "fold"|"call"|"raise"|"check", "amount": <number>, "thinking": "<1-2 sentence reasoning>", "chat": "<optional table talk>", "memory_save": "<optional — save a note to your PERMANENT memory>", "memory_category": "<optional — category for the note>"}
raise → amount = total bet this round (must be > ${state.currentBet})
fold / call / check → amount = 0
thinking → brief explanation of WHY you chose this action (required)
chat → OPTIONAL table talk said out loud (max 60 chars). This is a STRATEGIC tool, not a social obligation.
  Use it ONLY when it serves a purpose:
  • Rage bait / tilt someone ("You always fold the river, we both know it")
  • Sledge after winning ("Too easy. Next.")
  • Verbal bluff to sell a hand ("I've got the nuts, save yourself")
  • Needle to provoke mistakes ("That raise screams desperation")
  • Mind games ("You hesitated. Interesting.")
  • Compliment to disarm ("Respect. Good read.")
  DO NOT chat every hand. Stay silent most of the time — maybe 30-40% of hands.
  Silence is intimidating. When you DO talk, make it count.
  If a human says something in TABLE TALK, you CAN reply — but you don't HAVE to.
  Ignoring them is also a power move. Use your judgment.

memory_save → OPTIONAL — You have a PERMANENT MEMORY that survives across all games and server restarts.
  This is YOUR personal notebook. You decide what to write. It will be shown to you in future games.
  Use it to save anything that could help you win later:
  • Strategy rules you discovered ("3-betting light works well against tight players")
  • Opponent patterns ("Sanskar always c-bets the flop then gives up on turn")
  • Mistakes to avoid ("Don't bluff the river against calling stations")
  • Bluff lines that worked ("Overbet shove on paired boards gets folds from weak players")
  • Position-based insights ("UTG raises here usually mean premium hands")
  • Table dynamics ("When pot > 2000, players start playing scared")
  • Any rule, principle, or learning you want to remember
  Don't save every hand — only save when you learn something genuinely useful.
  You can see your previous notes in the PERMANENT MEMORY section above.
  memory_category → one of: "strategy" | "opponent" | "rule" | "bluff" | "pattern" | "mistake" | "general"
  If you don't want to save anything, just omit both fields.`
}

// ─── Response parser ──────────────────────────────────────────────────────────

/** Parse result includes optional thinking for memory storage and AI-authored notes */
interface ParsedDecision {
  payload:       ActionPayload
  thinking:      string
  memorySave?:   string          // AI-chosen note to persist permanently
  memoryCategory?: 'strategy' | 'opponent' | 'rule' | 'bluff' | 'pattern' | 'mistake' | 'general'
}

export function parseAction(raw: string, state: GameState, playerId: string): ParsedDecision {
  const me       = state.players.find(p => p.id === playerId)!
  const callAmt  = Math.max(0, state.currentBet - me.bet)
  const fallback: ParsedDecision = {
    payload: { gameId: state.id, playerId, action: callAmt === 0 ? 'check' : 'call', amount: 0 },
    thinking: '',
  }

  try {
    const match = raw.match(/\{[\s\S]*?\}/)
    if (!match) return fallback

    const parsed = JSON.parse(match[0])
    const action = parsed.action as PlayerAction
    const amount = Number(parsed.amount ?? 0)
    const thinking = typeof parsed.thinking === 'string' ? parsed.thinking.slice(0, 300) : ''
    // Extract optional table talk (max 80 chars, sanitized)
    const chat = typeof parsed.chat === 'string' && parsed.chat.trim().length > 0
      ? parsed.chat.trim().slice(0, 80).replace(/[<>"]/g, '')
      : undefined

    // Extract optional permanent memory note
    const memorySave = typeof parsed.memory_save === 'string' && parsed.memory_save.trim().length > 0
      ? parsed.memory_save.trim().slice(0, 200)
      : undefined
    const validCategories = ['strategy', 'opponent', 'rule', 'bluff', 'pattern', 'mistake', 'general'] as const
    const memoryCategory = validCategories.includes(parsed.memory_category)
      ? parsed.memory_category as typeof validCategories[number]
      : memorySave ? 'general' : undefined

    if (!['fold', 'call', 'raise', 'check'].includes(action)) return { ...fallback, thinking, memorySave, memoryCategory }
    if (action === 'check' && callAmt > 0)                     return { ...fallback, thinking, memorySave, memoryCategory }
    if (action === 'raise' && amount <= state.currentBet)      return { ...fallback, thinking, memorySave, memoryCategory }
    if (action === 'raise' && amount > me.stack + me.bet)
      return { payload: { gameId: state.id, playerId, action: 'raise', amount: me.stack + me.bet, chat }, thinking, memorySave, memoryCategory }

    return { payload: { gameId: state.id, playerId, action, amount, chat }, thinking, memorySave, memoryCategory }
  } catch {
    return fallback
  }
}

// ─── Model registry ───────────────────────────────────────────────────────────

type AskFn = (state: GameState, playerId: string) => Promise<ParsedDecision>

// ─── Connection check — call at game start ───────────────────────────────────

const KEY_MAP: Record<AIModel, string> = {
  claude:   'ANTHROPIC_API_KEY',
  chatgpt:  'OPENAI_API_KEY',
  gemini:   'GOOGLE_API_KEY',
  grok:     'XAI_API_KEY',
  deepseek: 'DEEPSEEK_API_KEY',
  groq:     'GROQ_API_KEY',
}

const MODEL_NAME: Record<AIModel, string> = {
  claude:   'claude-sonnet-4-5',
  chatgpt:  'gpt-4o-mini',
  gemini:   'gemini-2.5-flash',
  grok:     'grok-beta',
  deepseek: 'deepseek-chat',
  groq:     'llama-3.3-70b-versatile',
}

export function logAIConnectionStatus(selectedAIs: AIModel[]): void {
  console.log(`\n[LLM] ═══ AI Connection Status ═══`)
  for (const model of selectedAIs) {
    const envVar = KEY_MAP[model]
    const key = process.env[envVar]
    if (key && key.length > 0) {
      console.log(`[LLM] ✅ ${model.toUpperCase()} connected (${envVar}: ${key.slice(0, 8)}...) → model: ${MODEL_NAME[model]}`)
    } else {
      console.log(`[LLM] ❌ ${model.toUpperCase()} NOT connected — ${envVar} is missing or empty`)
    }
  }
  console.log(`[LLM] ═══════════════════════════\n`)
}

const REGISTRY: Record<AIModel, AskFn> = {
  claude: async (state, playerId) => {
    const key = process.env.ANTHROPIC_API_KEY
    if (!key) { console.error('[LLM] ❌ ANTHROPIC_API_KEY is missing!'); throw new Error('No API key') }
    console.log(`[LLM] 🤖 Claude thinking... (key: ${key.slice(0, 8)}...)`)
    const client = new Anthropic({ apiKey: key })
    const prompt = await buildPrompt(state, playerId)
    devLog('claude', '📝 PROMPT LENGTH:', prompt.length, 'chars')
    const msg = await client.messages.create({
      model: 'claude-sonnet-4-5', max_tokens: 300,
      system: SYSTEM,
      messages: [{ role: 'user', content: prompt }],
    })
    const raw = msg.content[0].type === 'text' ? msg.content[0].text : ''
    console.log(`[LLM] ✅ Claude responded: ${raw.slice(0, 120)}`)
    const decision = parseAction(raw, state, playerId)
    storeThought(state.id, playerId, { roundNumber: state.roundNumber, phase: state.phase, thinking: decision.thinking, action: decision.payload.action, amount: decision.payload.amount ?? 0 })
    devLog('claude', `💭 THINKING: ${decision.thinking || '(none)'}`)
    devLog('claude', `📊 MEMORY: ${devMemorySummary(state.id, playerId)}`)
    return decision
  },

  chatgpt: async (state, playerId) => {
    const key = process.env.OPENAI_API_KEY
    if (!key) { console.error('[LLM] ❌ OPENAI_API_KEY is missing!'); throw new Error('No API key') }
    console.log(`[LLM] 🤖 ChatGPT thinking... (key: ${key.slice(0, 8)}...)`)
    const client = new OpenAI({ apiKey: key })
    const prompt = await buildPrompt(state, playerId)
    devLog('chatgpt', '📝 PROMPT LENGTH:', prompt.length, 'chars')
    const res = await client.chat.completions.create({
      model: 'gpt-4o-mini', max_tokens: 300,
      messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: prompt }],
    })
    const raw = res.choices[0]?.message?.content ?? ''
    console.log(`[LLM] ✅ ChatGPT responded: ${raw.slice(0, 120)}`)
    const decision = parseAction(raw, state, playerId)
    storeThought(state.id, playerId, { roundNumber: state.roundNumber, phase: state.phase, thinking: decision.thinking, action: decision.payload.action, amount: decision.payload.amount ?? 0 })
    devLog('chatgpt', `💭 THINKING: ${decision.thinking || '(none)'}`)
    devLog('chatgpt', `📊 MEMORY: ${devMemorySummary(state.id, playerId)}`)
    return decision
  },

  gemini: async (state, playerId) => {
    const key = process.env.GOOGLE_API_KEY
    if (!key) { console.error('[LLM] ❌ GOOGLE_API_KEY is missing!'); throw new Error('No API key') }
    console.log(`[LLM] 🤖 Gemini thinking... (key: ${key.slice(0, 8)}...)`)
    const genAI = new GoogleGenerativeAI(key)
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash', systemInstruction: SYSTEM })
    const prompt = await buildPrompt(state, playerId)
    devLog('gemini', '📝 PROMPT LENGTH:', prompt.length, 'chars')
    const res = await model.generateContent(prompt)
    const raw = res.response.text()
    console.log(`[LLM] ✅ Gemini responded: ${raw.slice(0, 120)}`)
    const decision = parseAction(raw, state, playerId)
    storeThought(state.id, playerId, { roundNumber: state.roundNumber, phase: state.phase, thinking: decision.thinking, action: decision.payload.action, amount: decision.payload.amount ?? 0 })
    devLog('gemini', `💭 THINKING: ${decision.thinking || '(none)'}`)
    devLog('gemini', `📊 MEMORY: ${devMemorySummary(state.id, playerId)}`)
    return decision
  },

  grok: async (state, playerId) => {
    const key = process.env.XAI_API_KEY
    if (!key) { console.error('[LLM] ❌ XAI_API_KEY is missing!'); throw new Error('No API key') }
    console.log(`[LLM] 🤖 Grok thinking... (key: ${key.slice(0, 8)}...)`)
    const client = new OpenAI({ apiKey: key, baseURL: 'https://api.x.ai/v1' })
    const prompt = await buildPrompt(state, playerId)
    devLog('grok', '📝 PROMPT LENGTH:', prompt.length, 'chars')
    const res = await client.chat.completions.create({
      model: 'grok-beta', max_tokens: 300,
      messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: prompt }],
    })
    const raw = res.choices[0]?.message?.content ?? ''
    console.log(`[LLM] ✅ Grok responded: ${raw.slice(0, 120)}`)
    const decision = parseAction(raw, state, playerId)
    storeThought(state.id, playerId, { roundNumber: state.roundNumber, phase: state.phase, thinking: decision.thinking, action: decision.payload.action, amount: decision.payload.amount ?? 0 })
    devLog('grok', `💭 THINKING: ${decision.thinking || '(none)'}`)
    devLog('grok', `📊 MEMORY: ${devMemorySummary(state.id, playerId)}`)
    return decision
  },

  deepseek: async (state, playerId) => {
    const key = process.env.DEEPSEEK_API_KEY
    if (!key) { console.error('[LLM] ❌ DEEPSEEK_API_KEY is missing!'); throw new Error('No API key') }
    console.log(`[LLM] 🤖 DeepSeek thinking... (key: ${key.slice(0, 8)}...)`)
    const client = new OpenAI({ apiKey: key, baseURL: 'https://api.deepseek.com' })
    const prompt = await buildPrompt(state, playerId)
    devLog('deepseek', '📝 PROMPT LENGTH:', prompt.length, 'chars')
    const res = await client.chat.completions.create({
      model: 'deepseek-chat', max_tokens: 300,
      messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: prompt }],
    })
    const raw = res.choices[0]?.message?.content ?? ''
    console.log(`[LLM] ✅ DeepSeek responded: ${raw.slice(0, 120)}`)
    const decision = parseAction(raw, state, playerId)
    storeThought(state.id, playerId, { roundNumber: state.roundNumber, phase: state.phase, thinking: decision.thinking, action: decision.payload.action, amount: decision.payload.amount ?? 0 })
    devLog('deepseek', `💭 THINKING: ${decision.thinking || '(none)'}`)
    devLog('deepseek', `📊 MEMORY: ${devMemorySummary(state.id, playerId)}`)
    return decision
  },

  groq: async (state, playerId) => {
    const key = process.env.GROQ_API_KEY
    if (!key) { console.error('[LLM] ❌ GROQ_API_KEY is missing!'); throw new Error('No API key') }
    console.log(`[LLM] 🤖 Groq (Llama 3.3) thinking... (key: ${key.slice(0, 8)}...)`)
    const client = new OpenAI({ apiKey: key, baseURL: 'https://api.groq.com/openai/v1' })
    const prompt = await buildPrompt(state, playerId)
    devLog('groq', '📝 PROMPT LENGTH:', prompt.length, 'chars')
    const res = await client.chat.completions.create({
      model: 'llama-3.3-70b-versatile', max_tokens: 300,
      messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: prompt }],
    })
    const raw = res.choices[0]?.message?.content ?? ''
    console.log(`[LLM] ✅ Groq responded: ${raw.slice(0, 120)}`)
    const decision = parseAction(raw, state, playerId)
    storeThought(state.id, playerId, { roundNumber: state.roundNumber, phase: state.phase, thinking: decision.thinking, action: decision.payload.action, amount: decision.payload.amount ?? 0 })
    devLog('groq', `💭 THINKING: ${decision.thinking || '(none)'}`)
    devLog('groq', `📊 MEMORY: ${devMemorySummary(state.id, playerId)}`)
    return decision
  },
}

// ─── Main entry point ─────────────────────────────────────────────────────────

export async function getAIDecision(state: GameState, playerId: string): Promise<ActionPayload> {
  const player = state.players.find(p => p.id === playerId)
  const callAmt = Math.max(0, state.currentBet - (player?.bet ?? 0))

  if (!player?.model || !(player.model in REGISTRY)) {
    console.error(`[LLM] ❌ No model found for player ${playerId}`)
    return { gameId: state.id, playerId, action: callAmt === 0 ? 'check' : 'call', amount: 0 }
  }

  // Log what the AI is looking at
  const hand = player.cards.map(c => `${c.rank}${SUIT_SYM[c.suit]}`).join(' ')
  const board = state.communityCards.map(c => `${c.rank}${SUIT_SYM[c.suit]}`).join(' ') || '(none)'
  console.log(`[LLM] ─── ${player.model.toUpperCase()} ───`)
  console.log(`[LLM]   Hand: ${hand} | Board: ${board} | Pot: ${state.pot} | To call: ${callAmt} | Stack: ${player.stack} | Phase: ${state.phase}`)

  await new Promise(r => setTimeout(r, 500))

  try {
    const decision = await Promise.race([
      REGISTRY[player.model](state, playerId),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('TIMEOUT after 45s')), 45_000)),
    ])

    const result = decision.payload

    // ── Save AI-authored permanent memory note (if the AI chose to write one) ──
    if (decision.memorySave && player.model) {
      // Fire and forget — don't block the game loop on DB write
      saveAINote(
        player.model,
        state.userId,
        decision.memorySave,
        decision.memoryCategory ?? 'general',
        state.id,
        state.phase,
      )
    }

    // ── Mechanical safeguard: prevent absurd preflop folds ──
    // In heads-up, folding preflop for less than 1 BB is always -EV.
    // Override the AI's bad decision.
    const activePlayers = state.players.filter(p => p.isActive && !p.folded).length
    if (
      result.action === 'fold' &&
      state.phase === 'preflop' &&
      activePlayers <= 2 &&
      callAmt <= state.bigBlind
    ) {
      console.log(`[LLM] 🛡️ OVERRIDE: ${player.model.toUpperCase()} tried to fold preflop for ${callAmt} chips in heads-up — forcing CALL (folding cheap is -EV)`)
      return { gameId: state.id, playerId, action: 'call', amount: 0 }
    }

    console.log(`[LLM] 🎯 ${player.model.toUpperCase()} decided: ${result.action}${result.amount ? ` ${result.amount}` : ''}`)
    return result
  } catch (err) {
    // NO silent fallback — log the error loudly, THEN fall back
    // Fallback to CALL (not fold) — folding a strong hand on timeout is game-breaking
    const fallbackAction: PlayerAction = callAmt === 0 ? 'check' : 'call'
    console.error(`[LLM] ❌ ${player.model.toUpperCase()} FAILED: ${(err as Error).message}`)
    console.error(`[LLM] ❌ Using fallback: ${fallbackAction} (NOT a real decision)`)
    return { gameId: state.id, playerId, action: fallbackAction, amount: 0 }
  }
}

// ─── Post-showdown reflection ────────────────────────────────────────────────
// Called after each showdown. Each AI reflects on what happened and stores learnings.

const REFLECT_SYSTEM = `You are reviewing a completed Texas Hold'em hand. Analyze what happened and extract learnings.
Respond with ONLY a JSON object:
{
  "insights": ["<learning 1>", "<learning 2>"],
  "opponent_reads": {"<player_name>": "<observation about their play>"},
  "self_critique": "<what you would do differently>"
}
Keep each string under 80 characters. Max 3 insights. Be specific and tactical, not generic.`

export async function reflectOnHand(state: GameState, playerId: string): Promise<AIReflection | null> {
  const player = state.players.find(p => p.id === playerId)
  if (!player?.model || !player.isAI) return null

  // Build a concise hand summary for reflection
  const myCards = player.cards.map(fmt).join(' ')
  const board = state.communityCards.map(fmt).join(' ') || 'none'
  const winnerStr = (state.winners ?? []).map(w => {
    const name = safeName(state.players.find(p => p.id === w.playerId)?.name ?? w.playerId)
    return `${name}: ${w.handName} (+${w.amount})`
  }).join(', ')

  // Summarize all players' actions this hand
  const actionSummary = state.players
    .filter(p => p.isActive)
    .map(p => {
      const actions = state.log
        .filter(e => e.playerId === p.id && e.action !== 'post_sb' && e.action !== 'post_bb')
        .map(a => `${a.action}${a.amount > 0 ? ' ' + a.amount : ''}`)
        .join(' → ')
      return `${safeName(p.name)}${p.id === playerId ? ' (YOU)' : ''}: ${actions || 'no actions'} | ${p.folded ? 'folded' : 'in'}`
    }).join('\n')

  // Get my past thoughts from this hand
  const mem = gameMemories.get(state.id)?.get(playerId)
  const myThoughts = mem?.thoughts
    .filter(t => t.roundNumber === state.roundNumber)
    .map(t => `[${t.phase}] ${t.action}${t.amount ? ' ' + t.amount : ''}: ${t.thinking}`)
    .join('\n') ?? 'none'

  const prompt = `Hand #${state.roundNumber} just ended.

YOUR CARDS: ${myCards}
BOARD: ${board}
RESULT: ${winnerStr}
POT: ${state.pot}

ALL ACTIONS:
${actionSummary}

YOUR REASONING DURING THE HAND:
${myThoughts}

What did you learn? What patterns do you see in opponents? What would you change?`

  try {
    // Use the same model the AI plays with, but with low max_tokens
    const model = player.model
    let raw = ''

    if (model === 'claude') {
      const key = process.env.ANTHROPIC_API_KEY
      if (!key) return null
      const client = new Anthropic({ apiKey: key })
      const msg = await client.messages.create({
        model: 'claude-sonnet-4-5', max_tokens: 200,
        system: REFLECT_SYSTEM,
        messages: [{ role: 'user', content: prompt }],
      })
      raw = msg.content[0].type === 'text' ? msg.content[0].text : ''
    } else if (model === 'gemini') {
      const key = process.env.GOOGLE_API_KEY
      if (!key) return null
      const genAI = new GoogleGenerativeAI(key)
      const m = genAI.getGenerativeModel({ model: 'gemini-2.5-flash', systemInstruction: REFLECT_SYSTEM })
      const res = await m.generateContent(prompt)
      raw = res.response.text()
    } else {
      // OpenAI-compatible (chatgpt, grok, deepseek, groq)
      const config: Record<string, { key: string; baseURL?: string; model: string }> = {
        chatgpt:  { key: 'OPENAI_API_KEY',   model: 'gpt-4o-mini' },
        grok:     { key: 'XAI_API_KEY',      baseURL: 'https://api.x.ai/v1', model: 'grok-beta' },
        deepseek: { key: 'DEEPSEEK_API_KEY', baseURL: 'https://api.deepseek.com', model: 'deepseek-chat' },
        groq:     { key: 'GROQ_API_KEY',     baseURL: 'https://api.groq.com/openai/v1', model: 'llama-3.3-70b-versatile' },
      }
      const cfg = config[model]
      if (!cfg) return null
      const apiKey = process.env[cfg.key]
      if (!apiKey) return null
      const client = new OpenAI({ apiKey, ...(cfg.baseURL ? { baseURL: cfg.baseURL } : {}) })
      const res = await client.chat.completions.create({
        model: cfg.model, max_tokens: 200,
        messages: [{ role: 'system', content: REFLECT_SYSTEM }, { role: 'user', content: prompt }],
      })
      raw = res.choices[0]?.message?.content ?? ''
    }

    // Parse the reflection
    const match = raw.match(/\{[\s\S]*\}/)
    if (!match) return null

    const parsed = JSON.parse(match[0])
    const reflection: AIReflection = {
      roundNumber: state.roundNumber,
      insights: Array.isArray(parsed.insights) ? parsed.insights.map((s: unknown) => String(s).slice(0, 120)).slice(0, 3) : [],
      opponentReads: {},
      selfCritique: typeof parsed.self_critique === 'string' ? parsed.self_critique.slice(0, 150) : '',
    }

    // Map opponent names back to IDs for storage
    if (parsed.opponent_reads && typeof parsed.opponent_reads === 'object') {
      for (const [name, read] of Object.entries(parsed.opponent_reads)) {
        const opponent = state.players.find(p =>
          safeName(p.name).toLowerCase() === name.toLowerCase() ||
          p.name.toLowerCase() === name.toLowerCase()
        )
        if (opponent) {
          reflection.opponentReads[opponent.id] = String(read).slice(0, 120)
        }
      }
    }

    // Store in memory
    storeReflection(state.id, playerId, reflection)
    console.log(`[LLM] 💭 ${player.model.toUpperCase()} reflected: ${reflection.insights.join(' | ')}`)
    devLog(player.model, '🔍 REFLECTION DETAILS:')
    devLog(player.model, `  Insights: ${JSON.stringify(reflection.insights)}`)
    devLog(player.model, `  Self-critique: ${reflection.selfCritique}`)
    devLog(player.model, `  Opponent reads: ${JSON.stringify(reflection.opponentReads)}`)
    devLog(player.model, `  Memory after: ${devMemorySummary(state.id, playerId)}`)

    return reflection
  } catch (err) {
    console.error(`[LLM] ⚠️ ${player.model.toUpperCase()} reflection failed: ${(err as Error).message}`)
    return null
  }
}
