"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Loader2, Check } from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const QUICK_AMOUNTS = [5, 10, 25, 50];
const MIN_BET = 1;
const MAX_BET = 200;

type BetSlipProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fightLabel: string;
  optionLabel: string;
  optionId: string;
  marketId: string;
  odds: number;
  userBalance: number;
};

export function BetSlip({
  open,
  onOpenChange,
  fightLabel,
  optionLabel,
  optionId,
  marketId,
  odds,
  userBalance,
}: BetSlipProps) {
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [liveOdds, setLiveOdds] = useState(odds);
  const router = useRouter();
  const supabase = createClient();

  const numAmount = parseFloat(amount) || 0;
  const potentialReturn = numAmount * liveOdds * 0.9;
  const insufficientBalance = numAmount > userBalance;
  const invalidAmount = numAmount < MIN_BET || numAmount > MAX_BET;

  // Realtime odds subscription
  useEffect(() => {
    setLiveOdds(odds);
  }, [odds]);

  useEffect(() => {
    if (!open) return;
    const channel = supabase
      .channel("odds-update")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "market_options",
        },
        () => {
          // Refetch odds when any market_option changes
          supabase
            .from("market_options")
            .select("id, total_pool, market_id")
            .eq("market_id", marketId)
            .then(({ data }) => {
              if (!data) return;
              const totalPool = data.reduce(
                (s, o) => s + Number(o.total_pool),
                0
              );
              const myOption = data.find((o) => o.id === optionId);
              if (myOption && Number(myOption.total_pool) > 0) {
                setLiveOdds(totalPool / Number(myOption.total_pool));
              }
            });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [open, marketId, optionId, supabase]);

  function handleQuickAmount(val: number) {
    setAmount(String(val));
  }

  async function handlePlaceBet() {
    if (!amount || invalidAmount || insufficientBalance) return;

    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      const { error } = await supabase.rpc("place_bet", {
        p_user_id: user.id,
        p_market_id: marketId,
        p_option_id: optionId,
        p_amount: numAmount,
        p_idempotency_key: crypto.randomUUID(),
      });

      if (error) throw error;

      toast.success("Aposta feita! Agora é torcer, faixa branca! 🔥");
      setAmount("");
      onOpenChange(false);
      router.refresh();
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Erro ao apostar";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="border-t border-[var(--border-default)] rounded-t-2xl px-5 pb-8 max-w-[480px] mx-auto max-h-[65vh] overflow-y-auto"
        style={{ background: "#16161F" }}
      >
        {/* Handle bar */}
        <div className="flex justify-center pt-2 pb-4">
          <div className="w-10 h-1 rounded-full bg-[#2A2A3A]" />
        </div>

        <SheetTitle className="sr-only">Apostar</SheetTitle>
        <SheetDescription className="sr-only">
          Fazer aposta nesta luta
        </SheetDescription>

        <div className="space-y-4">
          {/* Fight info */}
          <div>
            <p className="text-xs text-[#6B6B80] uppercase tracking-wider">
              {fightLabel}
            </p>
            <div className="flex items-center gap-2 mt-1">
              <Check className="h-4 w-4 text-[#7ED957]" />
              <p className="text-sm text-[#F0F0F0]">
                Você apostou em:{" "}
                <span className="font-bold text-[#7ED957]">{optionLabel}</span>
              </p>
            </div>
          </div>

          {/* Odds */}
          <div className="text-center">
            <p className="text-[10px] text-[#6B6B80] uppercase tracking-wider">
              Odds
            </p>
            <p className="text-2xl font-bold text-[#D4A017]">
              {liveOdds.toFixed(2)}
            </p>
            <p className="text-[10px] text-[#6B6B80]">
              Odds podem mudar até o fechamento
            </p>
          </div>

          {/* Balance */}
          <p className="text-xs">
            Seu saldo:{" "}
            <span className="font-bold text-[#7ED957]">
              R$ {userBalance.toFixed(2)}
            </span>
          </p>

          {/* Amount input */}
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-[#D4A017]">
              R$
            </span>
            <Input
              type="number"
              min={MIN_BET}
              max={MAX_BET}
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0,00"
              className="pl-10 text-lg h-12 bg-[#0A0A0F] border-[#2A2A3A] text-[#F0F0F0] focus:border-[#7ED957] transition-colors"
            />
          </div>

          {/* Quick amounts */}
          <div className="flex gap-2">
            {QUICK_AMOUNTS.map((val) => (
              <button
                key={val}
                type="button"
                onClick={() => handleQuickAmount(val)}
                className={`flex-1 py-2 rounded-lg text-xs font-bold transition-colors border ${
                  amount === String(val)
                    ? "bg-[#7ED957] text-[#0A0A0F] border-[#7ED957]"
                    : "bg-[#1C1C28] text-[#9999AA] border-[#2A2A3A] hover:border-[#7ED957]/50"
                }`}
              >
                R$ {val}
              </button>
            ))}
          </div>

          {/* Potential return */}
          {numAmount > 0 && (
            <div className="text-center py-2 rounded-lg" style={{ background: "#0A0A0F" }}>
              <p className="text-[10px] text-[#6B6B80] uppercase tracking-wider">
                Retorno potencial
              </p>
              <p className={`text-xl font-bold ${potentialReturn < numAmount ? "text-[#FF4757]" : "text-[#D4A017]"}`}>
                R$ {potentialReturn.toFixed(2)}
              </p>
              {potentialReturn < numAmount && (
                <p className="text-[11px] text-[#FF4757] mt-1 font-medium">
                  Retorno abaixo do valor apostado! Muitas apostas neste lado.
                </p>
              )}
            </div>
          )}

          {/* Insufficient balance warning */}
          {insufficientBalance && numAmount > 0 && (
            <div className="text-center space-y-2">
              <p className="text-xs text-[#FF4757]">Saldo insuficiente</p>
              <Link href="/wallet">
                <Button
                  variant="outline"
                  size="sm"
                  className="border-[#7ED957] text-[#7ED957] hover:bg-[#7ED957]/10"
                  onClick={() => onOpenChange(false)}
                >
                  Depositar
                </Button>
              </Link>
            </div>
          )}

          {/* Amount range hint */}
          {numAmount > 0 && (numAmount < MIN_BET || numAmount > MAX_BET) && !insufficientBalance && (
            <p className="text-xs text-[#FF4757] text-center">
              Aposta: mínimo R$ {MIN_BET} / máximo R$ {MAX_BET}
            </p>
          )}

          {/* CTA */}
          <Button
            onClick={handlePlaceBet}
            disabled={
              loading ||
              !amount ||
              numAmount <= 0 ||
              invalidAmount ||
              insufficientBalance
            }
            className="w-full h-12 bg-[#7ED957] text-[#0A0A0F] hover:bg-[#7ED957]/90 font-bold text-base disabled:opacity-50 tap-scale"
          >
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              `APOSTAR R$ ${numAmount > 0 ? numAmount.toFixed(2) : "0,00"}`
            )}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
