"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Ticket, Trophy, XCircle, Clock, RotateCcw, Swords } from "lucide-react";

type Props = {
  bets: any[];
};

function marketTypeLabel(type: string) {
  switch (type) {
    case "winner":
      return "Vencedor";
    case "method":
      return "Método";
    case "has_submission":
      return "Finalização";
    default:
      return type;
  }
}

export function MyBetsClient({ bets }: Props) {
  const [tab, setTab] = useState<"active" | "settled">("active");

  const activeBets = bets.filter((b: any) => b.status === "pending");
  const settledBets = bets.filter((b: any) =>
    ["won", "lost", "refunded"].includes(b.status)
  );
  const currentBets = tab === "active" ? activeBets : settledBets;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <Ticket className="h-5 w-5 text-[#D4A017]" />
        <h1 className="font-heading text-2xl text-[#F0F0F0]">
          MINHAS APOSTAS
        </h1>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[#2A2A3A]">
        <button
          onClick={() => setTab("active")}
          className={`flex-1 pb-2.5 text-sm font-semibold transition-colors relative ${
            tab === "active" ? "text-[#F0F0F0]" : "text-[#6B6B80]"
          }`}
        >
          Ativas
          {activeBets.length > 0 && (
            <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] bg-[#7ED957] text-[#0A0A0F] font-bold">
              {activeBets.length}
            </span>
          )}
          {tab === "active" && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#7ED957]" />
          )}
        </button>
        <button
          onClick={() => setTab("settled")}
          className={`flex-1 pb-2.5 text-sm font-semibold transition-colors relative ${
            tab === "settled" ? "text-[#F0F0F0]" : "text-[#6B6B80]"
          }`}
        >
          Encerradas
          {tab === "settled" && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#7ED957]" />
          )}
        </button>
      </div>

      {/* Bets */}
      {currentBets.length === 0 ? (
        <div className="text-center py-12 space-y-3">
          <Swords className="h-10 w-10 mx-auto text-[#6B6B80] opacity-30" />
          {tab === "active" ? (
            <>
              <p className="text-sm text-[#6B6B80]">
                Ta com medo de apostar, faixa branca? 🥋
              </p>
              <Link href="/fights">
                <Button className="bg-[#7ED957] text-[#0A0A0F] font-bold mt-2">
                  Ver Lutas
                </Button>
              </Link>
            </>
          ) : (
            <p className="text-sm text-[#6B6B80]">
              Nenhuma aposta encerrada ainda.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {currentBets.map((bet: any) => (
            <BetCard key={bet.id} bet={bet} />
          ))}
        </div>
      )}
    </div>
  );
}

function BetCard({ bet }: { bet: any }) {
  const fightLabel = `${bet.market?.fight?.fighter_a?.name ?? "?"} vs ${bet.market?.fight?.fighter_b?.name ?? "?"}`;

  function borderColor() {
    switch (bet.status) {
      case "won":
        return "border-[#7ED957]";
      case "lost":
        return "border-[#FF4757]";
      case "refunded":
        return "border-[#6B6B80]";
      default:
        return "border-[#2A2A3A]";
    }
  }

  function StatusBadge() {
    switch (bet.status) {
      case "pending":
        return (
          <Badge
            variant="outline"
            className="border-[#F5C542] text-[#F5C542] text-[10px]"
          >
            <Clock className="h-3 w-3 mr-0.5" /> Ativa
          </Badge>
        );
      case "won":
        return (
          <Badge className="bg-[#7ED957] text-[#0A0A0F] text-[10px] font-bold">
            <Trophy className="h-3 w-3 mr-0.5" /> GANHOU 🏆
          </Badge>
        );
      case "lost":
        return (
          <Badge className="bg-[#FF4757] text-white text-[10px]">
            <XCircle className="h-3 w-3 mr-0.5" /> PERDEU
          </Badge>
        );
      case "refunded":
        return (
          <Badge
            variant="outline"
            className="border-[#6B6B80] text-[#6B6B80] text-[10px]"
          >
            <RotateCcw className="h-3 w-3 mr-0.5" /> REEMBOLSADO
          </Badge>
        );
      default:
        return null;
    }
  }

  return (
    <div
      className={`rounded-xl border ${borderColor()} overflow-hidden`}
      style={{ background: "#16161F" }}
    >
      <div className="px-4 py-3 space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-[#F0F0F0]">
              {fightLabel}
            </p>
            <p className="text-[10px] text-[#6B6B80]">
              {marketTypeLabel(bet.market?.type)}
            </p>
          </div>
          <StatusBadge />
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-[#2A2A3A]">
          <div>
            <p className="text-[10px] text-[#6B6B80]">Escolha</p>
            <p className="text-sm text-[#7ED957] font-semibold">
              {bet.market_option?.label ?? "\u2014"}
            </p>
          </div>
          <div className="text-center">
            <p className="text-[10px] text-[#6B6B80]">Apostou</p>
            <p className="text-sm font-bold text-[#D4A017]">
              R$ {Number(bet.amount).toFixed(2)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-[#6B6B80]">
              {bet.status === "won" ? "Ganhou" : "Retorno"}
            </p>
            <p
              className={`text-sm font-bold ${
                bet.status === "won"
                  ? "text-[#7ED957]"
                  : bet.status === "lost"
                  ? "text-[#6B6B80] line-through"
                  : "text-[#D4A017]"
              }`}
            >
              R${" "}
              {bet.status === "won"
                ? Number(bet.settled_amount).toFixed(2)
                : Number(bet.potential_payout ?? 0).toFixed(2)}
            </p>
          </div>
        </div>

        <p className="text-[10px] text-[#6B6B80]">
          {new Date(bet.created_at).toLocaleString("pt-BR")}
        </p>
      </div>
    </div>
  );
}
