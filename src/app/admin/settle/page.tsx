"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import Image from "next/image";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Target,
  Loader2,
  CheckCircle,
  Ban,
  Swords,
  User,
} from "lucide-react";

type MarketOption = {
  id: string;
  label: string;
  total_pool: number;
  is_winner: boolean;
};

type MarketData = {
  id: string;
  type: string;
  status: string;
  market_options: MarketOption[];
};

type FightToSettle = {
  id: string;
  fight_order: number | null;
  status: string;
  fighter_a: { id: string; name: string; nickname: string | null; photo_url: string | null };
  fighter_b: { id: string; name: string; nickname: string | null; photo_url: string | null };
  events: { name: string } | null;
  markets: MarketData[];
};

function marketTypeLabel(type: string) {
  switch (type) {
    case "winner":
      return "Vencedor";
    case "method":
      return "Método de Vitória";
    case "has_submission":
      return "Vai ter finalização?";
    default:
      return type;
  }
}

export default function AdminSettlePage() {
  const [fights, setFights] = useState<FightToSettle[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [selections, setSelections] = useState<Record<string, string>>({});
  const supabase = createClient();

  const loadFights = useCallback(async () => {
    const { data } = await supabase
      .from("fights")
      .select(
        `
        id, fight_order, status,
        fighter_a:fighters!fighter_a_id(id, name, nickname, photo_url),
        fighter_b:fighters!fighter_b_id(id, name, nickname, photo_url),
        events(name),
        markets(id, type, status, label, market_options(id, label, total_pool, is_winner))
      `
      )
      .in("status", ["locked", "finished"])
      .order("fight_order", { ascending: true });

    // Only show fights that have unsettled markets
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fightsWithOpenMarkets = (data ?? []).filter((f: any) =>
      f.markets?.some(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (m: any) => m.status === "open" || m.status === "locked"
      )
    );

    setFights(fightsWithOpenMarkets as unknown as FightToSettle[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadFights();
  }, [loadFights]);

  function selectOption(marketId: string, optionId: string) {
    setSelections((prev) => ({ ...prev, [marketId]: optionId }));
  }

  async function handleSettleFight(fight: FightToSettle) {
    const unsettledMarkets = fight.markets.filter(
      (m) => m.status === "open" || m.status === "locked"
    );

    // Check all markets have a selection
    const missing = unsettledMarkets.filter((m) => !selections[m.id]);
    if (missing.length > 0) {
      toast.error(
        `Selecione o vencedor para: ${missing.map((m) => marketTypeLabel(m.type)).join(", ")}`
      );
      return;
    }

    setProcessing(fight.id);

    for (const market of unsettledMarkets) {
      const winningOptionId = selections[market.id];
      const { error } = await supabase.rpc("settle_market", {
        p_market_id: market.id,
        p_winning_option_id: winningOptionId,
      });
      if (error) {
        toast.error(`Erro ao liquidar ${marketTypeLabel(market.type)}: ${error.message}`);
        setProcessing(null);
        return;
      }
    }

    // Update fight status to finished
    await supabase
      .from("fights")
      .update({ status: "finished" })
      .eq("id", fight.id);

    toast.success("Luta liquidada! Pagamentos realizados.");
    setSelections({});
    loadFights();
    setProcessing(null);
  }

  async function handleCancelFight(fight: FightToSettle) {
    if (!confirm("Cancelar esta luta e reembolsar todas as apostas?")) return;
    setProcessing(fight.id);

    const unsettledMarkets = fight.markets.filter(
      (m) => m.status === "open" || m.status === "locked"
    );

    for (const market of unsettledMarkets) {
      const { error } = await supabase.rpc("void_market", {
        p_market_id: market.id,
      });
      if (error) {
        toast.error(`Erro: ${error.message}`);
        setProcessing(null);
        return;
      }
    }

    await supabase
      .from("fights")
      .update({ status: "cancelled" })
      .eq("id", fight.id);

    toast.success("Luta cancelada. Apostas reembolsadas.");
    loadFights();
    setProcessing(null);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Target className="h-6 w-6 text-[var(--brand-gold)]" />
        <h1 className="font-heading text-3xl text-[var(--text-primary)]">
          APURAR RESULTADOS
        </h1>
      </div>

      <p className="text-sm text-[var(--text-secondary)]">
        Selecione os resultados de cada mercado e liquide a luta para pagar os
        vencedores.
      </p>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-[var(--brand-green)]" />
        </div>
      ) : fights.length === 0 ? (
        <Card
          className="border-[var(--border-default)]"
          style={{ background: "var(--bg-card)" }}
        >
          <CardContent className="py-12 text-center text-[var(--text-muted)]">
            <Target className="h-10 w-10 mx-auto mb-3 opacity-30" />
            Nenhuma luta pendente de apuração.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {fights.map((fight) => {
            const isProcessing = processing === fight.id;
            const unsettledMarkets = fight.markets.filter(
              (m) => m.status === "open" || m.status === "locked"
            );

            return (
              <Card
                key={fight.id}
                className="border-[var(--border-default)] overflow-hidden"
                style={{ background: "var(--bg-card)" }}
              >
                {/* Fight header */}
                <div
                  className="px-4 py-3 flex items-center justify-between"
                  style={{ background: "var(--bg-elevated)" }}
                >
                  <div>
                    <p className="text-xs text-[var(--text-muted)]">
                      {fight.events?.name} &bull; Luta{" "}
                      {fight.fight_order ?? "?"}
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className="text-[10px] border-[var(--color-warning)] text-[var(--color-warning)]"
                  >
                    Pendente
                  </Badge>
                </div>

                <CardContent className="py-5 space-y-5">
                  {/* Fighter matchup with photos */}
                  <div className="flex items-center justify-center gap-6">
                    <div className="text-center space-y-2">
                      <div
                        className="h-16 w-16 mx-auto rounded-full overflow-hidden flex items-center justify-center"
                        style={{ background: "var(--bg-elevated)" }}
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
                          <User className="h-8 w-8 text-[var(--text-muted)]" />
                        )}
                      </div>
                      <p className="font-semibold text-[var(--text-primary)] text-sm">
                        {fight.fighter_a?.name}
                      </p>
                    </div>

                    <Swords className="h-6 w-6 text-[var(--brand-gold)] shrink-0" />

                    <div className="text-center space-y-2">
                      <div
                        className="h-16 w-16 mx-auto rounded-full overflow-hidden flex items-center justify-center"
                        style={{ background: "var(--bg-elevated)" }}
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
                          <User className="h-8 w-8 text-[var(--text-muted)]" />
                        )}
                      </div>
                      <p className="font-semibold text-[var(--text-primary)] text-sm">
                        {fight.fighter_b?.name}
                      </p>
                    </div>
                  </div>

                  {/* Markets */}
                  {unsettledMarkets.map((market) => {
                    const totalPool = market.market_options.reduce(
                      (sum, o) => sum + Number(o.total_pool),
                      0
                    );
                    const selected = selections[market.id];

                    return (
                      <div
                        key={market.id}
                        className="rounded-lg p-4 space-y-3"
                        style={{ background: "var(--bg-elevated)" }}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold text-[var(--text-secondary)]">
                            {marketTypeLabel(market.type)}
                          </span>
                          <span className="text-xs text-[var(--brand-gold)] font-bold">
                            Pool: R$ {totalPool.toFixed(2)}
                          </span>
                        </div>

                        <div className="space-y-2">
                          {market.market_options.map((option) => {
                            const pct =
                              totalPool > 0
                                ? (Number(option.total_pool) / totalPool) * 100
                                : 0;
                            const isSelected = selected === option.id;

                            return (
                              <button
                                key={option.id}
                                onClick={() =>
                                  selectOption(market.id, option.id)
                                }
                                disabled={isProcessing}
                                className={`w-full text-left rounded-lg border p-3 transition-all ${
                                  isSelected
                                    ? "border-[var(--brand-green)] bg-[var(--brand-green)]/10"
                                    : "border-[var(--border-default)] hover:border-[var(--brand-green)]/30"
                                }`}
                              >
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center gap-2">
                                    {isSelected && (
                                      <CheckCircle className="h-4 w-4 text-[var(--brand-green)]" />
                                    )}
                                    <span className="text-sm text-[var(--text-primary)] font-medium">
                                      {option.label}
                                    </span>
                                  </div>
                                  <span className="text-xs text-[var(--brand-gold)] font-bold">
                                    R$ {Number(option.total_pool).toFixed(2)}
                                  </span>
                                </div>
                                {/* Progress bar */}
                                <div
                                  className="h-1.5 rounded-full overflow-hidden"
                                  style={{
                                    background: "var(--bg-primary)",
                                  }}
                                >
                                  <div
                                    className="h-full rounded-full transition-all"
                                    style={{
                                      width: `${pct}%`,
                                      background: isSelected
                                        ? "var(--brand-green)"
                                        : "var(--brand-gold)",
                                    }}
                                  />
                                </div>
                                <p className="text-[10px] text-[var(--text-muted)] mt-1">
                                  {pct.toFixed(0)}% do pool
                                </p>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}

                  {/* Action buttons */}
                  <div className="flex gap-3">
                    <Button
                      disabled={isProcessing}
                      onClick={() => handleSettleFight(fight)}
                      className="flex-1 bg-[var(--brand-green)] text-[var(--bg-primary)] hover:bg-[var(--brand-green)]/90 font-bold"
                    >
                      {isProcessing ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-1" />
                      ) : (
                        <CheckCircle className="h-4 w-4 mr-1" />
                      )}
                      Liquidar Luta
                    </Button>
                    <Button
                      variant="outline"
                      disabled={isProcessing}
                      onClick={() => handleCancelFight(fight)}
                      className="border-[var(--color-danger)] text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10"
                    >
                      <Ban className="h-4 w-4 mr-1" />
                      Cancelar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
