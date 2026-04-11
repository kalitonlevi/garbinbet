import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { getActiveGame, getDailyWin } from "@/app/actions/mines";
import { MinesClient } from "./mines-client";

export default async function MinesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: wallet } = await supabase
    .from("wallets")
    .select("balance")
    .eq("user_id", user.id)
    .single();

  const balance = Number(wallet?.balance ?? 0);

  // Mines only shows to users with money on the table. If the user has
  // a game already running (somehow hit 0 balance mid-game), we still
  // let them finish it.
  const [activeGame, daily] = await Promise.all([
    getActiveGame(),
    getDailyWin(),
  ]);

  if (balance <= 0 && !activeGame) notFound();

  return (
    <MinesClient
      balance={balance}
      initialGame={activeGame}
      initialDaily={daily}
    />
  );
}
