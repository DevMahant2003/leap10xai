import { z } from "zod";

export const criterionScoreSchema = z.object({
  criterion: z.string(),
  score: z.number(),
  max_score: z.number(),
  evidence_turn: z.number().nullable(),
  evidence_text: z.string().nullable(),
  explanation: z.string(),
});

export const hardRuleViolationSchema = z.object({
  rule: z.string(),
  evidence_turn: z.number().nullable(),
  evidence_text: z.string().nullable(),
  explanation: z.string(),
});

export const improvementSuggestionSchema = z.object({
  area: z.string(),
  current_score: z.number(),
  issue: z.string(),
  suggestion: z.string(),
  config_type: z.enum(["knowledge", "guidelines", "hard_rules", "rubric"]),
  suggested_addition: z.string(),
});

export const evaluationOutputSchema = z.object({
  scores: z.array(criterionScoreSchema),
  hard_rule_violations: z.array(hardRuleViolationSchema),
  summary: z.string(),
  improvement_suggestions: z.array(improvementSuggestionSchema).default([]),
});

export type EvaluationOutput = z.infer<typeof evaluationOutputSchema>;
export type CriterionScore = z.infer<typeof criterionScoreSchema>;
export type HardRuleViolation = z.infer<typeof hardRuleViolationSchema>;
export type ImprovementSuggestion = z.infer<typeof improvementSuggestionSchema>;