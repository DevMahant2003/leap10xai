import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Bot, Plus } from "lucide-react";

export default async function AgentsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: agents } = await supabase
    .from("agents")
    .select("*")
    .eq("user_id", user!.id)
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Agents</h1>
          <p className="text-muted-foreground">
            Configure AI employees with persona, knowledge, and rubrics
          </p>
        </div>
        <Link href="/agents/new">
          <Button>
            <Plus className="size-4" />
            New Agent
          </Button>
        </Link>
      </div>

      {agents && agents.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {agents.map((agent) => (
            <Link key={agent.id} href={`/agents/${agent.id}`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Bot className="size-5 text-muted-foreground" />
                    <CardTitle className="text-lg">{agent.name}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {agent.description || agent.goal}
                  </p>
                  <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                    <span>Pass threshold: {agent.pass_threshold}/5</span>
                    <span>
                      {(agent.rubric as unknown[]).length} criteria
                    </span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <Bot className="size-10 text-muted-foreground/50 mx-auto mb-3" />
            <h3 className="font-semibold mb-1">No agents yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Create your first AI employee to start evaluating conversations.
            </p>
            <Link href="/agents/new">
              <Button>
                <Plus className="size-4" />
                Create Agent
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}