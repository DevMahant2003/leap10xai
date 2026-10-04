import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { callOpenRouter } from "@/lib/ai/openrouter";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { persona, goal, knowledge, guidelines } = await req.json();

  if (!persona || !goal) {
    return NextResponse.json(
      { error: "Persona and goal are required" },
      { status: 400 }
    );
  }

  const system = `You are an expert at designing evaluation rubrics for AI voice agents. Given an agent's configuration, you suggest evaluation criteria that thoroughly test the agent's performance.`;

  const userPrompt = `AGENT CONFIGURATION:
Persona: ${persona}
Goal: ${goal}
Knowledge: ${knowledge || "(none)"}
Guidelines: ${guidelines || "(none)"}

Suggest 3-5 evaluation criteria for grading this agent's performance in a phone conversation. Each criterion should test a distinct aspect (e.g. diagnosis, resolution, policy compliance, customer handling, efficiency).

Output ONLY valid JSON:
{
  "criteria": [
    {
      "criterion": "Diagnosis",
      "description": "Did the agent correctly identify the customer's issue through appropriate questions?",
      "weight": 2,
      "max_score": 5
    }
  ]
}

Rules:
- criterion: short name (1-2 words)
- description: what to evaluate (1-2 sentences)
- weight: 1 = normal, 2 = important, 3 = critical
- max_score: always 5`;

  try {
    const content = await callOpenRouter({
      model: "openai/gpt-4o-mini",
      messages: [
        { role: "system", content: system },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.5,
      jsonMode: true,
    });

    let parsed: { criteria: unknown[] };
    try {
      parsed = JSON.parse(content);
    } catch {
      const match = content.match(/\{[\s\S]*\}/);
      if (match) {
        parsed = JSON.parse(match[0]);
      } else {
        throw new Error("AI did not return valid JSON");
      }
    }

    return NextResponse.json(parsed);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to generate rubric",
      },
      { status: 500 }
    );
  }
}