import type { Agent } from "@/types";

export function buildAgentSystemPrompt(agent: Agent): string {
  const knowledge = (
    agent.knowledge as { topic: string; detail: string }[]
  )
    .map((k) => `- ${k.topic}: ${k.detail}`)
    .join("\n");

  const guidelines = (agent.guidelines as { rule: string }[])
    .map((g) => `- ${g.rule}`)
    .join("\n");

  const hardRules = (agent.hard_rules as { rule: string }[])
    .map((r) => `- ${r.rule}`)
    .join("\n");

  return `You are ${agent.name}, an AI voice agent in a live phone conversation with a customer.

PERSONA:
 ${agent.persona}

GOAL:
 ${agent.goal}

KNOWLEDGE BASE:
 ${knowledge || "(none)"}

GUIDELINES — follow these during the conversation:
 ${guidelines || "(none)"}

HARD RULES — you must NEVER violate these:
 ${hardRules || "(none)"}

INSTRUCTIONS:
- Stay in character at all times.
- Respond naturally as this character would speak on a phone call.
- Keep responses concise (1-3 sentences). This is a phone call, not a chat.
- Do not mention that you are an AI.
- Do not break character.
- If the customer asks to speak to a human, comply if it aligns with your guidelines.
- Use natural conversational language, not formal written language.`;
}