import { createClient } from "@/lib/supabase/server";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
} from "@/components/ui/sidebar";
import { NavUser } from "@/components/nav-user";
import { SidebarNav } from "@/components/sidebar-nav";

export async function AppSidebar() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const userMeta = user?.user_metadata as
    | { full_name?: string; email?: string }
    | undefined;

  const userData = {
    name: userMeta?.full_name || user?.email?.split("@")[0] || "User",
    email: user?.email || "",
    avatar:
      (userMeta?.full_name?.[0] || user?.email?.[0] || "U").toUpperCase(),
  };

  return (
    <Sidebar>
            <SidebarHeader>
        <div className="px-3 py-3">
          <span className="text-xl font-bold text-gradient tracking-tight">
            LEAP10XAI
          </span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Platform</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarNav />
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={userData} />
      </SidebarFooter>
    </Sidebar>
  );
}