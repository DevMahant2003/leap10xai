import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import type { Evaluation } from "@/types";
import { Lightbulb, ArrowRight } from "lucide-react";

export function EvaluationViewer({
  evaluation,
}: {
  evaluation: Evaluation;
}) {
  const scores = evaluation.scores as {
    criterion: string;
    score: number;
    max_score: number;
    evidence_turn: number | null;
    evidence_text: string | null;
    explanation: string;
  }[];

  const violations = evaluation.hard_rule_violations as {
    rule: string;
    evidence_turn: number | null;
    evidence_text: string | null;
    explanation: string;
  }[];

  const suggestions = (evaluation.improvement_suggestions || []) as {
    area: string;
    current_score: number;
    issue: string;
    suggestion: string;
    config_type: string;
    suggested_addition: string;
  }[];

  const isPass = evaluation.pass_fail === "PASS";

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card className={isPass ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}>
        <CardContent className="p-6 text-center">
          <div className="flex items-center justify-center gap-3 mb-2">
            {isPass ? (
              <CheckCircle2 className="size-10 text-green-600" />
            ) : (
              <XCircle className="size-10 text-red-600" />
            )}
            <div>
              <div className="text-3xl text-red-600 font-bold">
                {evaluation.average_score} / 5
              </div>
              <Badge variant={isPass ? "default" : "destructive"} className="text-sm mt-1">
                {evaluation.pass_fail}
              </Badge>
            </div>
          </div>
          {evaluation.summary && (
            <p className="text-sm text-black text-muted-foreground mt-3 max-w-prose mx-auto">
              {evaluation.summary}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Hard Rule Violations (if any) */}
      {violations.length > 0 && (
        <Card className="border-red-300">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2 text-red-700">
              <AlertTriangle className="size-5" />
              Hard Rule Violations ({violations.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {violations.map((v, i) => (
              <div
                key={i}
                className="rounded-lg border border-purple-800 bg-purple-950/40 p-3 space-y-2"
              >
                <div className="flex items-center gap-2">
                  <Badge variant="destructive" className="text-xs">
                    AUTO-FAIL
                  </Badge>
                  <span className="text-sm font-medium">{v.rule}</span>
                </div>
                {v.evidence_turn !== null && v.evidence_text && (
                  <div className="rounded border-l-4 border-red-500 bg-red-950/30 px-3 py-2">
                    <span className="text-xs text-muted-foreground">
                      Turn {v.evidence_turn}:
                    </span>
                    <p className="text-sm italic mt-1">"{v.evidence_text}"</p>
                  </div>
                )}
                <p className="text-sm text-muted-foreground">
                  {v.explanation}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Criterion Scores */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Rubric Scores</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {scores.map((s, i) => (
            <div key={i} className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{s.criterion}</span>
                <Badge variant="secondary" className="text-sm">
                  {s.score} / {s.max_score}
                </Badge>
              </div>

              {s.evidence_turn !== null && s.evidence_text && (
                <div className="rounded border-l-4 border-blue-500 bg-blue-950/40 px-3 py-2">
                  <span className="text-xs text-muted-foreground">
                    Evidence — Turn {s.evidence_turn}:
                  </span>
                  <p className="text-sm italic mt-1">"{s.evidence_text}"</p>
                </div>
              )}

              <p className="text-sm text-muted-foreground">
                {s.explanation}
              </p>

              {i < scores.length - 1 && <Separator className="mt-4" />}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}