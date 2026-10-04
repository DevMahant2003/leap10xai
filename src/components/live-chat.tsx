"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { AudioPlayer } from "@/components/audio-player";
import { toast } from "sonner";
import {
  Send,
  Mic,
  Loader2,
  PhoneOff,
  Bot,
  Volume2,
} from "lucide-react";
import type { Agent, TranscriptTurn } from "@/types";

export function LiveChat({
  agent,
  initialConversationId,
  initialTranscript,
}: {
  agent: Agent;
  initialConversationId?: string;
  initialTranscript?: TranscriptTurn[];
}) {
  const router = useRouter();
  const supabase = createClient();

  const [messages, setMessages] = useState<TranscriptTurn[]>(
    initialTranscript || []
  );
  const [input, setInput] = useState("");
  const [conversationId, setConversationId] = useState<string | null>(
    initialConversationId || null
  );
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [autoPlay, setAutoPlay] = useState(true);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<{
    start: () => void;
    stop: () => void;
  } | null>(null);
  const autoPlayRef = useRef(autoPlay);
  const audioPlaybackRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    autoPlayRef.current = autoPlay;
  }, [autoPlay]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // Voice input (Web Speech API)
  useEffect(() => {
    const SpeechRecognition =
      (window as unknown as { SpeechRecognition?: new () => unknown })
        .SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: new () => unknown })
        .webkitSpeechRecognition;

    if (SpeechRecognition) {
      const recognition = new SpeechRecognition() as {
        lang: string;
        continuous: boolean;
        interimResults: boolean;
        onresult: ((event: any) => void) | null;
        onend: (() => void) | null;
        onerror: (() => void) | null;
        start: () => void;
        stop: () => void;
      };

      recognition.lang = "en-US";
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript as string;
        setInput(transcript);
        setListening(false);
      };

      recognition.onend = () => setListening(false);
      recognition.onerror = () => setListening(false);

      recognitionRef.current = recognition;
    }

    return () => {
      recognitionRef.current?.stop();
    };
  }, []);

  const handleMicClick = () => {
    if (!recognitionRef.current) {
      toast.error("Voice input not supported in this browser");
      return;
    }

    if (listening) {
      recognitionRef.current.stop();
      setListening(false);
    } else {
      try {
        recognitionRef.current.start();
        setListening(true);
      } catch {
        toast.error("Could not access microphone");
      }
    }
  };

  const handleSend = useCallback(
    async (overrideText?: string) => {
      const text = (overrideText ?? input).trim();
      if (!text || loading) return;

      const turnNo = messages.length + 1;
      const userTurn: TranscriptTurn = {
        role: "customer",
        text,
        turn_no: turnNo,
      };
      setMessages((prev) => [...prev, userTurn]);
      setInput("");
      setLoading(true);

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            agentId: agent.id,
            conversationId,
            message: text,
          }),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Failed to get response");
        }

        const data = await res.json();
        setConversationId(data.conversationId);

        const agentTurn: TranscriptTurn = {
          role: "agent",
          text: data.reply,
          turn_no: turnNo + 1,
        };
        setMessages((prev) => [...prev, agentTurn]);

        // Auto-play agent voice
        if (autoPlayRef.current) {
          // Stop previous audio if playing
          if (audioPlaybackRef.current) {
            audioPlaybackRef.current.pause();
          }
          try {
            const ttsRes = await fetch("/api/tts", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                text: data.reply,
                voice: "Sasurji",
              }),
            });
            if (ttsRes.ok) {
              const blob = await ttsRes.blob();
              const url = URL.createObjectURL(blob);
              const audio = new Audio(url);
              audioPlaybackRef.current = audio;
              audio.onended = () => {
                URL.revokeObjectURL(url);
                audioPlaybackRef.current = null;
              };
              audio.play().catch(() => {});
            }
          } catch {
            // Silent fail — don't block chat
          }
        }
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Failed to get response"
        );
      } finally {
        setLoading(false);
      }
    },
    [input, loading, messages, agent.id, conversationId]
  );

  const handleEndSession = async () => {
    if (conversationId) {
      await supabase
        .from("conversations")
        .update({ status: "completed" })
        .eq("id", conversationId);

      router.push(`/conversations/${conversationId}`);
    } else {
      router.push("/conversations");
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Bot className="size-6" />
            <h1 className="text-2xl font-bold tracking-tight">
              {agent.name}
            </h1>
          </div>
          <p className="text-sm text-white/50 line-clamp-1">
            {agent.persona}
          </p>
        </div>
        <Button variant="destructive" size="sm" onClick={handleEndSession}>
          <PhoneOff className="size-4" />
          End Session
        </Button>
      </div>

      {/* Chat Area */}
      <Card className="glass-card border-white/5">
        <CardContent className="p-0">
          <div className="h-[500px] overflow-y-auto p-4 space-y-3">
            {messages.length === 0 && (
              <div className="text-center py-12">
                <Bot className="size-10 text-white/20 mx-auto mb-3" />
                <p className="text-sm text-white/50">
                  Start the conversation. Type or speak as the customer.
                </p>
              </div>
            )}

            {messages.map((turn) => {
              const isAgent = turn.role === "agent";
              return (
                <div
                  key={turn.turn_no}
                  className={`flex ${isAgent ? "justify-start" : "justify-end"}`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg border p-3 ${
                      isAgent
                        ? "bg-indigo-950/40 border-indigo-900/40"
                        : "bg-zinc-900/50 border-zinc-800"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Badge
                        variant={isAgent ? "default" : "secondary"}
                        className="text-xs"
                      >
                        {isAgent ? "AGENT" : "YOU"}
                      </Badge>
                      <span className="text-xs text-white/30">
                        Turn {turn.turn_no}
                      </span>
                      {isAgent && (
                        <div className="ml-auto">
                          <AudioPlayer text={turn.text} />
                        </div>
                      )}
                    </div>
                    <p className="text-sm leading-relaxed text-white/90">
                      {turn.text}
                    </p>
                  </div>
                </div>
              );
            })}

            {loading && (
              <div className="flex justify-start">
                <div className="rounded-lg border border-indigo-900/40 bg-indigo-950/40 p-3">
                  <div className="flex items-center gap-2 text-sm text-white/50">
                    <Loader2 className="size-4 animate-spin" />
                    Agent is responding...
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </CardContent>
      </Card>

      {/* Input Bar */}
      <div className="flex items-center gap-2">
        <Button
          size="icon"
          variant={listening ? "destructive" : "outline"}
          onClick={handleMicClick}
          disabled={loading}
          className="shrink-0 btn-ghost-dark"
        >
          <Mic className={`size-5 ${listening ? "animate-pulse" : ""}`} />
        </Button>

        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder={
            listening ? "Listening..." : "Type as the customer..."
          }
          disabled={loading}
          className="input-glass"
        />

        <Button
          onClick={() => handleSend()}
          disabled={loading || !input.trim()}
          className="shrink-0 btn-glow"
        >
          {loading ? (
            <Loader2 className="size-5 animate-spin" />
          ) : (
            <Send className="size-5" />
          )}
        </Button>
      </div>

      {/* Options */}
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-sm text-white/50 cursor-pointer">
          <input
            type="checkbox"
            checked={autoPlay}
            onChange={(e) => setAutoPlay(e.target.checked)}
            className="rounded accent-indigo-500"
          />
          <Volume2 className="size-4" />
          Auto-play agent voice
        </label>
        {listening && (
          <Badge variant="destructive" className="animate-pulse">
            ● Recording
          </Badge>
        )}
      </div>
    </div>
  );
}