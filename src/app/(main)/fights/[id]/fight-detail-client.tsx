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
import { ArrowLeft, Flag, Trophy, Target, Check, Star } from "lucide-react";
import { BetSlip } from "@/components/bet-slip";

type Props = {
  fight: any;
  userBets: Record<string, string>;
  userBalance: number;
};

function marketIcon(type: string) {
  switch (type) {
    case "result":
      return <Trophy className="h-4 w-4 text-[#D4A017]" />;
    case "exact_score":
      return <Target className="h-4 w-4 text-[#D4A017]" />;
    case "special":
      return <Star className="h-4 w-4 text-purple-400" />;
    default:
      return null;
  }
}

function marketLabel(market: any) {
  switch (market.type) {
    case "result":
      return "Resultado";
    case "exact_score":
      return "Placar Exato";
    case "special":
      return market.label || "Mercado Especial";
    default:
      return market.type;
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
  const isDraw = isFinished && !fight.winner_id;
  const hasScore =
    fight.home_score !== null && fight.home_score !== undefined &&
    fight.away_score !== null && fight.away_score !== undefined;

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

  // Abre por padrão o mercado de Resultado
  const defaultOpen = openMarkets.find((m: any) => m.type === "result")?.id;

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

        {/* Confronto (seleções) */}
        <div className="flex items-start justify-between py-2">
          {/* Seleção A (mandante) */}
          <div
            className={`flex-1 text-center space-y-2 ${
              isFinished && !fighterAIsWinner && !isDraw ? "opacity-40" : ""
            }`}
          >
            <div
              className={`h-16 w-24 mx-auto rounded-md overflow-hidden border-2 ${
                fighterAIsWinner ? "border-[#7ED957]" : "border-[#2A2A3A]"
              } flex items-center justify-center`}
              style={{ background: "#1C1C28" }}
            >
              {fight.fighter_a?.photo_url ? (
                <Image
                  src={fight.fighter_a.photo_url}
                  alt={fight.fighter_a.name}
                  width={96}
                  height={64}
                  className="object-cover w-full h-full"
                />
              ) : (
                <Flag className="h-8 w-8 text-[#6B6B80]" />
              )}
            </div>
            <div>
              <p className="text-sm font-bold text-[#F0F0F0]">
                {fight.fighter_a?.name}
              </p>
              {fight.fighter_a?.fifa_code && (
                <p className="text-[10px] text-[#6B6B80] tracking-widest">
                  {fight.fighter_a.fifa_code}
                </p>
              )}
              {fighterAIsWinner && (
                <Badge className="bg-[#7ED957] text-[#0A0A0F] text-[9px] mt-1">
                  VENCEU
                </Badge>
              )}
            </div>
          </div>

          <div className="flex flex-col items-center justify-center px-2 pt-4">
            {isFinished && hasScore ? (
              <span className="text-3xl font-bold text-[#F5C542]">
                {fight.home_score}
                <span className="text-[#6B6B80] mx-1">x</span>
                {fight.away_score}
              </span>
            ) : (
              <span className="text-2xl font-bold text-[#D4A017]">VS</span>
            )}
            <span className="text-[9px] text-[#6B6B80]">
              Jogo {fight.fight_order}
            </span>
            {isDraw && (
              <Badge className="bg-[#6B6B80] text-[#0A0A0F] text-[9px] mt-1">
                EMPATE
              </Badge>
            )}
          </div>

          {/* Seleção B (adversário) */}
          <div
            className={`flex-1 text-center space-y-2 ${
              isFinished && !fighterBIsWinner && !isDraw ? "opacity-40" : ""
            }`}
          >
            <div
              className={`h-16 w-24 mx-auto rounded-md overflow-hidden border-2 ${
                fighterBIsWinner ? "border-[#7ED957]" : "border-[#2A2A3A]"
              } flex items-center justify-center`}
              style={{ background: "#1C1C28" }}
            >
              {fight.fighter_b?.photo_url ? (
                <Image
                  src={fight.fighter_b.photo_url}
                  alt={fight.fighter_b.name}
                  width={96}
                  height={64}
                  className="object-cover w-full h-full"
                />
              ) : (
                <Flag className="h-8 w-8 text-[#6B6B80]" />
              )}
            </div>
            <div>
              <p className="text-sm font-bold text-[#F0F0F0]">
                {fight.fighter_b?.name}
              </p>
              {fight.fighter_b?.fifa_code && (
                <p className="text-[10px] text-[#6B6B80] tracking-widest">
                  {fight.fighter_b.fifa_code}
                </p>
              )}
              {fighterBIsWinner && (
                <Badge className="bg-[#7ED957] text-[#0A0A0F] text-[9px] mt-1">
                  VENCEU
                </Badge>
              )}
            </div>
          </div>
        </div>

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
                        {marketLabel(market)}
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
              Nenhum mercado de apostas disponível.
            </p>
          </div>
        )}
      </div>

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
