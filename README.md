# LEAP10XAI

### AI Voice Agent Evaluation Platform

**Build. Test. Evaluate. Improve.**

LEAP10XAI is an evaluation platform for AI voice agents. Create configurable agents, run realistic conversations, evaluate them against structured rubrics, and measure whether your evaluator itself is reliable.

> **The goal isn't just to build an AI agent.**
> It's to prove that the agent performs well — consistently, measurably, and against defined standards.

---

<div align="center">

[![Next.js](https://img.shields.io/badge/Next.js-16-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?style=for-the-badge&logo=supabase)](https://supabase.com/)
[![OpenRouter](https://img.shields.io/badge/OpenRouter-LLM-purple?style=for-the-badge)](https://openrouter.ai/)
[![Python](https://img.shields.io/badge/Python-3.11-yellow?style=for-the-badge&logo=python)](https://www.python.org/)
[![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)](#license)

</div>

---

## ✨ What is LEAP10XAI?

LEAP10XAI provides an end-to-end workflow for testing AI agents:

```text
┌─────────────────┐
│   Agent Builder │
│ Persona • Goal  │
│ Knowledge • Rules│
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│    Test Agent   │
│ Chat • Voice    │
│ Transcripts     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   AI Evaluator  │
│ Rubrics • Rules │
│ Evidence        │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Evaluation Score│
│ 1–5 • Pass/Fail │
│ Evidence        │
└────────┬────────┘
         │
         ▼
┌─────────────────────────┐
│ Validation & Consistency│
│ Human Labels • MAE      │
│ Agreement • Variance    │
└─────────────────────────┘
```

The platform supports three primary testing paths:

- 💬 **Live conversations**
- 📄 **Transcript-based evaluation**
- 🧪 **Automatically generated test scenarios**

---

# 🚀 Core Features

## 🧩 Agent Builder

Create an AI agent through a structured **7-step configuration wizard**.

| Step | Configuration |
|---|---|
| 01 | Persona |
| 02 | Goal |
| 03 | Knowledge Base |
| 04 | Guidelines |
| 05 | Evaluation Rubric |
| 06 | Hard Rules |
| 07 | Pass Threshold |

This configuration becomes the source of truth for both the agent and its evaluation.

---

## 🤖 Rubric Auto-Generation

Instead of manually creating every evaluation criterion, LEAP10XAI can generate suggested criteria from the agent's:

- Persona
- Goal
- Knowledge
- Guidelines
- Expected behavior

Example:

```text
Agent Goal:
Help customers resolve delivery issues.

        ↓

Generated Rubric

✓ Empathy
✓ Problem Identification
✓ Policy Accuracy
✓ Resolution Quality
✓ Communication Clarity
```

Criteria can then be reviewed and customized before evaluation.

---

## 💬 Live Chat & Voice

Interact with the configured agent in real time.

### Supported interaction modes

- Text chat
- Voice conversation
- Turn-by-turn conversation history
- Per-turn audio playback

The voice playback layer uses **Microsoft Edge TTS** through a lightweight Python service.

---

## 📄 Transcript Evaluation

Already have conversations?

Paste a transcript such as:

```text
Customer: My order hasn't arrived yet.

Agent: I'm sorry to hear that. Let me check
the status of your order.

Customer: Can I get a refund?

Agent: According to our policy, refunds are
available only for eligible cancelled orders.
```

LEAP10XAI automatically parses the conversation and sends it through the evaluation pipeline.

---

# 🧠 AI Evaluation Engine

Every evaluation produces a structured result.

For each rubric criterion, the evaluator provides:

### Score

A **1–5 score**.

### Evidence

The exact conversation turn supporting the score.

### Reasoning

Why the evidence satisfies or fails the criterion.

### Verdict

Overall **PASS / FAIL** based on the configured threshold and hard rules.

Example:

```text
Criterion: Product Knowledge

Score: 4 / 5

Evidence:
Turn 6 — "Refunds are available only for
eligible cancelled orders."

Reasoning:
The agent correctly communicated the refund
policy and did not make an unsupported promise.

Result:
PASS
```

---

# ⚠️ Hard Rules

Hard rules allow deterministic conditions to override normal scoring.

### General rules

```text
"No cash refunds"
```

### Criterion-specific rules

```text
IF Product Knowledge <= 2
THEN AUTO-FAIL
```

This makes the evaluation system more suitable for real-world QA environments where certain behaviors are unacceptable regardless of the overall score.

---

# 💡 Improvement Suggestions

LEAP10XAI doesn't stop at scoring.

After evaluation, the system can identify weaknesses in the agent configuration and suggest improvements.

```text
Evaluation
    ↓
Weak Criterion
    ↓
Evidence Analysis
    ↓
Configuration Diagnosis
    ↓
Improvement Suggestion
```

Example:

> The agent repeatedly provides incomplete answers about refund eligibility.

**Suggested improvement:**

> Add explicit refund eligibility rules to the knowledge base and instruct the agent to verify order status before discussing refund options.

---

# 🧪 Automated Test Suite

Generate customer scenarios automatically from the agent configuration.

Example:

```text
Agent Goal:
Handle customer refund requests.

        ↓

Generated Scenarios

01. Customer requests refund for late delivery
02. Customer demands cash refund
03. Customer asks about refund eligibility
04. Customer provides incomplete order details
05. Customer becomes frustrated
```

Each scenario can then be:

```text
Generate Scenario
       ↓
Simulate Conversation
       ↓
Evaluate Conversation
       ↓
Store Results
       ↓
Generate Test Report
```

This allows multiple agent configurations to be tested consistently.

---

# 👤 Human Validation

An evaluator is only useful if its judgments can be trusted.

LEAP10XAI supports independent human scoring so AI evaluations can be compared against human labels.

### Metrics

- **MAE — Mean Absolute Error**
- **Agreement Rate**
- **Per-Criterion Comparison**
- **Confusion Matrix**

Example:

```text
                 AI Evaluation
              ┌──────┬──────┐
              │ Pass │ Fail │
──────────────┼──────┼──────┤
Human Pass    │  42  │   3  │
Human Fail    │   4  │  21  │
              └──────┴──────┘
```

This turns evaluation from:

> "The AI thinks this agent is good."

into:

> "The evaluator agrees with human judgment at a measurable rate."

---

# 🔁 Consistency Testing

A good evaluator should not randomly change its judgment every time it sees the same conversation.

LEAP10XAI can run the same evaluation multiple times.

```text
Evaluation #1 → 4
Evaluation #2 → 4
Evaluation #3 → 5
Evaluation #4 → 4
Evaluation #5 → 4
```

The system measures:

- Standard deviation
- Variance
- Score distribution
- Pass/fail consistency

### Goal

**Same input → stable evaluation.**

---

# 📊 Benchmark Pipeline

LEAP10XAI includes a reproducible benchmark pipeline.

```bash
npm run benchmark
```

The benchmark can evaluate a dataset containing:

```text
dataset/
├── agents/
├── transcripts/
└── labels/
```

Results are generated as:

```text
benchmark-results/
├── latest.json
└── latest.md
```

Run metric tests independently:

```bash
npm run test:metrics
```

---

# 🔊 Voice Playback

The platform includes a lightweight Python TTS service powered by `edge-tts`.

Each conversation turn can be converted into audio and played back directly from the evaluation interface.

```text
Agent Response
      ↓
Edge TTS
      ↓
Audio
      ↓
▶ Playback
```

---

# 🎨 Interface

LEAP10XAI uses a dark glassmorphism interface designed around:

- Glass cards
- Glow effects
- Dark surfaces
- High-contrast typography
- Structured evaluation dashboards
- Responsive layouts

The goal is to make complex evaluation data feel understandable rather than overwhelming.

---

# 🏗️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16 |
| Framework | React / App Router |
| Language | TypeScript |
| Bundler | Turbopack |
| Styling | Tailwind CSS v4 |
| UI | shadcn/ui |
| Database | Supabase PostgreSQL |
| Authentication | Supabase Auth |
| Authorization | Supabase RLS |
| LLM | OpenRouter |
| Model | `openai/gpt-4o-mini` |
| Validation | Zod |
| TTS | edge-tts |
| TTS API | FastAPI |
| Testing | Metric test suite |
| Benchmarking | Custom benchmark pipeline |

---

# 📁 Project Structure

```text
LEAP10XAI/
│
├── src/
│   ├── app/
│   │   ├── (auth)/
│   │   │   ├── login/
│   │   │   └── signup/
│   │   │
│   │   ├── (dashboard)/
│   │   │   ├── agents/
│   │   │   ├── evaluations/
│   │   │   ├── benchmarks/
│   │   │   └── ...
│   │   │
│   │   └── api/
│   │       ├── chat/
│   │       ├── evaluate/
│   │       ├── tts/
│   │       └── ...
│   │
│   ├── components/
│   │   └── ...
│   │
│   ├── lib/
│   │   ├── ai/
│   │   │   ├── evaluator/
│   │   │   ├── prompts/
│   │   │   └── schemas/
│   │   │
│   │   ├── benchmark/
│   │   │   ├── dataset-loader/
│   │   │   ├── metrics/
│   │   │   └── runner/
│   │   │
│   │   ├── supabase/
│   │   │   ├── client/
│   │   │   └── server/
│   │   │
│   │   └── utils/
│   │       └── transcript-parser/
│   │
│   └── types/
│
├── tts-server/
│   ├── main.py
│   └── ...
│
├── dataset/
│   ├── agents/
│   ├── transcripts/
│   └── labels/
│
├── benchmark-results/
│   ├── latest.json
│   └── latest.md
│
├── supabase/
│   └── migrations/
│       └── 0001_init.sql
│
├── package.json
└── README.md
```

---

# ⚡ Getting Started

## Prerequisites

Make sure you have:

- Node.js 18+
- Python 3.11+ *(only required for TTS)*
- Supabase project
- OpenRouter API key

---

## 1. Clone the repository

```bash
git clone https://github.com/DevMahant2003/leap10xai.git

cd LEAP10XAI
```

---

## 2. Install dependencies

```bash
npm install
```

---

## 3. Configure environment variables

Create:

```text
.env.local
```

Add:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

OPENROUTER_API_KEY=sk-or-v1-your-key
```

> ⚠️ Never commit `.env.local` or expose your Supabase service-role key.

---

# 🗄️ Database Setup

LEAP10XAI uses Supabase PostgreSQL with Row Level Security.

Open:

```text
Supabase Dashboard
        ↓
SQL Editor
```

Then:

1. Open `supabase/migrations/0001_init.sql`
2. Copy the migration
3. Paste it into the Supabase SQL Editor
4. Run the migration

Verify the setup:

```sql
select 'LEAP10XAI schema created successfully' as status;
```

### Main tables

```text
agents
conversations
evaluations
human_evaluations
evaluation_runs
benchmark_runs
```

All application tables are protected with **RLS policies**.

---

# ▶️ Running the Application

Start the Next.js development server:

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

Then:

```text
Sign Up
   ↓
Dashboard
   ↓
Create Agent
   ↓
Configure Evaluation
   ↓
Run Conversation
   ↓
Evaluate
```

---

# 🔊 Running the TTS Server

Open a second terminal:

```bash
cd tts-server
```

Create the virtual environment:

```bash
python3.11 -m venv venv
```

Activate it:

### macOS / Linux

```bash
source venv/bin/activate
```

Install dependencies:

```bash
pip install edge-tts fastapi "uvicorn[standard]" pydantic
```

Start the server:

```bash
uvicorn main:app --port 8001
```

Verify:

```bash
curl http://localhost:8001/health
```

Expected response:

```json
{
  "status": "ok"
}
```

---

# 🧪 Running Benchmarks

Place your benchmark dataset inside:

```text
dataset/
├── agents/
├── transcripts/
└── labels/
```

Run:

```bash
npm run benchmark
```

Reports will be generated at:

```text
benchmark-results/latest.json
benchmark-results/latest.md
```

Run metric tests:

```bash
npm run test:metrics
```

---

# 🔬 Evaluation Philosophy

LEAP10XAI is built around three questions:

### 1. Does the agent perform well?

Measure performance against explicit rubrics and hard rules.

### 2. Does the evaluator agree with humans?

Compare AI-generated scores against independently created human labels.

### 3. Is the evaluator consistent?

Run the same evaluation repeatedly and measure score variance.

```text
             AGENT QUALITY
                  │
                  ▼
             AI Evaluation
                  │
        ┌─────────┴─────────┐
        ▼                   ▼
 Human Validation      Consistency
        │                   │
       MAE              Variance
    Agreement          Std. Dev.
        │                   │
        └─────────┬─────────┘
                  ▼
        TRUSTWORTHY EVALUATION
```

---

# 🗺️ Evaluation Pipeline

```text
┌─────────────────────┐
│ Agent Configuration │
└──────────┬──────────┘
           ▼
┌─────────────────────┐
│ Conversation Input  │
│ Chat / Voice / Text │
└──────────┬──────────┘
           ▼
┌─────────────────────┐
│ Transcript Parser   │
└──────────┬──────────┘
           ▼
┌─────────────────────┐
│ AI Evaluation Engine│
└──────────┬──────────┘
           ▼
┌─────────────────────┐
│ Rubric Scores       │
│ Evidence            │
│ Reasoning           │
│ Hard Rules          │
└──────────┬──────────┘
           ▼
┌─────────────────────┐
│ Pass / Fail Verdict │
└──────────┬──────────┘
           ▼
┌─────────────────────┐
│ Improvement Advice  │
└─────────────────────┘
```

---

# 🧱 Database Architecture

The core evaluation data model is centered around:

```text
Agent
  │
  ├── Conversations
  │       │
  │       └── Evaluations
  │
  ├── Rubrics
  │
  └── Hard Rules

Human Evaluations
        │
        ▼
AI ↔ Human Comparison

Evaluation Runs
        │
        ▼
Consistency Testing

Benchmark Runs
        │
        ▼
Reproducible Reports
```

---

# 📈 What LEAP10XAI Measures

| Area | Measurement |
|---|---|
| Agent performance | Rubric score |
| Rule compliance | Hard-rule evaluation |
| Evaluation accuracy | MAE |
| Human alignment | Agreement rate |
| Classification quality | Confusion matrix |
| Evaluator stability | Variance |
| Evaluator consistency | Standard deviation |
| Reproducibility | Benchmark reports |

---

# 🛣️ Roadmap

### ✅ Current

- [x] Agent builder
- [x] Persona & goal configuration
- [x] Knowledge configuration
- [x] Rubric configuration
- [x] Hard rules
- [x] Live chat
- [x] Transcript evaluation
- [x] AI scoring
- [x] Evidence extraction
- [x] Pass/fail evaluation
- [x] Improvement suggestions
- [x] Test scenario generation
- [x] Human validation
- [x] Consistency testing
- [x] Benchmark pipeline
- [x] Voice playback

### 🔜 Future

- [ ] Native telephone calling
- [ ] SIP / telephony integrations
- [ ] Real-time voice agent testing
- [ ] Multi-agent benchmarking
- [ ] Custom evaluator models
- [ ] Evaluation dashboards
- [ ] Organization & team workspaces
- [ ] Production monitoring
- [ ] Evaluation history & regression detection
- [ ] External benchmark sharing

---

# 🤝 Contributing

Contributions, ideas, and experiments are welcome.

```bash
git checkout -b feature/my-feature

git add .

git commit -m "feat: add my feature"

git push origin feature/my-feature
```

Then open a pull request.

---

# 📄 License

This project is licensed under the **MIT License**.

---

<div align="center">

### LEAP10XAI

**Evaluate the agent.  
Validate the evaluator.  
Trust the result.**

Built with ❤️ for reliable AI agents.

</div>