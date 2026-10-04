"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
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
import { TranscriptViewer } from "@/components/transcript-viewer";
import { toast } from "sonner";
import { Save, User } from "lucide-react";
import type { Agent, TranscriptTurn } from "@/types";

export function HumanEvalForm({
  conversationId,
  title,
  transcript,
  agent,
}: {
  conversationId: string;
  title: string | null;
  transcript: TranscriptTurn[];
  agent: Agent;
}) {
  const router = useRouter();
  const supabase = createClient();

  const rubric = agent.rubric as {
    criterion: string;
    description: string;
    weight: number;
    max_score: number;
  }[];

  const [scores, setScores] = useState<Record<string, number>>({});
  const [passFail, setPassFail] = useState<"PASS" | "FAIL">("PASS");
  const [evaluatorName, setEvaluatorName] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!evaluatorName.trim()) {
      toast.error("Evaluator name is required");
      return;
    }

    // Check all criteria scored
    const unscored = rubric.filter(
      (r) => !scores[r.criterion] || scores[r.criterion] < 1
    );
    if (unscored.length > 0) {
      toast.error(`Please score all criteria (missing: ${unscored.map((u) => u.criterion).join(", ")})`);
      return;
    }

    setSaving(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Not authenticated");
      setSaving(false);
      return;
    }

    const scoresArray = rubric.map((r) => ({
      criterion: r.criterion,
      score: scores[r.criterion],
      max_score: r.max_score,
    }));

    const { error } = await supabase.from("human_evaluations").insert({
      conversation_id: conversationId,
      user_id: user.id,
      evaluator_name: evaluatorName.trim(),
      scores: scoresArray,
      pass_fail: passFail,
      notes: notes.trim() || null,
    });

    if (error) {
      toast.error(error.message);
      setSaving(false);
      return;
    }

    toast.success("Human evaluation saved!");
    router.push(`/conversations/${conversationId}/comparison`);
    router.refresh();
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Human Evaluation
        </h1>
        <p className="text-muted-foreground">
          Score this conversation independently of the AI evaluator.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left: Transcript */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Transcript</CardTitle>
            <CardDescription>
              {title || `Conversation ${conversationId.slice(0, 8)}`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="max-h-[600px] overflow-y-auto">
              <TranscriptViewer transcript={transcript} />
            </div>
          </CardContent>
        </Card>

        {/* Right: Scoring Form */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Score Sheet</CardTitle>
            <CardDescription>
              Agent: {agent.name} · Rubric: {rubric.length} criteria
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Evaluator name */}
            <div className="space-y-2">
              <Label htmlFor="evaluator">Your Name *</Label>
              <div className="flex items-center gap-2">
                <User className="size-4 text-muted-foreground" />
                <Input
                  id="evaluator"
                  placeholder="Jane Doe"
                  value={evaluatorName}
                  onChange={(e) => setEvaluatorName(e.target.value)}
                />
              </div>
            </div>

            {/* Criterion scores */}
            <div className="space-y-3">
              <Label>Rubric Scores</Label>
              {rubric.map((r) => (
                <div
                  key={r.criterion}
                  className="space-y-1 rounded-lg border p-3"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-sm font-medium">
                        {r.criterion}
                      </span>
                      <p className="text-xs text-muted-foreground">
                        {r.description}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      1–{r.max_score}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={1}
                      max={r.max_score}
                      placeholder="Score"
                      value={scores[r.criterion] || ""}
                      onChange={(e) =>
                        setScores({
                          ...scores,
                          [r.criterion]: parseInt(e.target.value) || 0,
                        })
                      }
                      className="w-24"
                    />
                    <span className="text-sm text-muted-foreground">
                      / {r.max_score}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Pass / Fail */}
            <div className="space-y-2">
              <Label>Final Verdict</Label>
              <Select
                value={passFail}
                onValueChange={(v) => setPassFail((v as "PASS" | "FAIL") ?? "PASS")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PASS">PASS</SelectItem>
                  <SelectItem value="FAIL">FAIL</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">Notes (optional)</Label>
              <Textarea
                id="notes"
                rows={3}
                placeholder="Any observations about the agent's performance..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => router.back()}
              >
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                <Save className="size-4" />
                {saving ? "Saving..." : "Save Evaluation"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}