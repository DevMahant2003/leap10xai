import { createClient } from "@supabase/supabase-js";
import { evaluateConversation } from "@/lib/ai/evaluator";
import { loadDataset } from "./dataset-loader";
import {
  calculateMAE,
  calculateExactAgreement,
  calculateWithinOneAgreement,
  calculatePassFailAgreement,
  calculateConfusionMatrix,
  calculateCriterionMetrics,
  calculateStdDev,
  calculateVariance,
  calculateRange,
  calculateMean,
  calculatePassFailConsistency,
  isNotAssessable,
} from "./metrics";
import {
  PROMPT_VERSION,
  EVALUATOR_TEMPERATURE,
  EVALUATOR_MODEL,
  DATASET_VERSION,
} from "./prompt-version";
import type { Agent, TranscriptTurn } from "@/types";
import type { EvaluationResult } from "@/lib/ai/evaluator";
import type {
  NormalizedDataset,
  CriterionComparison,
  ConversationComparison,
  DisagreementCase,
  HumanValidationMetrics,
  ConsistencyResult,
  ConsistencyMetrics,
  ConsistencySummary,
  BenchmarkResult,
} from "./types";

function createSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

// ============================================
// ENSURE AGENT EXISTS IN DB
async function ensureAgent(
  supabase: ReturnType<typeof createSupabaseAdmin>,
  transcript: NormalizedDataset["transcripts"][0],
  systemUserId: string
): Promise<{ agentId: string; agent: Agent }> {
  const { data: existing } = await supabase
    .from("agents")
    .select("*")
    .ilike("name", transcript.agentName)
    .limit(1)
    .maybeSingle();

  if (existing) {
    // Update existing agent with latest config (including scoring_notes for v2)
    const { data: updated, error } = await supabase
      .from("agents")
      .update({
        persona: transcript.agentConfig.persona,
        goal: transcript.agentConfig.goal,
        knowledge: transcript.agentConfig.knowledge,
        guidelines: transcript.agentConfig.guidelines,
        rubric: transcript.agentConfig.rubric,
        hard_rules: transcript.agentConfig.hard_rules,
        pass_threshold: transcript.agentConfig.pass_threshold,
        scoring_notes: transcript.agentConfig.scoring_notes || null,
      })
      .eq("id", existing.id)
      .select("*")
      .single();

    if (error) {
      console.warn(`⚠️ Failed to update agent: ${error.message}`);
      return { agentId: existing.id, agent: existing as unknown as Agent };
    }

    return { agentId: existing.id, agent: updated as unknown as Agent };
  }

  // Create new agent
  const { data: agent, error } = await supabase
    .from("agents")
    .insert({
      user_id: systemUserId,
      name: transcript.agentName,
      persona: transcript.agentConfig.persona,
      goal: transcript.agentConfig.goal,
      knowledge: transcript.agentConfig.knowledge,
      guidelines: transcript.agentConfig.guidelines,
      rubric: transcript.agentConfig.rubric,
      hard_rules: transcript.agentConfig.hard_rules,
      pass_threshold: transcript.agentConfig.pass_threshold,
      scoring_notes: transcript.agentConfig.scoring_notes || null,
    })
    .select("*")
    .single();

  if (error) throw new Error(`Failed to create agent: ${error.message}`);
  return { agentId: agent.id, agent: agent as unknown as Agent };
}

// ============================================
// ENSURE CONVERSATION EXISTS IN DB
// ============================================
async function ensureConversation(
  supabase: ReturnType<typeof createSupabaseAdmin>,
  agentId: string,
  transcript: NormalizedDataset["transcripts"][0],
  userId: string
): Promise<string> {
  // Check by title (transcript ID)
  const title = `Benchmark: ${transcript.id}`;
  const { data: existing } = await supabase
    .from("conversations")
    .select("id")
    .eq("agent_id", agentId)
    .ilike("title", title)
    .limit(1)
    .maybeSingle();

  if (existing) return existing.id;

  const { data: conv, error } = await supabase
    .from("conversations")
    .insert({
      agent_id: agentId,
      user_id: userId,
      title,
      transcript: transcript.transcript,
      source: "upload",
      status: "completed",
      metadata: { benchmark: true, dataset_id: transcript.id },
    })
    .select("id")
    .single();

  if (error) throw new Error(`Failed to create conversation: ${error.message}`);
  return conv.id;
}

// ============================================
// ENSURE HUMAN LABEL EXISTS IN DB
// ============================================
async function ensureHumanLabel(
  supabase: ReturnType<typeof createSupabaseAdmin>,
  conversationId: string,
  label: NormalizedDataset["humanLabels"][0],
  userId: string
): Promise<void> {
  const { data: existing } = await supabase
    .from("human_evaluations")
    .select("id")
    .eq("conversation_id", conversationId)
    .limit(1)
    .maybeSingle();

  if (existing) return;

  const { error } = await supabase.from("human_evaluations").insert({
    conversation_id: conversationId,
    user_id: userId,
    evaluator_name: label.evaluatorName,
    scores: label.scores,
    pass_fail: label.passFail,
    notes: label.notes || null,
  });

  if (error) {
    console.warn(`⚠️ Failed to save human label for ${conversationId}: ${error.message}`);
  }
}

// ============================================
// RUN AI EVALUATION
// ============================================
async function runAIEvaluation(
  agent: Agent,
  transcript: TranscriptTurn[],
  benchmarkRunId: string,
  userId: string,
  conversationId: string
): Promise<EvaluationResult & { evaluationId: string }> {
  const result = await evaluateConversation(agent, transcript, {
    model: EVALUATOR_MODEL,
  });

  // Save to DB
  const supabase = createSupabaseAdmin();
  const { data: evalRow, error } = await supabase
    .from("evaluations")
    .insert({
      conversation_id: conversationId,
      user_id: userId,
      scores: result.scores,
      hard_rule_violations: result.hard_rule_violations,
      average_score: result.averageScore,
      pass_fail: result.passFail,
      model: EVALUATOR_MODEL,
      summary: result.summary,
      improvement_suggestions: result.improvement_suggestions || [],
      prompt_version: PROMPT_VERSION,
      temperature: EVALUATOR_TEMPERATURE,
      benchmark_run_id: benchmarkRunId,
    })
    .select("id")
    .single();

  if (error) {
    console.warn(`⚠️ Failed to save evaluation: ${error.message}`);
  }

  return { ...result, evaluationId: evalRow?.id || "" };
}

// ============================================
// HUMAN VS AI COMPARISON
// ============================================
function compareScores(
  aiScores: { criterion: string; score: number; max_score: number }[],
  humanScores: { criterion: string; score: number | null; max_score: number }[],
  conversationId: string
): CriterionComparison[] {
  const comparisons: CriterionComparison[] = [];

  for (const aiScore of aiScores) {
    // Match by criterion name (case-insensitive)
    const humanScore = humanScores.find(
      (h) => h.criterion.toLowerCase().trim() === aiScore.criterion.toLowerCase().trim()
    );

    if (!humanScore) {
      // No human label for this criterion
      comparisons.push({
        conversationId,
        criterion: aiScore.criterion,
        aiScore: aiScore.score,
        humanScore: null,
        maxScore: aiScore.max_score,
        difference: null,
        exactMatch: false,
        withinOne: false,
        largeDisagreement: false,
        excluded: true,
        exclusionReason: "No human label for this criterion",
      });
      continue;
    }

    const excluded = isNotAssessable(humanScore.score);
    const diff = excluded ? null : Math.abs(aiScore.score - (humanScore.score as number));

    comparisons.push({
      conversationId,
      criterion: aiScore.criterion,
      aiScore: aiScore.score,
      humanScore: humanScore.score,
      maxScore: aiScore.max_score,
      difference: diff,
      exactMatch: !excluded && diff === 0,
      withinOne: !excluded && diff !== null && diff <= 1,
      largeDisagreement: !excluded && diff !== null && diff >= 2,
      excluded,
      exclusionReason: excluded ? "Marked as not assessable" : undefined,
    });
  }

  return comparisons;
}

// ============================================
// MAIN BENCHMARK RUNNER
// ============================================
export async function runBenchmark(
  options: { consistencyRuns?: number; skipConsistency?: boolean } = {}
): Promise<BenchmarkResult> {
  const consistencyRuns = options.consistencyRuns || 5;
  const supabase = createSupabaseAdmin();

  console.log("🚀 Starting benchmark...\n");

  // Step 1: Load dataset
  console.log("📂 Loading dataset...");
  const dataset = loadDataset();
  console.log(`   ${dataset.transcripts.length} transcripts, ${dataset.humanLabels.length} human labels\n`);

  // Step 2: Create benchmark run record
  const { data: usersData, error: usersError } =
    await supabase.auth.admin.listUsers();

  if (usersError) {
    throw new Error(
      `Could not list Supabase users: ${usersError.message}. Check SUPABASE_SERVICE_ROLE_KEY in .env.local`
    );
  }

  const systemUserId = usersData?.users[0]?.id;

  if (!systemUserId) {
    throw new Error(
      "No users found in Supabase. Sign up at http://localhost:3000/signup first, then re-run the benchmark."
    );
  }

  console.log(`👤 Using user: ${usersData!.users[0]!.email}\n`);

  const { data: benchmarkRun } = await supabase
    .from("benchmark_runs")
    .insert({
      user_id: systemUserId,
      dataset_version: DATASET_VERSION,
      model: EVALUATOR_MODEL,
      prompt_version: PROMPT_VERSION,
      temperature: EVALUATOR_TEMPERATURE,
      total_calls: dataset.transcripts.length,
      labelled_calls: dataset.humanLabels.length,
      status: "running",
    })
    .select("id")
    .single();

  const benchmarkRunId = benchmarkRun!.id;
  console.log(`📊 Benchmark run: ${benchmarkRunId}\n`);

  // Step 3: Ensure agents + conversations exist
  console.log("🔧 Ensuring agents and conversations exist...");
  const transcriptMap = new Map<string, { agentId: string; conversationId: string; agent: Agent }>();

  for (const transcript of dataset.transcripts) {
    const { agentId, agent } = await ensureAgent(supabase, transcript, systemUserId);
    const conversationId = await ensureConversation(supabase, agentId, transcript, systemUserId);
    transcriptMap.set(transcript.id, { agentId, conversationId, agent });
  }
  console.log(`   ${transcriptMap.size} conversations ready\n`);

  // Step 4: Ensure human labels exist + run AI evaluation on labelled calls
  console.log("🎯 Running AI evaluations on human-labelled calls...");
  const allComparisons: CriterionComparison[] = [];
  const conversationComparisons: ConversationComparison[] = [];
  const disagreements: DisagreementCase[] = [];
  const exclusions: { reason: string; count: number; details: string[] }[] = [];
  const exclusionDetails = new Map<string, string[]>();

  for (const label of dataset.humanLabels) {
    const transcriptData = transcriptMap.get(label.conversationId);
    if (!transcriptData) {
      console.warn(`⚠️ No transcript found for human label: ${label.conversationId}`);
      exclusions.push({
        reason: `Transcript not found: ${label.conversationId}`,
        count: 1,
        details: [label.conversationId],
      });
      continue;
    }

    console.log(`   Evaluating ${label.conversationId}...`);

    // Ensure human label in DB
    await ensureHumanLabel(supabase, transcriptData.conversationId, label, systemUserId);

    // Run AI evaluation
    let aiResult;
    try {
      aiResult = await runAIEvaluation(
        transcriptData.agent,
        dataset.transcripts.find((t) => t.id === label.conversationId)!.transcript,
        benchmarkRunId,
        systemUserId,
        transcriptData.conversationId
      );
    } catch (error) {
      console.error(`❌ AI evaluation failed for ${label.conversationId}:`, error);
      exclusions.push({
        reason: `AI evaluation failed: ${label.conversationId}`,
        count: 1,
        details: [label.conversationId],
      });
      continue;
    }

    // Compare
    const aiScores = aiResult.scores.map((s) => ({
      criterion: s.criterion,
      score: s.score,
      max_score: s.max_score,
    }));

    const humanScores = label.scores;
    const comparisons = compareScores(aiScores, humanScores, label.conversationId);
    allComparisons.push(...comparisons);

    // Conversation-level comparison
    const humanAvg = humanScores.filter((s) => !isNotAssessable(s.score)).length > 0
      ? humanScores.filter((s) => !isNotAssessable(s.score)).reduce((sum, s) => sum + (s.score as number), 0) /
        humanScores.filter((s) => !isNotAssessable(s.score)).length
      : null;

    conversationComparisons.push({
      conversationId: label.conversationId,
      transcriptTitle: `Benchmark: ${label.conversationId}`,
      aiAverageScore: aiResult.averageScore,
      humanAverageScore: humanAvg,
      aiPassFail: aiResult.passFail,
      humanPassFail: label.passFail,
      passFailAgreement: aiResult.passFail === label.passFail,
      criterionComparisons: comparisons,
    });

    // Collect disagreements
    for (const c of comparisons) {
      if (c.largeDisagreement && c.humanScore !== null) {
        const aiScore = aiResult.scores.find((s) => s.criterion === c.criterion);
        disagreements.push({
          conversationId: label.conversationId,
          transcriptTitle: `Benchmark: ${label.conversationId}`,
          criterion: c.criterion,
          humanScore: c.humanScore,
          aiScore: c.aiScore,
          difference: c.difference!,
          evidenceTurn: aiScore?.evidence_turn ?? null,
          evidenceText: aiScore?.evidence_text ?? null,
          aiExplanation: aiScore?.explanation ?? "",
        });
      }
    }

    // Track exclusions
    for (const c of comparisons) {
      if (c.excluded) {
        const reason = c.exclusionReason || "Unknown";
        if (!exclusionDetails.has(reason)) {
          exclusionDetails.set(reason, []);
        }
        exclusionDetails.get(reason)!.push(`${label.conversationId}/${c.criterion}`);
      }
    }
  }

  for (const [reason, details] of exclusionDetails) {
    exclusions.push({ reason, count: details.length, details });
  }

  console.log(`   Evaluated ${conversationComparisons.length} calls\n`);

  // Step 5: Calculate human validation metrics
  console.log("📏 Calculating human validation metrics...");
  const validComparisons = allComparisons.filter((c) => !c.excluded);
  const criterionMetrics = calculateCriterionMetrics(allComparisons);
  const passFailResults = conversationComparisons.map((c) => ({
    aiPassFail: c.aiPassFail,
    humanPassFail: c.humanPassFail,
  }));

  const humanValidation: HumanValidationMetrics = {
    labelledCalls: conversationComparisons.length,
    criteriaCompared: validComparisons.length,
    criteriaExcluded: allComparisons.length - validComparisons.length,
    overallMAE: calculateMAE(
      validComparisons.map((c) => ({ aiScore: c.aiScore, humanScore: c.humanScore }))
    ),
    exactAgreement: calculateExactAgreement(
      validComparisons.map((c) => ({ aiScore: c.aiScore, humanScore: c.humanScore }))
    ),
    withinOneAgreement: calculateWithinOneAgreement(
      validComparisons.map((c) => ({ aiScore: c.aiScore, humanScore: c.humanScore }))
    ),
    passFailAgreement: calculatePassFailAgreement(passFailResults),
    confusionMatrix: calculateConfusionMatrix(passFailResults),
    criterionMetrics,
    conversationComparisons,
    disagreements: disagreements.sort((a, b) => b.difference - a.difference),
  };
  console.log(`   MAE: ${humanValidation.overallMAE.toFixed(2)}`);
  console.log(`   Exact agreement: ${humanValidation.exactAgreement.toFixed(1)}%`);
  console.log(`   ±1 agreement: ${humanValidation.withinOneAgreement.toFixed(1)}%`);
  console.log(`   Pass/fail agreement: ${humanValidation.passFailAgreement.toFixed(1)}%\n`);

  // Step 6: Consistency testing
  let consistency: ConsistencyMetrics;
  if (options.skipConsistency) {
    consistency = {
      results: [],
      summary: {
        callsTested: 0,
        runsPerCall: 0,
        totalRuns: 0,
        meanStdDev: 0,
        maxStdDev: 0,
        meanRange: 0,
        maxRange: 0,
        passFailConsistency: 0,
        unanimousCalls: 0,
      },
    };
  } else {
    console.log(`🔁 Running consistency testing (${consistencyRuns} runs per call)...`);
    consistency = await runConsistencyTesting(
      dataset,
      transcriptMap,
      systemUserId,
      consistencyRuns
    );
    console.log(`   Mean SD: ${consistency.summary.meanStdDev.toFixed(2)}`);
    console.log(`   Pass/fail consistency: ${consistency.summary.passFailConsistency.toFixed(1)}%\n`);
  }

  // Step 7: Build final result
  const result: BenchmarkResult = {
    metadata: {
      dataset: DATASET_VERSION,
      model: EVALUATOR_MODEL,
      promptVersion: PROMPT_VERSION,
      temperature: EVALUATOR_TEMPERATURE,
      runAt: new Date().toISOString(),
      benchmarkRunId,
    },
    humanValidation,
    consistency,
    exclusions,
  };

  // Step 8: Save benchmark results to DB
  await supabase
    .from("benchmark_runs")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
      results: result as any,
    })
    .eq("id", benchmarkRunId);

  console.log("✅ Benchmark complete!\n");
  return result;
}

// ============================================
// CONSISTENCY TESTING
// ============================================
async function runConsistencyTesting(
  dataset: NormalizedDataset,
  transcriptMap: Map<string, { agentId: string; conversationId: string; agent: Agent }>,
  userId: string,
  runsPerCall: number
): Promise<ConsistencyMetrics> {
  const results: ConsistencyResult[] = [];
  const allStdDevs: number[] = [];
  const allRanges: number[] = [];
  const allPassFailConsistencies: number[] = [];
  let unanimousCount = 0;

  // Use all human-labelled calls for consistency testing
  const conversationIds = dataset.humanLabels.map((l) => l.conversationId);

  for (const convId of conversationIds) {
    const transcriptData = transcriptMap.get(convId);
    if (!transcriptData) continue;

    const transcript = dataset.transcripts.find((t) => t.id === convId)!;
    console.log(`   ${convId}: running ${runsPerCall} evaluations...`);

    const runs: {
      run: number;
      scores: { criterion: string; score: number; max_score: number }[];
      averageScore: number;
      passFail: string;
    }[] = [];

    for (let i = 0; i < runsPerCall; i++) {
      try {
        const result = await evaluateConversation(
          transcriptData.agent,
          transcript.transcript,
          { model: EVALUATOR_MODEL }
        );

        runs.push({
          run: i + 1,
          scores: result.scores.map((s) => ({
            criterion: s.criterion,
            score: s.score,
            max_score: s.max_score,
          })),
          averageScore: result.averageScore,
          passFail: result.passFail,
        });

        // Small delay to avoid rate limiting
        if (i < runsPerCall - 1) {
          await new Promise((r) => setTimeout(r, 500));
        }
      } catch (error) {
        console.warn(`   ⚠️ Run ${i + 1} failed for ${convId}`);
      }
    }

    if (runs.length === 0) continue;

    // Per-criterion stats
    const allCriteria = new Set<string>();
    for (const run of runs) {
      for (const s of run.scores) {
        allCriteria.add(s.criterion);
      }
    }

    const perCriterionStats = Array.from(allCriteria).map((criterion) => {
      const scores = runs
        .map((r) => r.scores.find((s) => s.criterion === criterion)?.score)
        .filter((s): s is number => s !== undefined) as number[];

      return {
        criterion,
        scores,
        mean: calculateMean(scores),
        stdDev: calculateStdDev(scores),
        variance: calculateVariance(scores),
        range: calculateRange(scores),
        min: Math.min(...scores),
        max: Math.max(...scores),
      };
    });

    // Average score stats
    const avgScores = runs.map((r) => r.averageScore);
    const avgStats = {
      scores: avgScores,
      mean: calculateMean(avgScores),
      stdDev: calculateStdDev(avgScores),
      variance: calculateVariance(avgScores),
      range: calculateRange(avgScores),
    };

    // Pass/fail consistency
    const passFailResults = runs.map((r) => r.passFail);
    const pfConsistency = calculatePassFailConsistency(passFailResults);

    allStdDevs.push(avgStats.stdDev);
    allRanges.push(avgStats.range);
    allPassFailConsistencies.push(pfConsistency.consistency);
    if (pfConsistency.unanimous) unanimousCount++;

    results.push({
      conversationId: convId,
      transcriptTitle: `Benchmark: ${convId}`,
      runs,
      perCriterionStats,
      averageScoreStats: avgStats,
      passFailConsistency: pfConsistency.consistency,
      unanimous: pfConsistency.unanimous,
    });
  }

  const summary: ConsistencySummary = {
    callsTested: results.length,
    runsPerCall,
    totalRuns: results.reduce((sum, r) => sum + r.runs.length, 0),
    meanStdDev: calculateMean(allStdDevs),
    maxStdDev: Math.max(...allStdDevs, 0),
    meanRange: calculateMean(allRanges),
    maxRange: Math.max(...allRanges, 0),
    passFailConsistency: calculateMean(allPassFailConsistencies),
    unanimousCalls: unanimousCount,
  };

  return { results, summary };
}