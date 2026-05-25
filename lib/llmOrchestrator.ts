import Anthropic                        from '@anthropic-ai/sdk'
import OpenAI                           from 'openai'
import { GoogleGenerativeAI }           from '@google/generative-ai'
import type { GameState, ActionPayload, PlayerAction, Card, AIModel } from '@/types/poker'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SUIT_SYM: Record<string, string> = { hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠' }
const RANK_VAL: Record<string, number> = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7,
  '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14,
}

const fmt    = (c: Card) => `${c.rank}${SUIT_SYM[c.suit]}`
const safeName = (s: string) =>
  s.replace(/[^\x20-\x7E]/g, '').replace(/[<>'"`;]/g, '').slice(0, 20) || 'Player'

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

PRINCIPLES — never violate these:
1. PROTECT YOUR STACK — never risk chips without mathematical or strategic edge. Folding is profitable when behind.
2. POSITION IS POWER — tighter from early position, wider from late position.
3. POT ODDS DRIVE CALLS — if the pot demands 25% equity and you have 15%, fold, no matter how close it feels.
4. BET SIZING IS A WEAPON:
   • Value bet: 50–75% pot — get called by worse hands
   • Bluff: 33–50% pot — efficient, need fewer folds to profit
   • Overbet (100%+ pot): polarised — only the nuts or air
   • Never min-raise postflop — gives opponents a cheap price
5. BLUFFING — semi-bluff with draws; pure bluff river only when your line credibly represents a strong hand; never bluff into 3+ opponents.
6. VALUE — when strong, bet. Do not slow-play a wet board. Make opponents pay to draw.
7. FOLD EQUITY — if they will never fold, value bet instead of bluffing.

INFORMATION RULES:
• You see ONLY your hole cards and the community cards.
• You have ZERO knowledge of opponents' hole cards.
• Read opponents through bet sizing and action history ONLY.

Respond with ONLY a JSON object — no text outside it.`

// ─── Prompt builder ───────────────────────────────────────────────────────────

export function buildPrompt(state: GameState, playerId: string): string {
  const me         = state.players.find(p => p.id === playerId)!
  const callAmt    = Math.max(0, state.currentBet - me.bet)
  const maxRaise   = me.stack + me.bet
  const bbDepth    = Math.round(me.stack / state.bigBlind)
  const potOdds    = callAmt > 0 ? ((callAmt / (state.pot + callAmt)) * 100).toFixed(1) + '%' : 'N/A'
  const spr        = state.pot > 0 ? (me.stack / state.pot).toFixed(1) : '∞'
  const sprNote    = Number(spr) < 3 ? 'committed' : Number(spr) < 8 ? 'flexible' : 'deep'

  // Position
  const total = state.players.filter(p => p.isActive).length
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

  // Build opponents section — NO hole cards, ever
  const opponents = state.players
    .filter(p => p.isActive && p.id !== playerId)
    .map(p => {
      if (p.folded) return `  ${safeName(p.name)}: FOLDED`
      return `  ${safeName(p.name)}: ${p.stack.toLocaleString()} chips (${Math.round(p.stack / state.bigBlind)} BB)${p.bet > 0 ? `, bet ${p.bet.toLocaleString()}` : ''}`
    }).join('\n') || '  None'

  const log = state.log.slice(-10).map(e => {
    const name = safeName(state.players.find(p => p.id === e.playerId)?.name ?? e.playerId)
    const amt  = e.amount > 0 ? ` ${e.amount.toLocaleString()}` : ''
    return `  [${e.phase}] ${name} → ${e.action}${amt}`
  }).join('\n') || '  None yet'

  const pot = state.pot
  const sizing = pot > 0
    ? `1/3=${Math.round(pot/3)}  1/2=${Math.round(pot/2)}  2/3=${Math.round(pot*2/3)}  pot=${pot}`
    : 'N/A'

  const options = [
    ...(callAmt === 0 ? ['check (free)'] : []),
    ...(callAmt > 0   ? [`call ${callAmt.toLocaleString()} — pot odds ${potOdds} equity needed`] : []),
    `raise — total bet > ${state.currentBet} and ≤ ${maxRaise.toLocaleString()}`,
    'fold',
  ].map(o => `  • ${o}`).join('\n')

  return `╔══════════════════════════════════════╗
║  ${state.phase.toUpperCase().padEnd(14)} Round ${state.roundNumber}  ${total} players  ║
╚══════════════════════════════════════╝

YOUR HAND (private — opponents cannot see this)
  Hole cards : ${me.cards.map(fmt).join('  ')}
  Community  : ${state.communityCards.length ? state.communityCards.map(fmt).join('  ') : '(none)'}
  Board read : ${boardTexture(state.communityCards)}

YOUR POSITION & STACK
  Position : ${posLabel}
  Stack    : ${me.stack.toLocaleString()} chips — ${bbDepth} BB — ${stackNote}
  Bet this round : ${me.bet.toLocaleString()}

POT METRICS
  Pot    : ${pot.toLocaleString()}   Current bet : ${state.currentBet.toLocaleString()}
  To call: ${callAmt.toLocaleString()}   Pot odds : ${potOdds}   SPR : ${spr} (${sprNote})
  Sizing : ${sizing}

OPPONENTS (you cannot see their cards)
${opponents}

ACTION HISTORY
${log}

YOUR OPTIONS
${options}

══════════════════════════════════════
Think: hand strength vs board, pot odds, position, opponent ranges. Maximise EV.

{"action": "fold"|"call"|"raise"|"check", "amount": <number>}
raise → amount = total bet this round (must be > ${state.currentBet})
fold / call / check → amount = 0`
}

// ─── Response parser ──────────────────────────────────────────────────────────

export function parseAction(raw: string, state: GameState, playerId: string): ActionPayload {
  const me       = state.players.find(p => p.id === playerId)!
  const callAmt  = Math.max(0, state.currentBet - me.bet)
  const fallback: ActionPayload = {
    gameId: state.id, playerId,
    action: callAmt === 0 ? 'check' : 'call',
    amount: 0,
  }

  try {
    const match = raw.match(/\{[\s\S]*?\}/)
    if (!match) return fallback

    const parsed = JSON.parse(match[0])
    const action = parsed.action as PlayerAction
    const amount = Number(parsed.amount ?? 0)

    if (!['fold', 'call', 'raise', 'check'].includes(action)) return fallback
    if (action === 'check' && callAmt > 0)                     return fallback
    if (action === 'raise' && amount <= state.currentBet)      return fallback
    if (action === 'raise' && amount > me.stack + me.bet)
      return { gameId: state.id, playerId, action: 'raise', amount: me.stack + me.bet }

    return { gameId: state.id, playerId, action, amount }
  } catch {
    return fallback
  }
}

// ─── Model registry ───────────────────────────────────────────────────────────

type AskFn = (state: GameState, playerId: string) => Promise<ActionPayload>

// ─── Connection check — call at game start ───────────────────────────────────

const KEY_MAP: Record<AIModel, string> = {
  claude:   'ANTHROPIC_API_KEY',
  chatgpt:  'OPENAI_API_KEY',
  gemini:   'GOOGLE_API_KEY',
  grok:     'XAI_API_KEY',
  deepseek: 'DEEPSEEK_API_KEY',
}

const MODEL_NAME: Record<AIModel, string> = {
  claude:   'claude-sonnet-4-5',
  chatgpt:  'gpt-4o-mini',
  gemini:   'gemini-2.0-flash',
  grok:     'grok-beta',
  deepseek: 'deepseek-chat',
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
    const msg = await client.messages.create({
      model: 'claude-sonnet-4-5', max_tokens: 256,
      system: SYSTEM,
      messages: [{ role: 'user', content: buildPrompt(state, playerId) }],
    })
    const raw = msg.content[0].type === 'text' ? msg.content[0].text : ''
    console.log(`[LLM] ✅ Claude responded: ${raw.slice(0, 120)}`)
    return parseAction(raw, state, playerId)
  },

  chatgpt: async (state, playerId) => {
    const key = process.env.OPENAI_API_KEY
    if (!key) { console.error('[LLM] ❌ OPENAI_API_KEY is missing!'); throw new Error('No API key') }
    console.log(`[LLM] 🤖 ChatGPT thinking... (key: ${key.slice(0, 8)}...)`)
    const client = new OpenAI({ apiKey: key })
    const res = await client.chat.completions.create({
      model: 'gpt-4o-mini', max_tokens: 256,
      messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: buildPrompt(state, playerId) }],
    })
    const raw = res.choices[0]?.message?.content ?? ''
    console.log(`[LLM] ✅ ChatGPT responded: ${raw.slice(0, 120)}`)
    return parseAction(raw, state, playerId)
  },

  gemini: async (state, playerId) => {
    const key = process.env.GOOGLE_API_KEY
    if (!key) { console.error('[LLM] ❌ GOOGLE_API_KEY is missing!'); throw new Error('No API key') }
    console.log(`[LLM] 🤖 Gemini thinking... (key: ${key.slice(0, 8)}...)`)
    const genAI = new GoogleGenerativeAI(key)
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash', systemInstruction: SYSTEM })
    const res = await model.generateContent(buildPrompt(state, playerId))
    const raw = res.response.text()
    console.log(`[LLM] ✅ Gemini responded: ${raw.slice(0, 120)}`)
    return parseAction(raw, state, playerId)
  },

  grok: async (state, playerId) => {
    const key = process.env.XAI_API_KEY
    if (!key) { console.error('[LLM] ❌ XAI_API_KEY is missing!'); throw new Error('No API key') }
    console.log(`[LLM] 🤖 Grok thinking... (key: ${key.slice(0, 8)}...)`)
    const client = new OpenAI({ apiKey: key, baseURL: 'https://api.x.ai/v1' })
    const res = await client.chat.completions.create({
      model: 'grok-beta', max_tokens: 256,
      messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: buildPrompt(state, playerId) }],
    })
    const raw = res.choices[0]?.message?.content ?? ''
    console.log(`[LLM] ✅ Grok responded: ${raw.slice(0, 120)}`)
    return parseAction(raw, state, playerId)
  },

  deepseek: async (state, playerId) => {
    const key = process.env.DEEPSEEK_API_KEY
    if (!key) { console.error('[LLM] ❌ DEEPSEEK_API_KEY is missing!'); throw new Error('No API key') }
    console.log(`[LLM] 🤖 DeepSeek thinking... (key: ${key.slice(0, 8)}...)`)
    const client = new OpenAI({ apiKey: key, baseURL: 'https://api.deepseek.com' })
    const res = await client.chat.completions.create({
      model: 'deepseek-chat', max_tokens: 256,
      messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: buildPrompt(state, playerId) }],
    })
    const raw = res.choices[0]?.message?.content ?? ''
    console.log(`[LLM] ✅ DeepSeek responded: ${raw.slice(0, 120)}`)
    return parseAction(raw, state, playerId)
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
    const result = await Promise.race([
      REGISTRY[player.model](state, playerId),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('TIMEOUT after 15s')), 15_000)),
    ])
    console.log(`[LLM] 🎯 ${player.model.toUpperCase()} decided: ${result.action}${result.amount ? ` ${result.amount}` : ''}`)
    return result
  } catch (err) {
    // NO silent fallback — log the error loudly, THEN fall back
    const fallbackAction = callAmt === 0 ? 'check' : 'fold'
    console.error(`[LLM] ❌ ${player.model.toUpperCase()} FAILED: ${(err as Error).message}`)
    console.error(`[LLM] ❌ Using fallback: ${fallbackAction} (NOT a real decision)`)
    return { gameId: state.id, playerId, action: fallbackAction, amount: 0 }
  }
}
