import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { callOpenRouter } from "@/lib/ai/openrouter";
import { buildAgentSystemPrompt } from "@/lib/ai/chat-prompts";
import type { Agent, TranscriptTurn } from "@/types";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { agentId, conversationId, message } = await req.json();

  if (!agentId || !message) {
    return NextResponse.json(
      { error: "agentId and message are required" },
      { status: 400 }
    );
  }

  // Fetch agent
  const { data: agent } = await supabase
    .from("agents")
    .select("*")
    .eq("id", agentId)
    .eq("user_id", user.id)
    .single();

  if (!agent) {
    return NextResponse.json(
      { error: "Agent not found" },
      { status: 404 }
    );
  }

  // Fetch existing transcript (if continuing a conversation)
  let transcript: TranscriptTurn[] = [];
  let finalConvId = conversationId;

  if (conversationId) {
    const { data: conv } = await supabase
      .from("conversations")
      .select("transcript")
      .eq("id", conversationId)
      .eq("user_id", user.id)
      .single();

    transcript = (conv?.transcript as TranscriptTurn[]) || [];
  }

  // Add customer message
  const customerTurn: TranscriptTurn = {
    role: "customer",
    text: message,
    turn_no: transcript.length + 1,
  };
  transcript.push(customerTurn);

  // Build messages for OpenRouter
  const systemPrompt = buildAgentSystemPrompt(agent as unknown as Agent);

  const messages = [
    { role: "system", content: systemPrompt },
    ...transcript.map((t) => ({
      role: (t.role === "agent" ? "assistant" : "user") as string,
      content: t.text,
    })),
  ];

  // Call OpenRouter
  let reply: string;
  try {
    reply = await callOpenRouter({
      model: "openai/gpt-4o-mini",
      messages,
      temperature: 0.7,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "AI response failed",
      },
      { status: 500 }
    );
  }

  // Add agent response to transcript
  const agentTurn: TranscriptTurn = {
    role: "agent",
    text: reply,
    turn_no: transcript.length + 1,
  };
  transcript.push(agentTurn);

  // Save or update conversation
  if (!finalConvId) {
    // Create new conversation
    const { data: newConv, error: createError } = await supabase
      .from("conversations")
      .insert({
        agent_id: agentId,
        user_id: user.id,
        title: `Live chat — ${new Date().toLocaleString()}`,
        transcript,
        source: "live",
        status: "draft",
      })
      .select("id")
      .single();

    if (createError) {
      return NextResponse.json(
        { error: "Failed to create conversation" },
        { status: 500 }
      );
    }

    finalConvId = newConv.id;
  } else {
    // Update existing conversation
    const { error: updateError } = await supabase
      .from("conversations")
      .update({ transcript })
      .eq("id", finalConvId)
      .eq("user_id", user.id);

    if (updateError) {
      return NextResponse.json(
        { error: "Failed to update conversation" },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({
    reply,
    conversationId: finalConvId,
    turnNo: agentTurn.turn_no,
  });
}