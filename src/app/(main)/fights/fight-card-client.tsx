"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Flag, Check } from "lucide-react";
import { BetSlip } from "@/components/bet-slip";

type FightCardClientProps = {
  fight: any;
  userBets: Record<string, string>;
  userBalance: number;
};

export function FightCardClient({
  fight,
  userBets,
  userBalance,
}: FightCardClientProps) {
  const [betSlipOpen, setBetSlipOpen] = useState(false);
  const [selectedOption, setSelectedOption] = useState<{
    id: string;
    label: string;
    marketId: string;
    odds: number;
  } | null>(null);

  // Mercado de Resultado (1X2): Vitória do Brasil / Empate / Vitória do adversário
  const resultMarket = fight.markets?.find((m: any) => m.type === "result");
  const resultOptions = resultMarket?.market_options ?? [];
  const totalPool = resultOptions.reduce(
    (s: number, o: any) => s + Number(o.total_pool),
    0
  );

  const isOpen = fight.status === "open";
  const isFinished = fight.status === "finished";
  const isLocked = fight.status === "locked";
  const userBetOnResult = resultMarket ? userBets[resultMarket.id] : null;

  function getOdds(option: any) {
    if (totalPool <= 0 || Number(option.total_pool) <= 0) return 0;
    return totalPool / Number(option.total_pool);
  }

  function handleOddsTap(option: any) {
    if (!isOpen || userBetOnResult) return;
    setSelectedOption({
      id: option.id,
      label: option.label,
      marketId: resultMarket.id,
      odds: getOdds(option) || 2.0,
    });
    setBetSlipOpen(true);
  }

  function StatusBadge() {
    if (isOpen) {
      return (
        <Badge className="bg-[#7ED957] text-[#0A0A0F] text-[10px] font-bold animate-pulse">
          Apostas Abertas
        </Badge>
      );
    }
    if (isLocked) {
      return (
        <Badge className="bg-[#D4A017] text-[#0A0A0F] text-[10px] font-bold">
          Em jogo
        </Badge>
      );
    }
    if (isFinished) {
      return (
        <Badge
          variant="outline"
          className="border-[#6B6B80] text-[#6B6B80] text-[10px]"
        >
          Encerrado
        </Badge>
      );
    }
    return (
      <Badge
        variant="outline"
        className="border-[#6B6B80] text-[#6B6B80] text-[10px]"
      >
        Em breve
      </Badge>
    );
  }

  const teamAWon = isFinished && fight.winner_id === fight.fighter_a?.id;
  const teamBWon = isFinished && fight.winner_id === fight.fighter_b?.id;
  const isDraw = isFinished && !fight.winner_id;
  const hasScore =
    fight.home_score !== null && fight.home_score !== undefined &&
    fight.away_score !== null && fight.away_score !== undefined;

  function TeamCrest({ team }: { team: any }) {
    return (
      <div
        className="h-12 w-16 mx-auto rounded-md overflow-hidden border border-[#2A2A3A] flex items-center justify-center"
        style={{ background: "#1C1C28" }}
      >
        {team?.photo_url ? (
          <Image
            src={team.photo_url}
            alt={team.name}
            width={64}
            height={48}
            className="object-cover w-full h-full"
          />
        ) : (
          <Flag className="h-6 w-6 text-[#6B6B80]" />
        )}
      </div>
    );
  }

  return (
    <>
      <Link href={`/fights/${fight.id}`}>
        <div
          className="rounded-xl border border-[#2A2A3A] overflow-hidden transition-colors hover:border-[#7ED957]/30"
          style={{ background: "#16161F" }}
        >
          {/* Top bar */}
          <div
            className="flex items-center justify-between px-4 py-2"
            style={{ background: "#1C1C28" }}
          >
            {fight.fight_order != null && (
              <Badge className="bg-[#D4A017] text-[#0A0A0F] text-[10px] font-bold px-2 py-0.5">
                Jogo {fight.fight_order}
              </Badge>
            )}
            <StatusBadge />
          </div>

          {/* Teams */}
          <div className="px-4 py-4">
            <div className="flex items-center justify-between">
              {/* Team A */}
              <div
                className={`flex-1 text-center space-y-2 ${
                  isFinished && !teamAWon && !isDraw ? "opacity-40" : ""
                }`}
              >
                <TeamCrest team={fight.fighter_a} />
                <div>
                  <p className="text-sm font-bold text-[#F0F0F0] leading-tight">
                    {fight.fighter_a?.name}
                  </p>
                  {teamAWon && (
                    <Badge className="bg-[#7ED957] text-[#0A0A0F] text-[9px] mt-1">
                      VENCEU
                    </Badge>
                  )}
                </div>
              </div>

              {/* Center: VS ou placar */}
              <div className="px-3 flex flex-col items-center">
                {isFinished && hasScore ? (
                  <span className="text-2xl font-bold text-[#F5C542]">
                    {fight.home_score}
                    <span className="text-[#6B6B80] mx-1">x</span>
                    {fight.away_score}
                  </span>
                ) : (
                  <span className="text-lg font-bold text-[#D4A017]">VS</span>
                )}
                {isDraw && (
                  <Badge className="bg-[#6B6B80] text-[#0A0A0F] text-[9px] mt-1">
                    EMPATE
                  </Badge>
                )}
              </div>

              {/* Team B */}
              <div
                className={`flex-1 text-center space-y-2 ${
                  isFinished && !teamBWon && !isDraw ? "opacity-40" : ""
                }`}
              >
                <TeamCrest team={fight.fighter_b} />
                <div>
                  <p className="text-sm font-bold text-[#F0F0F0] leading-tight">
                    {fight.fighter_b?.name}
                  </p>
                  {teamBWon && (
                    <Badge className="bg-[#7ED957] text-[#0A0A0F] text-[9px] mt-1">
                      VENCEU
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            {/* Botões de odds do Resultado (só quando aberto) */}
            {isOpen && resultOptions.length >= 2 && (
              <div className="mt-4 grid grid-cols-3 gap-2">
                {resultOptions.map((option: any) => {
                  const odds = getOdds(option);
                  const isUserBet = userBetOnResult === option.id;
                  return (
                    <button
                      key={option.id}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleOddsTap(option);
                      }}
                      disabled={!!userBetOnResult}
                      className={`py-3 px-2 rounded-lg border text-center transition-all tap-scale ${
                        isUserBet
                          ? "bg-[#7ED957]/15 border-[#7ED957]"
                          : "bg-[#1C1C28] border-[#D4A017]/20 hover:bg-[#7ED957] hover:text-[#0A0A0F] hover:border-[#7ED957]"
                      } ${userBetOnResult && !isUserBet ? "opacity-40" : ""}`}
                    >
                      <p className="text-[10px] text-[#9999AA] truncate">
                        {option.label}
                      </p>
                      <p className="text-base font-bold text-[#F5C542]">
                        {isUserBet ? (
                          <span className="flex items-center justify-center gap-1 text-[#7ED957]">
                            <Check className="h-4 w-4" />
                          </span>
                        ) : odds > 0 ? (
                          odds.toFixed(2)
                        ) : (
                          "--"
                        )}
                      </p>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </Link>

      {/* Bet Slip */}
      {selectedOption && (
        <BetSlip
          open={betSlipOpen}
          onOpenChange={setBetSlipOpen}
          fightLabel={`${fight.fighter_a?.name} x ${fight.fighter_b?.name}`}
          optionLabel={selectedOption.label}
          optionId={selectedOption.id}
          marketId={selectedOption.marketId}
          odds={selectedOption.odds}
          userBalance={userBalance}
        />
      )}
    </>
  );
}
