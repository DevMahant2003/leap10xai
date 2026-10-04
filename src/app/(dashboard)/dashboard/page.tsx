import { createClient } from "@/lib/supabase/server";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Bot,
  Phone,
  CheckCircle2,
  TrendingUp,
  AlertTriangle,
  Plus,
  ArrowRight,
} from "lucide-react";

type EvalRow = {
  id: string;
  conversation_id: string;
  average_score: number;
  pass_fail: string;
  scores: { criterion: string; score: number; max_score: number }[];
  created_at: string;
};

type AgentRow = {
  id: string;
  name: string;
  pass_threshold: number;
};

type ConvRow = {
  id: string;
  agent_id: string;
  status: string;
};

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: agents } = (await supabase
    .from("agents")
    .select("id, name, pass_threshold")
    .eq("user_id", user!.id)
    .order("created_at", { ascending: false })) as { data: AgentRow[] | null };

  const { data: conversations } = (await supabase
    .from("conversations")
    .select("id, agent_id, status")
    .eq("user_id", user!.id)) as { data: ConvRow[] | null };

  const { data: evaluations } = (await supabase
    .from("evaluations")
    .select("id, conversation_id, average_score, pass_fail, scores, created_at")
    .eq("user_id", user!.id)
    .order("created_at", { ascending: false })) as { data: EvalRow[] | null };

  // Build conversation → agent map
  const convToAgent = new Map<string, string>();
  for (const c of conversations || []) {
    convToAgent.set(c.id, c.agent_id);
  }

  // Latest eval per conversation
  const latestEvalPerConv = new Map<string, EvalRow>();
  for (const e of evaluations || []) {
    if (!latestEvalPerConv.has(e.conversation_id)) {
      latestEvalPerConv.set(e.conversation_id, e);
    }
  }

  // Overall stats
  const totalCalls = conversations?.length || 0;
  const evaluatedCalls = latestEvalPerConv.size;
  const allScores = Array.from(latestEvalPerConv.values()).map(
    (e) => e.average_score
  );
  const overallAvg =
    allScores.length > 0
      ? allScores.reduce((a, b) => a + b, 0) / allScores.length
      : 0;
  const passCount = Array.from(latestEvalPerConv.values()).filter(
    (e) => e.pass_fail === "PASS"
  ).length;
  const passRate =
    evaluatedCalls > 0 ? (passCount / evaluatedCalls) * 100 : 0;

  // Per-agent stats
  const agentStats = (agents || []).map((agent) => {
    const agentConvIds = (conversations || [])
      .filter((c) => c.agent_id === agent.id)
      .map((c) => c.id);
    const agentEvals = agentConvIds
      .map((id) => latestEvalPerConv.get(id))
      .filter(Boolean) as EvalRow[];

    const avg =
      agentEvals.length > 0
        ? agentEvals.reduce((sum, e) => sum + e.average_score, 0) /
          agentEvals.length
        : 0;
    const passes = agentEvals.filter((e) => e.pass_fail === "PASS").length;
    const rate =
      agentEvals.length > 0 ? (passes / agentEvals.length) * 100 : 0;

    // Weakest criterion
    const criterionScores: Record<string, number[]> = {};
    for (const e of agentEvals) {
      for (const s of e.scores) {
        if (!criterionScores[s.criterion]) criterionScores[s.criterion] = [];
        criterionScores[s.criterion].push(s.score);
      }
    }
    const criterionAvgs = Object.entries(criterionScores).map(
      ([criterion, scores]) => ({
        criterion,
        avg: scores.reduce((a, b) => a + b, 0) / scores.length,
      })
    );
    const weakest =
      criterionAvgs.length > 0
        ? criterionAvgs.reduce((min, c) =>
            c.avg < min.avg ? c : min
          )
        : null;

    return {
      ...agent,
      totalCalls: agentConvIds.length,
      evaluatedCalls: agentEvals.length,
      avgScore: avg,
      passRate: rate,
      weakest,
    };
  });

  // Common problems (lowest scoring criteria across ALL evaluations)
  const allCriterionScores: Record<string, number[]> = {};
  for (const e of evaluations || []) {
    for (const s of e.scores) {
      if (!allCriterionScores[s.criterion])
        allCriterionScores[s.criterion] = [];
      allCriterionScores[s.criterion].push(s.score);
    }
  }
  const commonProblems = Object.entries(allCriterionScores)
    .map(([criterion, scores]) => ({
      criterion,
      avg: scores.reduce((a, b) => a + b, 0) / scores.length,
      count: scores.length,
    }))
    .sort((a, b) => a.avg - b.avg)
    .slice(0, 3);

  // Recent evaluations
  const recentEvals = (evaluations || []).slice(0, 5);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Overview of your AI agents and evaluations
          </p>
        </div>
        <Link href="/agents/new">
          <Button>
            <Plus className="size-4" />
            New Agent
          </Button>
        </Link>
      </div>

      {/* Stat Cards */}
      <div className="grid gap-4 md:grid-cols-5">
        <StatCard title="Agents" value={agents?.length ?? 0} icon={Bot} />
        <StatCard title="Conversations" value={totalCalls} icon={Phone} />
        <StatCard title="Evaluated" value={evaluatedCalls} icon={CheckCircle2} />
        <StatCard
          title="Avg. Score"
          value={overallAvg > 0 ? overallAvg.toFixed(1) : "—"}
          icon={TrendingUp}
        />
        <StatCard
          title="Pass Rate"
          value={evaluatedCalls > 0 ? `${passRate.toFixed(0)}%` : "—"}
          icon={CheckCircle2}
        />
      </div>

      {/* Per-Agent Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Agent Performance</CardTitle>
        </CardHeader>
        <CardContent>
          {agentStats.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Agent</TableHead>
                  <TableHead className="text-center">Calls</TableHead>
                  <TableHead className="text-center">Evaluated</TableHead>
                  <TableHead className="text-center">Avg Score</TableHead>
                  <TableHead className="text-center">Pass Rate</TableHead>
                  <TableHead>Weakest Criterion</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {agentStats.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell>
                      <Link
                        href={`/agents/${a.id}`}
                        className="font-medium hover:underline"
                      >
                        {a.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-center">
                      {a.totalCalls}
                    </TableCell>
                    <TableCell className="text-center">
                      {a.evaluatedCalls}
                    </TableCell>
                    <TableCell className="text-center">
                      {a.evaluatedCalls > 0
                        ? a.avgScore.toFixed(1)
                        : "—"}
                    </TableCell>
                    <TableCell className="text-center">
                      {a.evaluatedCalls > 0 ? (
                        <Badge
                          variant={
                            a.passRate >= 75
                              ? "default"
                              : a.passRate >= 50
                              ? "secondary"
                              : "destructive"
                          }
                        >
                          {a.passRate.toFixed(0)}%
                        </Badge>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell>
                      {a.weakest ? (
                        <span className="text-sm text-muted-foreground">
                          {a.weakest.criterion} ({a.weakest.avg.toFixed(1)})
                        </span>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No agents yet. Create one to get started.
            </p>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Common Problems */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="size-5 text-amber-500" />
              Common Problems
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {commonProblems.length > 0 ? (
              commonProblems.map((p, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-lg border p-2"
                >
                  <span className="text-sm font-medium">{p.criterion}</span>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">
                      {p.avg.toFixed(1)} avg
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {p.count} scores
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No evaluation data yet.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Recent Evaluations */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Evaluations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {recentEvals.length > 0 ? (
              recentEvals.map((e) => (
                <Link
                  key={e.id}
                  href={`/conversations/${e.conversation_id}`}
                  className="flex items-center justify-between rounded-lg border p-2 hover:bg-muted/50 transition-colors"
                >
                  <div>
                    <p className="text-sm font-medium">
                      {e.conversation_id.slice(0, 8)}...
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(e.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">
                      {e.average_score}/5
                    </span>
                    <Badge
                      variant={
                        e.pass_fail === "PASS" ? "default" : "destructive"
                      }
                    >
                      {e.pass_fail}
                    </Badge>
                    <ArrowRight className="size-4 text-muted-foreground" />
                  </div>
                </Link>
              ))
            ) : (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No evaluations yet.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  icon: Icon,
}: {
  title: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">{title}</span>
          <Icon className="size-4 text-muted-foreground" />
        </div>
        <div className="text-2xl font-bold mt-2">{value}</div>
      </CardContent>
    </Card>
  );
}