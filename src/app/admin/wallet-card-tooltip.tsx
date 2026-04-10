"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Wallet } from "lucide-react";

type FinancialDetails = {
  totalDeposits: number;
  totalWithdrawals: number;
  totalWallets: number;
  totalInPools: number;
  totalBetVolume: number;
  totalPaidOut: number;
  houseCommissionRealized: number;
  houseCommissionPotential: number;
};

export function WalletCardWithTooltip({
  value,
  color,
  financialDetails: f,
}: {
  value: string;
  color: string;
  financialDetails: FinancialDetails;
}) {
  const [show, setShow] = useState(false);

  return (
    <div
      className="relative"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      <Card
        className="border-[var(--border-default)] overflow-hidden cursor-default"
        style={{ background: "var(--bg-card)" }}
      >
        <div className="h-1" style={{ background: "var(--brand-gold)" }} />
        <CardContent className="pt-4 pb-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-[var(--text-muted)] mb-1">
                Total em Wallets
              </p>
              <p className="text-2xl font-bold" style={{ color }}>
                {value}
              </p>
            </div>
            <div
              className="h-9 w-9 rounded-lg flex items-center justify-center"
              style={{ background: "var(--bg-elevated)" }}
            >
              <Wallet className="h-5 w-5" style={{ color }} />
            </div>
          </div>
        </CardContent>
      </Card>

      {show && (
        <div
          className="absolute top-full left-0 mt-2 z-50 w-72 rounded-xl border border-[var(--border-default)] shadow-2xl p-4 space-y-3"
          style={{ background: "var(--bg-card)" }}
        >
          <p className="text-xs font-bold text-[var(--brand-gold)] uppercase tracking-wider">
            Resumo Financeiro
          </p>

          <div className="space-y-2 text-xs">
            <Row
              label="Total depositado"
              value={f.totalDeposits}
              color="var(--brand-green)"
            />
            <Row
              label="Total sacado"
              value={f.totalWithdrawals}
              color="var(--color-danger)"
            />
            <Divider />
            <Row
              label="Saldo em carteiras"
              value={f.totalWallets}
              color="var(--brand-gold)"
            />
            <Row
              label="Dinheiro em apostas ativas"
              value={f.totalInPools}
              color="var(--color-warning)"
            />
            <Row
              label="Volume total apostado"
              value={f.totalBetVolume}
              color="var(--text-secondary)"
            />
            <Divider />
            <Row
              label="Taxa da casa (10%) potencial"
              value={f.houseCommissionPotential}
              color="var(--brand-gold)"
              bold
            />
            <Row
              label="Taxa da casa realizada"
              value={f.houseCommissionRealized}
              color="var(--brand-green)"
              bold
            />
            <Row
              label="Pago aos vencedores"
              value={f.totalPaidOut}
              color="var(--brand-blue)"
            />
          </div>

          <p className="text-[10px] text-[var(--text-muted)] leading-tight">
            Potencial = 10% dos pools ativos (cobrada no settle).
            Realizada = taxa já retida de mercados liquidados.
          </p>
        </div>
      )}
    </div>
  );
}

function Row({
  label,
  value,
  color,
  bold,
}: {
  label: string;
  value: number;
  color: string;
  bold?: boolean;
}) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-[var(--text-muted)]">{label}</span>
      <span className={bold ? "font-bold" : "font-medium"} style={{ color }}>
        R$ {value.toFixed(2)}
      </span>
    </div>
  );
}

function Divider() {
  return <div className="border-t border-[var(--border-default)]" />;
}
