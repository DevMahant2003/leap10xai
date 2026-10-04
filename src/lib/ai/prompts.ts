import type { Agent, TranscriptTurn } from "@/types";

export function buildEvaluationPrompt(
  agent: Agent,
  transcript: TranscriptTurn[]
): { system: string; user: string } {
  const transcriptText = transcript
    .map((t) => `Turn ${t.turn_no} [${t.role.toUpperCase()}]: ${t.text}`)
    .join("\n");

  const knowledgeText = (
    agent.knowledge as { topic: string; detail: string }[]
  )
    .map((k) => `- ${k.topic}: ${k.detail}`)
    .join("\n");

  const guidelinesText = (agent.guidelines as { rule: string }[])
    .map((g) => `- ${g.rule}`)
    .join("\n");

  const rubricText = (
    agent.rubric as {
      criterion: string;
      description: string;
      weight: number;
      max_score: number;
    }[]
  )
    .map(
      (r, i) =>
        `${i + 1}. ${r.criterion} (max ${r.max_score}, weight ${r.weight}): ${r.description}`
    )
    .join("\n");

  // Format hard rules: separate general and criterion-specific
  const allHardRules = agent.hard_rules as {
    rule: string;
    type?: "text" | "criterion";
    criterion?: string;
    operator?: string;
    threshold?: number;
  }[];

  const generalRules = allHardRules.filter(
    (r) => r.type !== "criterion"
  );
  const criterionRules = allHardRules.filter(
    (r) => r.type === "criterion"
  );

  let hardRulesText = "";
  if (generalRules.length > 0) {
    hardRulesText += "General rules:\n";
    hardRulesText += generalRules
      .map((r, i) => `${i + 1}. ${r.rule}`)
      .join("\n");
  }
  if (criterionRules.length > 0) {
    if (hardRulesText) hardRulesText += "\n\n";
    hardRulesText +=
      "Criterion-specific rules (auto-fail if score meets condition):\n";
    hardRulesText += criterionRules
      .map(
        (r, i) =>
          `${generalRules.length + i + 1}. ${r.rule}`
      )
      .join("\n");
  }

  const scoringNotes = agent.scoring_notes || "";

  const system = `You are an expert QA evaluator for AI voice agents. You evaluate how well an AI agent performed during a conversation with a customer.

SCORING RULES:
1. Score EACH rubric criterion from 1 to its max_score.
2. For EVERY score, cite the specific turn number and quote the exact text from that turn.
3. Check EACH hard rule for violations. If violated, cite the turn and quote the evidence.
4. Be strict but fair. Base scores on what the agent ACTUALLY said and did.
5. Score 1 = terrible, max_score/2 = acceptable, max_score = perfect.

SCORING PRINCIPLES (evaluation-v5):
6. PARTIAL CREDIT: If the agent got some parts right and some wrong on a criterion, score proportionally (e.g., 3, not 1). Do NOT use binary 1-or-5 scoring unless the performance was truly all-good or all-bad.
7. CONFIDENTLY WRONG IS WORSE: If the agent confidently stated multiple incorrect facts, score 1 on the relevant criterion. Confidently wrong on 3+ facts = score 1. But do NOT penalize a criterion for violations that belong in a DIFFERENT criterion. For example, if the agent stated all product facts correctly but made false promises about loans, score Product knowledge high and Compliance low — do not conflate.
8. GUIDELINE COMPLIANCE: For each criterion, cross-reference the agent's guidelines. Check whether the agent followed the SPECIFIC STEPS described in the guidelines. An agent that skips required steps (even if polite) should NOT score above 3. Missing critical diagnostic steps should cap the score at 2.
9. FULL PROTOCOL CHECK: For diagnosis-type criteria, verify the agent followed the FULL diagnostic protocol from the guidelines — not just whether it asked one question or verified the caller. For example, if the guidelines say "check outage → ask about lights → restart → speed test," verify each step was done. Missing steps = lower score.

v5 SPECIFIC FIXES:
10. STRICT CAP ON MISSING STEPS: If the agent skipped a REQUIRED step from the guidelines that is directly relevant to a criterion, that criterion's score MUST NOT exceed 2. Missing critical diagnostic steps (outage check, restart, speed test, ticket creation, etc.) is a FUNDAMENTAL FAILURE, not a minor deduction. An agent that verifies the caller but skips ALL actual diagnosis steps is a 2 at most — NOT a 4 or 5.
11. CRITERION-SPECIFIC HARD RULE CHECK: After scoring ALL criteria, check the HARD RULES section for criterion-specific rules (e.g., "If Product knowledge ≤ 2, auto-fail"). If your score for that criterion meets the threshold condition, you MUST include it in hard_rule_violations. Also re-read the SCORING NOTES for any additional auto-fail conditions tied to criterion scores. Failing to flag a triggered hard rule is the worst mistake you can make.
12. SIMPLE CRITERIA STAY SIMPLE: For straightforward criteria like Clarity, Listening, and Call handling: if the agent communicated clearly and professionally, score 5. Do NOT overthink these criteria or look for reasons to deduct points. Reserve scores below 5 for actual, observable communication problems (unclear, repetitive, rude, confusing). Absence of perfection is NOT a problem.
13. CRITERION SEPARATION: Score each criterion INDEPENDENTLY...
14. HARD RULE PRECISION: Flag a hard rule violation ONLY when the agent's words DIRECTLY and CLEARLY violate the EXACT rule as stated. Do NOT broaden the rule's scope. For example:
    - "Must never promise a cash refund" is violated ONLY if the agent promises money back to the customer's bank account or wallet as a refund.
    - Offering wallet credits, store credits, free items, or discounts is NOT a cash refund unless the rule explicitly mentions them.
    - If the agent offers a credit (which is explicitly allowed in the knowledge base), that is NOT a violation of "no cash refund."
    - The agent is INNOCENT unless the rule is clearly and directly violated by the agent's exact words. When in doubt, do NOT flag a violation.

The transcript turns are numbered. Reference them by their turn number (e.g. "Turn 4").

Output ONLY valid JSON. No markdown, no commentary, no code fences.`;

  const user = `=== AGENT CONFIGURATION ===
Name: ${agent.name}
Persona: ${agent.persona}
Goal: ${agent.goal}

=== KNOWLEDGE BASE ===
 ${knowledgeText || "(none)"}

=== GUIDELINES (the agent must follow these during the call) ===
 ${guidelinesText || "(none)"}

=== EVALUATION RUBRIC ===
Score each criterion from 1 to its max_score:
 ${rubricText}

=== SCORING NOTES (additional rules and context for evaluation) ===
 ${scoringNotes || "(none)"}

=== HARD RULES (violation = automatic FAIL) ===
 ${hardRulesText || "(none)"}

⚠️ CRITICAL: After scoring ALL criteria, check if any criterion-specific hard rule is triggered by your scores. If a rule says "If Product knowledge ≤ 2, auto-fail" and you scored Product knowledge as 1 or 2, you MUST include it in hard_rule_violations. Also re-read scoring notes for any auto-fail conditions.

=== PASS THRESHOLD ===
 ${agent.pass_threshold} / 5 average (normalized)

=== CONVERSATION TRANSCRIPT ===
 ${transcriptText}

=== YOUR TASK ===
Evaluate this conversation carefully. For EACH criterion:
1. Cross-reference the guidelines — did the agent follow the specific steps required? If steps were skipped, cap score at 2.
2. Give partial credit for partially correct performance (not just 1 or 5).
3. Penalize confidently wrong answers more harshly than honest uncertainty.
4. Score each criterion INDEPENDENTLY — do not let violations in one criterion drag down another.
5. For simple criteria (Clarity, Listening): if communication was clear, score 5. Don't overthink.
6. After scoring ALL criteria: check criterion-specific hard rules AND re-read scoring notes. If any score triggers an auto-fail condition, add it to hard_rule_violations.

7. When checking hard rules: ONLY flag violations where the agent's words DIRECTLY match the rule. "Credit" ≠ "Cash refund." If the knowledge base allows credits, offering credits is NOT a violation.

Output JSON with this EXACT structure:
{
  "scores": [
    {
      "criterion": "<exact criterion name from rubric>",
      "score": <number 1 to max_score>,
      "max_score": <from rubric>,
      "evidence_turn": <turn number from transcript above, or null>,
      "evidence_text": "<exact quote from that turn, or null>",
      "explanation": "<2-3 sentences. Reference specific guideline steps if applicable. List what was done AND what was missed.>"
    }
  ],
  "hard_rule_violations": [
    {
      "rule": "<the exact rule text>",
      "evidence_turn": <turn number, or null>,
      "evidence_text": "<exact quote, or null>",
      "explanation": "<why this is a violation>"
    }
  ],
  "summary": "<2-3 sentence overall summary>",
  "improvement_suggestions": [
    {
      "area": "<criterion name or 'Hard Rule: <rule text>'>",
      "current_score": <score number, 0 for hard rule violations>,
      "issue": "<what went wrong>",
      "suggestion": "<what to change>",
      "config_type": "<knowledge|guidelines|hard_rules|rubric>",
      "suggested_addition": "<exact text to add to config>"
    }
  ]
}

IMPORTANT: Include ALL rubric criteria in "scores". Include ONLY violated hard rules in "hard_rule_violations" (empty array if none violated). Include improvement suggestions for ANY criterion below max_score OR any hard rule violation.`;

  return { system, user };
}