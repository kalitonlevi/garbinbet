import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { BottomNav } from "@/components/bottom-nav";
import { MainTopBar } from "./top-bar";
import { WelcomeDialog } from "@/components/welcome-dialog";

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  let user = null;
  try {
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch {
    redirect("/login");
  }

  if (!user) redirect("/login");

  let profile = null;
  let wallet = null;
  try {
    const { data: profileData } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();
    profile = profileData;

    const { data: walletData } = await supabase
      .from("wallets")
      .select("*")
      .eq("user_id", user.id)
      .single();
    wallet = walletData;
  } catch {
    redirect("/login");
  }

  if (!profile) redirect("/login");

  return (
    <div className="flex flex-col min-h-screen" style={{ background: "#0A0A0F" }}>
      <MainTopBar profile={profile} balance={wallet?.balance ?? 0} />
      {/* Spacer for fixed header */}
      <div className="h-14" />
      <main className="flex-1 w-full max-w-[480px] mx-auto px-4 py-4 pb-24">
        {children}
      </main>
      <BottomNav isAdmin={profile?.role === "admin"} />
      <WelcomeDialog />
    </div>
  );
}
