"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Wallet,
  ArrowDownCircle,
  ArrowUpCircle,
  CircleDollarSign,
  Trophy,
  RotateCcw,
  Copy,
  Check,
  Loader2,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

// PIX key for deposits - easy to change
const ADMIN_PIX_KEY = "8248870c-f796-45e3-ac79-c828b2641eed";

type Props = {
  balance: number;
  userPixKey: string;
  transactions: any[];
};

function txIcon(type: string) {
  switch (type) {
    case "deposit":
      return <ArrowDownCircle className="h-5 w-5 text-[#7ED957]" />;
    case "withdraw":
      return <ArrowUpCircle className="h-5 w-5 text-[#FF4757]" />;
    case "bet_placed":
      return <CircleDollarSign className="h-5 w-5 text-[#D4A017]" />;
    case "bet_won":
      return <Trophy className="h-5 w-5 text-[#7ED957]" />;
    case "bet_refund":
      return <RotateCcw className="h-5 w-5 text-[#1A6BC4]" />;
    default:
      return <CircleDollarSign className="h-5 w-5 text-[#6B6B80]" />;
  }
}

function txLabel(type: string) {
  switch (type) {
    case "deposit":
      return "Depósito";
    case "withdraw":
      return "Saque";
    case "bet_placed":
      return "Aposta";
    case "bet_won":
      return "Ganho";
    case "bet_refund":
      return "Reembolso";
    default:
      return type;
  }
}

export function WalletClient({ balance, userPixKey, transactions }: Props) {
  const [depositOpen, setDepositOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawPix, setWithdrawPix] = useState(userPixKey);
  const [loading, setLoading] = useState(false);
  const supabase = createClient();
  const router = useRouter();

  async function handleCopy() {
    await navigator.clipboard.writeText(ADMIN_PIX_KEY);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleWithdraw(e: React.FormEvent) {
    e.preventDefault();
    const amount = parseFloat(withdrawAmount);
    if (!amount || amount < 1) {
      toast.error("Valor mínimo para saque é R$ 1,00");
      return;
    }
    if (amount > balance) {
      toast.error("Saldo insuficiente");
      return;
    }
    if (!withdrawPix.trim()) {
      toast.error("Informe sua chave PIX");
      return;
    }

    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Sessão expirada");
      setLoading(false);
      return;
    }

    // Save PIX key to profile
    if (withdrawPix) {
      await supabase
        .from("profiles")
        .update({ pix_key: withdrawPix })
        .eq("id", user.id);
    }

    // Create withdrawal request
    const { error } = await supabase.from("withdrawal_requests").insert({
      user_id: user.id,
      amount,
      pix_key: withdrawPix.trim(),
    });

    if (error) {
      toast.error("Erro ao solicitar saque: " + error.message);
    } else {
      toast.success("Saque solicitado! O admin vai processar em breve.");
      setWithdrawOpen(false);
      setWithdrawAmount("");
    }
    setLoading(false);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {/* Balance */}
      <div className="text-center py-6">
        <p className="text-xs text-[#6B6B80] uppercase tracking-wider mb-1">
          Seu saldo
        </p>
        <p className="font-heading text-[40px] leading-none text-[#F5C542] font-bold">
          R$ {balance.toFixed(2)}
        </p>
      </div>

      {/* Action buttons */}
      <div className="grid grid-cols-2 gap-3">
        <Button
          onClick={() => setDepositOpen(true)}
          className="h-12 bg-[#7ED957] text-[#0A0A0F] hover:bg-[#7ED957]/90 font-bold text-sm"
        >
          <ArrowDownCircle className="h-4 w-4 mr-1.5" />
          Depositar
        </Button>
        <Button
          variant="outline"
          onClick={() => setWithdrawOpen(true)}
          className="h-12 border-[#F0F0F0]/20 text-[#F0F0F0] hover:bg-[#F0F0F0]/5 font-bold text-sm"
        >
          <ArrowUpCircle className="h-4 w-4 mr-1.5" />
          Sacar
        </Button>
      </div>

      {/* Transaction history */}
      <div>
        <h2 className="font-heading text-lg text-[#F0F0F0] mb-3">EXTRATO</h2>
        {transactions.length === 0 ? (
          <div
            className="text-center py-8 rounded-xl border border-[#2A2A3A]"
            style={{ background: "#16161F" }}
          >
            <Wallet className="h-10 w-10 mx-auto text-[#6B6B80] opacity-20 mb-2" />
            <p className="text-sm text-[#9999AA]">
              Para começar a apostar, faça um depósito! 💰
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {transactions.map((tx: any) => (
              <div
                key={tx.id}
                className="flex items-center gap-3 px-3 py-3 rounded-xl border border-[#2A2A3A]"
                style={{ background: "#16161F" }}
              >
                {txIcon(tx.type)}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#F0F0F0]">
                    {txLabel(tx.type)}
                  </p>
                  {tx.description && (
                    <p className="text-[10px] text-[#6B6B80] truncate">
                      {tx.description}
                    </p>
                  )}
                  <p className="text-[10px] text-[#6B6B80]">
                    {new Date(tx.created_at).toLocaleString("pt-BR")}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p
                    className={`text-sm font-bold ${
                      Number(tx.amount) >= 0
                        ? "text-[#7ED957]"
                        : "text-[#FF4757]"
                    }`}
                  >
                    {Number(tx.amount) >= 0 ? "+" : ""}R${" "}
                    {Math.abs(Number(tx.amount)).toFixed(2)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Deposit Modal */}
      <Dialog open={depositOpen} onOpenChange={setDepositOpen}>
        <DialogContent
          showCloseButton={false}
          className="max-w-sm border-[#2A2A3A] p-5"
          style={{ background: "#16161F" }}
        >
          <DialogTitle className="font-heading text-xl text-[#F0F0F0]">
            DEPOSITAR
          </DialogTitle>
          <DialogDescription className="text-sm text-[#9999AA]">
            Envie o PIX para a chave abaixo e avise o LEVI no whatsapp.
          </DialogDescription>

          <div className="space-y-4 mt-3">
            <div
              className="flex items-center justify-between px-3 py-3 rounded-lg border border-[#2A2A3A]"
              style={{ background: "#0A0A0F" }}
            >
              <code className="text-sm text-[#F0F0F0] font-mono">
                {ADMIN_PIX_KEY}
              </code>
              <button
                onClick={handleCopy}
                className="text-[#7ED957] hover:text-[#7ED957]/80 transition-colors"
              >
                {copied ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </button>
            </div>

            {copied && (
              <p className="text-xs text-[#7ED957] text-center">
                Copiado! ✅
              </p>
            )}

            <p className="text-xs text-[#6B6B80] text-center">
              Seu saldo sera creditado pelo admin em alguns minutos ⏳
            </p>

            <Button
              onClick={() => setDepositOpen(false)}
              className="w-full bg-[#7ED957] text-[#0A0A0F] font-bold"
            >
              Entendi
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Withdraw Modal */}
      <Dialog open={withdrawOpen} onOpenChange={setWithdrawOpen}>
        <DialogContent
          showCloseButton={false}
          className="max-w-sm border-[#2A2A3A] p-5"
          style={{ background: "#16161F" }}
        >
          <DialogTitle className="font-heading text-xl text-[#F0F0F0]">
            SACAR
          </DialogTitle>
          <DialogDescription className="text-sm text-[#9999AA]">
            Saldo disponivel:{" "}
            <span className="font-bold text-[#D4A017]">
              R$ {balance.toFixed(2)}
            </span>
          </DialogDescription>

          <form onSubmit={handleWithdraw} className="space-y-4 mt-3">
            <div className="space-y-2">
              <Label className="text-[#9999AA] text-xs">Valor do saque</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-[#D4A017]">
                  R$
                </span>
                <Input
                  type="number"
                  min="1"
                  step="0.01"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  placeholder="0,00"
                  required
                  className="pl-10 bg-[#0A0A0F] border-[#2A2A3A] text-[#F0F0F0] focus:border-[#7ED957]"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-[#9999AA] text-xs">Sua chave PIX</Label>
              <Input
                value={withdrawPix}
                onChange={(e) => setWithdrawPix(e.target.value)}
                placeholder="CPF, email ou telefone"
                required
                className="bg-[#0A0A0F] border-[#2A2A3A] text-[#F0F0F0] focus:border-[#7ED957]"
              />
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setWithdrawOpen(false)}
                className="flex-1 h-10 rounded-lg border border-[#2A2A3A] text-[#9999AA] text-sm font-medium hover:bg-[#1C1C28] transition-colors"
              >
                Cancelar
              </button>
              <Button
                type="submit"
                disabled={loading}
                className="flex-1 bg-[#7ED957] text-[#0A0A0F] font-bold"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Solicitar Saque"
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
