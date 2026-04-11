import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ReportClient } from "./report-client";

export default async function ReportPage() {
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

  const { data: bets } = await supabase
    .from("bets")
    .select(
      `
      id,
      amount,
      potential_payout,
      settled_amount,
      status,
      created_at,
      market_option:market_options!option_id(label),
      market:markets!market_id(
        type,
        fight:fights!fight_id(
          fighter_a:fighters!fighter_a_id(name),
          fighter_b:fighters!fighter_b_id(name)
        )
      )
    `
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <ReportClient
      balance={Number(wallet?.balance ?? 0)}
      bets={(bets ?? []) as unknown as React.ComponentProps<typeof ReportClient>["bets"]}
    />
  );
}
