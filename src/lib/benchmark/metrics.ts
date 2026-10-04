import type {
    CriterionComparison,
    ConfusionMatrix,
    CriterionMetrics,
    ConsistencyRun,
  } from "./types";
  
  // ============================================
  // MAE — Mean Absolute Error
  // ============================================
  export function calculateMAE(
    comparisons: { aiScore: number; humanScore: number | null }[]
  ): number {
    const valid = comparisons.filter(
      (c) => c.humanScore !== null && c.humanScore !== undefined
    );
    if (valid.length === 0) return 0;
    const sum = valid.reduce(
      (acc, c) => acc + Math.abs(c.aiScore - (c.humanScore as number)),
      0
    );
    return sum / valid.length;
  }
  
  // ============================================
  // Exact Score Agreement
  // ============================================
  export function calculateExactAgreement(
    comparisons: { aiScore: number; humanScore: number | null }[]
  ): number {
    const valid = comparisons.filter(
      (c) => c.humanScore !== null && c.humanScore !== undefined
    );
    if (valid.length === 0) return 0;
    const matches = valid.filter(
      (c) => c.aiScore === c.humanScore
    ).length;
    return (matches / valid.length) * 100;
  }
  
  // ============================================
  // ±1 Score Agreement
  // ============================================
  export function calculateWithinOneAgreement(
    comparisons: { aiScore: number; humanScore: number | null }[]
  ): number {
    const valid = comparisons.filter(
      (c) => c.humanScore !== null && c.humanScore !== undefined
    );
    if (valid.length === 0) return 0;
    const within = valid.filter(
      (c) => Math.abs(c.aiScore - (c.humanScore as number)) <= 1
    ).length;
    return (within / valid.length) * 100;
  }
  
  // ============================================
  // Pass/Fail Agreement
  // ============================================
  export function calculatePassFailAgreement(
    results: { aiPassFail: string; humanPassFail: string }[]
  ): number {
    if (results.length === 0) return 0;
    const matches = results.filter(
      (r) => r.aiPassFail === r.humanPassFail
    ).length;
    return (matches / results.length) * 100;
  }
  
  // ============================================
  // Confusion Matrix
  // ============================================
  export function calculateConfusionMatrix(
    results: { aiPassFail: string; humanPassFail: string }[]
  ): ConfusionMatrix {
    let tp = 0, fp = 0, fn = 0, tn = 0;
    for (const r of results) {
      if (r.aiPassFail === "PASS" && r.humanPassFail === "PASS") tp++;
      else if (r.aiPassFail === "PASS" && r.humanPassFail === "FAIL") fp++;
      else if (r.aiPassFail === "FAIL" && r.humanPassFail === "PASS") fn++;
      else tn++;
    }
    return { tp, fp, fn, tn };
  }
  
  // ============================================
  // Criterion-Level Metrics
  // ============================================
  export function calculateCriterionMetrics(
    comparisons: CriterionComparison[]
  ): CriterionMetrics[] {
    const criteria = new Map<string, CriterionComparison[]>();
  
    for (const c of comparisons) {
      if (!criteria.has(c.criterion)) {
        criteria.set(c.criterion, []);
      }
      criteria.get(c.criterion)!.push(c);
    }
  
    return Array.from(criteria.entries()).map(([criterion, items]) => {
      const included = items.filter((i) => !i.excluded);
      const excludedCount = items.filter((i) => i.excluded).length;
  
      return {
        criterion,
        count: included.length,
        excludedCount,
        mae: calculateMAE(
          included.map((i) => ({
            aiScore: i.aiScore,
            humanScore: i.humanScore,
          }))
        ),
        exactAgreement: calculateExactAgreement(
          included.map((i) => ({
            aiScore: i.aiScore,
            humanScore: i.humanScore,
          }))
        ),
        withinOneAgreement: calculateWithinOneAgreement(
          included.map((i) => ({
            aiScore: i.aiScore,
            humanScore: i.humanScore,
          }))
        ),
      };
    });
  }
  
  // ============================================
  // Standard Deviation
  // ============================================
  export function calculateStdDev(values: number[]): number {
    if (values.length < 2) return 0;
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance =
      values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) /
      values.length;
    return Math.sqrt(variance);
  }
  
  // ============================================
  // Variance
  // ============================================
  export function calculateVariance(values: number[]): number {
    if (values.length < 2) return 0;
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    return (
      values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) /
      values.length
    );
  }
  
  // ============================================
  // Range
  // ============================================
  export function calculateRange(values: number[]): number {
    if (values.length === 0) return 0;
    return Math.max(...values) - Math.min(...values);
  }
  
  // ============================================
  // Pass/Fail Consistency
  // ============================================
  export function calculatePassFailConsistency(
    passFailResults: string[]
  ): { consistency: number; unanimous: boolean; mostCommon: string } {
    if (passFailResults.length === 0) {
      return { consistency: 0, unanimous: false, mostCommon: "N/A" };
    }
  
    const counts = new Map<string, number>();
    for (const r of passFailResults) {
      counts.set(r, (counts.get(r) || 0) + 1);
    }
  
    let maxCount = 0;
    let mostCommon = "N/A";
    for (const [r, c] of counts) {
      if (c > maxCount) {
        maxCount = c;
        mostCommon = r;
      }
    }
  
    const consistency = (maxCount / passFailResults.length) * 100;
    const unanimous = counts.size === 1;
  
    return { consistency, unanimous, mostCommon };
  }
  
  // ============================================
  // Mean
  // ============================================
  export function calculateMean(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((a, b) => a + b, 0) / values.length;
  }
  
  // ============================================
  // Clamp score to valid range
  // ============================================
  export function clampScore(
    score: number,
    min: number = 1,
    max: number = 5
  ): number {
    return Math.max(min, Math.min(score, max));
  }
  
  // ============================================
  // Is "not assessable"?
  // ============================================
  export function isNotAssessable(value: unknown): boolean {
    if (value === null || value === undefined) return true;
    if (typeof value === "string") {
      const lower = value.toLowerCase().trim();
      return (
        lower === "n/a" ||
        lower === "na" ||
        lower === "not assessable" ||
        lower === "not applicable" ||
        lower === "null" ||
        lower === ""
      );
    }
    if (typeof value === "number") {
      return isNaN(value);
    }
    return false;
  }