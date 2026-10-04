LEAP10XAI — AI Voice Agent Evaluation Platform
Build, test, and grade AI voice agents with rubric-driven evaluations. Create agents with configurable personas, knowledge bases, rubrics, and hard rules. Let them have conversations (live chat, pasted transcripts, or auto-generated test scenarios). Automatically evaluate their performance with scores, evidence, improvement suggestions, and pass/fail verdicts. Validate the evaluator against human labels and measure consistency.

Features
Agent Builder — 7-step wizard: persona, goal, knowledge, guidelines, rubric, hard rules, pass threshold
Rubric Auto-Generation — AI suggests evaluation criteria from persona/goal
Live Chat — Real-time text + voice conversation with the agent
Transcript Upload — Paste "Customer:.../Agent:..." text, auto-parsed
AI Evaluator — Scores each criterion (1-5), cites evidence (turn + quote), explains reasoning
Hard Rules — General rules ("no cash refunds") + criterion-specific rules ("if Product knowledge ≤ 2, auto-fail")
Improvement Suggestions — AI tells you what to fix in the agent config
Test Suite — Auto-generate customer scenarios, simulate conversations, evaluate automatically
Human Validation — Score calls independently, compare AI vs Human (MAE, agreement, confusion matrix)
Consistency Testing — Run same evaluation 5×, measure standard deviation
Benchmark Pipeline — npm run benchmark produces reproducible JSON + Markdown reports
Voice Playback — edge-tts (Microsoft) with per-turn audio
Dark Glassmorphism UI — Modern dark theme with glass cards and glow effects
Tech Stack
Next.js 16 (App Router, TypeScript, Turbopack)
Supabase (PostgreSQL, Auth, RLS)
OpenRouter (openai/gpt-4o-mini)
edge-tts (Python FastAPI, port 8001)
Tailwind CSS v4 + shadcn/ui
Zod (schema validation)
Prerequisites
Node.js 18+
Python 3.11 (for TTS server, optional)
Supabase project
OpenRouter API key
Installation
git clone <https://github.com/DevMahant2003/leap10xai> cd LEAP10XAI npm install

Create .env.local:

NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
OPENROUTER_API_KEY=sk-or-v1-your-key

Database Setup
Run the SQL migration in Supabase SQL Editor:

Go to Supabase Dashboard → SQL Editor
Copy contents of supabase/migrations/0001_init.sql
Paste and Run
Verify: select 'LEAP10XAI schema created successfully' as status;
Tables created: agents, conversations, evaluations, human_evaluations, evaluation_runs, benchmark_runs — all with RLS enabled.


Running the App

npm run dev

Open http://localhost:3000. Sign up → land on dashboard.

TTS Server

cd tts-server
python3.11 -m venv venv
source venv/bin/activate
pip install edge-tts fastapi 'uvicorn[standard]' pydantic
uvicorn main:app --port 8001

Verify: curl http://localhost:8001/health

Benchmark
Place the dataset in dataset/ (agents/, transcripts/, labels/). Then:
npm run benchmark


npm run benchmark
Results: benchmark-results/latest.json + benchmark-results/latest.md

Run metric tests:

npm run test:metrics

Project Structure

src/
├── app/                      # Next.js App Router
│   ├── (auth)/               # Login + Signup
│   ├── (dashboard)/          # All authenticated pages
│   └── api/                  # API routes (chat, evaluate, tts, etc.)
├── components/               # React components
├── lib/
│   ├── ai/                   # Evaluator, prompts, schemas
│   ├── benchmark/            # Dataset loader, metrics, runner
│   ├── supabase/             # Client + server clients
│   └── utils/                # Transcript parser
└── types/                    # TypeScript types
tts-server/                   # Python edge-tts server
dataset/                      # Supplied transcripts + labels
benchmark-results/            # Generated reports