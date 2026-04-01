"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import { ArrowLeft, User, Trophy, Swords, Flame, Check } from "lucide-react";
import { BetSlip } from "@/components/bet-slip";

type Props = {
  fight: any;
  userBets: Record<string, string>;
  userBalance: number;
};

function marketIcon(type: string) {
  switch (type) {
    case "winner":
      return <Trophy className="h-4 w-4 text-[#D4A017]" />;
    case "method":
      return <Swords className="h-4 w-4 text-[#D4A017]" />;
    case "has_submission":
      return <Flame className="h-4 w-4 text-[#D4A017]" />;
    default:
      return null;
  }
}

function marketLabel(type: string) {
  switch (type) {
    case "winner":
      return "Vencedor";
    case "method":
      return "Metodo de Vitoria";
    case "has_submission":
      return "Vai ter finalizacao?";
    default:
      return type;
  }
}

export function FightDetailClient({ fight, userBets, userBalance }: Props) {
  const [betSlipOpen, setBetSlipOpen] = useState(false);
  const [selectedOption, setSelectedOption] = useState<{
    id: string;
    label: string;
    marketId: string;
    odds: number;
  } | null>(null);

  const isFinished = fight.status === "finished";
  const fighterAIsWinner = isFinished && fight.winner_id === fight.fighter_a?.id;
  const fighterBIsWinner = isFinished && fight.winner_id === fight.fighter_b?.id;

  const openMarkets = (fight.markets ?? []).filter(
    (m: any) => m.status === "open" || m.status === "locked"
  );

  function handleBet(option: any, market: any) {
    const totalPool = market.market_options.reduce(
      (s: number, o: any) => s + Number(o.total_pool),
      0
    );
    const optionPool = Number(option.total_pool);
    const odds = totalPool > 0 && optionPool > 0 ? totalPool / optionPool : 2.0;

    setSelectedOption({
      id: option.id,
      label: option.label,
      marketId: market.id,
      odds,
    });
    setBetSlipOpen(true);
  }

  // Default open the winner accordion
  const defaultOpen = openMarkets.find((m: any) => m.type === "winner")?.id;

  return (
    <>
      <div className="space-y-5">
        {/* Back */}
        <Link
          href="/fights"
          className="inline-flex items-center gap-1 text-xs text-[#6B6B80] hover:text-[#F0F0F0]"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Voltar
        </Link>

        {/* Event info */}
        {fight.events && (
          <p className="text-[10px] text-[#6B6B80] text-center uppercase tracking-wider">
            {fight.events.name}
          </p>
        )}

        {/* Fighter matchup */}
        <div className="flex items-start justify-between py-2">
          {/* Fighter A */}
          <div
            className={`flex-1 text-center space-y-2 ${
              isFinished && !fighterAIsWinner ? "opacity-40" : ""
            }`}
          >
            <div
              className={`h-16 w-16 mx-auto rounded-full overflow-hidden border-2 ${
                fighterAIsWinner ? "border-[#7ED957]" : "border-[#D4A017]"
              } flex items-center justify-center`}
              style={{ background: "#1C1C28" }}
            >
              {fight.fighter_a?.photo_url ? (
                <Image
                  src={fight.fighter_a.photo_url}
                  alt={fight.fighter_a.name}
                  width={64}
                  height={64}
                  className="object-cover w-full h-full"
                />
              ) : (
                <User className="h-8 w-8 text-[#6B6B80]" />
              )}
            </div>
            <div>
              <p className="text-sm font-bold text-[#F0F0F0]">
                {fight.fighter_a?.name}
              </p>
              {fight.fighter_a?.nickname && (
                <p className="text-[10px] text-[#6B6B80] italic">
                  &quot;{fight.fighter_a.nickname}&quot;
                </p>
              )}
              {fight.fighter_a?.weight_kg && (
                <p className="text-[10px] text-[#9999AA]">
                  {fight.fighter_a.weight_kg}kg
                </p>
              )}
              {fighterAIsWinner && (
                <Badge className="bg-[#7ED957] text-[#0A0A0F] text-[9px] mt-1">
                  VENCEDOR
                </Badge>
              )}
            </div>
          </div>

          <div className="flex flex-col items-center justify-center px-2 pt-4">
            <span className="text-2xl font-bold text-[#D4A017]">VS</span>
            <span className="text-[9px] text-[#6B6B80]">
              Luta #{fight.fight_order}
            </span>
          </div>

          {/* Fighter B */}
          <div
            className={`flex-1 text-center space-y-2 ${
              isFinished && !fighterBIsWinner ? "opacity-40" : ""
            }`}
          >
            <div
              className={`h-16 w-16 mx-auto rounded-full overflow-hidden border-2 ${
                fighterBIsWinner ? "border-[#7ED957]" : "border-[#D4A017]"
              } flex items-center justify-center`}
              style={{ background: "#1C1C28" }}
            >
              {fight.fighter_b?.photo_url ? (
                <Image
                  src={fight.fighter_b.photo_url}
                  alt={fight.fighter_b.name}
                  width={64}
                  height={64}
                  className="object-cover w-full h-full"
                />
              ) : (
                <User className="h-8 w-8 text-[#6B6B80]" />
              )}
            </div>
            <div>
              <p className="text-sm font-bold text-[#F0F0F0]">
                {fight.fighter_b?.name}
              </p>
              {fight.fighter_b?.nickname && (
                <p className="text-[10px] text-[#6B6B80] italic">
                  &quot;{fight.fighter_b.nickname}&quot;
                </p>
              )}
              {fight.fighter_b?.weight_kg && (
                <p className="text-[10px] text-[#9999AA]">
                  {fight.fighter_b.weight_kg}kg
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

        {/* Result badge */}
        {isFinished && fight.result_method && (
          <div
            className="text-center py-2.5 rounded-lg border border-[#2A2A3A]"
            style={{ background: "#1C1C28" }}
          >
            <p className="text-xs text-[#D4A017] font-bold uppercase">
              Resultado:{" "}
              {fight.result_method === "submission"
                ? "Finalizacao"
                : fight.result_method === "points"
                ? "Pontos"
                : fight.result_method === "dq"
                ? "Desqualificacao"
                : fight.result_method === "draw"
                ? "Empate"
                : fight.result_method === "wo"
                ? "W.O."
                : fight.result_method}
            </p>
          </div>
        )}

        {/* Markets as Accordions */}
        {openMarkets.length > 0 ? (
          <Accordion defaultValue={[defaultOpen]} className="space-y-3">
            {openMarkets.map((market: any) => {
              const totalPool = market.market_options.reduce(
                (s: number, o: any) => s + Number(o.total_pool),
                0
              );
              const userBetOnThisMarket = userBets[market.id];
              const isLocked = market.status === "locked";

              return (
                <AccordionItem
                  key={market.id}
                  value={market.id}
                  className="rounded-xl border border-[#2A2A3A] overflow-hidden"
                  style={{ background: "#16161F" }}
                >
                  <AccordionTrigger className="px-4 py-3 hover:no-underline">
                    <div className="flex items-center gap-2 flex-1">
                      {marketIcon(market.type)}
                      <span className="text-sm font-semibold text-[#F0F0F0]">
                        {marketLabel(market.type)}
                      </span>
                    </div>
                    <span className="text-xs font-bold text-[#D4A017] mr-2">
                      R$ {totalPool.toFixed(2)}
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-4">
                    <div className="space-y-2">
                      {market.market_options.map((option: any) => {
                        const optPool = Number(option.total_pool);
                        const pct =
                          totalPool > 0 ? (optPool / totalPool) * 100 : 0;
                        const odds =
                          totalPool > 0 && optPool > 0
                            ? totalPool / optPool
                            : 0;
                        const isUserBet =
                          userBetOnThisMarket === option.id;

                        return (
                          <div
                            key={option.id}
                            className={`rounded-lg border p-3 ${
                              isUserBet
                                ? "border-[#7ED957] bg-[#7ED957]/10"
                                : "border-[#2A2A3A]"
                            }`}
                            style={
                              !isUserBet
                                ? { background: "#1C1C28" }
                                : undefined
                            }
                          >
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                {isUserBet && (
                                  <Check className="h-4 w-4 text-[#7ED957]" />
                                )}
                                <span className="text-sm font-medium text-[#F0F0F0]">
                                  {option.label}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-[#D4A017]">
                                  {odds > 0 ? odds.toFixed(2) : "--"}
                                </span>
                                {!isLocked &&
                                  !userBetOnThisMarket &&
                                  market.status === "open" && (
                                    <Button
                                      size="sm"
                                      onClick={() =>
                                        handleBet(option, market)
                                      }
                                      className="bg-[#7ED957] text-[#0A0A0F] hover:bg-[#7ED957]/90 text-xs h-7 font-bold"
                                    >
                                      Apostar
                                    </Button>
                                  )}
                              </div>
                            </div>
                            {/* Pool bar */}
                            <div
                              className="h-1.5 rounded-full overflow-hidden"
                              style={{ background: "#0A0A0F" }}
                            >
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: `${Math.max(pct, 2)}%`,
                                  background: isUserBet
                                    ? "#7ED957"
                                    : "#D4A017",
                                }}
                              />
                            </div>
                            <p className="text-[10px] text-[#6B6B80] mt-1">
                              {pct.toFixed(0)}% &bull; R${" "}
                              {optPool.toFixed(2)}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        ) : (
          <div
            className="text-center py-6 rounded-xl border border-[#2A2A3A]"
            style={{ background: "#16161F" }}
          >
            <p className="text-sm text-[#6B6B80]">
              Nenhum mercado de apostas disponivel.
            </p>
          </div>
        )}
      </div>

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
