"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard,
  Bot,
  Phone,
  Shield,
  Plus,
  MessageCircle,
} from "lucide-react";
import { SidebarMenu, SidebarMenuItem } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";

const navItems = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { title: "Agents", href: "/agents", icon: Bot },
  { title: "Conversations", href: "/conversations", icon: Phone },
  { title: "Validation", href: "/validation", icon: Shield },
];

const quickActions = [
  { title: "New Agent", href: "/agents/new", icon: Plus },
  { title: "Live Chat", href: "/conversations/live", icon: MessageCircle },
];

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <div className="space-y-4">
      {/* Main Nav */}
      <SidebarMenu>
        {navItems.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <SidebarMenuItem key={item.title}>
              <Link
                href={item.href}
                data-sidebar="menu-button"
                data-slot="sidebar-menu-button"
                className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-indigo-600/20 text-indigo-300 border-l-2 border-indigo-500"
                    : "text-white/60 hover:bg-white/5 hover:text-white"
                }`}
              >
                <item.icon className="size-4" />
                <span>{item.title}</span>
              </Link>
            </SidebarMenuItem>
          );
        })}
      </SidebarMenu>

      <Separator className="bg-white/5" />

      {/* Quick Actions */}
      <div>
        <p className="px-3 mb-2 text-xs font-medium text-white/30 uppercase tracking-wider">
          Quick Actions
        </p>
        <SidebarMenu>
          {quickActions.map((item) => {
            const isActive = pathname === item.href;
            return (
              <SidebarMenuItem key={item.title}>
                <Link
                  href={item.href}
                  className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-indigo-600/20 text-indigo-300"
                      : "text-white/60 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <item.icon className="size-4" />
                  <span>{item.title}</span>
                </Link>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </div>
    </div>
  );
}