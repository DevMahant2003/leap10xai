import { callOpenRouter } from "./openrouter";
import { buildEvaluationPrompt } from "./prompts";
import {
  evaluationOutputSchema,
  type EvaluationOutput,
} from "./schemas";
import type { Agent, TranscriptTurn } from "@/types";

export type EvaluationResult = EvaluationOutput & {
  averageScore: number;
  passFail: "PASS" | "FAIL";
};

function extractJSON(content: string): unknown {
  try {
    return JSON.parse(content);
  } catch {
    const match = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (match) {
      try {
        return JSON.parse(match[1]);
      } catch {
        // continue
      }
    }
    const start = content.indexOf("{");
    const end = content.lastIndexOf("}");
    if (start !== -1 && end !== -1) {
      try {
        return JSON.parse(content.slice(start, end + 1));
      } catch {
        // continue
      }
    }
    throw new Error("AI did not return valid JSON");
  }
}

// ============================================
// v4: Deterministic criterion-specific hard rule check
// Uses structured config (not regex on scoring notes)
// ============================================
function checkCriterionHardRules(
  scores: {
    criterion: string;
    score: number;
    evidence_turn: number | null;
    evidence_text: string | null;
    explanation: string;
  }[],
  hardRules: {
    type?: "text" | "criterion";
    rule: string;
    criterion?: string;
    operator?: string;
    threshold?: number;
  }[],
  existingViolations: {
    rule: string;
    evidence_turn: number | null;
    evidence_text: string | null;
    explanation: string;
  }[]
): {
  rule: string;
  evidence_turn: number | null;
  evidence_text: string | null;
  explanation: string;
}[] {
  const newViolations: {
    rule: string;
    evidence_turn: number | null;
    evidence_text: string | null;
    explanation: string;
  }[] = [];

  const existingRules = new Set(
    existingViolations.map((v) => v.rule.toLowerCase())
  );

  for (const rule of hardRules) {
    // Only check criterion-specific rules
    if (rule.type !== "criterion") continue;
    if (!rule.criterion || !rule.operator || rule.threshold === undefined)
      continue;

    // Find the AI's score for this criterion (case-insensitive)
    const score = scores.find(
      (s) =>
        s.criterion.toLowerCase().trim() ===
        rule.criterion!.toLowerCase().trim()
    );
    if (!score) continue;

    // Check if the score triggers the rule
    let triggered = false;
    if (rule.operator === "==" && score.score === rule.threshold) {
      triggered = true;
    } else if (rule.operator === "<=" && score.score <= rule.threshold) {
      triggered = true;
    } else if (rule.operator === ">=" && score.score >= rule.threshold) {
      triggered = true;
    }

    if (triggered) {
      const ruleText = rule.rule;
      if (!existingRules.has(ruleText.toLowerCase())) {
        newViolations.push({
          rule: ruleText,
          evidence_turn: score.evidence_turn ?? null,
          evidence_text: score.evidence_text ?? null,
          explanation: `Criterion "${score.criterion}" was scored ${score.score}, triggering auto-fail: ${ruleText}`,
        });
      }
    }
  }

  return newViolations;
}

// ============================================
// MAIN EVALUATION FUNCTION
// ============================================
export async function evaluateConversation(
  agent: Agent,
  transcript: TranscriptTurn[],
  options?: { model?: string; temperature?: number }
): Promise<EvaluationResult> {
  if (transcript.length === 0) {
    throw new Error("Cannot evaluate an empty transcript");
  }

  const { system, user } = buildEvaluationPrompt(agent, transcript);

  const content = await callOpenRouter({
    model: options?.model || "openai/gpt-4o-mini",
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    temperature: 0.2,
    jsonMode: true,
  });

  const raw = extractJSON(content);
  const validated = evaluationOutputSchema.parse(raw);

  // Build rubric lookup by criterion name (case-insensitive)
  const rubricByName = new Map<
    string,
    { weight: number; max_score: number }
  >();
  for (const r of agent.rubric as {
    criterion: string;
    weight: number;
    max_score: number;
  }[]) {
    rubricByName.set(r.criterion.toLowerCase(), {
      weight: r.weight,
      max_score: r.max_score,
    });
  }

  // Enforce rubric max_score
  const scored = validated.scores.map((s) => {
    const rubric = rubricByName.get(s.criterion.toLowerCase());
    const maxScore = rubric?.max_score || s.max_score || 5;
    const clampedScore = Math.max(1, Math.min(s.score, maxScore));
    return {
      ...s,
      score: clampedScore,
      max_score: maxScore,
    };
  });

  // ============================================
  // v4 POST-PROCESSING: Check criterion-specific
  // hard rules deterministically (no regex, no
  // AI interpretation needed)
  // ============================================
  const criterionViolations = checkCriterionHardRules(
    scored,
    agent.hard_rules as {
      type?: "text" | "criterion";
      rule: string;
      criterion?: string;
      operator?: string;
      threshold?: number;
    }[],
    validated.hard_rule_violations
  );

  const allViolations = [
    ...validated.hard_rule_violations,
    ...criterionViolations,
  ];

  // Calculate weighted average
  const totalWeighted = scored.reduce((sum, s) => {
    const rubric = rubricByName.get(s.criterion.toLowerCase());
    const weight = rubric?.weight || 1;
    return sum + (s.score / s.max_score) * 5 * weight;
  }, 0);

  const totalWeight = scored.reduce((sum, s) => {
    const rubric = rubricByName.get(s.criterion.toLowerCase());
    return sum + (rubric?.weight || 1);
  }, 0);

  const averageScore =
    totalWeight > 0
      ? Math.round((totalWeighted / totalWeight) * 100) / 100
      : 0;

  // Determine pass/fail
  const hasViolations = allViolations.length > 0;
  const passFail: "PASS" | "FAIL" =
    hasViolations || averageScore < agent.pass_threshold ? "FAIL" : "PASS";

  return {
    ...validated,
    scores: scored,
    hard_rule_violations: allViolations,
    averageScore,
    passFail,
  };
}