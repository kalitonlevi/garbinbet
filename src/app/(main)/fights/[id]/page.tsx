import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { FightDetailClient } from "./fight-detail-client";

export default async function FightDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: fight } = await supabase
    .from("fights")
    .select(
      `*,
      fighter_a:fighters!fighter_a_id(id, name, nickname, weight_kg, photo_url),
      fighter_b:fighters!fighter_b_id(id, name, nickname, weight_kg, photo_url),
      markets(id, type, status, market_options(id, label, total_pool, is_winner)),
      events(name, date)`
    )
    .eq("id", id)
    .single();

  if (!fight) notFound();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: wallet } = await supabase
    .from("wallets")
    .select("balance")
    .eq("user_id", user!.id)
    .single();

  // Get user bets
  let userBets: Record<string, string> = {};
  if (user && fight.markets) {
    const marketIds = fight.markets.map((m: any) => m.id);
    if (marketIds.length > 0) {
      const { data: bets } = await supabase
        .from("bets")
        .select("market_id, option_id")
        .eq("user_id", user.id)
        .in("market_id", marketIds);
      if (bets) {
        userBets = Object.fromEntries(
          bets.map((b: any) => [b.market_id, b.option_id])
        );
      }
    }
  }

  return (
    <FightDetailClient
      fight={fight}
      userBets={userBets}
      userBalance={wallet?.balance ?? 0}
    />
  );
}
