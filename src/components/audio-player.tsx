"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Play, AlertCircle } from "lucide-react";
import { toast } from "sonner";

export function AudioPlayer({
  text,
  voice = "Sasurji",
}: {
  text: string;
  voice?: string;
}) {
  const [loading, setLoading] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  const handleGenerate = async () => {
    setLoading(true);
    setError(false);

    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, voice }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "TTS failed");
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      setAudioUrl(url);

      // Auto-play
      setTimeout(() => {
        audioRef.current?.play();
      }, 100);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "TTS generation failed";
      setError(true);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  if (error) {
    return (
      <Button
        size="sm"
        variant="ghost"
        onClick={handleGenerate}
        disabled={loading}
        className="text-red-500"
      >
        <AlertCircle className="size-4" />
        Retry
      </Button>
    );
  }

  if (audioUrl) {
    return (
      <audio
        ref={audioRef}
        src={audioUrl}
        controls
        className="h-7 w-full max-w-[200px]"
      />
    );
  }

  return (
    <Button
      size="sm"
      variant="ghost"
      onClick={handleGenerate}
      disabled={loading}
      className="text-muted-foreground"
    >
      {loading ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <Play className="size-4" />
      )}
    </Button>
  );
}