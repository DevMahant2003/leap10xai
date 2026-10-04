"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Play, Pause, Volume2 } from "lucide-react";
import type { TranscriptTurn } from "@/types";

export function ConversationAudioPlayer({
  transcript,
  voice = "Sasurji",
}: {
  transcript: TranscriptTurn[];
  voice?: string;
}) {
  const [state, setState] = useState<
    "idle" | "generating" | "playing" | "paused"
  >("idle");
  const [progress, setProgress] = useState("");
  const [currentTurn, setCurrentTurn] = useState<number | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const urlsRef = useRef<Map<number, string>>(new Map());

  const agentTurns = transcript.filter((t) => t.role === "agent");

  const generateAndPlay = async () => {
    setState("generating");

    for (let i = 0; i < agentTurns.length; i++) {
      const turn = agentTurns[i];
      const turnNo = turn.turn_no ?? i + 1;
      setProgress(`Generating ${i + 1}/${agentTurns.length}...`);

      // Generate if not cached
      if (!urlsRef.current.has(turnNo)) {
        try {
          const res = await fetch("/api/tts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: turn.text, voice }),
          });

          if (res.ok) {
            const blob = await res.blob();
            urlsRef.current.set(turnNo, URL.createObjectURL(blob));
          }
        } catch {
          // Skip failed turns
        }
      }

      // Play this turn
      const url = urlsRef.current.get(turnNo);
      if (url && audioRef.current) {
        setCurrentTurn(turnNo);
        setState("playing");

        audioRef.current.src = url;
        await new Promise<void>((resolve) => {
          audioRef.current!.onended = () => resolve();
          audioRef.current!.play().catch(() => resolve());
        });
      }
    }

    setState("idle");
    setCurrentTurn(null);
    setProgress("");
  };

  const handleToggle = () => {
    if (state === "playing") {
      audioRef.current?.pause();
      setState("paused");
    } else if (state === "paused") {
      audioRef.current?.play();
      setState("playing");
    } else {
      generateAndPlay();
    }
  };

  if (agentTurns.length === 0) return null;

  return (
    <div className="flex items-center gap-3">
      <Button
        onClick={handleToggle}
        disabled={state === "generating"}
        variant="outline"
        size="sm"
      >
        {state === "generating" ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            {progress}
          </>
        ) : state === "playing" ? (
          <>
            <Pause className="size-4" />
            Playing
          </>
        ) : state === "paused" ? (
          <>
            <Play className="size-4" />
            Resume
          </>
        ) : (
          <>
            <Volume2 className="size-4" />
            Play Conversation
          </>
        )}
      </Button>
      {currentTurn !== null && state === "playing" && (
        <span className="text-xs text-muted-foreground">
          Turn {currentTurn}
        </span>
      )}
      <audio ref={audioRef} className="hidden" />
    </div>
  );
}