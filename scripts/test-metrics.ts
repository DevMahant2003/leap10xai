import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.join(process.cwd(), ".env.local") });

import {
  calculateMAE,
  calculateExactAgreement,
  calculateWithinOneAgreement,
  calculatePassFailAgreement,
  calculateConfusionMatrix,
  calculateStdDev,
  calculateVariance,
  calculateRange,
  calculatePassFailConsistency,
  isNotAssessable,
} from "../src/lib/benchmark/metrics";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`✅ ${name}`);
    passed++;
  } catch (error) {
    console.error(`❌ ${name}`);
    console.error(`   ${error instanceof Error ? error.message : String(error)}`);
    failed++;
  }
}

function assertEqual(actual: unknown, expected: unknown, msg?: string) {
  if (actual !== expected) {
    throw new Error(`${msg || "Assertion failed"}: expected ${expected}, got ${actual}`);
  }
}

// ============================================
console.log("\n🧪 METRICS TESTS\n");
// ============================================

// --- MAE ---
test("MAE: [1,2,3] vs [2,2,5] = 1", () => {
  const mae = calculateMAE([
    { aiScore: 1, humanScore: 2 },
    { aiScore: 2, humanScore: 2 },
    { aiScore: 3, humanScore: 5 },
  ]);
  assertEqual(mae, 1, "MAE");
});

test("MAE: perfect match = 0", () => {
  const mae = calculateMAE([
    { aiScore: 3, humanScore: 3 },
    { aiScore: 4, humanScore: 4 },
  ]);
  assertEqual(mae, 0, "MAE");
});

test("MAE: excludes null human scores", () => {
  const mae = calculateMAE([
    { aiScore: 3, humanScore: 3 },
    { aiScore: 4, humanScore: null },
  ]);
  assertEqual(mae, 0, "MAE should exclude null");
});

test("MAE: empty array = 0", () => {
  assertEqual(calculateMAE([]), 0);
});

// --- Exact Agreement ---
test("Exact: [1,2,3] vs [1,4,3] = 66.67%", () => {
  const pct = calculateExactAgreement([
    { aiScore: 1, humanScore: 1 },
    { aiScore: 2, humanScore: 4 },
    { aiScore: 3, humanScore: 3 },
  ]);
  assertEqual(Math.round(pct * 100) / 100, 66.67, "Exact agreement");
});

test("Exact: all match = 100%", () => {
  const pct = calculateExactAgreement([
    { aiScore: 1, humanScore: 1 },
    { aiScore: 2, humanScore: 2 },
  ]);
  assertEqual(pct, 100);
});

// --- ±1 Agreement ---
test("±1: diff=1 included, diff=2 excluded", () => {
  const pct = calculateWithinOneAgreement([
    { aiScore: 4, humanScore: 5 }, // diff=1 → included
    { aiScore: 5, humanScore: 3 }, // diff=2 → excluded
  ]);
  assertEqual(pct, 50, "±1 agreement");
});

test("±1: diff=0 included", () => {
  const pct = calculateWithinOneAgreement([
    { aiScore: 3, humanScore: 3 },
  ]);
  assertEqual(pct, 100);
});

// --- Pass/Fail Agreement ---
test("Pass/Fail: 3/4 match = 75%", () => {
  const pct = calculatePassFailAgreement([
    { aiPassFail: "PASS", humanPassFail: "PASS" },
    { aiPassFail: "PASS", humanPassFail: "FAIL" },
    { aiPassFail: "FAIL", humanPassFail: "FAIL" },
    { aiPassFail: "FAIL", humanPassFail: "FAIL" },
  ]);
  assertEqual(pct, 75);
});

// --- Confusion Matrix ---
test("Confusion matrix: basic", () => {
  const cm = calculateConfusionMatrix([
    { aiPassFail: "PASS", humanPassFail: "PASS" }, // TP
    { aiPassFail: "PASS", humanPassFail: "FAIL" }, // FP
    { aiPassFail: "FAIL", humanPassFail: "PASS" }, // FN
    { aiPassFail: "FAIL", humanPassFail: "FAIL" }, // TN
  ]);
  assertEqual(cm.tp, 1);
  assertEqual(cm.fp, 1);
  assertEqual(cm.fn, 1);
  assertEqual(cm.tn, 1);
});

// --- Std Dev ---
test("StdDev: [4,4,4,4,4] = 0", () => {
  assertEqual(calculateStdDev([4, 4, 4, 4, 4]), 0);
});

test("StdDev: [1,2,3] > 0", () => {
  const sd = calculateStdDev([1, 2, 3]);
  if (sd <= 0) throw new Error("StdDev should be > 0");
  assertEqual(Math.round(sd * 1000) / 1000, 0.816);
});

// --- Variance ---
test("Variance: [4,4,4,4,4] = 0", () => {
  assertEqual(calculateVariance([4, 4, 4, 4, 4]), 0);
});

test("Variance: [1,2,3] > 0", () => {
  const v = calculateVariance([1, 2, 3]);
  if (v <= 0) throw new Error("Variance should be > 0");
});

// --- Range ---
test("Range: [1,2,3] = 2", () => {
  assertEqual(calculateRange([1, 2, 3]), 2);
});

test("Range: [5,5,5] = 0", () => {
  assertEqual(calculateRange([5, 5, 5]), 0);
});

// --- Pass/Fail Consistency ---
test("PF Consistency: all same = 100%, unanimous", () => {
  const r = calculatePassFailConsistency(["PASS", "PASS", "PASS"]);
  assertEqual(r.consistency, 100);
  assertEqual(r.unanimous, true);
});

test("PF Consistency: 4/5 = 80%, not unanimous", () => {
  const r = calculatePassFailConsistency(["PASS", "PASS", "PASS", "FAIL", "PASS"]);
  assertEqual(r.consistency, 80);
  assertEqual(r.unanimous, false);
});

// --- isNotAssessable ---
test("isNotAssessable: null = true", () => {
  assertEqual(isNotAssessable(null), true);
});

test("isNotAssessable: 'N/A' = true", () => {
  assertEqual(isNotAssessable("N/A"), true);
});

test("isNotAssessable: 'not assessable' = true", () => {
  assertEqual(isNotAssessable("not assessable"), true);
});

test("isNotAssessable: 4 = false", () => {
  assertEqual(isNotAssessable(4), false);
});

test("isNotAssessable: NaN = true", () => {
  assertEqual(isNotAssessable(NaN), true);
});

// ============================================
console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);