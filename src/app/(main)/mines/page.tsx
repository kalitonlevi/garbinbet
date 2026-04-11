import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { getActiveGame } from "@/app/actions/mines";
import { MinesClient } from "./mines-client";

export default async function MinesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Mines is admin-only — hide the route from regular users.
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin") notFound();

  const { data: wallet } = await supabase
    .from("wallets")
    .select("balance")
    .eq("user_id", user.id)
    .single();

  const activeGame = await getActiveGame();

  return (
    <MinesClient
      balance={Number(wallet?.balance ?? 0)}
      initialGame={activeGame}
    />
  );
}
