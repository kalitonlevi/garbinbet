import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { MyBetsClient } from "./my-bets-client";

export default async function MyBetsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: bets } = await supabase
    .from("bets")
    .select(
      `
      *,
      market_option:market_options!option_id(label),
      market:markets!market_id(
        type,
        fight:fights!fight_id(
          fight_order,
          fighter_a:fighters!fighter_a_id(name),
          fighter_b:fighters!fighter_b_id(name)
        )
      )
    `
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return <MyBetsClient bets={bets ?? []} />;
}
