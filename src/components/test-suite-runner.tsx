"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Play,
  Loader2,
  CheckCircle2,
  XCircle,
  ArrowRight,
  FlaskConical,
} from "lucide-react";

type TestResult = {
  scenario: {
    customer_persona: string;
    opening_message: string;
    difficulty: string;
    tests_hard_rule: boolean;
    expected_behavior: string;
  };
  conversationId: string;
  averageScore: number;
  passFail: "PASS" | "FAIL";
  hardRuleViolations: { rule: string }[];
  summary: string;
  error?: string;
};

export function TestSuiteRunner({
  agentId,
  agentName,
}: {
  agentId: string;
  agentName: string;
}) {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<TestResult[] | null>(null);
  const [summary, setSummary] = useState<{
    total: number;
    passed: number;
    failed: number;
    averageScore: number;
  } | null>(null);

  const handleRun = async () => {
    setLoading(true);
    setResults(null);
    setSummary(null);

    try {
      const res = await fetch("/api/test-suite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId, numScenarios: 3 }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Test suite failed");
      }

      const data = await res.json();
      setResults(data.results);
      setSummary(data.summary);
      toast.success(
        `Test complete: ${data.summary.passed}/${data.summary.total} passed`
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Test suite failed"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Run Button */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FlaskConical className="size-5" />
            Automated Test Suite
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            The AI will generate 3 diverse customer scenarios, simulate live
            conversations with <strong>{agentName}</strong>, and evaluate each
            one automatically. This takes ~1-2 minutes.
          </p>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• Generates realistic customer personas</li>
            <li>• Simulates multi-turn phone conversations</li>
            <li>• Evaluates each conversation against the rubric</li>
            <li>• Includes at least 1 hard rule trigger test</li>
          </ul>
          <Button
            onClick={handleRun}
            disabled={loading}
            size="lg"
            className="w-full sm:w-auto"
          >
            {loading ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Running test suite... (1-2 min)
              </>
            ) : (
              <>
                <Play className="size-4" />
                Run Test Suite
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Results Summary */}
      {summary && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-sm text-muted-foreground">Total Tests</div>
              <div className="text-3xl font-bold mt-1">{summary.total}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-sm text-muted-foreground">Passed</div>
              <div className="text-3xl font-bold mt-1 text-green-600">
                {summary.passed}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-sm text-muted-foreground">Failed</div>
              <div className="text-3xl font-bold mt-1 text-red-600">
                {summary.failed}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-sm text-muted-foreground">Avg Score</div>
              <div className="text-3xl font-bold mt-1">
                {summary.averageScore.toFixed(1)}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Per-Scenario Results */}
      {results && results.length > 0 && (
        <div className="space-y-3">
          {results.map((result, i) => (
            <Card
              key={i}
              className={
                result.passFail === "PASS"
                  ? "border-green-200"
                  : "border-red-200"
              }
            >
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      {result.passFail === "PASS" ? (
                        <CheckCircle2 className="size-5 text-green-600" />
                      ) : (
                        <XCircle className="size-5 text-red-600" />
                      )}
                      <span className="font-medium">
                        Scenario {i + 1}:{" "}
                        {result.scenario.customer_persona.slice(0, 80)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 ml-7">
                      <Badge
                        variant={
                          result.scenario.difficulty === "hard"
                            ? "destructive"
                            : result.scenario.difficulty === "medium"
                            ? "secondary"
                            : "outline"
                        }
                        className="text-xs"
                      >
                        {result.scenario.difficulty}
                      </Badge>
                      {result.scenario.tests_hard_rule && (
                        <Badge variant="outline" className="text-xs">
                          ⚠ Hard rule test
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-2xl font-bold">
                      {result.averageScore.toFixed(1)}
                    </span>
                    <Badge
                      variant={
                        result.passFail === "PASS"
                          ? "default"
                          : "destructive"
                      }
                    >
                      {result.passFail}
                    </Badge>
                  </div>
                </div>

                {/* Hard Rule Violations */}
                {result.hardRuleViolations &&
                  result.hardRuleViolations.length > 0 && (
                    <div className="rounded-lg border border-red-200 bg-red-50 p-2">
                      <p className="text-xs font-medium text-red-700 mb-1">
                        Hard Rule Violations:
                      </p>
                      {result.hardRuleViolations.map((v, j) => (
                        <p
                          key={j}
                          className="text-sm text-red-600"
                        >
                          • {v.rule}
                        </p>
                      ))}
                    </div>
                  )}

                {/* Summary */}
                {result.summary && (
                  <p className="text-sm text-muted-foreground">
                    {result.summary}
                  </p>
                )}

                {/* Error */}
                {result.error && (
                  <p className="text-sm text-red-500">{result.error}</p>
                )}

                {/* Link to conversation */}
                {result.conversationId && (
                  <Link
                    href={`/conversations/${result.conversationId}`}
                    className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline"
                  >
                    View Conversation
                    <ArrowRight className="size-3" />
                  </Link>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}