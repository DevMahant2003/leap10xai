"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { AudioPlayer } from "@/components/audio-player";
import type { TranscriptTurn } from "@/types";

export function TranscriptViewer({
  transcript,
  highlightedTurns = [],
  enableAudio = false,
  voice = "Sasurji",
}: {
  transcript: TranscriptTurn[];
  highlightedTurns?: number[];
  enableAudio?: boolean;
  voice?: string;
}) {
  if (transcript.length === 0) {
    return (
      <div className="text-sm text-muted-foreground py-8 text-center">
        No transcript available
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {transcript.map((turn) => {
        const isHighlighted = highlightedTurns.includes(turn.turn_no || 0);
        const isAgent = turn.role === "agent";

        return (
          <div
            key={turn.turn_no}
            className={cn(
              "rounded-lg border p-3 transition-colors",
              isHighlighted &&
                "ring-2 ring-amber-500 border-amber-700 bg-amber-950/40",
              !isHighlighted && isAgent && "bg-indigo-950/30 border-indigo-900/40",
              !isHighlighted && !isAgent && "bg-zinc-900/40 border-zinc-800/50"
            )}
          >
            <div className="flex items-center gap-2 mb-1">
              <Badge
                variant={isAgent ? "default" : "secondary"}
                className="text-xs"
              >
                {isAgent ? "AGENT" : "CUSTOMER"}
              </Badge>
              <span className="text-xs text-muted-foreground">
                Turn {turn.turn_no}
              </span>
              {isHighlighted && (
                <Badge
                  variant="outline"
                  className="text-xs text-amber-700 border-amber-400"
                >
                  Evidence
                </Badge>
              )}
              {/* Audio player for agent turns */}
              {enableAudio && isAgent && (
                <div className="ml-auto">
                  <AudioPlayer text={turn.text} voice={voice} />
                </div>
              )}
            </div>
            <p className="text-sm leading-relaxed">{turn.text}</p>
          </div>
        );
      })}
    </div>
  );
}