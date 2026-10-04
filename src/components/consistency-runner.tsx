"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { Loader2, Play } from "lucide-react";

type Conversation = {
  id: string;
  title: string | null;
  agent: { name: string } | null;
};

type RunResult = {
  run: number;
  scores: { criterion: string; score: number; max_score: number }[];
  averageScore: number;
  passFail: string;
  error?: string;
};

function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance =
    values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) /
    values.length;
  return Math.sqrt(variance);
}

export function ConsistencyRunner({
  conversations,
}: {
  conversations: Conversation[];
}) {
  const [selectedId, setSelectedId] = useState(conversations[0]?.id || "");
  const [runs, setRuns] = useState(5);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<RunResult[] | null>(null);

  const handleRun = async () => {
    if (!selectedId) {
      toast.error("Select a conversation first");
      return;
    }
    setLoading(true);
    setResults(null);

    try {
      const res = await fetch("/api/evaluate/consistency", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: selectedId, runs }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Consistency test failed");
      }

      const data = await res.json();
      setResults(data.results);
      toast.success(`Completed ${data.results.length} runs`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Consistency test failed"
      );
    } finally {
      setLoading(false);
    }
  };

  // Compute per-criterion stats from results
  const criterionStats: Record<
    string,
    { scores: number[]; maxScore: number }
  > = {};

  if (results) {
    for (const r of results) {
      for (const s of r.scores) {
        if (!criterionStats[s.criterion]) {
          criterionStats[s.criterion] = { scores: [], maxScore: s.max_score };
        }
        criterionStats[s.criterion].scores.push(s.score);
      }
    }
  }

  const passCount = results
    ? results.filter((r) => r.passFail === "PASS").length
    : 0;
  const avgScores = results
    ? results.map((r) => r.averageScore)
    : [];

  return (
    <div className="space-y-6">
      {/* Controls */}
      <Card>
        <CardHeader>
          <CardTitle>Test Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Conversation</label>
            <Select
              value={selectedId}
              onValueChange={(v) => setSelectedId(v ?? "")}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select conversation" />
              </SelectTrigger>
              <SelectContent>
                {conversations.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.title || `Conversation ${c.id.slice(0, 8)}`} —{" "}
                    {c.agent?.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Number of Runs</label>
            <div className="flex gap-2">
              {[3, 5, 10].map((n) => (
                <Button
                  key={n}
                  variant={runs === n ? "default" : "outline"}
                  size="sm"
                  onClick={() => setRuns(n)}
                >
                  {n}×
                </Button>
              ))}
            </div>
          </div>

          <Button
            onClick={handleRun}
            disabled={loading || !selectedId}
            size="lg"
          >
            {loading ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Running {runs} evaluations...
              </>
            ) : (
              <>
                <Play className="size-4" />
                Run Consistency Test
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Results */}
      {results && results.length > 0 && (
        <>
          {/* Summary Stats */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-sm text-muted-foreground">
                  Avg Score (mean)
                </div>
                <div className="text-3xl font-bold mt-2">
                  {(
                    avgScores.reduce((a, b) => a + b, 0) / avgScores.length
                  ).toFixed(2)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  σ = {stdDev(avgScores).toFixed(2)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-sm text-muted-foreground">
                  Pass Rate
                </div>
                <div className="text-3xl font-bold mt-2">
                  {((passCount / results.length) * 100).toFixed(0)}%
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {passCount} / {results.length} PASS
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-sm text-muted-foreground">
                  Score Range
                </div>
                <div className="text-3xl font-bold mt-2">
                  {Math.min(...avgScores).toFixed(1)}–
                  {Math.max(...avgScores).toFixed(1)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Range ={" "}
                  {(Math.max(...avgScores) - Math.min(...avgScores)).toFixed(1)}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Per-Run Table */}
          <Card>
            <CardHeader>
              <CardTitle>Per-Run Results</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Run</TableHead>
                    {Object.keys(criterionStats).map((c) => (
                      <TableHead key={c} className="text-center">
                        {c}
                      </TableHead>
                    ))}
                    <TableHead className="text-center">Avg</TableHead>
                    <TableHead className="text-center">Verdict</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {results.map((r) => (
                    <TableRow key={r.run}>
                      <TableCell className="font-medium">
                        Run {r.run}
                      </TableCell>
                      {Object.keys(criterionStats).map((c) => {
                        const s = r.scores.find(
                          (sc) => sc.criterion === c
                        );
                        return (
                          <TableCell key={c} className="text-center">
                            {s ? `${s.score}/${s.max_score}` : "—"}
                          </TableCell>
                        );
                      })}
                      <TableCell className="text-center font-medium">
                        {r.averageScore.toFixed(1)}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge
                          variant={
                            r.passFail === "PASS" ? "default" : "destructive"
                          }
                        >
                          {r.passFail}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Per-Criterion Variance */}
          <Card>
            <CardHeader>
              <CardTitle>Per-Criterion Variance</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Criterion</TableHead>
                    <TableHead className="text-center">Mean</TableHead>
                    <TableHead className="text-center">Std Dev</TableHead>
                    <TableHead className="text-center">Min</TableHead>
                    <TableHead className="text-center">Max</TableHead>
                    <TableHead className="text-center">Range</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Object.entries(criterionStats).map(([criterion, data]) => {
                    const mean =
                      data.scores.reduce((a, b) => a + b, 0) /
                      data.scores.length;
                    const sd = stdDev(data.scores);
                    const min = Math.min(...data.scores);
                    const max = Math.max(...data.scores);
                    return (
                      <TableRow key={criterion}>
                        <TableCell className="font-medium">
                          {criterion}
                        </TableCell>
                        <TableCell className="text-center">
                          {mean.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge
                            variant={
                              sd < 0.5
                                ? "default"
                                : sd < 1.0
                                ? "secondary"
                                : "destructive"
                            }
                          >
                            {sd.toFixed(2)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">{min}</TableCell>
                        <TableCell className="text-center">{max}</TableCell>
                        <TableCell className="text-center">
                          {max - min}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}