import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="bg-glow-top">
        <SiteHeader />
        <div className="flex-1 p-4 md:p-6 animate-fade-in">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}