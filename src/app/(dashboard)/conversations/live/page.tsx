import { createClient } from "@/lib/supabase/server";
import { LiveChatPicker } from "@/components/live-chat-picker";
import { LiveChat } from "@/components/live-chat";
import type { Agent, TranscriptTurn } from "@/types";

export default async function LiveChatPage({
  searchParams,
}: {
  searchParams: Promise<{
    agentId?: string;
    conversationId?: string;
  }>;
}) {
  const { agentId, conversationId } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Resume existing conversation
  if (conversationId) {
    const { data: conv } = await supabase
      .from("conversations")
      .select("*, agent:agents(*)")
      .eq("id", conversationId)
      .eq("user_id", user!.id)
      .single();

    if (conv) {
      return (
        <LiveChat
          agent={conv.agent as unknown as Agent}
          initialConversationId={conv.id}
          initialTranscript={conv.transcript as TranscriptTurn[]}
        />
      );
    }
  }

  // Start new conversation with specific agent
  if (agentId) {
    const { data: agent } = await supabase
      .from("agents")
      .select("*")
      .eq("id", agentId)
      .eq("user_id", user!.id)
      .single();

    if (agent) {
      return <LiveChat agent={agent as unknown as Agent} />;
    }
  }

  // No agentId — show agent picker
  const { data: agents } = await supabase
    .from("agents")
    .select("id, name, persona, goal")
    .eq("user_id", user!.id)
    .order("name");

  return <LiveChatPicker agents={agents || []} />;
}