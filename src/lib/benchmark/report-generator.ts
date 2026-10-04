import * as fs from "fs";
import * as path from "path";
import type { BenchmarkResult } from "./types";

const RESULTS_DIR = path.join(process.cwd(), "benchmark-results");

export function generateReports(result: BenchmarkResult): void {
  // Ensure directory exists
  if (!fs.existsSync(RESULTS_DIR)) {
    fs.mkdirSync(RESULTS_DIR, { recursive: true });
  }

  // Generate JSON
  const jsonPath = path.join(RESULTS_DIR, "latest.json");
  fs.writeFileSync(jsonPath, JSON.stringify(result, null, 2));

  // Generate Markdown
  const mdPath = path.join(RESULTS_DIR, "latest.md");
  fs.writeFileSync(mdPath, generateMarkdown(result));

  console.log(`\n📄 Reports generated:`);
  console.log(`   JSON: ${jsonPath}`);
  console.log(`   Markdown: ${mdPath}`);
}

function generateMarkdown(result: BenchmarkResult): string {
  const hv = result.humanValidation;
  const cs = result.consistency.summary;
  const md = result.metadata;
  const lines: string[] = [];

  lines.push("# Evaluator Validation Report");
  lines.push("");
  lines.push(`Generated: ${new Date(md.runAt).toLocaleString()}`);
  lines.push("");

  // 1. Dataset
  lines.push("## 1. Dataset");
  lines.push("");
  lines.push(`- Total transcripts: ${result.metadata.dataset.includes("20") ? "20" : "see dataset"}`);
  lines.push(`- Human-labelled calls: ${hv.labelledCalls}`);
  lines.push(`- Criteria compared: ${hv.criteriaCompared}`);
  lines.push(`- Criteria excluded: ${hv.criteriaExcluded}`);
  lines.push("");

  // 2. Evaluation Configuration
  lines.push("## 2. Evaluation Configuration");
  lines.push("");
  lines.push(`- Model: \`${md.model}\``);
  lines.push(`- Temperature: ${md.temperature}`);
  lines.push(`- Prompt version: \`${md.promptVersion}\``);
  lines.push(`- Benchmark run ID: \`${md.benchmarkRunId}\``);
  lines.push("");

  // 3. Human Agreement
  lines.push("## 3. Human Agreement");
  lines.push("");
  lines.push(`- **MAE: ${hv.overallMAE.toFixed(2)}**`);
  lines.push(`- Exact agreement: ${hv.exactAgreement.toFixed(1)}%`);
  lines.push(`- Within ±1: ${hv.withinOneAgreement.toFixed(1)}%`);
  lines.push(`- Pass/fail agreement: ${hv.passFailAgreement.toFixed(1)}%`);
  lines.push("");

  // Confusion matrix
  const cm = hv.confusionMatrix;
  lines.push("### Confusion Matrix");
  lines.push("");
  lines.push("| | Human PASS | Human FAIL |");
  lines.push("|---|---:|---:|");
  lines.push(`| **AI PASS** | ${cm.tp} | ${cm.fp} |`);
  lines.push(`| **AI FAIL** | ${cm.fn} | ${cm.tn} |`);
  lines.push("");
  lines.push(`- True Positives (both PASS): ${cm.tp}`);
  lines.push(`- True Negatives (both FAIL): ${cm.tn}`);
  lines.push(`- False Positives (AI PASS, Human FAIL): ${cm.fp}`);
  lines.push(`- False Negatives (AI FAIL, Human PASS): ${cm.fn}`);
  lines.push("");

  // 4. Criterion-Level Results
  lines.push("## 4. Criterion-Level Results");
  lines.push("");
  lines.push("| Criterion | N | MAE | Exact | ±1 |");
  lines.push("|---|---:|---:|---:|---:|");
  for (const c of hv.criterionMetrics) {
    lines.push(
      `| ${c.criterion} | ${c.count} | ${c.mae.toFixed(2)} | ${c.exactAgreement.toFixed(1)}% | ${c.withinOneAgreement.toFixed(1)}% |`
    );
  }
  lines.push("");

  // 5. Consistency
  lines.push("## 5. Consistency");
  lines.push("");
  lines.push(`- Calls tested: ${cs.callsTested}`);
  lines.push(`- Runs per call: ${cs.runsPerCall}`);
  lines.push(`- Total evaluation runs: ${cs.totalRuns}`);
  lines.push(`- **Mean SD: ${cs.meanStdDev.toFixed(2)}**`);
  lines.push(`- Maximum SD: ${cs.maxStdDev.toFixed(2)}`);
  lines.push(`- Mean range: ${cs.meanRange.toFixed(2)}`);
  lines.push(`- Maximum range: ${cs.maxRange.toFixed(2)}`);
  lines.push(`- **Pass/fail consistency: ${cs.passFailConsistency.toFixed(1)}%**`);
  lines.push(`- Unanimous calls: ${cs.unanimousCalls}/${cs.callsTested}`);
  lines.push("");

  // Per-conversation consistency detail
  if (result.consistency.results.length > 0) {
    lines.push("### Per-Conversation Consistency");
    lines.push("");
    lines.push("| Conversation | Mean | SD | Range | Pass/Fail Consistency |");
    lines.push("|---|---:|---:|---:|---:|");
    for (const r of result.consistency.results) {
      lines.push(
        `| ${r.conversationId} | ${r.averageScoreStats.mean.toFixed(2)} | ${r.averageScoreStats.stdDev.toFixed(2)} | ${r.averageScoreStats.range.toFixed(1)} | ${r.passFailConsistency.toFixed(0)}% |`
      );
    }
    lines.push("");
  }

  // 6. Largest Disagreements
  lines.push("## 6. Largest Disagreements");
  lines.push("");
  if (hv.disagreements.length > 0) {
    for (const d of hv.disagreements.slice(0, 10)) {
      lines.push(`### ${d.conversationId} — ${d.criterion}`);
      lines.push("");
      lines.push(`- Human score: ${d.humanScore}`);
      lines.push(`- AI score: ${d.aiScore}`);
      lines.push(`- Difference: ${d.difference}`);
      lines.push("");
      if (d.evidenceTurn !== null) {
        lines.push(`**AI evidence:**`);
        lines.push("");
        lines.push(`Turn ${d.evidenceTurn}:`);
        if (d.evidenceText) {
          lines.push(`> "${d.evidenceText}"`);
        }
        lines.push("");
      }
      lines.push(`**AI reasoning:**`);
      lines.push("");
      lines.push(`> ${d.aiExplanation}`);
      lines.push("");
      lines.push("---");
      lines.push("");
    }
  } else {
    lines.push("No large disagreements (delta ≥ 2) found.");
    lines.push("");
  }

  // 7. Per-Conversation Results
  lines.push("## 7. Per-Conversation Results");
  lines.push("");
  lines.push("| Conversation | AI Score | Human Score | Difference | AI Result | Human Result | Match |");
  lines.push("|---|---:|---:|---:|---|---|---|");
  for (const c of hv.conversationComparisons) {
    const diff = c.humanAverageScore !== null
      ? Math.abs(c.aiAverageScore - c.humanAverageScore).toFixed(1)
      : "—";
    lines.push(
      `| ${c.conversationId} | ${c.aiAverageScore.toFixed(1)} | ${c.humanAverageScore !== null ? c.humanAverageScore.toFixed(1) : "—"} | ${diff} | ${c.aiPassFail} | ${c.humanPassFail} | ${c.passFailAgreement ? "✅" : "❌"} |`
    );
  }
  lines.push("");

  // 8. Exclusions
  lines.push("## 8. Exclusions");
  lines.push("");
  if (result.exclusions.length > 0) {
    for (const e of result.exclusions) {
      lines.push(`- **${e.reason}**: ${e.count} case(s)`);
      for (const d of e.details.slice(0, 5)) {
        lines.push(`  - ${d}`);
      }
      if (e.details.length > 5) {
        lines.push(`  - ... and ${e.details.length - 5} more`);
      }
    }
  } else {
    lines.push("No exclusions.");
  }
  lines.push("");

  // 9. Limitations
  lines.push("## 9. Limitations");
  lines.push("");
  lines.push("- Results are based on the supplied dataset and may not generalize to other domains.");
  lines.push("- The evaluator uses `openai/gpt-4o-mini` with temperature 0.2 — results may vary with different models/temperatures.");
  lines.push("- Human labels are assumed to be ground truth but may contain subjectivity.");
  if (hv.criteriaExcluded > 0) {
    lines.push(`- ${hv.criteriaExcluded} criterion scores were excluded from MAE calculations due to "not assessable" labels or missing data.`);
  }
  if (hv.labelledCalls < 8) {
    lines.push(`- Only ${hv.labelledCalls} human-labelled calls were available for comparison.`);
  }
  lines.push("");

  // 10. Next Improvements
  lines.push("## 10. Next Improvements");
  lines.push("");
  if (hv.overallMAE > 1.0) {
    lines.push("- MAE is above 1.0 — consider improving prompt clarity for score boundaries.");
  }
  if (hv.passFailAgreement < 80) {
    lines.push("- Pass/fail agreement is below 80% — consider adjusting pass threshold or hard rule detection.");
  }
  if (cs.meanStdDev > 0.5) {
    lines.push("- Consistency mean SD is above 0.5 — evaluator may benefit from lower temperature or more deterministic prompting.");
  }
  lines.push("- Compare against `evaluation-v2` after prompt improvements.");
  lines.push("- Add more human-labelled calls for statistical significance.");
  lines.push("");

  return lines.join("\n");
}