import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { AgentBuilder } from "@/components/agent-builder/agent-builder";
import type { Agent } from "@/types";

export default async function EditAgentPage({
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

  return <AgentBuilder agent={agent as unknown as Agent} />;
}