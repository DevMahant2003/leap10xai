import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
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
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Bot, User, CheckCircle2, XCircle } from "lucide-react";

type AIScore = {
  criterion: string;
  score: number;
  max_score: number;
  evidence_turn: number | null;
  evidence_text: string | null;
  explanation: string;
};

type HumanScore = {
  criterion: string;
  score: number;
  max_score: number;
};

export default async function ComparisonPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Fetch conversation
  const { data: rawConv } = await supabase
    .from("conversations")
    .select("id, title, agent:agents(name)")
    .eq("id", id)
    .eq("user_id", user!.id)
    .single();

  if (!rawConv) notFound();

  const conversation = rawConv as unknown as {
    id: string;
    title: string | null;
    agent: { name: string } | null;
  };

  // Fetch latest AI evaluation
  const { data: aiEval } = await supabase
    .from("evaluations")
    .select(
      "id, average_score, pass_fail, scores, summary, hard_rule_violations"
    )
    .eq("conversation_id", id)
    .eq("user_id", user!.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Fetch latest human evaluation
  const { data: humanEval } = await supabase
    .from("human_evaluations")
    .select("id, evaluator_name, scores, pass_fail, notes")
    .eq("conversation_id", id)
    .eq("user_id", user!.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!aiEval && !humanEval) {
    return (
      <div className="space-y-6">
        <Link
          href={`/conversations/${id}`}
          className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
        >
          <ArrowLeft className="size-4" />
          Back to conversation
        </Link>
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <p className="text-sm text-muted-foreground">
              No evaluations found for this conversation.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const aiScores = (aiEval?.scores as AIScore[]) || [];
  const humanScores = (humanEval?.scores as HumanScore[]) || [];
  const agreement = aiEval && humanEval ? aiEval.pass_fail === humanEval.pass_fail : null;

  // Build comparison rows
  const allCriteria = new Set<string>();
  aiScores.forEach((s) => allCriteria.add(s.criterion));
  humanScores.forEach((s) => allCriteria.add(s.criterion));

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/conversations/${id}`}
          className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mb-2"
        >
          <ArrowLeft className="size-4" />
          Back to conversation
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">
          AI vs Human Comparison
        </h1>
        <p className="text-muted-foreground">
          {conversation.title || `Conversation ${id.slice(0, 8)}`} ·{" "}
          {conversation.agent?.name}
        </p>
      </div>

      {/* Verdict comparison */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* AI */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Bot className="size-5" />
              AI Evaluator
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {aiEval ? (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    Average Score
                  </span>
                  <span className="text-2xl font-bold">
                    {aiEval.average_score}/5
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    Verdict
                  </span>
                  <Badge
                    variant={
                      aiEval.pass_fail === "PASS" ? "default" : "destructive"
                    }
                  >
                    {aiEval.pass_fail}
                  </Badge>
                </div>
                {aiEval.summary && (
                  <>
                    <Separator />
                    <p className="text-sm text-muted-foreground">
                      {aiEval.summary}
                    </p>
                  </>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                No AI evaluation. Run one from the conversation page.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Human */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <User className="size-5" />
              Human Evaluator
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {humanEval ? (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    Evaluator
                  </span>
                  <span className="text-sm font-medium">
                    {humanEval.evaluator_name}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    Verdict
                  </span>
                  <Badge
                    variant={
                      humanEval.pass_fail === "PASS"
                        ? "default"
                        : "destructive"
                    }
                  >
                    {humanEval.pass_fail}
                  </Badge>
                </div>
                {humanEval.notes && (
                  <>
                    <Separator />
                    <p className="text-sm text-muted-foreground">
                      {humanEval.notes}
                    </p>
                  </>
                )}
              </>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  No human evaluation yet.
                </p>
                <Link href={`/conversations/${id}/add-human-eval`}>
                  <Button variant="outline" size="sm">
                    Add Human Evaluation
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Agreement Banner */}
      {aiEval && humanEval && (
        <Card
          className={
            agreement
              ? "border-green-300 bg-green-50"
              : "border-red-300 bg-red-50"
          }
        >
          <CardContent className="p-4 flex items-center justify-center gap-3">
            {agreement ? (
              <CheckCircle2 className="size-6 text-green-600" />
            ) : (
              <XCircle className="size-6 text-red-600" />
            )}
            <span className="font-medium">
              {agreement
                ? `Both evaluators agree: ${aiEval.pass_fail}`
                : `Disagreement: AI says ${aiEval.pass_fail}, Human says ${humanEval.pass_fail}`}
            </span>
          </CardContent>
        </Card>
      )}

      {/* Per-Criterion Comparison Table */}
      {aiScores.length > 0 && humanScores.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Criterion-by-Criterion</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Criterion</TableHead>
                  <TableHead className="text-center">AI Score</TableHead>
                  <TableHead className="text-center">Human Score</TableHead>
                  <TableHead className="text-center">Delta</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Array.from(allCriteria).map((criterion) => {
                  const ai = aiScores.find(
                    (s) => s.criterion === criterion
                  );
                  const human = humanScores.find(
                    (s) => s.criterion === criterion
                  );
                  const aiVal = ai?.score ?? 0;
                  const humanVal = human?.score ?? 0;
                  const delta = aiVal - humanVal;
                  const maxScore = ai?.max_score || human?.max_score || 5;

                  return (
                    <TableRow key={criterion}>
                      <TableCell className="font-medium">
                        {criterion}
                      </TableCell>
                      <TableCell className="text-center">
                        {ai ? `${aiVal}/${maxScore}` : "—"}
                      </TableCell>
                      <TableCell className="text-center">
                        {human ? `${humanVal}/${maxScore}` : "—"}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge
                          variant={
                            Math.abs(delta) < 0.5
                              ? "default"
                              : Math.abs(delta) < 1.5
                              ? "secondary"
                              : "destructive"
                          }
                        >
                          {delta > 0 ? "+" : ""}
                          {delta.toFixed(1)}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}