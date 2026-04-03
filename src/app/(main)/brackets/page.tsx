import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, User } from "lucide-react";
import Image from "next/image";

export default async function BracketsPage() {
  const supabase = await createClient();

  // Get active/upcoming event
  const { data: event } = await supabase
    .from("events")
    .select("*")
    .in("status", ["live", "upcoming"])
    .order("date", { ascending: true })
    .limit(1)
    .single();

  let fights: any[] = [];

  if (event) {
    const { data } = await supabase
      .from("fights")
      .select(
        `*,
        fighter_a:fighters!fighter_a_id(id, name, nickname, photo_url),
        fighter_b:fighters!fighter_b_id(id, name, nickname, photo_url)`
      )
      .eq("event_id", event.id)
      .order("fight_order", { ascending: true });

    fights = data ?? [];
  }

  const statusLabel: Record<string, { text: string; cls: string }> = {
    upcoming: { text: "Em breve", cls: "border-[#6B6B80] text-[#6B6B80]" },
    open: { text: "Aberta", cls: "bg-[#7ED957] text-[#0A0A0F]" },
    locked: { text: "Travada", cls: "bg-[#D4A017] text-[#0A0A0F]" },
    finished: { text: "Finalizada", cls: "border-[#6B6B80] text-[#6B6B80]" },
    cancelled: { text: "Cancelada", cls: "border-[#FF4757] text-[#FF4757]" },
  };

  return (
    <div className="space-y-5">
      {event ? (
        <>
          <div className="text-center space-y-1">
            <Trophy className="h-5 w-5 text-[#D4A017] mx-auto" />
            <h1 className="font-heading text-2xl text-[#D4A017] tracking-wide">
              CHAVEAMENTO
            </h1>
            <p className="text-sm text-[#9999AA]">{event.name}</p>
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

          {fights.length === 0 ? (
            <Card className="border-[#2A2A3A]" style={{ background: "#16161F" }}>
              <CardContent className="py-8 text-center text-[#6B6B80]">
                Lutas ainda n&atilde;o foram definidas.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {fights.map((fight: any, i: number) => {
                const status = statusLabel[fight.status] ?? statusLabel.upcoming;
                const aWon = fight.status === "finished" && fight.winner_id === fight.fighter_a?.id;
                const bWon = fight.status === "finished" && fight.winner_id === fight.fighter_b?.id;

                return (
                  <div
                    key={fight.id}
                    className={`rounded-xl border border-[#2A2A3A] overflow-hidden animate-fade-in stagger-${Math.min(i + 1, 6)}`}
                    style={{ background: "#16161F" }}
                  >
                    {/* Header */}
                    <div
                      className="flex items-center justify-between px-4 py-2"
                      style={{ background: "#1C1C28" }}
                    >
                      <span className="text-xs font-bold text-[#D4A017]">
                        LUTA {fight.fight_order ?? i + 1}
                      </span>
                      <Badge
                        variant={status.cls.startsWith("bg-") ? "default" : "outline"}
                        className={`text-[10px] font-bold ${status.cls}`}
                      >
                        {status.text}
                      </Badge>
                    </div>

                    {/* Matchup */}
                    <div className="flex items-center px-4 py-4">
                      {/* Fighter A */}
                      <div className={`flex-1 flex items-center gap-3 ${fight.status === "finished" && !aWon ? "opacity-40" : ""}`}>
                        <div
                          className={`h-11 w-11 rounded-full overflow-hidden border-2 flex-shrink-0 flex items-center justify-center ${
                            aWon ? "border-[#7ED957]" : "border-[#D4A017]"
                          }`}
                          style={{ background: "#1C1C28" }}
                        >
                          {fight.fighter_a?.photo_url ? (
                            <Image
                              src={fight.fighter_a.photo_url}
                              alt={fight.fighter_a.name}
                              width={44}
                              height={44}
                              className="object-cover w-full h-full"
                            />
                          ) : (
                            <User className="h-5 w-5 text-[#6B6B80]" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-[#F0F0F0] truncate">
                            {fight.fighter_a?.name}
                          </p>
                          {fight.fighter_a?.nickname && (
                            <p className="text-[10px] text-[#6B6B80] italic truncate">
                              &quot;{fight.fighter_a.nickname}&quot;
                            </p>
                          )}
                          {aWon && (
                            <Badge className="bg-[#7ED957] text-[#0A0A0F] text-[9px] mt-0.5">
                              VENCEDOR
                            </Badge>
                          )}
                        </div>
                      </div>

                      {/* VS */}
                      <span className="text-base font-bold text-[#D4A017] px-2 flex-shrink-0">
                        VS
                      </span>

                      {/* Fighter B */}
                      <div className={`flex-1 flex items-center gap-3 flex-row-reverse ${fight.status === "finished" && !bWon ? "opacity-40" : ""}`}>
                        <div
                          className={`h-11 w-11 rounded-full overflow-hidden border-2 flex-shrink-0 flex items-center justify-center ${
                            bWon ? "border-[#7ED957]" : "border-[#D4A017]"
                          }`}
                          style={{ background: "#1C1C28" }}
                        >
                          {fight.fighter_b?.photo_url ? (
                            <Image
                              src={fight.fighter_b.photo_url}
                              alt={fight.fighter_b.name}
                              width={44}
                              height={44}
                              className="object-cover w-full h-full"
                            />
                          ) : (
                            <User className="h-5 w-5 text-[#6B6B80]" />
                          )}
                        </div>
                        <div className="min-w-0 text-right">
                          <p className="text-sm font-bold text-[#F0F0F0] truncate">
                            {fight.fighter_b?.name}
                          </p>
                          {fight.fighter_b?.nickname && (
                            <p className="text-[10px] text-[#6B6B80] italic truncate">
                              &quot;{fight.fighter_b.nickname}&quot;
                            </p>
                          )}
                          {bWon && (
                            <Badge className="bg-[#7ED957] text-[#0A0A0F] text-[9px] mt-0.5">
                              VENCEDOR
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Result method */}
                    {fight.status === "finished" && fight.result_method && (
                      <div className="px-4 pb-3">
                        <p className="text-[10px] text-[#6B6B80] text-center">
                          Resultado: {fight.result_method.charAt(0).toUpperCase() + fight.result_method.slice(1)}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      ) : (
        <div className="text-center space-y-3 py-12">
          <Trophy className="h-12 w-12 mx-auto text-[#D4A017] opacity-20" />
          <h1 className="font-heading text-2xl text-[#D4A017] tracking-wide">
            CHAVEAMENTO
          </h1>
          <p className="text-sm text-[#9999AA]">
            Nenhum evento ativo no momento.
          </p>
        </div>
      )}
    </div>
  );
}
