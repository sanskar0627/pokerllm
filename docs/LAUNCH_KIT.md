# PokerLLM — Launch Video Kit

The hook is NOT "I built a poker app." The hook is:
**"I made Claude, ChatGPT and Gemini play poker against each other — with real money-style stakes."**
AIs bluffing each other is inherently watchable. Lead with that.

---

## 1. The 40-Second Cut (X / Twitter, Reels, Shorts)

| Time | Shot | On-screen / VO line |
|------|------|--------------------|
| 0-3s | Watch-mode table, mid-hand, AI chat bubble trash-talking | **"Claude just bluffed ChatGPT out of 4,000 chips."** |
| 3-8s | Home page slow pan (the pixel-art casino hall) | "I built a poker room where the players are AI models." |
| 8-15s | Lobby: click Claude card → panel slides open → model list with the gold checkmark animation | "Pick your opponents. Bring your own API keys — they're encrypted, and games run on YOUR models." |
| 15-25s | Deal animation → AI thinking spinner → a raise → community cards flip | "Then watch them think. Every decision is a real LLM call — reads, bluffs, table talk." |
| 25-33s | Showdown → winner modal with chip counter rolling up → AI reflection text | "They even reflect on hands and remember how YOU play." |
| 33-40s | Leaderboard → URL on screen | "Play against them, or just watch the machines battle. Link below. It's free — bring a key." |

Rules for this cut: no intro, no "hey guys", first frame must be gameplay.
Cut on action (card flips, chip sweeps). One idea per shot.

## 2. The 90-Second Cut (YouTube / LinkedIn / Product Hunt)

Same skeleton, plus:
- 10s on the BYOK security angle ("your keys are AES-256 encrypted, never leave the server — the whole thing is open source") with a quick scroll of the GitHub repo
- 15s watch-mode segment with the AI Thinking Panel open — showing actual reasoning text is the "whoa" moment
- 10s human-vs-AI hand where you win (or lose dramatically — losses are more shareable)
- End card: URL + GitHub + "built with Next.js, Socket.io, and five LLM APIs"

## 3. Recording — exact toolchain (macOS)

**Recorder (pick one):**
- **Screen Studio** (~$89, screen.studio) — THE tool indie launches use: auto-zoom on clicks,
  smooth cursor, instant background. Worth it if you'll make more videos.
- **Cap** (cap.so, free/open source) — 80% of Screen Studio, free.
- **Built-in**: `Cmd+Shift+5` → record selected portion → edit in iMovie/CapCut. Free, fine.

**Setup before recording:**
1. Clean Chrome profile or hide bookmarks bar (`Cmd+Shift+B`), full-screen the tab (`Cmd+Ctrl+F`? use presentation mode or hide toolbar)
2. Window at 1920×1080 minimum; record at 2x/Retina for crispness
3. `⌘ + 0` reset zoom; close DevTools; turn on Do Not Disturb
4. **API keys**: the key field is already masked (password input) — but NEVER click the eye toggle on camera, and don't show the Railway/Brevo dashboards
5. Seed the demo: pre-verify a demo account, pre-save 2-3 AI keys so the demo flows without waiting

**Editing:** CapCut (free, fast) or DaVinci Resolve (free, pro). Music: Uppbeat or
YouTube Audio Library (search "synthwave" / "lofi jazz" — fits the casino vibe).
Captions ON — 80% of feeds watch muted.

**The money shots to capture (record long, cut later):**
- Card deal animation into a full table
- The model-picker gold checkmark spring
- AI chat bubbles trash-talking mid-hand
- Thinking panel with live reasoning (watch mode)
- Winner modal chip counter rolling up
- A big all-in showdown

## 4. Launch Post Copy (paste-ready)

**X/Twitter:**
> I made Claude, ChatGPT, Gemini, Grok and DeepSeek play poker against each other.
>
> They bluff. They trash-talk. They remember how you play.
>
> You can sit at the table too — bring your own API key (encrypted, BYOK).
>
> Free to play: [URL]
> Open source: [repo]
> [video]

**Reddit (r/SideProject, r/webdev, r/LocalLLaMA):** honest builder tone —
"I spent N weeks building a real-time poker room where LLMs are the opponents.
Tech: Next.js 16, Socket.io, Prisma/Neon, Redis, AES-256-GCM key vault for BYOK.
Hardest bugs: Railway blocking SMTP, and a CSRF check that broke behind the proxy.
Happy to answer anything." — post the 90s video + architecture notes. Reddit loves war stories.

**Product Hunt:** launch Tuesday–Thursday, 12:01am PT. Tagline:
"Texas Hold'em where the other players are frontier AI models."

## 5. Pre-Launch Checklist (do BEFORE posting)

- [ ] Fresh incognito signup → email arrives → verify works (Brevo activated)
- [ ] Two browsers, one game each — no cross-game bleed
- [ ] Railway plan: upgrade off trial BEFORE traffic hits (site dies when trial credit runs out)
- [ ] Watch Railway logs during launch hour
- [ ] README has the video/GIF embedded at the top + one-line pitch + screenshot
- [ ] Add a demo GIF to the README (10s loop of a hand being played)
