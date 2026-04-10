"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { User, Check } from "lucide-react";
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

  const winnerMarket = fight.markets?.find((m: any) => m.type === "winner");
  const winnerOptions = winnerMarket?.market_options ?? [];
  const totalPool = winnerOptions.reduce(
    (s: number, o: any) => s + Number(o.total_pool),
    0
  );

  const isOpen = fight.status === "open";
  const isFinished = fight.status === "finished";
  const isLocked = fight.status === "locked";
  const userBetOnWinner = winnerMarket ? userBets[winnerMarket.id] : null;

  function getOdds(option: any) {
    if (totalPool <= 0 || Number(option.total_pool) <= 0) return 0;
    return totalPool / Number(option.total_pool);
  }

  function handleOddsTap(option: any) {
    if (!isOpen || userBetOnWinner) return;
    setSelectedOption({
      id: option.id,
      label: option.label,
      marketId: winnerMarket.id,
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
          Travada
        </Badge>
      );
    }
    if (isFinished) {
      const method = fight.result_method
        ? fight.result_method.charAt(0).toUpperCase() +
          fight.result_method.slice(1)
        : "";
      return (
        <Badge
          variant="outline"
          className="border-[#6B6B80] text-[#6B6B80] text-[10px]"
        >
          Finalizada {method ? `- ${method}` : ""}
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

  const fighterAIsWinner = isFinished && fight.winner_id === fight.fighter_a?.id;
  const fighterBIsWinner = isFinished && fight.winner_id === fight.fighter_b?.id;

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
                #{fight.fight_order}
              </Badge>
            )}
            <StatusBadge />
          </div>

          {/* Fighters */}
          <div className="px-4 py-4">
            <div className="flex items-center justify-between">
              {/* Fighter A */}
              <div
                className={`flex-1 text-center space-y-2 ${
                  isFinished && !fighterAIsWinner ? "opacity-40" : ""
                }`}
              >
                <div
                  className={`h-12 w-12 mx-auto rounded-full overflow-hidden border-2 ${
                    fighterAIsWinner
                      ? "border-[#7ED957]"
                      : "border-[#D4A017]"
                  } flex items-center justify-center`}
                  style={{ background: "#1C1C28" }}
                >
                  {fight.fighter_a?.photo_url ? (
                    <Image
                      src={fight.fighter_a.photo_url}
                      alt={fight.fighter_a.name}
                      width={48}
                      height={48}
                      className="object-cover w-full h-full"
                    />
                  ) : (
                    <User className="h-6 w-6 text-[#6B6B80]" />
                  )}
                </div>
                <div>
                  <p className="text-sm font-bold text-[#F0F0F0] leading-tight">
                    {fight.fighter_a?.name}
                  </p>
                  {fight.fighter_a?.nickname && (
                    <p className="text-[10px] text-[#6B6B80] italic">
                      &quot;{fight.fighter_a.nickname}&quot;
                    </p>
                  )}
                  {fighterAIsWinner && (
                    <Badge className="bg-[#7ED957] text-[#0A0A0F] text-[9px] mt-1">
                      VENCEDOR
                    </Badge>
                  )}
                </div>
              </div>

              {/* VS */}
              <div className="px-3 flex flex-col items-center">
                <span className="text-lg font-bold text-[#D4A017]">VS</span>
              </div>

              {/* Fighter B */}
              <div
                className={`flex-1 text-center space-y-2 ${
                  isFinished && !fighterBIsWinner ? "opacity-40" : ""
                }`}
              >
                <div
                  className={`h-12 w-12 mx-auto rounded-full overflow-hidden border-2 ${
                    fighterBIsWinner
                      ? "border-[#7ED957]"
                      : "border-[#D4A017]"
                  } flex items-center justify-center`}
                  style={{ background: "#1C1C28" }}
                >
                  {fight.fighter_b?.photo_url ? (
                    <Image
                      src={fight.fighter_b.photo_url}
                      alt={fight.fighter_b.name}
                      width={48}
                      height={48}
                      className="object-cover w-full h-full"
                    />
                  ) : (
                    <User className="h-6 w-6 text-[#6B6B80]" />
                  )}
                </div>
                <div>
                  <p className="text-sm font-bold text-[#F0F0F0] leading-tight">
                    {fight.fighter_b?.name}
                  </p>
                  {fight.fighter_b?.nickname && (
                    <p className="text-[10px] text-[#6B6B80] italic">
                      &quot;{fight.fighter_b.nickname}&quot;
                    </p>
                  )}
                  {fighterBIsWinner && (
                    <Badge className="bg-[#7ED957] text-[#0A0A0F] text-[9px] mt-1">
                      VENCEDOR
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            {/* Odds buttons (only when open) */}
            {isOpen && winnerOptions.length >= 2 && (
              <div className="mt-4 grid grid-cols-2 gap-2">
                {winnerOptions
                  .filter((o: any) => o.label !== "Empate")
                  .sort((a: any, b: any) => {
                    const aIsA = a.label === fight.fighter_a?.name;
                    const bIsA = b.label === fight.fighter_a?.name;
                    return aIsA ? -1 : bIsA ? 1 : 0;
                  })
                  .map((option: any) => {
                    const odds = getOdds(option);
                    const isUserBet = userBetOnWinner === option.id;
                    return (
                      <button
                        key={option.id}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleOddsTap(option);
                        }}
                        disabled={!!userBetOnWinner}
                        className={`py-3 px-2 rounded-lg border text-center transition-all tap-scale ${
                          isUserBet
                            ? "bg-[#7ED957]/15 border-[#7ED957]"
                            : "bg-[#1C1C28] border-[#D4A017]/20 hover:bg-[#7ED957] hover:text-[#0A0A0F] hover:border-[#7ED957]"
                        } ${userBetOnWinner && !isUserBet ? "opacity-40" : ""}`}
                      >
                        <p className="text-[10px] text-[#9999AA] truncate">
                          {option.label}
                        </p>
                        <p className="text-lg font-bold text-[#F5C542]">
                          {isUserBet ? (
                            <span className="flex items-center justify-center gap-1 text-[#7ED957]">
                              <Check className="h-4 w-4" /> Apostou
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
          fightLabel={`${fight.fighter_a?.name} vs ${fight.fighter_b?.name}`}
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
