"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { MessageCircle, ChevronRight } from "lucide-react";

const PAGE_NAMES: Record<string, string> = {
  dashboard: "Dashboard",
  agents: "Agents",
  new: "New",
  edit: "Edit",
  conversations: "Conversations",
  live: "Live Chat",
  validation: "Validation",
  consistency: "Consistency",
  "test-suite": "Test Suite",
  "add-human-eval": "Human Eval",
  comparison: "Comparison",
};

export function SiteHeader() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  return (
    <header className="flex h-14 items-center gap-3 border-b border-white/5 glass-panel px-4">
      <SidebarTrigger />

      {/* Breadcrumbs */}
      <nav className="flex items-center gap-1 text-sm">
        {segments.map((segment, i) => {
          const href = "/" + segments.slice(0, i + 1).join("/");
          const isLast = i === segments.length - 1;
          const name = PAGE_NAMES[segment] || segment;

          return (
            <span key={href} className="flex items-center gap-1">
              {i > 0 && (
                <ChevronRight className="size-3 text-white/20" />
              )}
              {isLast ? (
                <span className="text-white/90 font-medium">{name}</span>
              ) : (
                <Link
                  href={href}
                  className="text-white/40 hover:text-white/70 transition"
                >
                  {name}
                </Link>
              )}
            </span>
          );
        })}
      </nav>

      <div className="flex-1" />

      {/* Quick Live Chat button */}
      <Link href="/conversations/live">
        <Button size="sm" variant="outline" className="btn-ghost-dark">
          <MessageCircle className="size-4" />
          <span className="hidden sm:inline">Live Chat</span>
        </Button>
      </Link>
    </header>
  );
}