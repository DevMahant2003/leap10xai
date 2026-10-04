import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
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
import { Button } from "@/components/ui/button";
import {
  Shield,
  CheckCircle2,
  XCircle,
  ArrowRight,
  Activity,
} from "lucide-react";

type HumanEval = {
  id: string;
  conversation_id: string;
  evaluator_name: string;
  scores: { criterion: string; score: number; max_score: number }[];
  pass_fail: string;
  notes: string | null;
  created_at: string;
};

type AIEval = {
  id: string;
  conversation_id: string;
  average_score: number;
  pass_fail: string;
  scores: { criterion: string; score: number; max_score: number }[];
  summary: string | null;
};

type Conv = {
  id: string;
  title: string | null;
  agent_id: string;
  agent: { name: string } | null;
};

export default async function ValidationPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Fetch human evaluations
  const { data: humanEvals } = (await supabase
    .from("human_evaluations")
    .select(
      "id, conversation_id, evaluator_name, scores, pass_fail, notes, created_at"
    )
    .eq("user_id", user!.id)
    .order("created_at", { ascending: false })) as {
    data: HumanEval[] | null;
  };

  if (!humanEvals || humanEvals.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Evaluator Validation
          </h1>
          <p className="text-muted-foreground">
            Compare AI evaluations against human labels.
          </p>
        </div>
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <Shield className="size-10 text-muted-foreground/50 mx-auto mb-3" />
            <h3 className="font-semibold mb-1">No human labels yet</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Add a human evaluation to any conversation to start validating
              your AI evaluator's accuracy.
            </p>
            <Link href="/conversations" className="inline-block mt-4">
              <Button variant="outline">
                Browse Conversations
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Fetch AI evaluations for same conversations
  const convIds = humanEvals.map((h) => h.conversation_id);
  const { data: aiEvals } = (await supabase
    .from("evaluations")
    .select(
      "id, conversation_id, average_score, pass_fail, scores, summary"
    )
    .eq("user_id", user!.id)
    .in("conversation_id", convIds)
    .order("created_at", { ascending: false })) as {
    data: AIEval[] | null;
  };

  // Fetch conversations
  const { data: conversations } = (await supabase
    .from("conversations")
    .select("id, title, agent:agents(name)")
    .in("id", convIds)) as { data: Conv[] | null };

  // Build latest AI eval per conversation
  const latestAIPerConv = new Map<string, AIEval>();
  for (const e of aiEvals || []) {
    if (!latestAIPerConv.has(e.conversation_id)) {
      latestAIPerConv.set(e.conversation_id, e);
    }
  }

  const convMap = new Map<string, Conv>();
  for (const c of conversations || []) {
    convMap.set(c.id, c);
  }

  // Build comparison rows
  const comparisons = humanEvals
    .map((h) => {
      const ai = latestAIPerConv.get(h.conversation_id);
      if (!ai) return null;

      const conv = convMap.get(h.conversation_id);

      // Per-criterion deltas
      const criterionDeltas = ai.scores.map((aiScore) => {
        const humanScore = h.scores.find(
          (s) => s.criterion === aiScore.criterion
        );
        const humanVal = humanScore?.score ?? 0;
        return {
          criterion: aiScore.criterion,
          aiScore: aiScore.score,
          humanScore: humanVal,
          delta: Math.abs(aiScore.score - humanVal),
        };
      });

      const avgDelta =
        criterionDeltas.reduce((sum, d) => sum + d.delta, 0) /
        (criterionDeltas.length || 1);

      const humanAvg =
        h.scores.reduce((sum, s) => sum + s.score, 0) /
        (h.scores.length || 1);

      return {
        conversationId: h.conversation_id,
        conversationTitle:
          conv?.title || `Conversation ${h.conversation_id.slice(0, 8)}`,
        agentName: conv?.agent?.name || "Unknown",
        evaluatorName: h.evaluator_name,
        aiAverage: ai.average_score,
        humanAverage: humanAvg,
        avgDelta,
        aiVerdict: ai.pass_fail,
        humanVerdict: h.pass_fail,
        agreement: ai.pass_fail === h.pass_fail,
        criterionDeltas,
      };
    })
    .filter(Boolean) as NonNullable<
    ReturnType<typeof comparisonsFn>
  >[];

  // Overall metrics
  const overallMAE =
    comparisons.length > 0
      ? comparisons.reduce((sum, c) => sum + c.avgDelta, 0) /
        comparisons.length
      : 0;

  const agreementRate =
    comparisons.length > 0
      ? (comparisons.filter((c) => c.agreement).length / comparisons.length) *
        100
      : 0;

  // Per-criterion MAE
  const criterionMAEs: Record<string, number[]> = {};
  for (const c of comparisons) {
    for (const d of c.criterionDeltas) {
      if (!criterionMAEs[d.criterion]) criterionMAEs[d.criterion] = [];
      criterionMAEs[d.criterion].push(d.delta);
    }
  }
  const perCriterion = Object.entries(criterionMAEs).map(
    ([criterion, deltas]) => ({
      criterion,
      mae: deltas.reduce((a, b) => a + b, 0) / deltas.length,
      aiAvg:
        comparisons.reduce((sum, c) => {
          const d = c.criterionDeltas.find(
            (cd) => cd.criterion === criterion
          );
          return sum + (d?.aiScore || 0);
        }, 0) / deltas.length,
      humanAvg:
        comparisons.reduce((sum, c) => {
          const d = c.criterionDeltas.find(
            (cd) => cd.criterion === criterion
          );
          return sum + (d?.humanScore || 0);
        }, 0) / deltas.length,
    })
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Evaluator Validation
          </h1>
          <p className="text-muted-foreground">
            How well does the AI evaluator match human judgments?
          </p>
        </div>
        <Link href="/validation/consistency">
          <Button variant="outline">
            <Activity className="size-4" />
            Consistency Test
          </Button>
        </Link>
      </div>

      {/* Overview Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-sm text-muted-foreground">
              Conversations Labeled
            </div>
            <div className="text-3xl font-bold mt-2">
              {comparisons.length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-sm text-muted-foreground">
              Mean Absolute Error
            </div>
            <div className="text-3xl font-bold mt-2">
              {overallMAE.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Lower = better (0 = perfect match)
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-sm text-muted-foreground">
              Pass/Fail Agreement
            </div>
            <div className="text-3xl font-bold mt-2">
              {agreementRate.toFixed(0)}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {comparisons.filter((c) => c.agreement).length} /{" "}
              {comparisons.length} agree
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Per-Criterion Comparison */}
      <Card>
        <CardHeader>
          <CardTitle>Per-Criterion Comparison</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Criterion</TableHead>
                <TableHead className="text-center">AI Avg</TableHead>
                <TableHead className="text-center">Human Avg</TableHead>
                <TableHead className="text-center">MAE</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {perCriterion.map((c) => (
                <TableRow key={c.criterion}>
                  <TableCell className="font-medium">
                    {c.criterion}
                  </TableCell>
                  <TableCell className="text-center">
                    {c.aiAvg.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-center">
                    {c.humanAvg.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge
                      variant={
                        c.mae < 0.5
                          ? "default"
                          : c.mae < 1.0
                          ? "secondary"
                          : "destructive"
                      }
                    >
                      {c.mae.toFixed(2)}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Per-Conversation Comparison */}
      <Card>
        <CardHeader>
          <CardTitle>Conversation-Level Comparison</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Conversation</TableHead>
                <TableHead>Evaluator</TableHead>
                <TableHead className="text-center">AI Score</TableHead>
                <TableHead className="text-center">Human Score</TableHead>
                <TableHead className="text-center">Delta</TableHead>
                <TableHead className="text-center">AI</TableHead>
                <TableHead className="text-center">Human</TableHead>
                <TableHead className="text-center">Match</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {comparisons.map((c) => (
                <TableRow key={c.conversationId}>
                  <TableCell>
                    <Link
                      href={`/conversations/${c.conversationId}/comparison`}
                      className="font-medium hover:underline"
                    >
                      {c.conversationTitle}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {c.agentName}
                    </p>
                  </TableCell>
                  <TableCell className="text-sm">
                    {c.evaluatorName}
                  </TableCell>
                  <TableCell className="text-center">
                    {c.aiAverage.toFixed(1)}
                  </TableCell>
                  <TableCell className="text-center">
                    {c.humanAverage.toFixed(1)}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline">
                      {c.avgDelta.toFixed(1)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge
                      variant={
                        c.aiVerdict === "PASS" ? "default" : "destructive"
                      }
                    >
                      {c.aiVerdict}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge
                      variant={
                        c.humanVerdict === "PASS" ? "default" : "destructive"
                      }
                    >
                      {c.humanVerdict}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    {c.agreement ? (
                      <CheckCircle2 className="size-5 text-green-600 mx-auto" />
                    ) : (
                      <XCircle className="size-5 text-red-600 mx-auto" />
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

// Helper type for the filter(Boolean) cast
type ComparisonRow = {
  conversationId: string;
  conversationTitle: string;
  agentName: string;
  evaluatorName: string;
  aiAverage: number;
  humanAverage: number;
  avgDelta: number;
  aiVerdict: string;
  humanVerdict: string;
  agreement: boolean;
  criterionDeltas: {
    criterion: string;
    aiScore: number;
    humanScore: number;
    delta: number;
  }[];
};
function comparisonsFn(): ComparisonRow | null {
  return null;
}