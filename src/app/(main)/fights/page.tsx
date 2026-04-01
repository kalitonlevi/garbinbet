import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy } from "lucide-react";
import { FightCardClient } from "./fight-card-client";

export default async function FightsPage() {
  const supabase = await createClient();

  // Get active/upcoming event
  const { data: event } = await supabase
    .from("events")
    .select("*")
    .in("status", ["live", "upcoming"])
    .order("date", { ascending: true })
    .limit(1)
    .single();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: wallet } = await supabase
    .from("wallets")
    .select("balance")
    .eq("user_id", user!.id)
    .single();

  let fights: any[] = [];
  let userBets: Record<string, string> = {};

  if (event) {
    const { data } = await supabase
      .from("fights")
      .select(
        `*,
        fighter_a:fighters!fighter_a_id(id, name, nickname, weight_kg, photo_url),
        fighter_b:fighters!fighter_b_id(id, name, nickname, weight_kg, photo_url),
        markets(id, type, status, market_options(id, label, total_pool, is_winner))`
      )
      .eq("event_id", event.id)
      .order("fight_order", { ascending: true });

    fights = data ?? [];

    // Get user's existing bets for these markets
    if (user) {
      const marketIds = fights.flatMap(
        (f: any) => f.markets?.map((m: any) => m.id) ?? []
      );
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
  }

  return (
    <div className="space-y-5">
      {/* Event Header */}
      {event ? (
        <div className="text-center space-y-1">
          <div className="flex items-center justify-center gap-2">
            <Trophy className="h-4 w-4 text-[#D4A017]" />
            {event.status === "live" && (
              <Badge className="bg-[#FF4757] text-white text-[10px] animate-pulse">
                AO VIVO
              </Badge>
            )}
          </div>
          <h1 className="font-heading text-2xl text-[#D4A017] tracking-wide">
            {event.name}
          </h1>
          {event.date && (
            <p className="text-xs text-[#6B6B80]">
              {new Date(event.date + "T12:00:00").toLocaleDateString("pt-BR", {
                day: "2-digit",
                month: "long",
                year: "numeric",
              })}
            </p>
          )}
        </div>
      ) : (
        <div className="text-center space-y-3 py-12">
          <Trophy className="h-12 w-12 mx-auto text-[#D4A017] opacity-20" />
          <p className="text-sm text-[#9999AA]">
            Nenhum evento ativo no momento.
          </p>
          <p className="text-xs text-[#6B6B80]">
            Fique de olho no grupo do WhatsApp! 🥋
          </p>
        </div>
      )}

      {/* Fight Cards */}
      {fights.length > 0 && (
        <div className="space-y-4">
          {fights.map((fight: any, i: number) => (
            <div key={fight.id} className={`animate-fade-in stagger-${Math.min(i + 1, 6)}`}>
              <FightCardClient
                fight={fight}
                userBets={userBets}
                userBalance={wallet?.balance ?? 0}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
