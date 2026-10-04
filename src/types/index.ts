// ============================================
// CORE TYPES
// ============================================

export interface Agent {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  persona: string;
  goal: string;
  knowledge: KnowledgeEntry[];
  guidelines: Guideline[];
  rubric: RubricCriterion[];
  hard_rules: HardRule[];
  pass_threshold: number;
  created_at: string;
  updated_at: string;
  scoring_notes?: string;
}

export interface KnowledgeEntry {
  id: string;
  topic: string;
  detail: string;
}

export interface Guideline {
  id: string;
  rule: string;
}

export interface RubricCriterion {
  id: string;
  criterion: string;       // e.g. "Diagnosis"
  description: string;     // what to evaluate
  weight: number;          // 1.0 = normal, 2.0 = double
  max_score: number;       // typically 5
}

export interface HardRule {
  id: string;
  rule: string;
  severity: "fail";
  type?: "text" | "criterion";
  criterion?: string;
  operator?: "<=" | ">=" | "==";
  threshold?: number;
}

// ============================================
// TRANSCRIPT
// ============================================

export interface TranscriptTurn {
  role: "agent" | "customer" | "user";
  text: string;
  turn_no?: number;
}

// ============================================
// EVALUATION
// ============================================

export interface CriterionScore {
  criterion: string;
  score: number;
  max_score: number;
  evidence_turn?: number;
  evidence_text?: string;
  explanation: string;
}

export interface HardRuleViolation {
  rule: string;
  evidence_turn?: number;
  evidence_text?: string;
  explanation: string;
}

export interface ImprovementSuggestion {
  area: string;
  current_score: number;
  issue: string;
  suggestion: string;
  config_type: "knowledge" | "guidelines" | "hard_rules" | "rubric";
  suggested_addition: string;
}

export interface Evaluation {
  id: string;
  conversation_id: string;
  scores: CriterionScore[];
  hard_rule_violations: HardRuleViolation[];
  average_score: number;
  pass_fail: "PASS" | "FAIL" | "PENDING";
  model?: string;
  raw_response?: unknown;
  summary?: string;
  improvement_suggestions?: ImprovementSuggestion[];
  created_at: string;
}

// ============================================
// CONVERSATION
// ============================================

export interface Conversation {
  id: string;
  agent_id: string;
  user_id: string;
  title?: string;
  transcript: TranscriptTurn[];
  source: "manual" | "upload" | "live" | "vapi";
  status: "draft" | "completed" | "evaluated";
  metadata?: Record<string, unknown>;
  created_at: string;
}

// ============================================
// HUMAN EVALUATION (for validation)
// ============================================

export interface HumanEvaluation {
  id: string;
  conversation_id: string;
  evaluator_name: string;
  scores: { criterion: string; score: number; max_score: number }[];
  pass_fail: "PASS" | "FAIL";
  notes?: string;
  created_at: string;
}