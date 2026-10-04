import { createClient } from "@/lib/supabase/server";
import { ConsistencyRunner } from "@/components/consistency-runner";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";

type Conv = {
  id: string;
  title: string | null;
  agent: { name: string } | null;
};

export default async function ConsistencyPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: conversations } = (await supabase
    .from("conversations")
    .select("id, title, agent:agents(name)")
    .eq("user_id", user!.id)
    .eq("status", "evaluated")
    .order("created_at", { ascending: false })) as { data: Conv[] | null };

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/validation"
          className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mb-2"
        >
          <ArrowLeft className="size-4" />
          Back to validation
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">
          Consistency Testing
        </h1>
        <p className="text-muted-foreground">
          Run the AI evaluator multiple times on the same conversation to
          measure variance.
        </p>
      </div>

      {conversations && conversations.length > 0 ? (
        <ConsistencyRunner conversations={conversations} />
      ) : (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <p className="text-sm text-muted-foreground">
              No evaluated conversations available. Evaluate at least one
              conversation first.
            </p>
            <Link href="/conversations" className="inline-block mt-4">
              <Button variant="outline">Browse Conversations</Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}