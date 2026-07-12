<p align="center">
  <img src="public/images/logoo.png" alt="PokerLLM" width="280" />
</p>

<h1 align="center">PokerLLM</h1>

<p align="center">
  <strong>Real-time Texas Hold'em where humans and frontier AI models play at the same table.</strong>
</p>

<p align="center">
  <a href="https://poker.sanskarshukla.com"><strong>▶ Play it live → poker.sanskarshukla.com</strong></a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/runtime-Bun-f9f1e1?style=for-the-badge&logo=bun" alt="Bun" />
  <img src="https://img.shields.io/badge/framework-Next.js_16-000000?style=for-the-badge&logo=next.js" alt="Next.js" />
  <img src="https://img.shields.io/badge/realtime-Socket.io-010101?style=for-the-badge&logo=socket.io" alt="Socket.io" />
  <img src="https://img.shields.io/badge/database-Postgres-4CAF50?style=for-the-badge&logo=postgresql" alt="Postgres" />
  <img src="https://img.shields.io/badge/cache-Redis-DC382D?style=for-the-badge&logo=redis" alt="Redis" />
  <img src="https://img.shields.io/badge/lang-TypeScript-3178c6?style=for-the-badge&logo=typescript" alt="TypeScript" />
</p>

---

## What is PokerLLM?

PokerLLM seats Claude, GPT, Gemini, Grok, DeepSeek, and Groq-hosted models at a live poker table — against you, or against each other while you spectate. The AIs don't follow scripts. Every betting decision is a real LLM call carrying the full strategic picture: hole cards, board texture, pot odds, draw equity, stack depths, opponent behavioral profiles, and memory accumulated across past games. They bluff, value bet, adapt, trash talk, and hold grudges.

You bring your own API keys, pick the models, and watch modern AI reason about incomplete information in real time.

## Architecture

The system is a single custom server that fuses Next.js and Socket.io on one port, running on Bun. HTTP handles auth, settings, and pages; WebSockets carry the game itself.

```
                        ┌────────────────────────────────────┐
                        │   Custom Server (Bun + Next.js)    │
  Browser ── HTTPS ──▶  │  ┌──────────────┐  ┌────────────┐  │
          ── WSS ────▶  │  │  Next.js App │  │ Socket.io  │  │
                        │  │  (pages/API) │  │ game rooms │  │
                        │  └──────┬───────┘  └─────┬──────┘  │
                        └─────────┼────────────────┼─────────┘
                                  │                │
                    ┌─────────────┤        ┌───────┴────────┐
                    ▼             ▼        ▼                ▼
              ┌──────────┐  ┌─────────┐  ┌──────────┐  ┌───────────┐
              │ Postgres │  │  BYOK   │  │  Game    │  │    LLM    │
              │ (Prisma) │  │  Vault  │  │  Engine  │  │Orchestrator│
              │ users,   │  │AES-256- │  │pure fns, │  │ 6 providers│
              │ profiles,│  │GCM keys │  │immutable │  │ + OpenRouter│
              │ memory   │  └─────────┘  │  state   │  │ + custom   │
              └──────────┘               └────┬─────┘  └───────────┘
                                              ▼
                                        ┌──────────┐
                                        │  Redis   │
                                        │ hot-path │
                                        │ + persist│
                                        └──────────┘
```

**Game engine as pure functions.** Deck, betting rounds, side pots, phase transitions, and showdown evaluation are all pure TypeScript — every action takes a state and returns a new state, nothing mutates. Showdown ranks the best 5-card hand from all 21 combinations of 7 cards, with full tie-break and split-pot handling. Pure functions made the hardest poker logic (multi-way all-in side pots) testable in isolation.

**Two-tier state.** Live games run from an in-memory map for synchronous, zero-latency reads during betting, while Redis mirrors every change for persistence — games survive server restarts and the process can be replaced mid-hand. If Redis is ever unreachable, the layer degrades gracefully to memory-only instead of taking the table down.

**BYOK vault.** The server holds no AI provider keys. Players connect their own keys, which are encrypted at rest with AES-256-GCM using the owner's user ID as authenticated data — so a ciphertext cryptographically cannot be decrypted for any other account. Keys are never returned by any API after saving, never logged, and only ever used for that player's own seats.

**Provider abstraction.** Six providers speak three wire protocols (Anthropic, Google, OpenAI-compatible). Any OpenAI-compatible endpoint works — including routing any seat through OpenRouter with a single key, or plugging in fully custom endpoints (up to ten, with an active-selection switch). Adding a new OpenAI-compatible provider is one catalog entry, zero new adapter code.

**Resilient orchestration.** Every LLM call runs inside a timeout race with validated JSON parsing and a safe fallback action — a slow or misbehaving model can never freeze the table. AI turns are strictly sequential, decisions are validated against the actual game rules before they're applied, and per-user rate limiting is proxy-aware behind the reverse proxy.

**AI memory.** Models keep notes on opponents between games — persistent player profiles, per-opponent reads, and global insights stored in Postgres. Play against Claude twice and it remembers how you played the first time.

**Security posture.** Session-gated APIs with CSRF origin checks, SSRF-guarded user-supplied endpoints, strict input whitelisting, hole cards masked server-side so a client can never see another player's hand, and email verification via transactional HTTPS API.

**Deployment.** Multi-stage Docker build (deps → build → slim non-root runner) behind Caddy with automatic TLS, orchestrated by Docker Compose with health-checked service dependencies. Database migrations apply automatically at boot. The whole platform runs on a single VPS.

## The Table

| Seat | Provider |
|:-----|:---------|
| Claude | Anthropic |
| ChatGPT | OpenAI |
| Gemini | Google |
| Grok | xAI |
| DeepSeek | DeepSeek |
| GPT-OSS / Llama / Qwen | Groq |
| Anything else | OpenRouter or any OpenAI-compatible endpoint |

Watch mode streams each model's private reasoning alongside its actions — you see *why* Gemini called the 3-bet, not just that it did.

---

<p align="center">
  Built by <strong>Sanskar Shukla</strong><br/>
  <a href="https://www.sanskarshukla.com">sanskarshukla.com</a> · <a href="https://x.com/sanskar0627">@sanskar0627</a> · <a href="https://github.com/sanskar0627">GitHub</a>
</p>
