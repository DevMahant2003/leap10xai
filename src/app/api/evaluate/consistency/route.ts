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
  const { conversationId, runs = 5 } = body as {
    conversationId?: string;
    runs?: number;
  };

  if (!conversationId) {
    return NextResponse.json(
      { error: "conversationId is required" },
      { status: 400 }
    );
  }

  const { data: conversation } = await supabase
    .from("conversations")
    .select("*, agent:agents(*)")
    .eq("id", conversationId)
    .eq("user_id", user.id)
    .single();

  if (!conversation) {
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

  const results: Array<{
    run: number;
    scores: { criterion: string; score: number; max_score: number }[];
    averageScore: number;
    passFail: string;
    error?: string;
  }> = [];

  for (let i = 0; i < runs; i++) {
    try {
      const result = await evaluateConversation(agent, transcript);
      results.push({
        run: i + 1,
        scores: result.scores.map((s) => ({
          criterion: s.criterion,
          score: s.score,
          max_score: s.max_score,
        })),
        averageScore: result.averageScore,
        passFail: result.passFail,
      });
      // Delay between runs to avoid rate limiting
      if (i < runs - 1) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    } catch (error) {
      results.push({
        run: i + 1,
        scores: [],
        averageScore: 0,
        passFail: "ERROR",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  return NextResponse.json({ results });
}