import { createClient } from "@/lib/supabase/server";
import { ConversationForm } from "@/components/conversation-form";

export default async function NewConversationPage({
  searchParams,
}: {
  searchParams: Promise<{ agentId?: string }>;
}) {
  const { agentId } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: agents } = await supabase
    .from("agents")
    .select("id, name")
    .eq("user_id", user!.id)
    .order("name");

  return (
    <ConversationForm
      agents={agents || []}
      preselectedAgentId={agentId}
    />
  );
}