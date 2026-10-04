```markdown
# CLAUDE.md

## Project Overview

LEAP10XAI is an AI voice agent evaluation platform. Users create AI agents with configurable personas, knowledge bases, rubrics, and hard rules. The platform lets agents have conversations (live chat, pasted transcripts, or auto-generated test scenarios), then automatically grades the agent's performance using an AI evaluator that produces scores, evidence, improvement suggestions, and pass/fail verdicts.

## Tech Stack

- **Framework:** Next.js 16 (App Router, TypeScript, Turbopack)
- **Database + Auth:** Supabase (PostgreSQL, pgvector, JWT Auth, RLS)
- **AI:** OpenRouter (`openai/gpt-4o-mini`)
- **TTS:** edge-tts (Python FastAPI server, port 8001)
- **UI:** Tailwind CSS v4, shadcn/ui (new-york, neutral)
- **Icons:** Lucide React
- **Toasts:** Sonner
- **Scripts:** tsx (for benchmark/tests)

## Folder Structure

```
src/
├── app/
│   ├── (auth)/                    # Login + Signup (no sidebar)
│   ├── (dashboard)/               # All authenticated pages (sidebar + header)
│   │   ├── dashboard/
│   │   ├── agents/                 # List, create, edit, detail, test-suite
│   │   ├── conversations/         # List, create, live chat, detail, comparison
│   │   └── validation/            # AI vs Human, consistency testing
│   ├── api/
│   │   ├── chat/route.ts          # Live chat endpoint
│   │   ├── evaluate/route.ts      # AI evaluation endpoint
│   │   ├── evaluate/consistency/  # Consistency testing
│   │   ├── suggest-rubric/        # AI rubric generation
│   │   ├── test-suite/            # Auto-generate test conversations
│   │   └── tts/route.ts           # TTS proxy to Python server
│   ├── globals.css                # Dark glassmorphism theme
│   ├── layout.tsx                 # Root layout (Inter font, Providers)
│   └── page.tsx                   # Redirect to /dashboard or /login
├── components/
│   ├── agent-builder/             # 7-step wizard (create + edit)
│   ├── ui/                        # shadcn components
│   ├── app-sidebar.tsx            # Server component, fetches user
│   ├── sidebar-nav.tsx            # Client, active state + quick actions
│   ├── site-header.tsx            # Client, breadcrumbs + live chat button
│   ├── live-chat.tsx              # Real-time chat with TTS auto-play
│   ├── live-chat-picker.tsx      # Agent selection grid
│   ├── transcript-viewer.tsx      # Dark theme, evidence highlighting, audio
│   ├── evaluation-viewer.tsx     # Scores, evidence, violations, suggestions
│   ├── evaluation-history.tsx    # Switch between past evaluations
│   ├── evaluate-button.tsx       # Run / Re-evaluate
│   ├── delete-button.tsx         # Confirmation dialog
│   ├── audio-player.tsx           # Per-turn TTS playback
│   ├── conversation-audio-player.tsx  # Sequential playback
│   ├── conversation-form.tsx      # Paste transcript + live parse
│   ├── human-eval-form.tsx        # Independent human scoring
│   ├── test-suite-runner.tsx      # Auto-generate scenarios + evaluate
│   ├── consistency-runner.tsx     # Run N×, measure variance
│   ├── nav-user.tsx               # Dropdown with sign out
│   └── providers.tsx              # QueryClient + Toaster
├── lib/
│   ├── supabase/
│   │   ├── client.ts              # Browser client
│   │   ├── server.ts              # Server client + admin client
│   │   └── middleware.ts          # Session refresh (no redirect)
│   ├── ai/
│   │   ├── openrouter.ts          # API client for OpenRouter
│   │   ├── prompts.ts             # Evaluation prompt (evaluation-v5)
│   │   ├── chat-prompts.ts        # Live chat system prompt
│   │   ├── evaluator.ts           # Core evaluator + deterministic hard rule check
│   │   └── schemas.ts             # Zod schemas for AI output
│   ├── benchmark/
│   │   ├── prompt-version.ts      # PROMPT_VERSION = "evaluation-v5"
│   │   ├── metrics.ts             # MAE, exact, ±1, std dev, etc.
│   │   ├── dataset-loader.ts      # Parse agents/transcripts/labels
│   │   ├── runner.ts              # Main benchmark orchestrator
│   │   ├── report-generator.ts    # JSON + Markdown reports
│   │   └── types.ts               # Benchmark types
│   ├── utils/
│   │   └── transcript-parser.ts   # Parse "Customer:.../Agent:..." format
│   └── utils.ts                   # cn() helper
├── types/
│   └── index.ts                   # Agent, TranscriptTurn, Evaluation, etc.
├── hooks/
│   └── use-mobile.ts              # shadcn hook
└── proxy.ts                       # Next.js 16 proxy (session refresh only)
```

## Database

Tables: `agents`, `conversations`, `evaluations`, `human_evaluations`, `evaluation_runs`, `benchmark_runs`

All tables have RLS enabled (`auth.uid() = user_id`). Deleting an agent cascades to conversations → evaluations.

### Key columns:
- `agents`: persona, goal, knowledge (JSONB), guidelines (JSONB), rubric (JSONB), hard_rules (JSONB with `type` field for criterion-specific), pass_threshold, scoring_notes
- `conversations`: transcript (JSONB array of `{role, text, turn_no}`), source, status
- `evaluations`: scores (JSONB), hard_rule_violations (JSONB), improvement_suggestions (JSONB), prompt_version, temperature, benchmark_run_id

## Environment Variables

```bash
NEXT_PUBLIC_SUPABASE_URL=         # https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=    # public anon key
SUPABASE_SERVICE_ROLE_KEY=        # server-only, bypasses RLS
OPENROUTER_API_KEY=               # sk-or-v1-xxxx
```

## How to Run

```bash
# Terminal 1: Next.js
npm run dev

# Terminal 2: TTS server (optional, for voice)
cd tts-server
source venv/bin/activate
uvicorn main:app --port 8001

# Run benchmark (requires dataset in dataset/)
npm run benchmark

# Run metric tests
npm run test:metrics
```

## Key Conventions

1. **`@/*` resolves to `./src/*`** (see tsconfig.json paths)
2. **Dark theme only** — `globals.css` has dark CSS variables. Use `glass-card`, `input-glass`, `btn-glow`, `btn-ghost-dark` classes
3. **Proxy (middleware) does NOT redirect** — it only refreshes the Supabase session. Auth redirects are handled by `(dashboard)/layout.tsx`
4. **Evaluator post-processing** — `evaluator.ts` has a deterministic `checkCriterionHardRules` function that runs after the AI returns scores. This catches hard rules the AI might miss (e.g., "if Product knowledge ≤ 2, auto-fail")
5. **Benchmark is reproducible** — every evaluation records `prompt_version`, `temperature`, `model`. Run `npm run benchmark` to regenerate `benchmark-results/latest.json` + `latest.md`
6. **Transcript format**: `{ role: "agent" | "customer", text: string, turn_no: number }` — 1-indexed
7. **Hard rules** can be `type: "text"` (general rule) or `type: "criterion"` (criterion-specific with operator + threshold)

## Evaluator Versions

| Version | Key Change |
|---------|-----------|
| v1 | Baseline |
| v2 | +Partial credit, +guideline check, +confidently-wrong |
| v3 | +Strict caps, +simple criteria |
| v4 | +Deterministic hard rules (told AI — bad) |
| v5 | V3 prompt + silent deterministic check + criterion separation (BEST) |

Current: `evaluation-v5` in `src/lib/benchmark/prompt-version.ts`

## Benchmark Results (v5)

- MAE: 0.30
- Exact agreement: 75.7%
- ±1 agreement: 94.6%
- Pass/fail agreement: 87.5%
- Consistency: 100% (8/8 unanimous)
- Remaining failures: sup-03 Diagnosis (AI 4 vs Human 2), trn-02 false positive (implicit human rule not in config)

## TTS Server

- Uses `edge-tts` (Microsoft Edge TTS, free, no API key)
- Voices: Sasurji (hi-IN-SwaraNeural), Management/Default (en-IN-PrabhatNeural)
- Rate: +15% (adjustable in `main.py`)
- Returns MP3 directly (no WAV conversion)
- Platform works without TTS — all features except voice playback

## Common Tasks

- **Create agent**: `/agents/new` → 7-step wizard
- **Live chat**: `/conversations/live` → pick agent → type as customer
- **Paste transcript**: `/conversations/new` → paste "Customer:.../Agent:..." text
- **Evaluate**: Open conversation → click "Run AI Evaluation"
- **Add human label**: Open conversation → "Add Human Evaluation"
- **Compare AI vs Human**: Open conversation → "View Comparison"
- **Run test suite**: Open agent → "Test Suite" → "Run Test Suite"
- **Run benchmark**: `npm run benchmark` (requires dataset in `dataset/`)
- **Check benchmark results**: `cat benchmark-results/latest.md`

## Known Limitations

1. TTS server is local (not deployed)
2. All agents share the same default voice.
3. No Vapi/Twilio integration (no real phone calls)
4. No team collaboration (single user)
5. Web Speech API (mic input) only works in Chrome/Edge
6. Long conversations may exceed LLM context window
7. sup-03 Diagnosis disagreement is a model capability limitation (gpt-4o-mini doesn't follow "strict cap at 2" instruction reliably)
