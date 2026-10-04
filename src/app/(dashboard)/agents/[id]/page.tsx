import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { MessageCircle, FlaskConical } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { DeleteButton } from "@/components/delete-button";
import {
  Bot,
  BookOpen,
  ListChecks,
  Scale,
  AlertTriangle,
  Phone,
  ArrowLeft,
  Plus,
  ArrowRight,
  Pencil,
} from "lucide-react";

type RubricCriterion = {
  criterion: string;
  description: string;
  weight: number;
  max_score: number;
};

export default async function AgentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: agent } = await supabase
    .from("agents")
    .select("*")
    .eq("id", id)
    .eq("user_id", user!.id)
    .single();

  if (!agent) notFound();

  const { data: conversations } = await supabase
    .from("conversations")
    .select(
      "id, title, status, created_at, evaluations(average_score, pass_fail)"
    )
    .eq("agent_id", id)
    .eq("user_id", user!.id)
    .order("created_at", { ascending: false })
    .limit(5);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link
          href="/agents"
          className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mb-2"
        >
          <ArrowLeft className="size-4" />
          Back to agents
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Bot className="size-6" />
              <h1 className="text-2xl font-bold tracking-tight">
                {agent.name}
              </h1>
            </div>
            {agent.description && (
              <p className="text-muted-foreground">{agent.description}</p>
            )}
          </div>
          <div className="flex gap-2">
            <Link href={`/agents/${agent.id}/edit`}>
              <Button variant="outline" size="sm">
                <Pencil className="size-4" />
                Edit
              </Button>
            </Link>
            <Link href={`/conversations/new?agentId=${agent.id}`}>
              <Button size="sm">
                <Plus className="size-4" />
                Add Conversation
              </Button>
            </Link>
            <Link href={`/conversations/live?agentId=${agent.id}`}>
  <Button variant="default" size="sm">
    <MessageCircle className="size-4" />
    Live Chat
  </Button>
</Link>
<Link href={`/agents/${agent.id}/test-suite`}>
  <Button variant="outline" size="sm">
    <FlaskConical className="size-4" />
    Test Suite
  </Button>
</Link>
            <DeleteButton
              table="agents"
              id={agent.id}
              label=""
              redirectAfter="/agents"
            />
          </div>
        </div>
      </div>

      {/* Persona + Goal */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Bot className="size-4" />
              Persona
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
              {agent.persona}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <ListChecks className="size-4" />
              Goal
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
              {agent.goal}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Knowledge */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <BookOpen className="size-4" />
            Knowledge ({(agent.knowledge as unknown[]).length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {(agent.knowledge as { topic: string; detail: string }[]).length >
          0 ? (
            <ul className="space-y-2">
              {(agent.knowledge as { topic: string; detail: string }[]).map(
                (k, i) => (
                  <li key={i} className="text-sm text-muted-foreground">
                    <strong className="text-foreground">{k.topic}:</strong>{" "}
                    {k.detail}
                  </li>
                )
              )}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              No knowledge entries
            </p>
          )}
        </CardContent>
      </Card>

      {/* Guidelines */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <ListChecks className="size-4" />
            Guidelines ({(agent.guidelines as unknown[]).length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {(agent.guidelines as { rule: string }[]).length > 0 ? (
            <ul className="space-y-1">
              {(agent.guidelines as { rule: string }[]).map((g, i) => (
                <li key={i} className="text-sm text-muted-foreground">
                  • {g.rule}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No guidelines</p>
          )}
        </CardContent>
      </Card>

      {/* Rubric */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Scale className="size-4" />
            Rubric ({(agent.rubric as unknown[]).length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {(agent.rubric as RubricCriterion[]).map((r, i) => (
            <div
              key={i}
              className="flex items-start justify-between gap-2 rounded border p-2"
            >
              <div>
                <div className="text-sm font-medium">{r.criterion}</div>
                <div className="text-xs text-muted-foreground">
                  {r.description}
                </div>
              </div>
              <Badge variant="secondary">
                Weight {r.weight} · /{r.max_score}
              </Badge>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Hard Rules */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertTriangle className="size-4 text-amber-500" />
              Hard Rules ({(agent.hard_rules as unknown[]).length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(agent.hard_rules as {
              rule: string;
              type?: "text" | "criterion";
              criterion?: string;
              operator?: string;
              threshold?: number;
            }[]).length > 0 ? (
              <ul className="space-y-1">
                {(agent.hard_rules as {
                  rule: string;
                  type?: "text" | "criterion";
                  criterion?: string;
                  operator?: string;
                  threshold?: number;
                }[]).map((r, i) => (
                  <li
                    key={i}
                    className="text-sm text-muted-foreground flex items-center gap-2"
                  >
                    • {r.rule}{" "}
                    {r.type === "criterion" ? (
                      <Badge variant="outline" className="text-xs">
                        Criterion: {r.criterion} {r.operator} {r.threshold}
                      </Badge>
                    ) : null}
                    <Badge variant="destructive" className="text-xs">
                      Auto-fail
                    </Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No hard rules</p>
            )}
          </CardContent>
        </Card>

      <Separator />

      {/* Recent Conversations */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-medium flex items-center gap-2">
            <Phone className="size-4" />
            Recent Conversations
          </h3>
          <Badge variant="outline">
            Pass threshold: {agent.pass_threshold}/5
          </Badge>
        </div>

        {conversations && conversations.length > 0 ? (
          <div className="space-y-2">
            {conversations.map((conv: any) => {
              const evaluation = conv.evaluations?.[0];
              return (
                <Link key={conv.id} href={`/conversations/${conv.id}`}>
                  <Card className="hover:shadow-md transition-shadow cursor-pointer">
                    <CardContent className="flex items-center justify-between p-4">
                      <div>
                        <p className="font-medium text-sm">
                          {conv.title ||
                            `Conversation ${conv.id.slice(0, 8)}`}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(conv.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {evaluation ? (
                          <>
                            <Badge
                              variant={
                                evaluation.pass_fail === "PASS"
                                  ? "default"
                                  : "destructive"
                              }
                            >
                              {evaluation.pass_fail}
                            </Badge>
                            <span className="text-sm font-medium">
                              {evaluation.average_score}/5
                            </span>
                          </>
                        ) : (
                          <Badge variant="outline">Not evaluated</Badge>
                        )}
                        <ArrowRight className="size-4 text-muted-foreground" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        ) : (
          <Card className="border-dashed">
            <CardContent className="py-8 text-center">
              <p className="text-sm text-muted-foreground mb-3">
                No conversations yet for this agent.
              </p>
              <Link href={`/conversations/new?agentId=${agent.id}`}>
                <Button variant="outline" size="sm">
                  <Plus className="size-4" />
                  Add Conversation
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}