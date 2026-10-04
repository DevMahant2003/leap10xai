import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { TestSuiteRunner } from "@/components/test-suite-runner";

export default async function TestSuitePage({
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
    .select("id, name")
    .eq("id", id)
    .eq("user_id", user!.id)
    .single();

  if (!agent) notFound();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Test Suite</h1>
        <p className="text-muted-foreground">
          Automatically generate test conversations and evaluate{" "}
          {agent.name}
        </p>
      </div>

      <TestSuiteRunner agentId={agent.id} agentName={agent.name} />
    </div>
  );
}