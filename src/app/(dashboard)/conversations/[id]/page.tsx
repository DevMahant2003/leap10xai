import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { TranscriptViewer } from "@/components/transcript-viewer";
import { EvaluationHistory } from "@/components/evaluation-history";
import { EvaluateButton } from "@/components/evaluate-button";
import { DeleteButton } from "@/components/delete-button";
import { ConversationAudioPlayer } from "@/components/conversation-audio-player";
import {
  ArrowLeft,
  Phone,
  ArrowRight,
  Plus,
  User,
  Pencil,
} from "lucide-react";
import type { Evaluation, TranscriptTurn } from "@/types";

export default async function ConversationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: conversation } = await supabase
    .from("conversations")
    .select("*, agent:agents(name)")
    .eq("id", id)
    .eq("user_id", user!.id)
    .single();

  if (!conversation) notFound();

  // Fetch ALL evaluations (for history)
  const { data: evaluations } = await supabase
    .from("evaluations")
    .select("*")
    .eq("conversation_id", id)
    .eq("user_id", user!.id)
    .order("created_at", { ascending: false });

  // Fetch human evaluation (if any)
  const { data: humanEval } = await supabase
    .from("human_evaluations")
    .select("id, evaluator_name, pass_fail")
    .eq("conversation_id", id)
    .eq("user_id", user!.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const transcript = conversation.transcript as TranscriptTurn[];
  const evalList = (evaluations || []) as unknown as Evaluation[];

  // Collect highlighted turns from latest evaluation
  const highlightedTurns: number[] = [];
  if (evalList.length > 0) {
    const latest = evalList[0];
    for (const s of latest.scores) {
      if (s.evidence_turn) highlightedTurns.push(s.evidence_turn);
    }
    for (const v of latest.hard_rule_violations) {
      if (v.evidence_turn) highlightedTurns.push(v.evidence_turn);
    }
  }

  const agentName = (
    conversation.agent as unknown as { name: string } | null
  )?.name;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link
          href="/conversations"
          className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mb-2"
        >
          <ArrowLeft className="size-4" />
          Back to conversations
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Phone className="size-5" />
              <h1 className="text-2xl font-bold tracking-tight">
                {conversation.title || `Conversation ${id.slice(0, 8)}`}
              </h1>
            </div>
            <p className="text-sm text-muted-foreground">
              Agent: {agentName || "Unknown"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge
              variant={
                conversation.status === "evaluated" ? "default" : "outline"
              }
            >
              {conversation.status}
            </Badge>
            <DeleteButton
              table="conversations"
              id={id}
              label=""
              redirectAfter="/conversations"
            />
          </div>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left: Transcript */}
        <div>
        <Card>
  <CardHeader>
    <div className="flex items-center justify-between">
      <CardTitle className="text-lg">Transcript</CardTitle>
      <ConversationAudioPlayer transcript={transcript} />
    </div>
  </CardHeader>
  <CardContent>
    <TranscriptViewer
      transcript={transcript}
      highlightedTurns={highlightedTurns}
      enableAudio
    />
  </CardContent>
</Card>
        </div>

        {/* Right: Evaluation / Evaluate Button / History */}
        <div className="space-y-4">
          {evalList.length > 0 ? (
            <>
              {/* Re-evaluate button */}
              <div className="flex justify-end">
                <EvaluateButton
                  conversationId={id}
                  isReevaluate
                  variant="outline"
                  size="sm"
                />
              </div>
              <EvaluationHistory evaluations={evalList} />
            </>
          ) : (
            <Card className="border-dashed">
              <CardContent className="py-12 text-center space-y-4">
                <div>
                  <h3 className="font-semibold mb-1">Not evaluated yet</h3>
                  <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                    Run the AI evaluator to score this conversation against
                    the agent&apos;s rubric and hard rules.
                  </p>
                </div>
                <EvaluateButton conversationId={id} />
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Human Evaluation Section */}
      <div className="flex items-center justify-between rounded-lg border p-4">
        <div className="flex items-center gap-3">
          <User className="size-5 text-muted-foreground" />
          <div>
            <h3 className="font-medium">Human Evaluation</h3>
            {humanEval ? (
              <p className="text-sm text-muted-foreground">
                By {humanEval.evaluator_name} —{" "}
                <Badge
                  variant={
                    humanEval.pass_fail === "PASS"
                      ? "default"
                      : "destructive"
                  }
                  className="text-xs ml-1"
                >
                  {humanEval.pass_fail}
                </Badge>
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                No human evaluation yet
              </p>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          {humanEval && evalList.length > 0 ? (
            <Link href={`/conversations/${id}/comparison`}>
              <Button variant="outline" size="sm">
                View Comparison
                <ArrowRight className="size-4" />
              </Button>
            </Link>
          ) : (
            <Link href={`/conversations/${id}/add-human-eval`}>
              <Button variant="outline" size="sm">
                <Plus className="size-4" />
                Add Human Evaluation
              </Button>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}