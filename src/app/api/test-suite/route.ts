import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { callOpenRouter } from "@/lib/ai/openrouter";
import { buildAgentSystemPrompt } from "@/lib/ai/chat-prompts";
import { evaluateConversation } from "@/lib/ai/evaluator";
import type { Agent, TranscriptTurn } from "@/types";

export const maxDuration = 180;

type TestScenario = {
  customer_persona: string;
  opening_message: string;
  difficulty: string;
  tests_hard_rule: boolean;
  expected_behavior: string;
};

type TestResult = {
  scenario: TestScenario;
  conversationId: string;
  transcript: TranscriptTurn[];
  averageScore: number;
  passFail: "PASS" | "FAIL";
  hardRuleViolations: { rule: string }[];
  summary: string;
  error?: string;
};

async function generateScenarios(
  agent: Agent,
  count: number
): Promise<TestScenario[]> {
  const knowledge = (agent.knowledge as { topic: string; detail: string }[])
    .map((k) => `- ${k.topic}: ${k.detail}`)
    .join("\n");

  const hardRules = (agent.hard_rules as { rule: string }[])
    .map((r) => `- ${r.rule}`)
    .join("\n");

  const system = `You are a QA test designer for AI voice agents. You design realistic test scenarios that thoroughly test an agent's capabilities.`;

  const userPrompt = `AGENT CONFIGURATION:
Name: ${agent.name}
Persona: ${agent.persona}
Goal: ${agent.goal}
Knowledge: ${knowledge || "(none)"}
Hard Rules: ${hardRules || "(none)"}

Generate exactly ${count} diverse test scenarios for this agent.

REQUIREMENTS:
- At least 1 scenario should try to trigger a hard rule violation (if any exist)
- Vary difficulty: easy, medium, hard
- Make scenarios realistic — like real customer calls
- Each opening_message should be what the customer says FIRST when they call

Output ONLY valid JSON:
{
  "scenarios": [
    {
      "customer_persona": "Description of the customer and their situation",
      "opening_message": "The exact first thing the customer says",
      "difficulty": "easy|medium|hard",
      "tests_hard_rule": true|false,
      "expected_behavior": "What the agent should ideally do"
    }
  ]
}`;

  const content = await callOpenRouter({
    model: "openai/gpt-4o-mini",
    messages: [
      { role: "system", content: system },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.8,
    jsonMode: true,
  });

  let parsed: { scenarios: TestScenario[] };
  try {
    parsed = JSON.parse(content);
  } catch {
    const match = content.match(/\{[\s\S]*\}/);
    if (match) {
      parsed = JSON.parse(match[0]);
    } else {
      throw new Error("Failed to parse scenarios");
    }
  }

  return parsed.scenarios.slice(0, count);
}

async function simulateConversation(
  agent: Agent,
  scenario: TestScenario,
  maxTurns: number = 6
): Promise<TranscriptTurn[]> {
  const transcript: TranscriptTurn[] = [];

  const customerSystemPrompt = `You are a customer on a phone call with a support agent.

CUSTOMER PERSONA:
 ${scenario.customer_persona}

WHAT YOU WANT:
 ${scenario.expected_behavior}

INSTRUCTIONS:
- Stay in character at all times.
- Respond naturally as this customer would speak on a phone call.
- Keep responses concise (1-2 sentences).
- If the agent resolves your issue, thank them and say goodbye.
- If the agent asks a question, answer it based on your persona.
- Do not mention that you are an AI.
- Be realistic — don't make it too easy for the agent.`;

  let customerMessage = scenario.opening_message;

  for (let turn = 0; turn < maxTurns; turn++) {
    // Customer turn
    transcript.push({
      role: "customer",
      text: customerMessage,
      turn_no: transcript.length + 1,
    });

    // Check if customer is ending
    const endKeywords = [
      "bye",
      "goodbye",
      "thank you",
      "that's all",
      "appreciate it",
    ];
    if (
      turn > 0 &&
      endKeywords.some((kw) => customerMessage.toLowerCase().includes(kw))
    ) {
      break;
    }

    // Agent turn
    const agentMessages = [
      { role: "system", content: buildAgentSystemPrompt(agent) },
      ...transcript.map((t) => ({
        role: (t.role === "agent" ? "assistant" : "user") as string,
        content: t.text,
      })),
    ];

    const agentReply = await callOpenRouter({
      model: "openai/gpt-4o-mini",
      messages: agentMessages,
      temperature: 0.7,
    });

    transcript.push({
      role: "agent",
      text: agentReply,
      turn_no: transcript.length + 1,
    });

    // Check if agent is ending
    const agentEndKeywords = [
      "transfer you",
      "have a great day",
      "thank you for calling",
      "is there anything else",
    ];
    if (
      turn >= 2 &&
      agentEndKeywords.some((kw) =>
        agentReply.toLowerCase().includes(kw)
      )
    ) {
      // Get customer's final response
      const customerMessages = [
        { role: "system", content: customerSystemPrompt },
        ...transcript.map((t) => ({
          role: (t.role === "customer" ? "user" : "assistant") as string,
          content: t.text,
        })),
      ];

      customerMessage = await callOpenRouter({
        model: "openai/gpt-4o-mini",
        messages: customerMessages,
        temperature: 0.8,
      });

      transcript.push({
        role: "customer",
        text: customerMessage,
        turn_no: transcript.length + 1,
      });
      break;
    }

    // Generate next customer message
    const customerMessages = [
      { role: "system", content: customerSystemPrompt },
      ...transcript.map((t) => ({
        role: (t.role === "customer" ? "user" : "assistant") as string,
        content: t.text,
      })),
    ];

    customerMessage = await callOpenRouter({
      model: "openai/gpt-4o-mini",
      messages: customerMessages,
      temperature: 0.8,
    });

    // Small delay to avoid rate limiting
    await new Promise((resolve) => setTimeout(resolve, 300));
  }

  return transcript;
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { agentId, numScenarios = 3 } = await req.json();

  if (!agentId) {
    return NextResponse.json(
      { error: "agentId is required" },
      { status: 400 }
    );
  }

  // Fetch agent
  const { data: agentData } = await supabase
    .from("agents")
    .select("*")
    .eq("id", agentId)
    .eq("user_id", user.id)
    .single();

  if (!agentData) {
    return NextResponse.json(
      { error: "Agent not found" },
      { status: 404 }
    );
  }

  const agent = agentData as unknown as Agent;

  try {
    // Step 1: Generate scenarios
    const scenarios = await generateScenarios(agent, numScenarios);

    // Step 2: Run each scenario
    const results: TestResult[] = [];

    for (const scenario of scenarios) {
      try {
        // Simulate conversation
        const transcript = await simulateConversation(agent, scenario, 6);

        // Save conversation
        const { data: conv } = await supabase
          .from("conversations")
          .insert({
            agent_id: agentId,
            user_id: user.id,
            title: `Test: ${scenario.customer_persona.slice(0, 60)}`,
            transcript,
            source: "live",
            status: "evaluated",
            metadata: {
              test_suite: true,
              scenario,
            },
          })
          .select("id")
          .single();

        // Evaluate
        const evalResult = await evaluateConversation(agent, transcript);

        // Save evaluation
        await supabase.from("evaluations").insert({
          conversation_id: conv!.id,
          user_id: user.id,
          scores: evalResult.scores,
          hard_rule_violations: evalResult.hard_rule_violations,
          average_score: evalResult.averageScore,
          pass_fail: evalResult.passFail,
          model: "openai/gpt-4o-mini",
          summary: evalResult.summary,
          improvement_suggestions: evalResult.improvement_suggestions || [],
        });

        results.push({
          scenario,
          conversationId: conv!.id,
          transcript,
          averageScore: evalResult.averageScore,
          passFail: evalResult.passFail,
          hardRuleViolations: evalResult.hard_rule_violations,
          summary: evalResult.summary,
        });
      } catch (error) {
        results.push({
          scenario,
          conversationId: "",
          transcript: [],
          averageScore: 0,
          passFail: "FAIL",
          hardRuleViolations: [],
          summary: "",
          error:
            error instanceof Error ? error.message : "Scenario failed",
        });
      }
    }

    return NextResponse.json({
      results,
      summary: {
        total: results.length,
        passed: results.filter((r) => r.passFail === "PASS").length,
        failed: results.filter((r) => r.passFail === "FAIL").length,
        averageScore:
          results.length > 0
            ? results.reduce((sum, r) => sum + r.averageScore, 0) /
              results.length
            : 0,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Test suite failed",
      },
      { status: 500 }
    );
  }
}