import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { evaluateConversation } from "@/lib/ai/evaluator";
import type { Agent, TranscriptTurn } from "@/types";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { conversationId } = body as { conversationId?: string };

  if (!conversationId) {
    return NextResponse.json(
      { error: "conversationId is required" },
      { status: 400 }
    );
  }

  // Fetch conversation + agent
  const { data: conversation, error: convError } = await supabase
    .from("conversations")
    .select("*, agent:agents(*)")
    .eq("id", conversationId)
    .eq("user_id", user.id)
    .single();

  if (convError || !conversation) {
    return NextResponse.json(
      { error: "Conversation not found" },
      { status: 404 }
    );
  }

  const transcript = conversation.transcript as TranscriptTurn[];
  const agent = conversation.agent as Agent;

  if (!agent) {
    return NextResponse.json(
      { error: "Agent not found" },
      { status: 404 }
    );
  }

  try {
    const result = await evaluateConversation(agent, transcript);

    // Save evaluation to DB
    const { data: evaluation, error: evalError } = await supabase
    .from("evaluations")
    .insert({
      conversation_id: conversationId,
      user_id: user.id,
      scores: result.scores,
      hard_rule_violations: result.hard_rule_violations,
      average_score: result.averageScore,
      pass_fail: result.passFail,
      model: "openai/gpt-4o-mini",
      summary: result.summary,
      improvement_suggestions: result.improvement_suggestions || [],
    })
    .select()
    .single();

    if (evalError) throw evalError;

    // Update conversation status
    await supabase
      .from("conversations")
      .update({ status: "evaluated" })
      .eq("id", conversationId);

    return NextResponse.json({ evaluation });
  } catch (error) {
    console.error("Evaluation error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Evaluation failed",
      },
      { status: 500 }
    );
  }
}