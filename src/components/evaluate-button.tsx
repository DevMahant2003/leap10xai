"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2, Sparkles, RefreshCw } from "lucide-react";

export function EvaluateButton({
  conversationId,
  label = "Run AI Evaluation",
  variant = "default",
  size = "lg",
  isReevaluate = false,
}: {
  conversationId: string;
  label?: string;
  variant?: "default" | "outline" | "ghost" | "destructive";
  size?: "default" | "sm" | "lg" | "icon";
  isReevaluate?: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleEvaluate = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Evaluation failed");
      }

      toast.success(
        isReevaluate ? "Re-evaluation complete!" : "Evaluation complete!"
      );
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Evaluation failed"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      onClick={handleEvaluate}
      disabled={loading}
      variant={variant}
      size={size}
      className="w-full sm:w-auto"
    >
      {loading ? (
        <>
          <Loader2 className="size-4 animate-spin" />
          Evaluating...
        </>
      ) : isReevaluate ? (
        <>
          <RefreshCw className="size-4" />
          Re-evaluate
        </>
      ) : (
        <>
          <Sparkles className="size-4" />
          {label}
        </>
      )}
    </Button>
  );
}