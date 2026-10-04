"use client";

import { useState, useMemo } from "react";
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
import { toast } from "sonner";
import { Save, FileText, Sparkles } from "lucide-react";
import { parseTranscript, SAMPLE_TRANSCRIPT } from "@/lib/utils/transcript-parser";

type AgentOption = { id: string; name: string };

export function ConversationForm({
  agents,
  preselectedAgentId,
}: {
  agents: AgentOption[];
  preselectedAgentId?: string;
}) {
  const router = useRouter();
  const supabase = createClient();

  const [agentId, setAgentId] = useState(
    preselectedAgentId || (agents[0]?.id ?? "")
  );
  const [title, setTitle] = useState("");
  const [rawTranscript, setRawTranscript] = useState("");
  const [saving, setSaving] = useState(false);

  const parsedTurns = useMemo(
    () => parseTranscript(rawTranscript),
    [rawTranscript]
  );

  const agentTurns = parsedTurns.filter((t) => t.role === "agent").length;
  const customerTurns = parsedTurns.filter(
    (t) => t.role === "customer"
  ).length;

  const handleSave = async () => {
    if (!agentId) {
      toast.error("Please select an agent");
      return;
    }
    if (parsedTurns.length === 0) {
      toast.error("Please paste a transcript");
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

    const { data, error } = await supabase
      .from("conversations")
      .insert({
        agent_id: agentId,
        user_id: user.id,
        title: title.trim() || null,
        transcript: parsedTurns,
        source: "manual",
        status: "completed",
      })
      .select("id")
      .single();

    if (error) {
      toast.error(error.message);
      setSaving(false);
      return;
    }

    toast.success("Conversation saved!");
    router.push(`/conversations/${data.id}`);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          New Conversation
        </h1>
        <p className="text-muted-foreground">
          Paste a transcript for the AI evaluator to grade.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="agent">Agent *</Label>
            <Select value={agentId} onValueChange={(v) => setAgentId(v ?? "")}>
              <SelectTrigger>
                <SelectValue placeholder="Select an agent" />
              </SelectTrigger>
              <SelectContent>
                {agents.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {agents.length === 0 && (
              <p className="text-xs text-muted-foreground">
                No agents found. Create an agent first.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="title">Title (optional)</Label>
            <Input
              id="title"
              placeholder="e.g. Broadband fault call — LOS light"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Transcript</CardTitle>
              <CardDescription>
                Paste the conversation. Use labels like{" "}
                <code className="text-xs">Customer:</code> and{" "}
                <code className="text-xs">Agent:</code> to mark speakers.
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRawTranscript(SAMPLE_TRANSCRIPT)}
            >
              <Sparkles className="size-4" />
              Load Sample
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            rows={14}
            placeholder={`Customer: My internet isn't working.\nAgent: What lights are showing on your router?\nCustomer: Red LOS light.\nAgent: ...`}
            value={rawTranscript}
            onChange={(e) => setRawTranscript(e.target.value)}
            className="font-mono text-sm"
          />

          {parsedTurns.length > 0 && (
            <div className="flex items-center gap-4 rounded-lg border bg-muted/50 p-3">
              <FileText className="size-5 text-muted-foreground" />
              <div className="flex items-center gap-4 text-sm">
                <span>
                  <strong>{parsedTurns.length}</strong> turns
                </span>
                <Badge variant="secondary" className="text-xs">
                  {customerTurns} customer
                </Badge>
                <Badge variant="secondary" className="text-xs">
                  {agentTurns} agent
                </Badge>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-end gap-3">
        <Button
          variant="outline"
          onClick={() => router.push("/conversations")}
        >
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={saving}>
          <Save className="size-4" />
          {saving ? "Saving..." : "Save Conversation"}
        </Button>
      </div>
    </div>
  );
}