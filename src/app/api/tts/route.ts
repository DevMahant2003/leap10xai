import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { text, voice = "Sasurji", rate = "+15%" } = await req.json();

  if (!text || !text.trim()) {
    return NextResponse.json({ error: "Text is required" }, { status: 400 });
  }

  try {
    const response = await fetch("http://localhost:8001/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: text, voice, rate }),
    });

    if (!response.ok) {
      const errorData = await response
        .json()
        .catch(() => ({ detail: "TTS server error" }));
      return NextResponse.json(
        { error: errorData.detail || "TTS generation failed" },
        { status: response.status }
      );
    }

    const audioBuffer = await response.arrayBuffer();
    return new NextResponse(audioBuffer, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-cache",
      },
    });
  } catch {
    return NextResponse.json(
      {
        error:
          "TTS server not running. Start it: cd tts-server && uvicorn main:app --port 8001",
      },
      { status: 503 }
    );
  }
}