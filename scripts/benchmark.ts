import * as dotenv from "dotenv";
import * as path from "path";

// Load .env.local
dotenv.config({ path: path.join(process.cwd(), ".env.local") });

import { runBenchmark } from "../src/lib/benchmark/runner";
import { generateReports } from "../src/lib/benchmark/report-generator";

async function main() {
  console.log("═══════════════════════════════════════");
  console.log("  LEAP10XAI — Evaluator Benchmark");
  console.log("═══════════════════════════════════════\n");

  const args = process.argv.slice(2);
  const skipConsistency = args.includes("--no-consistency");
  const runsArg = args.find((a) => a.startsWith("--runs="));
  const consistencyRuns = runsArg ? parseInt(runsArg.split("=")[1]) : 5;

  try {
    const result = await runBenchmark({
      consistencyRuns,
      skipConsistency,
    });

    generateReports(result);

    console.log("\n═══════════════════════════════════════");
    console.log("  BENCHMARK SUMMARY");
    console.log("═══════════════════════════════════════\n");

    const hv = result.humanValidation;
    const cs = result.consistency.summary;

    console.log("HUMAN AGREEMENT:");
    console.log(`  Labelled calls:      ${hv.labelledCalls}`);
    console.log(`  Criteria compared:   ${hv.criteriaCompared}`);
    console.log(`  Criteria excluded:   ${hv.criteriaExcluded}`);
    console.log(`  MAE:                  ${hv.overallMAE.toFixed(2)}`);
    console.log(`  Exact agreement:     ${hv.exactAgreement.toFixed(1)}%`);
    console.log(`  ±1 agreement:        ${hv.withinOneAgreement.toFixed(1)}%`);
    console.log(`  Pass/fail agreement: ${hv.passFailAgreement.toFixed(1)}%`);
    console.log(`  Confusion: TP=${hv.confusionMatrix.tp} FP=${hv.confusionMatrix.fp} FN=${hv.confusionMatrix.fn} TN=${hv.confusionMatrix.tn}`);
    console.log(`  Disagreements (≥2):  ${hv.disagreements.length}`);

    console.log("\nCONSISTENCY:");
    console.log(`  Calls tested:        ${cs.callsTested}`);
    console.log(`  Runs per call:       ${cs.runsPerCall}`);
    console.log(`  Total runs:          ${cs.totalRuns}`);
    console.log(`  Mean SD:             ${cs.meanStdDev.toFixed(2)}`);
    console.log(`  Max SD:              ${cs.maxStdDev.toFixed(2)}`);
    console.log(`  Mean range:          ${cs.meanRange.toFixed(2)}`);
    console.log(`  Pass/fail consistency: ${cs.passFailConsistency.toFixed(1)}%`);
    console.log(`  Unanimous calls:     ${cs.unanimousCalls}/${cs.callsTested}`);

    console.log("\n═══════════════════════════════════════");
    console.log("  ✅ Benchmark complete!");
    console.log("═══════════════════════════════════════\n");

    process.exit(0);
  } catch (error) {
    console.error("\n❌ Benchmark failed:");
    console.error(error);
    console.error("\nEnsure:");
    console.error("  1. Dataset files are in dataset/ directory");
    console.error("  2. .env.local has SUPABASE + OPENROUTER keys");
    console.error("  3. Supabase project is accessible\n");
    process.exit(1);
  }
}

main();