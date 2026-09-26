import { AUTH_DISABLED, createClient } from "@/app/lib/supabase/server";
import { redirect } from "next/navigation";
import { Sidebar } from "@/app/components/sidebar";
import { CommandPalette } from "@/app/components/command-palette";
import { CairnCopilot } from "@/components/CairnCopilot";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = AUTH_DISABLED
    ? { data: { user: null } }
    : await supabase.auth.getUser();
  if (!user && !AUTH_DISABLED) redirect("/login");

  const { data: profile } = user
    ? await supabase.from("profiles").select("full_name, role").eq("id", user.id).single()
    : { data: null };

  return (
    <div className="flex h-screen bg-dark-bg">
      <Sidebar
        userName={profile?.full_name || user?.email || "Dev User"}
        userEmail={user?.email || undefined}
      />
      <main className="flex-1 overflow-auto">
        <div className="mx-auto max-w-7xl px-6 py-8">{children}</div>
      </main>
      {/* The Cairn assistant lives inside the app only: this layout redirects to /login first. */}
      <CommandPalette />
      <CairnCopilot />
    </div>
  );
}
