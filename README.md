<p align="center">
  <img src="public/images/logoo.png" alt="PokerLLM" width="280" />
</p>

<h1 align="center">PokerLLM</h1>

<p align="center">
  <strong>Where Large Language Models Bet, Bluff, and Battle at the Poker Table</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/runtime-Bun-f9f1e1?style=for-the-badge&logo=bun" alt="Bun" />
  <img src="https://img.shields.io/badge/framework-Next.js_16-000000?style=for-the-badge&logo=next.js" alt="Next.js" />
  <img src="https://img.shields.io/badge/realtime-Socket.io-010101?style=for-the-badge&logo=socket.io" alt="Socket.io" />
  <img src="https://img.shields.io/badge/database-Neon_Postgres-4CAF50?style=for-the-badge&logo=postgresql" alt="Neon" />
  <img src="https://img.shields.io/badge/cache-Redis-DC382D?style=for-the-badge&logo=redis" alt="Redis" />
  <img src="https://img.shields.io/badge/lang-TypeScript-3178c6?style=for-the-badge&logo=typescript" alt="TypeScript" />
</p>

<p align="center">
  <em>A production-grade, real-time Texas Hold'em platform where 6 frontier AI models play poker with genuine strategy — bluffing, value betting, reading opponents, and evolving their play across games. Play against them, or watch them destroy each other.</em>
</p>

---

## 🎬 Overview

PokerLLM puts **Claude, ChatGPT, Gemini, Grok, DeepSeek, and Groq (Llama 3.3)** at a poker table and feeds each one a structured game-state prompt with its hole cards, opponent dossiers, pot odds, draw equity, and accumulated memory. Each AI responds with a JSON decision — fold, call, raise, or check — plus optional trash talk and permanent memory notes.

The result is an LLM arena where AI models develop real poker strategies, remember opponent patterns across games, and compete for chip supremacy.

**Play alongside them** or **watch AI-only battles** in real-time.

---

## 🤖 Supported AI Models

| Model | Provider | Engine | Personality |
|:------|:---------|:-------|:------------|
| **Claude** | Anthropic | `claude-sonnet-4-5` | Careful · Strategic · Principled |
| **ChatGPT** | OpenAI | `gpt-4o-mini` | Aggressive · Adaptive · Sharp |
| **Gemini** | Google | `gemini-2.5-flash` | Analytical · Balanced · Precise |
| **Grok** | xAI | `grok-beta` | Bold · Unpredictable · Contrarian |
| **DeepSeek** | DeepSeek | `deepseek-chat` | Methodical · Patient · Mathematical |
| **Groq** | Groq (Llama 3.3) | `llama-3.3-70b-versatile` | Lightning · Fearless · Relentless |

> **BYO-API-Key model** — you provide your own API keys. No credits system, no subscriptions, no middleman.

---

## 🏗 System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CLIENT (Browser)                           │
│                                                                     │
│   Next.js 16 App Router · React 19 · Tailwind v4 · Framer Motion  │
│                                                                     │
│   ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐  │
│   │  Home /  │  │  Login / │  │  Game    │  │  useSocket Hook  │  │
│   │  Lobby   │  │  Signup  │  │  Table   │  │  (real-time)     │  │
│   └──────────┘  └──────────┘  └──────────┘  └────────┬─────────┘  │
│                                                       │             │
└───────────────────────────────────────────────────────┼─────────────┘
                                                        │ Socket.IO
                                                        ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    SERVER (Bun · Custom HTTP + Socket.IO)           │
│                                                                     │
│   ┌─────────────────────────────────────────────────────────────┐   │
│   │                      server.ts (862 lines)                  │   │
│   │                                                             │   │
│   │  • Socket.IO auth (JWT from NextAuth cookie)                │   │
│   │  • Input validation (6 validators + prompt injection guard) │   │
│   │  • Game lifecycle (create → deal → play → showdown → next)  │   │
│   │  • AI turn orchestration (sequential with concurrency lock) │   │
│   │  • Human turn timer (120s → auto-call)                      │   │
│   │  • Graceful shutdown (SIGTERM/SIGINT with 30s drain)        │   │
│   │  • Game reaper (1h TTL) + user cleanup cron (15min)         │   │
│   └──────────┬──────────┬──────────┬──────────┬─────────────────┘   │
│              │          │          │          │                      │
│   ┌──────────▼──┐ ┌─────▼────┐ ┌──▼───────┐ ┌▼────────────────┐   │
│   │ gameEngine  │ │  hand    │ │   llm    │ │   permanent     │   │
│   │   .ts       │ │ Evaluator│ │Orchestr. │ │   Memory.ts     │   │
│   │  (652 LOC)  │ │ (270 LOC)│ │(1481 LOC)│ │   (313 LOC)     │   │
│   │             │ │          │ │          │ │                  │   │
│   │ • Deck/     │ │ • All 10 │ │ • Prompt │ │ • Per-user      │   │
│   │   shuffle   │ │   hand   │ │   builder│ │   AI profiles   │   │
│   │ • Blinds    │ │   ranks  │ │ • 6 LLM  │ │ • AI-authored   │   │
│   │ • Betting   │ │ • C(7,5) │ │   APIs   │ │   notes         │   │
│   │ • Phase     │ │   eval   │ │ • Circuit│ │ • Global        │   │
│   │   advance   │ │ • Tie-   │ │   breaker│ │   insights      │   │
│   │ • Stats     │ │   break  │ │ • Retry  │ │ • Cross-game    │   │
│   │   tracking  │ │   arrays │ │ • Memory │ │   learning      │   │
│   └─────────────┘ └──────────┘ └────┬─────┘ └────────┬────────┘   │
│                                     │                 │             │
└─────────────────────────────────────┼─────────────────┼─────────────┘
                                      │                 │
                    ┌─────────────────┼─────────────────┼──────┐
                    │                 ▼                 ▼      │
                    │   ┌──────────────────┐  ┌────────────┐   │
                    │   │     Redis         │  │   Neon     │   │
                    │   │                  │  │  Postgres   │   │
                    │   │ • Game state     │  │             │   │
                    │   │ • AI memory      │  │ • Auth      │   │
                    │   │ • Chat logs      │  │ • Sessions  │   │
                    │   │ • Smart persist  │  │ • AI notes  │   │
                    │   │   (showdown +    │  │ • Profiles  │   │
                    │   │    every 5 rds)  │  │ • Global    │   │
                    │   │ • 1h TTL         │  │   insights  │   │
                    │   └──────────────────┘  └────────────┘   │
                    │                                          │
                    │   ┌──────────────────────────────────┐   │
                    │   │     6× LLM APIs                  │   │
                    │   │     (Anthropic, OpenAI, Google,   │   │
                    │   │      xAI, DeepSeek, Groq)        │   │
                    │   └──────────────────────────────────┘   │
                    │                  EXTERNAL                 │
                    └──────────────────────────────────────────┘
```

### Request Flow

```
Human clicks "Raise 500"
  │
  ▼
useSocket.ts → socket.emit('player_action', { action: 'raise', amount: 500 })
  │
  ▼
server.ts → validate input → verify socket owns playerId → clear turn timer
  │
  ▼
gameEngine.processAction() → immutable state transform → new GameState
  │
  ▼
store.setGame() → in-memory Map (instant) + Redis (if showdown/every 5 rounds)
  │
  ▼
broadcastGameState() → buildClientState() masks opponents' cards → emit per-socket
  │
  ▼
triggerAITurn() → sequential loop until human's turn or showdown
  │
  ├──▶ llmOrchestrator.getAIDecision()
  │      │
  │      ├── isCircuitOpen(model)? → skip API, fallback to call/check
  │      │
  │      ├── withRetry(fn, model) → 1 retry, 2s backoff
  │      │      │
  │      │      └── buildPrompt() → 16K char budget
  │      │           │
  │      │           ├── Hand strength analysis (draws, equity, outs)
  │      │           ├── Board texture analysis
  │      │           ├── Opponent dossiers (VPIP, PFR, AGG, tilt, bluff rate)
  │      │           ├── In-game memory (strategy notes + opponent reads)
  │      │           ├── Permanent memory (cross-game learnings from Postgres)
  │      │           ├── Game history (last 8 rounds)
  │      │           └── Table talk context
  │      │
  │      ├── parseAction() → validate JSON, clamp amounts, extract chat + memory_save
  │      │
  │      ├── storeThought() → Redis write-through
  │      │
  │      └── saveAINote() → Postgres (if AI chose to remember something)
  │
  ▼
processAction() → advance phase or showdown
  │
  ▼
handleShowdown() → determineWinners() → distribute pot → broadcast
  │
  ▼
reflectOnHand() → each AI reflects (every 3 rounds) → store insights + opponent reads
```

---

## 🧠 Memory Architecture

PokerLLM implements a **3-tier hierarchical memory system** that gives each AI persistent, evolving intelligence:

```
                    ┌────────────────────────────────────┐
                    │         TIER 3: PERMANENT          │
                    │       (Neon Postgres · Prisma)     │
                    │                                    │
                    │  Survives: forever (until deleted)  │
                    │  Scope: per-user × per-AI-model    │
                    │                                    │
                    │  • AiPlayerProfile (play style,    │
                    │    win rate, behavioral patterns)   │
                    │  • AiNote (AI-authored, categorized │
                    │    notes: strategy, opponent,       │
                    │    bluff, pattern, mistake)          │
                    │  • AiGlobalInsight (cross-game      │
                    │    poker wisdom, deduplicated)       │
                    │                                    │
                    │  Caps: 50 notes/user, 100 global   │
                    │        15 patterns, 10 traits      │
                    └───────────────┬────────────────────┘
                                    │ promoteGameLearnings()
                                    │ (on game over)
                    ┌───────────────┴────────────────────┐
                    │          TIER 2: SESSION            │
                    │    (In-Memory Map + Redis backup)   │
                    │                                    │
                    │  Survives: server restarts (Redis)  │
                    │  Scope: per-game × per-AI-player   │
                    │  TTL: 1 hour                       │
                    │                                    │
                    │  • AIGameMemory                     │
                    │    ├── thoughts[] (decision log)    │
                    │    ├── reflections[] (post-hand)    │
                    │    ├── opponentNotes{} (reads)      │
                    │    └── strategyNotes[] (learnings)  │
                    │                                    │
                    │  • Chat logs (last 6 messages)      │
                    │                                    │
                    │  Write-through: every storeThought, │
                    │  storeReflection, addChatMessage    │
                    └───────────────┬────────────────────┘
                                    │ storeThought()
                                    │ (on every AI decision)
                    ┌───────────────┴────────────────────┐
                    │        TIER 1: EPHEMERAL            │
                    │         (Prompt Context)            │
                    │                                    │
                    │  Survives: single API call          │
                    │  Scope: one decision                │
                    │                                    │
                    │  • Current hole cards + community   │
                    │  • Hand strength analysis           │
                    │  • Board texture                    │
                    │  • Pot odds, SPR, position          │
                    │  • Action log (current round)       │
                    │  • Last 8 rounds of game history    │
                    │  • Opponent dossiers (40+ stats)    │
                    │  • Session memory (Tier 2)          │
                    │  • Permanent memory (Tier 3)        │
                    │                                    │
                    │  Budget: 16,000 chars (~4K tokens)  │
                    │  Auto-trim: reduces to 4 rounds     │
                    │  if over budget                     │
                    └────────────────────────────────────┘
```

### Memory Lifecycle

```
Round 1: AI plays hand
   │
   ├── AI sends JSON: { action, thinking, chat, memory_save, memory_category }
   │     │
   │     ├── "thinking" → Tier 1 (logged for this prompt)
   │     ├── "memory_save" → Tier 3 (permanent Postgres note, if AI chose to save)
   │     └── decision → Tier 2 (storeThought → Redis)
   │
   ├── Showdown → reflectOnHand() (every 3 rounds)
   │     │
   │     └── AI reviews hand → { insights[], opponent_reads{}, self_critique }
   │           └── → Tier 2 (storeReflection → Redis, merges into opponentNotes)
   │
   └── Next round: Tier 2 memory injected into prompt as "YOUR MEMORY" section

Game Over:
   │
   ├── promoteGameLearnings() → Tier 2 → Tier 3
   │     ├── Update AiPlayerProfile (style, win rate, patterns)
   │     ├── Push strategy notes → AiGlobalInsight
   │     └── Merge opponent reads → AiPlayerProfile.patterns
   │
   ├── Send accumulated AI reflections to client (only now — prevents mid-game exploit)
   │
   └── clearGameMemory() → purge Tier 2 (both in-memory Map and Redis)

Next Game (same user):
   │
   └── AI receives Tier 3 memory: "LONG-TERM MEMORY" section in prompt
         ├── "This player — seen in 5 games, style: LAG, win rate: 60%"
         ├── Saved notes: [OPPONENT] "Folds to 3-bets 70%"
         └── Cross-game learnings: "Small bets on river = blocking bet"
```

### Opponent Intelligence System

Every AI receives a **complete dossier** on each opponent (40+ computed metrics):

```
┌─── Claude | 12,500 chips (25 BB) | TAG (Tight-Aggressive) — respect their raises
│ Stats: VPIP 35% | PFR 28% | AGG 2.1 | 12R/8C/3Ch/5F over 15 hands
│ Fold-to-raise: 62% ⚠ EXPLOITABLE: raise to steal
│ Showdown win rate: 55% (6W/11SD)
│
│ MONEY RECORD: Started 10,000 → Now 12,500 (+2,500)
│   Best hand: +4,200 | Worst hand: -1,800
│   History: R1:+800  R2:-400  R3:+1,200  R4:-300  R5:+1,200
│
│ MOMENTUM: 2 wins in a row | Best streak: 3W | Worst streak: 2L
│
│ PHASE TENDENCIES:
│   Preflop: 40%R 30%C 20%F 10%Ch (10 actions)
│   Flop:    25%R 35%C 15%F 25%Ch (8 actions)
│   Turn:    20%R 30%C 30%F 20%Ch (6 actions)
│   ⚠ Gives up on turn 30% — double-barrel profitably
│
│ BEHAVIOR SHIFT: LOOSENING (VPIP: 25%→42%)
│   ⚠ Going wild — likely tilting. Tighten up and let them donate chips.
│
│ BLUFF RATE: 33% (2/6 aggressive showdowns) — occasional bluffer
│ SHOWDOWN HISTORY (6 total, last 3):
│   R12: A♠ K♥ (Top Pair) — raise 400→call→raise 1200 [WON +3,200]
│   R10: 7♦ 8♦ (High Card) — raise 600→raise 1500 [LOST -1,500]
│   R8:  Q♣ Q♠ (Two Pair) — call→raise 800 [WON +2,100]
│
│ THIS HAND: raise 400 → call
└───
```

---

## 🔒 Security Model

| Layer | Protection | Location |
|:------|:-----------|:---------|
| **Deck** | Cryptographically secure Fisher-Yates shuffle (`crypto.getRandomValues`) | `gameEngine.ts:32-42` |
| **Cards** | Hole cards masked as `['??', '??']` for opponents, revealed only at showdown for non-folded players | `gameEngine.ts:632-651` |
| **Auth** | NextAuth v5 (JWT) + encrypted session cookies. Socket handshake decrypts JWE cookie with `AUTH_SECRET` | `socketAuth.ts` |
| **Ownership** | Every `join_game` verifies `state.userId === socket.data.userId` | `server.ts:659-664` |
| **Actions** | Every `player_action` verifies `socket.data.playerId === payload.playerId` | `server.ts:709-719` |
| **Exploits** | Raise amount validated: must exceed current bet AND commit positive chips. Prevents chip-minting via `owed <= 0` | `gameEngine.ts:306-317` |
| **Injection** | Player names filtered against 16 prompt-injection keywords (`ignore`, `system`, `jailbreak`, etc.) | `server.ts:63-81` |
| **Brute Force** | Login rate-limited: 10 attempts per email per 15 minutes | `auth.ts:40-44` |
| **Game Spam** | 3 creates per 10s per socket + 5 concurrent games per IP | `server.ts:38-41` |
| **CORS** | `process.exit(1)` if `ALLOWED_ORIGIN` not set in production | `server.ts:537-539` |
| **AI Reflections** | Withheld from client until game over — prevents humans from exploiting AI strategy mid-game | `server.ts:406-434` |

---

## ⚡ Reliability & Fault Tolerance

### LLM Circuit Breaker

```
Request → withRetry() ─── Success ──→ recordSuccess() → reset failures
              │
              └── Fail ──→ wait 2s ──→ Retry
                                         │
                                         └── Fail ──→ recordFailure()
                                                         │
                                              failures >= 3? ──→ CIRCUIT OPEN
                                                                    │
                                                            60s cooldown
                                                                    │
                                                            Auto-close → resume
```

- **Per-model isolation** — Claude going down doesn't affect Gemini
- **Automatic fallback** — open circuit = instant check/call (no 45s timeout wait)
- **Self-healing** — circuit auto-closes after 60s cooldown

### Human Turn Timer

```
Human's turn starts
  │
  ├── t=0s:     emit turn_timer { phase: 'running', remainingMs: 120000 }
  │
  ├── t=110s:   WARNING phase begins — per-second countdown ticks
  │                emit turn_timer { phase: 'warning', remainingMs: 10000 }
  │                emit turn_timer { phase: 'warning', remainingMs: 9000 }
  │                ...
  │
  └── t=120s:   EXPIRED — auto-call/check
                   emit turn_timer { phase: 'expired', remainingMs: 0 }
                   processAction(state, playerId, 'call' | 'check')
```

### Graceful Shutdown

```
SIGTERM / SIGINT received
  │
  ├── 1. io.close() — stop accepting new connections
  ├── 2. Broadcast "Server is restarting" to all clients
  ├── 3. Wait for in-flight AI turns (max 30s)
  ├── 4. Clear all turn timers
  ├── 5. Force-persist ALL games to Redis
  ├── 6. Close HTTP server
  └── 7. Fallback: force exit at 35s
```

### State Persistence

```
In-Memory Map (authoritative during gameplay)
  │
  ├── Always: instant synchronous read/write
  │
  └── Selective Redis write-through:
        ├── On showdown / game end / waiting phase → always persist
        ├── Every 5 rounds → periodic checkpoint
        ├── On game creation → setGameForce()
        └── On graceful shutdown → force-persist all games
```

---

## 📁 Project Structure

```
pokerllm/
├── app/                               # Next.js 16 App Router
│   ├── page.tsx                       # Home / lobby (537 lines)
│   ├── login/page.tsx                 # Login (email/password + Google OAuth)
│   ├── signup/page.tsx                # Signup with email verification
│   ├── verify/page.tsx                # Email verification handler
│   ├── game/[gameId]/page.tsx         # Game table (socket-connected)
│   ├── api/auth/[...nextauth]/        # NextAuth v5 route handler
│   └── api/cron/cleanup-unverified/   # Expired user cleanup
│
├── components/
│   ├── lobby/                         # LLM selector cards, mode toggle, player setup
│   ├── game/                          # Poker table, seats, cards, action buttons, chat
│   └── result/                        # Winner modal, game over modal with AI reflections
│
├── lib/                               # Backend (pure TypeScript)
│   ├── gameEngine.ts                  # 652 LOC — deck, blinds, betting, phase, stats
│   ├── handEvaluator.ts               # 270 LOC — all 10 hand ranks, C(7,5) eval
│   ├── llmOrchestrator.ts             # 1481 LOC — prompts, 6 LLM APIs, memory, parsing
│   ├── permanentMemory.ts             # 313 LOC — Prisma-backed cross-game AI memory
│   ├── store.ts                       # 123 LOC — in-memory + smart Redis persistence
│   ├── socketAuth.ts                  # 74 LOC — JWT socket authentication
│   ├── auth.ts                        # 146 LOC — NextAuth config (credentials + Google)
│   ├── rateLimit.ts                   # 61 LOC — sliding window rate limiter
│   ├── cleanup.ts                     # 49 LOC — unverified user cleanup
│   ├── redis.ts                       # 61 LOC — Redis connection with graceful degradation
│   ├── db.ts                          # Prisma client singleton
│   └── aiMeta.ts                      # 114 LOC — AI model branding and display metadata
│
├── hooks/
│   ├── useSocket.ts                   # 171 LOC — Socket.IO client with full event handling
│   └── useAudio.ts                    # Background music and SFX
│
├── types/
│   └── poker.ts                       # 253 LOC — complete type system (40+ types)
│
├── prisma/
│   └── schema.prisma                  # Auth, AI memory (AiPlayerProfile, AiNote, AiGlobalInsight)
│
├── server.ts                          # 862 LOC — custom Bun HTTP + Socket.IO server
└── public/
    ├── images/                        # Card faces, table textures, logos, backgrounds
    ├── sounds/                        # SFX (deal, chip, fold, win)
    └── music/                         # Background casino music
```

---

## 🚀 Getting Started

### Prerequisites

- [Bun](https://bun.sh) v1.0+
- [Redis](https://redis.io) (local or hosted — optional, falls back to in-memory)
- [Neon](https://neon.tech) Postgres database (or any Postgres instance)
- API keys for the AI models you want to use

### Installation

```bash
git clone https://github.com/sanskar0627/pokerllm.git
cd pokerllm
bun install
```

### Environment Variables

Create a `.env.local` file:

```env
# ─── Auth ────────────────────────────────────────────────
AUTH_SECRET=your_random_secret_here           # Required — openssl rand -base64 32
NEXTAUTH_URL=http://localhost:3000

# ─── Google OAuth (optional) ─────────────────────────────
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# ─── Database ────────────────────────────────────────────
DATABASE_URL=postgresql://user:pass@host/dbname

# ─── Redis (optional — falls back to in-memory) ──────────
REDIS_URL=redis://localhost:6379

# ─── Email (for verification) ────────────────────────────
RESEND_API_KEY=your_resend_api_key
EMAIL_FROM=noreply@yourdomain.com

# ─── AI Models (only need keys for models you want) ──────
ANTHROPIC_API_KEY=sk-ant-...                  # Claude
OPENAI_API_KEY=sk-...                         # ChatGPT
GOOGLE_API_KEY=AI...                          # Gemini
XAI_API_KEY=xai-...                           # Grok
DEEPSEEK_API_KEY=sk-...                       # DeepSeek
GROQ_API_KEY=gsk_...                          # Groq (Llama 3.3)

# ─── Production only ─────────────────────────────────────
ALLOWED_ORIGIN=https://yourdomain.com         # Required in production
```

### Database Setup

```bash
bunx prisma migrate dev    # Create tables
bunx prisma generate       # Generate client
```

### Run

```bash
# Development
bun server.ts

# Production
NODE_ENV=production bun server.ts
```

Open [http://localhost:3000](http://localhost:3000)

---

## 🎮 Game Flow

```
┌──────────┐     ┌───────────┐     ┌───────────┐     ┌──────────┐
│  LOBBY   │────▶│  PREFLOP  │────▶│   FLOP    │────▶│   TURN   │
│          │     │           │     │           │     │          │
│ Pick AIs │     │ Deal 2    │     │ Deal 3    │     │ Deal 1   │
│ Set stack│     │ Post      │     │ community │     │ community│
│ Set blind│     │ blinds    │     │ Bet round │     │ Bet round│
└──────────┘     └───────────┘     └───────────┘     └────┬─────┘
                                                          │
┌──────────┐     ┌───────────┐     ┌───────────┐         │
│ GAME     │◀────│ NEXT ROUND│◀────│ SHOWDOWN  │◀────────┘
│ OVER     │     │           │     │           │     ┌──────────┐
│          │     │ Rotate    │     │ Reveal    │◀────│  RIVER   │
│ Show AI  │     │ blinds    │     │ cards     │     │          │
│ brain    │     │ Deal new  │     │ Best hand │     │ Deal 1   │
│ dump     │     │ hand      │     │ Award pot │     │ community│
└──────────┘     └───────────┘     └───────────┘     └──────────┘
```

### Hand Evaluator

Ranks hands from **Royal Flush** (rank 1) to **High Card** (rank 10). Evaluates all **C(7,5) = 21** possible five-card combinations from 7 cards (2 hole + 5 community). Handles split pots via ranked tiebreak arrays.

| Rank | Hand | Example |
|:-----|:-----|:--------|
| 1 | Royal Flush | A♠ K♠ Q♠ J♠ 10♠ |
| 2 | Straight Flush | 9♥ 8♥ 7♥ 6♥ 5♥ |
| 3 | Four of a Kind | K♣ K♥ K♦ K♠ 7♠ |
| 4 | Full House | Q♦ Q♣ Q♠ 8♥ 8♣ |
| 5 | Flush | A♦ J♦ 9♦ 6♦ 3♦ |
| 6 | Straight | 10♣ 9♠ 8♥ 7♦ 6♣ |
| 7 | Three of a Kind | 7♣ 7♥ 7♠ K♦ 2♣ |
| 8 | Two Pair | J♥ J♣ 4♠ 4♦ A♣ |
| 9 | One Pair | 10♠ 10♦ K♣ 8♥ 3♦ |
| 10 | High Card | A♠ Q♦ 9♣ 7♥ 4♠ |

---

## 🛠 Tech Stack

| Category | Technology |
|:---------|:-----------|
| **Runtime** | Bun |
| **Framework** | Next.js 16 (App Router) |
| **Language** | TypeScript (strict) |
| **Real-time** | Socket.IO (custom server) |
| **Auth** | NextAuth v5 (JWT, Credentials + Google OAuth) |
| **Database** | Neon Postgres (via Prisma 7.8) |
| **Cache** | Redis (ioredis) with graceful degradation |
| **Styling** | Tailwind CSS v4 |
| **Animation** | Framer Motion |
| **Email** | Resend |
| **Fonts** | Chakra Petch (UI), Press Start 2P (retro) |

---

## 📊 Codebase Stats

| Module | Lines of Code | Purpose |
|:-------|:-------------|:--------|
| `llmOrchestrator.ts` | 1,481 | AI prompt engineering, 6 LLM integrations, memory, parsing |
| `server.ts` | 862 | Server bootstrap, socket handlers, game lifecycle |
| `gameEngine.ts` | 652 | Core poker logic — deck, betting, phases, stats |
| `app/page.tsx` | 537 | Home page with lobby and game configuration |
| `permanentMemory.ts` | 313 | Cross-game persistent AI memory system |
| `handEvaluator.ts` | 270 | Hand ranking and winner determination |
| `types/poker.ts` | 253 | Complete type system (40+ types and interfaces) |
| `useSocket.ts` | 171 | Client-side Socket.IO hook with all event handling |
| **Total** | **~11,400** | Full-stack poker platform |

---

## 📄 License

MIT

---

<p align="center">
  <sub>Built by <a href="https://github.com/sanskar0627">Sanskar</a> · Powered by 6 frontier AI models · Every chip is a decision</sub>
</p>
