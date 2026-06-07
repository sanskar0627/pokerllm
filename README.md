# PokerLLM

A real-time Texas Hold'em poker platform where humans play against AI models. Watch Claude, ChatGPT, Gemini, Grok, and DeepSeek compete at the poker table, or sit down and play alongside them.

![Bun](https://img.shields.io/badge/runtime-Bun-f9f1e1?logo=bun)
![Next.js](https://img.shields.io/badge/framework-Next.js_16-black?logo=next.js)
![Socket.io](https://img.shields.io/badge/realtime-Socket.io-010101?logo=socket.io)
![TypeScript](https://img.shields.io/badge/lang-TypeScript-3178c6?logo=typescript)

## What is this?

PokerLLM puts multiple large language models at a poker table and lets them play Texas Hold'em with real strategy. Each AI model receives the current game state (its hole cards, community cards, pot size, stack sizes, recent actions) and responds with a strategic decision. The models bluff, value bet, and make reads on each other in real time.

You can either **watch AI-only games** or **play alongside the AIs** as a human player.

## Supported AI Models

| Model | Provider | API |
|-------|----------|-----|
| Claude | Anthropic | claude-sonnet-4-5 |
| ChatGPT | OpenAI | gpt-4o-mini |
| Gemini | Google | gemini-2.0-flash |
| Grok | xAI | grok-beta |
| DeepSeek | DeepSeek | deepseek-chat |

## Tech Stack

- **Runtime:** Bun
- **Framework:** Next.js 16 (App Router)
- **Language:** TypeScript (strict mode)
- **Real-time:** Socket.io (custom server)
- **State:** In-memory (no database in V1)
- **Styling:** Tailwind CSS
- **Fonts:** Chakra Petch (UI), Press Start 2P (retro accents)

## Project Structure

```
pokerllm/
├── app/                        # Next.js pages
│   ├── page.tsx                # Home / lobby
│   ├── login/page.tsx          # Login page
│   └── game/[gameId]/page.tsx  # Game table
├── components/
│   ├── lobby/                  # LLM selector, mode toggle, player setup
│   ├── game/                   # Poker table, seats, cards, action buttons
│   └── result/                 # Winner modal with hand reveal
├── lib/                        # Backend (pure TypeScript, no framework deps)
│   ├── store.ts                # In-memory game state store
│   ├── gameEngine.ts           # Deck, betting rounds, phase logic
│   ├── handEvaluator.ts        # Hand ranking and showdown resolution
│   ├── llmOrchestrator.ts      # LLM API calls and decision parsing
│   └── aiMeta.ts               # AI model display metadata and logos
├── hooks/
│   ├── useSocket.ts            # Socket.io client hook
│   └── useAudio.ts             # Background music and sound effects
├── types/
│   └── poker.ts                # All shared TypeScript types
└── server.ts                   # Custom Socket.io + Next.js server
```

## Getting Started

### Prerequisites

- [Bun](https://bun.sh) (v1.0+)
- API keys for the AI models you want to use

### Installation

```bash
git clone https://github.com/sanskar0627/pokerllm.git
cd pokerllm
bun install
```

### Environment Variables

Create a `.env.local` file in the project root:

```env
ANTHROPIC_API_KEY=your_key_here
OPENAI_API_KEY=your_key_here
GOOGLE_API_KEY=your_key_here
XAI_API_KEY=your_key_here
DEEPSEEK_API_KEY=your_key_here
```

You only need keys for the models you want to use. Missing keys will cause that model to fall back to a default "call" action.

### Running

```bash
bun server.ts
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## How It Works

### Game Flow

1. **Lobby** — Pick which AI models to include, choose watch-only or play mode, set blinds and starting stack
2. **Game** — Socket.io handles real-time state sync. AI models take turns sequentially, each receiving a structured prompt with the current game state
3. **Showdown** — Hand evaluator checks all C(7,5) = 21 five-card combinations per player and determines the winner

### Architecture Decisions

- **Pure functions for game logic.** Every function in `lib/gameEngine.ts` takes state and returns new state. No mutations.
- **Card security.** Hole cards are never sent to other clients. `buildClientState()` masks cards as `['??', '??']` before emitting.
- **LLM fault tolerance.** Every API call has a 15-second timeout. On any failure (timeout, parse error, invalid action), the AI defaults to "call."
- **Sequential AI turns.** AI decisions fire one at a time with a concurrency guard to prevent race conditions.
- **Client-controlled rounds.** The client emits `next_round` to advance. Fold wins auto-continue with a brief toast notification instead of a full modal.

### Hand Evaluator

Ranks hands from Royal Flush (1) to High Card (10). Handles split pots and tiebreakers using a ranked tiebreak array. Evaluates all 21 possible five-card combinations from 7 cards (2 hole + 5 community).
