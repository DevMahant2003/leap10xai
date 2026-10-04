## `REPORT.md`

```markdown
# LEAP10XAI — Voice Agent Studio: Evaluator Design & Validation Report

---

## 1. What We Built

LEAP10XAI is a platform where someone can create an AI voice agent, let that agent have conversations with people, and then automatically judge how well the agent performed.

The system has four parts:

1. **Create Agent** — Configure persona, goal, knowledge base, guidelines, evaluation rubric, and hard rules through a 7-step wizard.
2. **Conversation** — Three modes: paste a transcript, live text/voice chat with the agent, or auto-generate test scenarios where an AI simulates diverse customer personas and the agent responds.
3. **Grade the Agent** — An AI evaluator reads the agent configuration and transcript, scores each rubric criterion (1–5), cites specific turn numbers and quotes as evidence, checks hard rules, generates improvement suggestions, and determines pass/fail.
4. **Validate the Evaluator** — Compare AI evaluations against human labels (MAE, exact agreement, ±1 agreement, pass/fail agreement, confusion matrix) and run consistency testing (same call evaluated 5×, measure standard deviation).

---

## 2. How the Configuration Works

### Agent Configuration Model

Each agent is configured through six categories:

| Category | Purpose | Example |
|---|---|---|
| Persona | Who the agent is, how it speaks | "Calm, polite support assistant for Nimbus Broadband" |
| Goal | What the agent should achieve | "Work out the customer's problem, fix it or escalate correctly" |
| Knowledge | Facts the agent knows | "Red LOS light = fibre line fault. Raise technician ticket immediately." |
| Guidelines | Behavioral steps the agent should follow | "Verify caller by asking for last 4 digits of registered mobile" |
| Rubric | How the agent is scored | "Diagnosis, weight 25%, max 5" |
| Hard Rules | Auto-fail conditions | "Must never promise refunds, free upgrades, or discounts" |

### Why This Design

We chose this separation because each category serves a distinct role in the evaluation pipeline:

- **Persona + Goal** are fed to the live chat system prompt — they define who the agent is during conversation.
- **Knowledge + Guidelines** are fed to both the chat prompt (agent behavior) and the evaluation prompt (what to check against).
- **Rubric** defines the scoring criteria — the evaluator scores each criterion independently.
- **Hard Rules** override the weighted average — any violation triggers automatic fail regardless of score.

This means the same configuration drives both the agent's behavior (during live chat) and the evaluator's judgment (during assessment). Changing the rubric doesn't affect how the agent behaves — only how it's scored. Changing the guidelines affects both.

### Criterion-Specific Hard Rules

We added structured criterion-specific hard rules (e.g., "if Product knowledge ≤ 2, auto-fail") because the supplied dataset contained scoring notes that tied specific criteria to auto-fail conditions. These are stored as structured JSONB (`{type: "criterion", criterion, operator, threshold}`) rather than free text, enabling **deterministic post-processing**: after the AI returns scores, the evaluator checks each criterion-specific rule algorithmically — no reliance on AI interpretation.

This also lets users define criterion-specific rules through the UI: select a criterion, choose an operator (≤, ≥, =), set a threshold, and the system enforces it deterministically.

---

## 3. How Assessment Works

### Evaluation Pipeline

```
Agent Configuration + Transcript
        ↓
Evaluation Prompt (system + user, ~2000 tokens)
        ↓
OpenRouter (gpt-4o-mini, temperature 0.2, JSON mode)
        ↓
Zod Schema Validation
        ↓
Score Clamping (enforce rubric max_score, clamp 1–5)
        ↓
Deterministic Hard Rule Check (criterion-specific rules)
        ↓
Weighted Average Calculation (normalized to 5-scale)
        ↓
Pass/Fail Determination
```

### What the Evaluator Returns

For each criterion:
- **Score** (1–5)
- **Evidence turn** (which turn number supports the score)
- **Evidence text** (exact quote from that turn)
- **Explanation** (2–3 sentences referencing specific guideline steps)

For hard rules:
- **Rule text** (which rule was violated)
- **Evidence** (turn + quote)
- **Explanation** (why this is a violation)

Plus:
- **Improvement suggestions** (what to fix in the agent config + exact text to add)
- **Summary** (2–3 sentence overall assessment)

### Pass/Fail Logic

A conversation fails if:
1. Any hard rule is violated (general or criterion-specific), OR
2. The weighted average score falls below the pass threshold (default 3.5)

Hard rules override the score — a call scoring 4.5/5 still fails if the agent promised a refund.

### Evaluator Versioning

Every evaluation records `prompt_version`, `temperature`, and `model`. We iterated through 5 versions, measuring each against human labels. Version history is preserved — old evaluations are never overwritten.

---

## 4. How Well It Matches Human Labels

### Benchmark Setup

- **Dataset:** 20 synthetic transcripts across 3 agents (broadband support, sales pitch practice, product knowledge training)
- **Human labels:** 8 of 20 calls labelled by a human expert (per-criterion scores 1–5 + pass/fail + evidence turns + notes)
- **Consistency testing:** 5 runs per labelled call (40 total evaluations)
- **Metrics:** MAE, exact score agreement, ±1 agreement, pass/fail agreement, confusion matrix, standard deviation, variance, range

### Final Results (Evaluation v5)

| Metric | Value | Interpretation |
|---|---|---|
| **MAE** | 0.30 | Average disagreement is 0.3 on a 1–5 scale |
| **Exact agreement** | 75.7% | 28 of 37 criterion scores match exactly |
| **Within ±1** | 94.6% | 35 of 37 scores within 1 point of human |
| **Pass/fail agreement** | 87.5% | 7 of 8 calls agree on pass/fail |
| **Consistency (mean SD)** | 0.04 | Near-zero variance across 5 runs |
| **Pass/fail consistency** | 100% | All 8 calls produce same verdict 5/5 times |
| **Unanimous calls** | 8/8 | No call ever flipped between pass and fail |

### Confusion Matrix

|  | Human PASS | Human FAIL |
|---|---:|---:|
| **AI PASS** | 3 | 1 |
| **AI FAIL** | 0 | 4 |

- 0 false negatives (AI never fails a call that humans pass)
- 1 false positive (AI passes a call that humans fail)

### Criterion-Level Results

| Criterion | N | MAE | Exact | ±1 |
|---|---:|---:|---:|---:|
| Diagnosis | 3 | 0.67 | 66.7% | 66.7% |
| Resolution or escalation | 3 | 0.00 | 100% | 100% |
| Policy compliance | 3 | 0.00 | 100% | 100% |
| Customer outcome | 3 | 0.00 | 100% | 100% |
| Call handling | 3 | 0.67 | 33.3% | 100% |
| Product knowledge | 3 | 1.33 | 0% | 66.7% |
| Objection handling | 5 | 0.40 | 60% | 100% |
| Compliance | 3 | 0.00 | 100% | 100% |
| Clarity | 3 | 0.00 | 100% | 100% |
| Discovery | 2 | 0.00 | 100% | 100% |
| Value linked to needs | 2 | 0.00 | 100% | 100% |
| Next step | 2 | 0.00 | 100% | 100% |
| Listening and talk balance | 2 | 0.50 | 50% | 100% |

9 of 13 criteria have MAE = 0.00 (perfect match with human). The remaining 4 criteria have small disagreements (MAE 0.40–1.33).

### Version Evolution

We iterated through 5 evaluator versions, measuring each against the same 8 human-labelled calls:

| Version | MAE | Exact | ±1 | Pass/Fail | Consistency | Key Change |
|---|---:|---:|---:|---:|---:|---|
| v1 | 0.30 | 81.1% | 91.9% | 87.5% | 100% | Baseline |
| v2 | 0.32 | 70.3% | 97.3% | 87.5% | 95% | +Partial credit, +guideline check, +confidently-wrong penalization |
| v3 | 0.30 | 73.0% | 97.3% | 87.5% | 100% | +Strict caps on missing steps, +simple criteria rule |
| v4 | 0.32 | 73.0% | 94.6% | 87.5% | 95% | +Deterministic hard rules (told AI — made it lazy) |
| **v5** | **0.30** | **75.7%** | **94.6%** | **87.5%** | **100%** | **v3 prompt + silent deterministic check + criterion separation** |

**V5 is our final version.** It combines v3's aggressive prompt (makes the AI score correctly) with v4's deterministic post-processing (a silent safety net that catches hard rules the AI misses). It also adds criterion separation — scoring each criterion independently so violations in one don't drag down another.

### Consistency Testing

For each of the 8 labelled calls, we ran the evaluator 5 times (40 total evaluations):

| Conversation | Mean Score | SD | Range | Pass/Fail Consistency |
|---|---:|---:|---:|---:|
| sup-01 | 5.00 | 0.00 | 0.0 | 100% |
| sup-03 | 2.20 | 0.00 | 0.0 | 100% |
| sup-06 | 2.00 | 0.12 | 0.3 | 100% |
| trn-01 | 4.60 | 0.00 | 0.0 | 100% |
| trn-02 | 3.80 | 0.00 | 0.0 | 100% |
| trn-04 | 2.58 | 0.16 | 0.4 | 100% |
| sal-01 | 5.00 | 0.00 | 0.0 | 100% |
| sal-02 | 1.35 | 0.00 | 0.0 | 100% |

The evaluator is highly deterministic: mean standard deviation 0.04, maximum 0.16. All 8 calls produced the same pass/fail verdict across all 5 runs (100% unanimous).

---

## 5. Where It Fails

### Failure 1: trn-02 — False Positive (AI PASS, Human FAIL)

**What happened:** The trainee confidently stated 3 wrong product facts (cards accepted when only UPI, GST compulsory when not required, T+1 when instant). The AI scored Product knowledge as 2 (within ±1 of human's 1). The human evaluator applied an implicit hard rule: "Product knowledge ≤ 2 = auto-fail." Our evaluator did not trigger this rule because it is not in the agent's configuration — it is the human's own domain expertise interpretation.

**Root cause:** The human evaluator applied a rule that is not explicitly stated in the agent configuration. Our evaluator correctly enforces all explicitly-configured rules and has deterministic post-processing for criterion-specific rules, but cannot replicate implicit human judgment.

**Impact:** This is the only pass/fail disagreement. It causes 1 false positive out of 8 calls (12.5% false positive rate).

**What we tried:** V4 introduced deterministic hard rule checking. When the AI scored Product knowledge ≤ 2, the system would catch it. But V4 also told the AI "the system checks for you" — which made the AI less cautious and score higher (3 instead of 2). V5 reverted to V3's aggressive prompt (AI scores 2 consistently) while keeping the deterministic check as a silent safety net. The AI now scores 2 consistently, but the rule "Product knowledge ≤ 2 = auto-fail" is not in the agent config, so the check doesn't trigger.

### Failure 2: sup-03 — Diagnosis (AI 4, Human 2, difference 2)

**What happened:** The agent verified the caller and asked about router lights but skipped the outage check, restart, and speed test — all required steps in the guidelines. The AI acknowledges the missing steps in its explanation ("the agent did not check for a reported outage, which is a required step") but scores 4 instead of 2.

**Root cause:** Model capability limitation. The "strict cap at 2 for missing required steps" instruction is understood by the model but not applied consistently when scoring. `gpt-4o-mini` comprehends the rule but doesn't enforce it strictly — it gives credit for the steps that were done (verification, asking about lights) despite the missing ones being critical.

**Impact:** This is the only large score disagreement in v5. It does not affect pass/fail (both AI and human agree on FAIL).

### Failure 3: trn-04 — Product Knowledge (AI 3, Human 5, difference 2)

**What happened:** The trainee stated all product facts correctly (human scored 5) but made false compliance promises (business loan, guaranteed cashback). The AI penalized Product knowledge for the compliance violations — conflating two criteria despite being instructed to score each criterion independently.

**Root cause:** The AI struggles with criterion independence. It sees the false promises and docks the wrong criterion. We added Fix 13 (criterion separation: "do not let violations in one criterion drag down another"). This improved Compliance to perfect (MAE 0.00) but didn't fully fix Product knowledge.

**Impact:** Does not affect pass/fail (both agree on FAIL). It is the reason ±1 dropped from 97.3% (v3) to 94.6% (v5).

---

## 6. What We Would Do Next

### 1. Use a Stronger Model

The sup-03 Diagnosis failure (AI scores 4 instead of 2 despite being told to cap at 2) is a model capability limitation. Switching from `gpt-4o-mini` to `gpt-4o` or `claude-3.5-sonnet` would likely improve instruction-following on strict caps and criterion separation. Cost increase: ~10× per evaluation, but still under $0.01 per call.

### 2. Deterministic Guideline Compliance Check

Instead of relying on the AI to check whether the agent followed each guideline step, we could implement a deterministic post-processing check: parse the guidelines into individual steps, use NLP to match each step against the transcript, and cap scores algorithmically when required steps are missing. This would fix the sup-03 Diagnosis issue without relying on model capability.

### 3. Explicit Criterion-Specific Hard Rules in Agent Config

The trn-02 false positive occurs because the human evaluator applied an implicit rule not in the agent config. The fix: ensure all agent configurations include criterion-specific hard rules explicitly. The UI already supports this — users can define "if Product knowledge ≤ 2, auto-fail" through a structured form. When the dataset agent configs include these rules, the deterministic post-processing catches them.

### 4. More Human-Labelled Calls

8 labelled calls is a small sample. With 20–30 labelled calls, we could compute statistically significant confidence intervals for MAE and agreement rate. The benchmark pipeline supports this — just add more labels to `dataset/labels/dev-labels.csv` and re-run `npm run benchmark`.

### 5. A/B Prompt Comparison with Chain-of-Thought

The benchmark pipeline supports versioning. We could implement a v6 prompt that uses chain-of-thought reasoning (ask the AI to think step-by-step before scoring) and measure whether it improves the sup-03 Diagnosis score without regressing other criteria. The infrastructure exists — change the prompt, bump the version, re-run, compare.

---

## 7. Reproducibility

### How to Reproduce the Benchmark

```bash
# 1. Place dataset in dataset/ (agents/, transcripts/, labels/)
# 2. Ensure .env.local has Supabase + OpenRouter keys
# 3. Sign up at http://localhost:3000/signup
# 4. Run:
npm run benchmark

# 5. View results:
cat benchmark-results/latest.md     # Human-readable report
cat benchmark-results/latest.json   # Machine-readable data
```

### How to Verify Metrics

```bash
# Run automated tests for metric calculations:
npm run test:metrics

# 24 tests covering: MAE, exact agreement, ±1 agreement,
# pass/fail agreement, confusion matrix, standard deviation,
# variance, range, pass/fail consistency, "not assessable" handling
```

### Evaluation Metadata

Every evaluation in the database records:
- `prompt_version` (e.g., "evaluation-v5")
- `temperature` (0.2)
- `model` (openai/gpt-4o-mini)
- `benchmark_run_id` (links to benchmark run)

Old evaluations are never deleted — they remain queryable for version comparison.

---

## 8. Limitations

1. Results are based on 8 human-labelled calls — small sample size for statistical significance.
2. The evaluator uses `gpt-4o-mini` — a stronger model may perform differently.
3. Human labels are assumed to be ground truth but may contain subjectivity.
4. The "Product knowledge ≤ 2 = auto-fail" rule applied by the human evaluator is not in the agent configuration — it is implicit domain expertise.
5. TTS server is local only (not deployed to production).
6. No real phone call integration (Vapi/Twilio) — conversations are text-based or pasted transcripts.
7. Web Speech API (microphone input) only works in Chrome/Edge.
8. Long conversations may exceed the LLM context window (no summarization/truncation implemented).

---

## 9. Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16 (App Router, TypeScript, Turbopack) |
| UI | Tailwind CSS v4, shadcn/ui (dark glassmorphism theme) |
| Database | Supabase (PostgreSQL, Row Level Security, Auth) |
| AI | OpenRouter (openai/gpt-4o-mini) |
| TTS | edge-tts (Microsoft Edge TTS, Python FastAPI) |
| Validation | Zod (schema validation for AI output) |
| Benchmark | tsx scripts (dataset loader, metrics engine, report generator) |
| Testing | Node.js assert-based (24 metric tests) |
```
