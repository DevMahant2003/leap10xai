"use client";

import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Bot, MessageCircle, ArrowRight } from "lucide-react";

type AgentOption = {
  id: string;
  name: string;
  persona: string;
  goal: string;
};

export function LiveChatPicker({ agents }: { agents: AgentOption[] }) {
  const router = useRouter();

  if (agents.length === 0) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Live Chat</h1>
          <p className="text-white/50">Start a real-time conversation with an AI agent</p>
        </div>
        <Card className="glass-card border-white/5">
          <CardContent className="py-16 text-center">
            <Bot className="size-12 text-white/20 mx-auto mb-4" />
            <h3 className="font-semibold mb-1">No agents yet</h3>
            <p className="text-sm text-white/50 mb-4">
              Create an agent first, then come back to chat with it.
            </p>
            <button
              onClick={() => router.push("/agents/new")}
              className="text-sm text-indigo-400 hover:text-indigo-300"
            >
              Create an agent →
            </button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Start a Live Chat</h1>
        <p className="text-white/50">
            Pick an agent to start a real-time conversation. You play the customer, the AI plays the agent.
          </p>
      </div>

      <div className="grid gap-3">
        {agents.map((agent) => (
          <button
            key={agent.id}
            onClick={() => router.push(`/conversations/live?agentId=${agent.id}`)}
            className="group"
          >
            <Card className="glass-card border-white/5 hover:border-indigo-700/50 transition-all cursor-pointer">
              <CardContent className="flex items-center gap-4 p-4">
                <div className="flex items-center justify-center size-12 rounded-full bg-indigo-950/50 border border-indigo-900/40 shrink-0">
                  <Bot className="size-6 text-indigo-400" />
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">{agent.name}</h3>
                    <Badge variant="outline" className="text-xs">
                      <MessageCircle className="size-3 mr-1" />
                      Ready
                    </Badge>
                  </div>
                  <p className="text-sm text-white/50 line-clamp-1 mt-1">
                    {agent.persona}
                  </p>
                </div>
                <ArrowRight className="size-5 text-white/20 group-hover:text-indigo-400 group-hover:translate-x-1 transition-all shrink-0" />
              </CardContent>
            </Card>
          </button>
        ))}
      </div>
    </div>
  );
}