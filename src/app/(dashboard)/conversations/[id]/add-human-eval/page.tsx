import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { HumanEvalForm } from "@/components/human-eval-form";
import type { Agent, TranscriptTurn } from "@/types";

export default async function AddHumanEvalPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: conversation } = await supabase
    .from("conversations")
    .select("id, title, transcript, agent:agents(*)")
    .eq("id", id)
    .eq("user_id", user!.id)
    .single();

  if (!conversation) notFound();

  return (
    <HumanEvalForm
      conversationId={id}
      title={conversation.title}
      transcript={conversation.transcript as TranscriptTurn[]}
      agent={conversation.agent as unknown as Agent}
    />
  );
}