import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Phone, Plus, ArrowRight } from "lucide-react";

export default async function ConversationsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: conversations } = await supabase
    .from("conversations")
    .select(
      "id, title, status, source, created_at, agent:agents(id, name), evaluations(average_score, pass_fail)"
    )
    .eq("user_id", user!.id)
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Conversations</h1>
          <p className="text-muted-foreground">
            Transcripts evaluated (or pending evaluation)
          </p>
        </div>
        <Link href="/conversations/new">
          <Button>
            <Plus className="size-4" />
            New Conversation
          </Button>
        </Link>
      </div>

      {conversations && conversations.length > 0 ? (
        <div className="space-y-2">
          {conversations.map((conv: any) => {
            const evaluation = conv.evaluations?.[0];
            const isEvaluated = conv.status === "evaluated" && evaluation;

            return (
              <Link key={conv.id} href={`/conversations/${conv.id}`}>
                <Card className="hover:shadow-md transition-shadow cursor-pointer">
                  <CardContent className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-4 min-w-0">
                      <Phone className="size-5 text-muted-foreground shrink-0" />
                      <div className="min-w-0">
                        <p className="font-medium truncate">
                          {conv.title || `Conversation ${conv.id.slice(0, 8)}`}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {conv.agent?.name || "Unknown agent"}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      {isEvaluated ? (
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
        <Card>
          <CardContent className="py-12 text-center">
            <Phone className="size-10 text-muted-foreground/50 mx-auto mb-3" />
            <h3 className="font-semibold mb-1">No conversations yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Add a transcript to evaluate an agent's performance.
            </p>
            <Link href="/conversations/new">
              <Button>
                <Plus className="size-4" />
                Add Conversation
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}