"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EvaluationViewer } from "@/components/evaluation-viewer";
import type { Evaluation } from "@/types";

export function EvaluationHistory({
  evaluations,
}: {
  evaluations: Evaluation[];
}) {
  const [selected, setSelected] = useState(0);

  if (evaluations.length === 0) return null;

  const current = evaluations[selected];
  const isLatest = selected === 0;

  return (
    <div className="space-y-4">
      {evaluations.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">
              Evaluation History ({evaluations.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {evaluations.map((evalItem, i) => (
                <button
                  key={evalItem.id}
                  onClick={() => setSelected(i)}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs transition ${
                    selected === i
                      ? "border-primary bg-primary/5"
                      : "hover:bg-muted"
                  }`}
                >
                  <span className="text-muted-foreground">
                    {new Date(evalItem.created_at).toLocaleString()}
                  </span>
                  <Badge
                    variant={
                      evalItem.pass_fail === "PASS"
                        ? "default"
                        : "destructive"
                    }
                    className="text-xs"
                  >
                    {evalItem.average_score}/5 {evalItem.pass_fail}
                  </Badge>
                  {i === 0 && (
                    <Badge variant="outline" className="text-xs">
                      Latest
                    </Badge>
                  )}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {!isLatest && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Viewing a previous evaluation.{" "}
          <button
            onClick={() => setSelected(0)}
            className="underline font-medium"
          >
            Jump to latest
          </button>
        </div>
      )}

      <EvaluationViewer evaluation={current} />
    </div>
  );
}