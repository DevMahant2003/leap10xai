"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Trash2, Loader2 } from "lucide-react";

type DeleteTable =
  | "agents"
  | "conversations"
  | "evaluations"
  | "human_evaluations";

export function DeleteButton({
  table,
  id,
  label = "Delete",
  redirectAfter,
  variant = "outline",
  size = "sm",
}: {
  table: DeleteTable;
  id: string;
  label?: string;
  redirectAfter?: string;
  variant?: "default" | "outline" | "ghost" | "destructive";
  size?: "default" | "sm" | "lg" | "icon";
}) {
  const router = useRouter();
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    setLoading(true);
    const { error } = await supabase.from(table).delete().eq("id", id);

    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }

    toast.success("Deleted");
    setOpen(false);
    if (redirectAfter) {
      router.push(redirectAfter);
    }
    router.refresh();
  };

  return (
    <>
      <Button
        variant={variant}
        size={size}
        onClick={() => setOpen(true)}
      >
        <Trash2 className="size-4" />
        {label}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Delete</DialogTitle>
            <DialogDescription>
              Are you sure? This action cannot be undone.
              {table === "agents" &&
                " All conversations and evaluations for this agent will also be deleted."}
              {table === "conversations" &&
                " All evaluations for this conversation will also be deleted."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}