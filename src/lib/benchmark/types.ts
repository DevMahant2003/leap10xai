// ============================================
// DATASET TYPES (normalized from supplied files)
// ============================================

export interface NormalizedTranscript {
  id: string;
  agentName: string;
  agentConfig: {
    persona: string;
    goal: string;
    scoring_notes?: string;
    knowledge: { topic: string; detail: string }[];
    guidelines: { rule: string }[];
    rubric: {
      criterion: string;
      description: string;
      weight: number;
      max_score: number;
    }[];
    hard_rules: { rule: string }[];
    pass_threshold: number;
  };
  transcript: {
    role: "agent" | "customer";
    text: string;
    turn_no: number;
  }[];
}

export interface NormalizedHumanLabel {
  conversationId: string;
  scores: {
    criterion: string;
    score: number | null; // null = "not assessable"
    max_score: number;
  }[];
  passFail: "PASS" | "FAIL";
  evaluatorName: string;
  notes?: string;
}

export interface NormalizedDataset {
  transcripts: NormalizedTranscript[];
  humanLabels: NormalizedHumanLabel[];
}

// ============================================
// COMPARISON TYPES
// ============================================

export interface CriterionComparison {
  conversationId: string;
  criterion: string;
  aiScore: number;
  humanScore: number | null;
  maxScore: number;
  difference: number | null; // null if human score is null
  exactMatch: boolean;
  withinOne: boolean;
  largeDisagreement: boolean; // |ai - human| >= 2
  excluded: boolean; // true if human score is null/NA
  exclusionReason?: string;
}

export interface ConversationComparison {
  conversationId: string;
  transcriptTitle: string;
  aiAverageScore: number;
  humanAverageScore: number | null;
  aiPassFail: string;
  humanPassFail: string;
  passFailAgreement: boolean;
  criterionComparisons: CriterionComparison[];
}

export interface DisagreementCase {
  conversationId: string;
  transcriptTitle: string;
  criterion: string;
  humanScore: number;
  aiScore: number;
  difference: number;
  evidenceTurn: number | null;
  evidenceText: string | null;
  aiExplanation: string;
}

// ============================================
// METRICS TYPES
// ============================================

export interface CriterionMetrics {
  criterion: string;
  count: number;
  excludedCount: number;
  mae: number;
  exactAgreement: number; // percentage
  withinOneAgreement: number; // percentage
}

export interface ConfusionMatrix {
  tp: number; // AI PASS, Human PASS
  fp: number; // AI PASS, Human FAIL
  fn: number; // AI FAIL, Human PASS
  tn: number; // AI FAIL, Human FAIL
}

export interface HumanValidationMetrics {
  labelledCalls: number;
  criteriaCompared: number;
  criteriaExcluded: number;
  overallMAE: number;
  exactAgreement: number; // percentage
  withinOneAgreement: number; // percentage
  passFailAgreement: number; // percentage
  confusionMatrix: ConfusionMatrix;
  criterionMetrics: CriterionMetrics[];
  conversationComparisons: ConversationComparison[];
  disagreements: DisagreementCase[];
}

// ============================================
// CONSISTENCY TYPES
// ============================================

export interface ConsistencyRun {
  run: number;
  scores: { criterion: string; score: number; max_score: number }[];
  averageScore: number;
  passFail: string;
}

export interface ConsistencyResult {
  conversationId: string;
  transcriptTitle: string;
  runs: ConsistencyRun[];
  perCriterionStats: {
    criterion: string;
    scores: number[];
    mean: number;
    stdDev: number;
    variance: number;
    range: number;
    min: number;
    max: number;
  }[];
  averageScoreStats: {
    scores: number[];
    mean: number;
    stdDev: number;
    variance: number;
    range: number;
  };
  passFailConsistency: number; // percentage
  unanimous: boolean;
}

export interface ConsistencySummary {
  callsTested: number;
  runsPerCall: number;
  totalRuns: number;
  meanStdDev: number;
  maxStdDev: number;
  meanRange: number;
  maxRange: number;
  passFailConsistency: number; // percentage
  unanimousCalls: number;
}

export interface ConsistencyMetrics {
  results: ConsistencyResult[];
  summary: ConsistencySummary;
}

// ============================================
// BENCHMARK RESULT (full output)
// ============================================

export interface BenchmarkResult {
  metadata: {
    dataset: string;
    model: string;
    promptVersion: string;
    temperature: number;
    runAt: string;
    benchmarkRunId: string;
  };
  humanValidation: HumanValidationMetrics;
  consistency: ConsistencyMetrics;
  exclusions: {
    reason: string;
    count: number;
    details: string[];
  }[];
}