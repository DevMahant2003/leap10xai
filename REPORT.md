
The evaluator returns:
- **Per-criterion scores** (1-5) with evidence (turn number + quoted text) and explanation
- **Hard rule violations** (if any) with evidence
- **Improvement suggestions** (what to fix + exact text to add to config)
- **Summary** (2-3 sentence overall assessment)

### Pass/Fail Logic

A conversation FAILS if:
1. Any hard rule is violated (general or criterion-specific), OR
2. The weighted average score falls below the pass threshold (default 3.5)

Hard rules override the score — a call scoring 4.5/5 still fails if the agent promised a cash refund.

### Evaluator Versioning

Every evaluation records `prompt_version`, `temperature`, and `model`. We iterated through 5 versions, measuring each against human labels. Version history is preserved — old evaluations are never overwritten.

## 3. How Well It Matches Human Labels

### Benchmark Setup

- **Dataset:** 20 synthetic transcripts across 3 agents (broadband support, sales pitch, product training)
- **Human labels:** 8 of 20 calls labelled by a human expert (per-criterion scores 1-5 + pass/fail)
- **Consistency testing:** 5 runs per labelled call (40 total evaluations)

### Results (Evaluation v5 — Final Version)

| Metric | Value | Interpretation |
|---|---|---|
| **MAE** | 0.30 | Average disagreement is 0.3 on a 1-5 scale |
| **Exact agreement** | 75.7% | 28 of 37 criterion scores match exactly |
| **Within ±1** | 94.6% | 35 of 37 scores within 1 point of human |
| **Pass/fail agreement** | 87.5% | 7 of 8 calls agree on pass/fail |
| **Consistency (mean SD)** | 0.04 | Near-zero variance across runs |
| **Pass/fail consistency** | 100% | All 8 calls produce same verdict 5/5 times |
| **Unanimous calls** | 8/8 | No call ever flipped between pass/fail |

### Confusion Matrix

|  | Human PASS | Human FAIL |
|---|---:|---:|
| **AI PASS** | 3 | 1 |
| **AI FAIL** | 0 | 4 |

- 0 false negatives (AI never fails a call that humans pass)
- 1 false positive (AI passes a call that humans fail)

### Version Evolution

| Version | MAE | ±1 | Pass/Fail | Consistency | Key Change |
|---|---:|---:|---:|---:|---|
| v1 | 0.30 | 91.9% | 87.5% | 100% | Baseline |
| v2 | 0.32 | 97.3% | 87.5% | 95% | +Partial credit, +guideline check |
| v3 | 0.30 | 97.3% | 87.5% | 100% | +Strict caps, +simple criteria |
| v4 | 0.32 | 94.6% | 87.5% | 95% | +Deterministic hard rules (told AI — bad) |
| **v5** | **0.30** | **94.6%** | **87.5%** | **100%** | **v3 prompt + silent deterministic check** |

V5 combines v3's aggressive prompt (makes the AI score correctly) with v4's deterministic post-processing (a silent safety net that catches hard rules the AI misses). It also adds criterion separation (Fix 13) to prevent cross-contamination of scores.

## 4. Where It Fails

### Failure 1: trn-02 — False Positive (AI PASS, Human FAIL)

**What happened:** The trainee confidently stated 3 wrong product facts. The AI scored Product knowledge as 2 (within ±1 of human's 1). The human evaluator applied an implicit hard rule: "Product knowledge ≤ 2 = auto-fail." Our evaluator did not trigger this rule because it is not in the agent's configuration — it is the human's own domain expertise interpretation.

**Root cause:** The human evaluator applied a rule that is not explicitly stated in the agent configuration. Our evaluator correctly enforces all explicitly-configured rules and has deterministic post-processing for criterion-specific rules, but cannot replicate implicit human judgment.

**Severity:** This is the only pass/fail disagreement. It causes 1 false positive out of 8 calls.

### Failure 2: sup-03 — Diagnosis (AI 4, Human 2, difference 2)

**What happened:** The agent verified the caller and asked about router lights but skipped the outage check, restart, and speed test. The AI acknowledges the missing steps but scores 4 instead of 2. The "strict cap at 2 for missing required steps" instruction is partially followed but not enforced strictly enough.

**Root cause:** Model capability limitation. `gpt-4o-mini` understands the instruction conceptually but doesn't apply it consistently when scoring. A stronger model (gpt-4o, claude-3.5-sonnet) would likely follow the strict cap better.

**Severity:** This is the only large score disagreement in v5. It does not affect pass/fail (both agree on FAIL).

### Failure 3: trn-04 — Product Knowledge (AI 3, Human 5, difference 2)

**What happened:** The trainee stated all product facts correctly (human scored 5) but made false compliance promises (loan, cashback). The AI penalized Product knowledge for the compliance violations — conflating two criteria despite Fix 13 (criterion separation) instructing it not to.

**Root cause:** The AI struggles with criterion independence. It sees the false promises and docks the wrong criterion. Fix 13 improved Compliance to perfect (MAE 0.00) but didn't fully fix Product knowledge.

**Severity:** Does not affect pass/fail (both agree on FAIL). ±1 dropped from 97.3% to 94.6% because of this one case.

## 5. What We Would Do Next

### 1. Use a Stronger Model

The sup-03 Diagnosis failure (AI scores 4 instead of 2 despite being told to cap at 2) is a model capability limitation. Switching from `gpt-4o-mini` to `gpt-4o` or `claude-3.5-sonnet` would likely improve instruction-following on strict caps and criterion separation. Cost increase: ~10× per evaluation, but still under $0.01 per call.

### 2. Deterministic Guideline Compliance Check

Instead of relying on the AI to check whether the agent followed each guideline step, we could implement a deterministic post-processing check: parse the guidelines into steps, use NLP to match each step against the transcript, and cap scores algorithmically when required steps are missing. This would fix the sup-03 Diagnosis issue without relying on model capability.

### 3. Explicit Criterion-Specific Hard Rules in Config

The trn-02 false positive occurs because the human evaluator applied an implicit rule ("Product knowledge ≤ 2 = auto-fail") that isn't in the agent configuration. The fix: allow human evaluators to explicitly define criterion-specific hard rules through the UI (already implemented). When the dataset agent configs include these rules, the deterministic post-processing catches them.

### 4. More Human-Labelled Calls

8 labelled calls is a small sample. With 20-30 labelled calls, we could compute statistically significant confidence intervals for MAE and agreement rate. The benchmark pipeline supports this — just add more labels to `dataset/labels/dev-labels.csv` and re-run.

### 5. A/B Prompt Comparison

The benchmark pipeline supports versioning. We could implement a v6 prompt that uses chain-of-thought reasoning (ask the AI to think step-by-step before scoring) and measure whether it improves the sup-03 Diagnosis score without regressing other criteria. The infrastructure exists — just change the prompt, bump the version, and re-run.

## 6. Limitations

1. Results are based on 8 human-labelled calls — small sample size
2. The evaluator uses `gpt-4o-mini` — stronger models may perform differently
3. Human labels are assumed to be ground truth but may contain subjectivity
4. TTS server is local only (not deployed)
5. No real phone call integration (Vapi/Twilio)
6. Web Speech API (mic input) only works in Chrome/Edge
7. Long conversations may exceed the LLM context window (no summarization)