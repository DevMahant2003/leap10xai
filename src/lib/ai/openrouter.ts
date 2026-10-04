const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

type Message = { role: string; content: string };

export async function callOpenRouter({
  model = "openai/gpt-4o-mini",
  messages,
  temperature = 0.2,
  jsonMode = false,
}: {
  model?: string;
  messages: Message[];
  temperature?: number;
  jsonMode?: boolean;
}) {
  const response = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "HTTP-Referer": "http://localhost:3000",
      "X-Title": "LEAP10XAI",
    },
    body: JSON.stringify({
      model,
      messages,
      temperature,
      ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenRouter ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  return data.choices[0].message.content as string;
}