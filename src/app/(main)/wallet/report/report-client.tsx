"use client";

import Link from "next/link";
import {
  ArrowLeft,
  Wallet,
  TrendingUp,
  TrendingDown,
  Trophy,
  XCircle,
  Clock,
  RotateCcw,
  Info,
  Scale,
} from "lucide-react";

type Bet = {
  id: string;
  amount: number | string;
  potential_payout: number | string | null;
  settled_amount: number | string;
  status: "pending" | "won" | "lost" | "refunded";
  created_at: string;
  market_option: { label: string } | null;
  market: {
    type: string;
    fight: {
      fighter_a: { name: string } | null;
      fighter_b: { name: string } | null;
    } | null;
  } | null;
};

type Props = {
  balance: number;
  bets: Bet[];
};

function marketTypeLabel(type?: string) {
  switch (type) {
    case "winner":
      return "Vencedor da luta";
    case "method":
      return "Método de vitória";
    case "has_submission":
      return "Vai ter finalização?";
    case "special":
      return "Mercado especial";
    default:
      return type ?? "—";
  }
}

function brl(v: number) {
  return `R$ ${v.toFixed(2).replace(".", ",")}`;
}

export function ReportClient({ balance, bets }: Props) {
  // Totals
  const settled = bets.filter((b) =>
    ["won", "lost", "refunded"].includes(b.status)
  );
  const wonBets = bets.filter((b) => b.status === "won");
  const lostBets = bets.filter((b) => b.status === "lost");
  const pendingBets = bets.filter((b) => b.status === "pending");
  const refundedBets = bets.filter((b) => b.status === "refunded");

  const totalStakeSettled = settled.reduce(
    (s, b) => s + Number(b.amount),
    0
  );
  const totalWon = wonBets.reduce(
    (s, b) => s + Number(b.settled_amount),
    0
  );
  const totalLostStake = lostBets.reduce(
    (s, b) => s + Number(b.amount),
    0
  );
  // Profit on won bets = settled_amount - amount (settled already includes stake)
  const profitOnWins = wonBets.reduce(
    (s, b) => s + (Number(b.settled_amount) - Number(b.amount)),
    0
  );
  const netResult = profitOnWins - totalLostStake;
  const isPositive = netResult >= 0;

  const pendingStake = pendingBets.reduce(
    (s, b) => s + Number(b.amount),
    0
  );

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Link
          href="/wallet"
          className="p-1.5 rounded-lg hover:bg-[#1C1C28] transition-colors"
        >
          <ArrowLeft className="h-5 w-5 text-[#F0F0F0]" />
        </Link>
        <div className="flex items-center gap-2">
          <Scale className="h-5 w-5 text-[#D4A017]" />
          <h1 className="font-heading text-xl text-[#F0F0F0]">
            PRESTAÇÃO DE CONTAS
          </h1>
        </div>
      </div>

      {/* Intro explanation */}
      <div
        className="rounded-xl border border-[#2A2A3A] p-4 flex gap-3"
        style={{ background: "#16161F" }}
      >
        <Info className="h-5 w-5 text-[#1A6BC4] shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="text-sm text-[#F0F0F0] font-semibold">
            O que é este relatório?
          </p>
          <p className="text-xs text-[#9999AA] leading-relaxed">
            Aqui você vê cada aposta que fez, quanto investiu e qual foi o
            resultado. No final somamos tudo para mostrar se você está
            ganhando ou perdendo dinheiro na GARBINBET. Assim você aposta com
            consciência! 🧠
          </p>
        </div>
      </div>

      {/* Current balance */}
      <div
        className="rounded-xl border border-[#2A2A3A] p-4"
        style={{ background: "#16161F" }}
      >
        <div className="flex items-center gap-2 mb-1">
          <Wallet className="h-4 w-4 text-[#F5C542]" />
          <p className="text-xs uppercase tracking-wider text-[#9999AA]">
            Saldo atual na carteira
          </p>
        </div>
        <p className="font-heading text-3xl text-[#F5C542] font-bold">
          {brl(balance)}
        </p>
        <p className="text-[11px] text-[#6B6B80] mt-1">
          É quanto você tem disponível agora para apostar ou sacar.
        </p>
      </div>

      {/* Net result card */}
      <div
        className={`rounded-xl border-2 p-4 ${
          isPositive ? "border-[#7ED957]" : "border-[#FF4757]"
        }`}
        style={{ background: "#16161F" }}
      >
        <div className="flex items-center gap-2 mb-2">
          {isPositive ? (
            <TrendingUp className="h-5 w-5 text-[#7ED957]" />
          ) : (
            <TrendingDown className="h-5 w-5 text-[#FF4757]" />
          )}
          <p className="text-xs uppercase tracking-wider text-[#9999AA]">
            Resultado geral das apostas
          </p>
        </div>
        <p
          className={`font-heading text-4xl font-bold ${
            isPositive ? "text-[#7ED957]" : "text-[#FF4757]"
          }`}
        >
          {isPositive ? "+" : "−"}
          {brl(Math.abs(netResult))}
        </p>
        <p className="text-xs text-[#9999AA] mt-2 leading-relaxed">
          {settled.length === 0 ? (
            <>Você ainda não tem apostas encerradas para calcular o resultado.</>
          ) : isPositive ? (
            <>
              Parabéns! No total das suas apostas encerradas você está{" "}
              <span className="text-[#7ED957] font-semibold">
                no lucro de {brl(netResult)}
              </span>
              . Continue apostando com cabeça! 🏆
            </>
          ) : (
            <>
              No total das suas apostas encerradas você está{" "}
              <span className="text-[#FF4757] font-semibold">
                no prejuízo de {brl(Math.abs(netResult))}
              </span>
              . Aposte com responsabilidade e só o que pode perder.
            </>
          )}
        </p>
      </div>

      {/* Breakdown */}
      <div className="grid grid-cols-2 gap-3">
        <SummaryTile
          icon={<Trophy className="h-4 w-4 text-[#7ED957]" />}
          label="Apostas ganhas"
          value={`${wonBets.length}`}
          sub={
            profitOnWins >= 0
              ? `+${brl(profitOnWins)} de lucro`
              : `−${brl(Math.abs(profitOnWins))} de prejuízo`
          }
          color="text-[#7ED957]"
        />
        <SummaryTile
          icon={<XCircle className="h-4 w-4 text-[#FF4757]" />}
          label="Apostas perdidas"
          value={`${lostBets.length}`}
          sub={`−${brl(totalLostStake)} perdidos`}
          color="text-[#FF4757]"
        />
        <SummaryTile
          icon={<Clock className="h-4 w-4 text-[#F5C542]" />}
          label="Em andamento"
          value={`${pendingBets.length}`}
          sub={`${brl(pendingStake)} em jogo`}
          color="text-[#F5C542]"
        />
        <SummaryTile
          icon={<RotateCcw className="h-4 w-4 text-[#6B6B80]" />}
          label="Reembolsadas"
          value={`${refundedBets.length}`}
          sub="sem ganho nem perda"
          color="text-[#9999AA]"
        />
      </div>

      {/* Totals explanation */}
      <div
        className="rounded-xl border border-[#2A2A3A] p-4 space-y-2"
        style={{ background: "#16161F" }}
      >
        <p className="text-xs uppercase tracking-wider text-[#9999AA] mb-2">
          Como chegamos no resultado
        </p>
        <Row
          label="Total investido em apostas encerradas"
          value={brl(totalStakeSettled)}
          muted
        />
        <Row
          label={
            profitOnWins >= 0
              ? "Lucro das apostas ganhas"
              : "Prejuízo das apostas ganhas"
          }
          value={`${profitOnWins >= 0 ? "+" : "−"}${brl(Math.abs(profitOnWins))}`}
          valueColor={profitOnWins >= 0 ? "text-[#7ED957]" : "text-[#FF4757]"}
        />
        <Row
          label="Prejuízo das apostas perdidas"
          value={`−${brl(totalLostStake)}`}
          valueColor="text-[#FF4757]"
        />
        <div className="h-px bg-[#2A2A3A] my-2" />
        <Row
          label="Resultado líquido"
          value={`${isPositive ? "+" : "−"}${brl(Math.abs(netResult))}`}
          valueColor={isPositive ? "text-[#7ED957]" : "text-[#FF4757]"}
          bold
        />
        <p className="text-[10px] text-[#6B6B80] pt-2 leading-relaxed">
          Cálculo: lucro (ou prejuízo) das apostas que você ganhou, menos o
          valor perdido nas apostas que errou. Apostas em andamento e
          reembolsadas não entram nessa conta. Quando o prêmio de uma aposta
          ganha é menor que o valor apostado (por causa da distribuição do
          bolão + comissão da casa), o prejuízo aparece mesmo entre as ganhas.
        </p>
      </div>

      {/* Extract - each bet */}
      <div className="space-y-3">
        <h2 className="font-heading text-lg text-[#F0F0F0]">
          EXTRATO DETALHADO
        </h2>

        {bets.length === 0 ? (
          <div
            className="text-center py-10 rounded-xl border border-[#2A2A3A]"
            style={{ background: "#16161F" }}
          >
            <Scale className="h-10 w-10 mx-auto text-[#6B6B80] opacity-30 mb-2" />
            <p className="text-sm text-[#9999AA]">
              Você ainda não fez nenhuma aposta.
            </p>
            <p className="text-xs text-[#6B6B80] mt-1">
              Quando apostar, tudo aparecerá aqui de forma clarinha. ✨
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {bets.map((bet) => (
              <BetReportCard key={bet.id} bet={bet} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryTile({
  icon,
  label,
  value,
  sub,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  color: string;
}) {
  return (
    <div
      className="rounded-xl border border-[#2A2A3A] p-3"
      style={{ background: "#16161F" }}
    >
      <div className="flex items-center gap-1.5 mb-1">
        {icon}
        <p className="text-[10px] uppercase tracking-wide text-[#9999AA]">
          {label}
        </p>
      </div>
      <p className={`font-heading text-2xl font-bold ${color}`}>{value}</p>
      <p className="text-[10px] text-[#6B6B80] mt-0.5">{sub}</p>
    </div>
  );
}

function Row({
  label,
  value,
  valueColor,
  muted,
  bold,
}: {
  label: string;
  value: string;
  valueColor?: string;
  muted?: boolean;
  bold?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span
        className={`text-xs ${muted ? "text-[#9999AA]" : "text-[#F0F0F0]"} ${
          bold ? "font-semibold" : ""
        }`}
      >
        {label}
      </span>
      <span
        className={`text-sm ${valueColor ?? "text-[#F0F0F0]"} ${
          bold ? "font-bold" : "font-semibold"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

function BetReportCard({ bet }: { bet: Bet }) {
  const amount = Number(bet.amount);
  const settledAmount = Number(bet.settled_amount);
  const potentialPayout = Number(bet.potential_payout ?? 0);

  const fighterA = bet.market?.fight?.fighter_a?.name ?? "?";
  const fighterB = bet.market?.fight?.fighter_b?.name ?? "?";
  const fightLabel = `${fighterA} vs ${fighterB}`;

  let borderClass = "border-[#2A2A3A]";
  let statusIcon: React.ReactNode = null;
  let statusText = "";
  let statusColor = "text-[#9999AA]";
  let explanation: React.ReactNode = null;
  let resultLine: React.ReactNode = null;

  switch (bet.status) {
    case "won": {
      const profit = settledAmount - amount;
      if (profit >= 0) {
        borderClass = "border-[#7ED957]";
        statusIcon = <Trophy className="h-3.5 w-3.5" />;
        statusText = "GANHOU";
        statusColor = "text-[#7ED957]";
        explanation = (
          <>
            Você apostou <strong>{brl(amount)}</strong> e acertou! Recebeu{" "}
            <strong className="text-[#7ED957]">{brl(settledAmount)}</strong>{" "}
            de volta na carteira.
          </>
        );
        resultLine = (
          <span className="text-[#7ED957] font-bold">+{brl(profit)}</span>
        );
      } else {
        // Won the bet but payout < stake (pari-mutuel + house commission)
        borderClass = "border-[#D4A017]";
        statusIcon = <Trophy className="h-3.5 w-3.5" />;
        statusText = "ACERTOU MAS PERDEU";
        statusColor = "text-[#D4A017]";
        explanation = (
          <>
            Você apostou <strong>{brl(amount)}</strong> e acertou na escolha,
            mas o prêmio distribuído foi de só{" "}
            <strong className="text-[#D4A017]">{brl(settledAmount)}</strong> —
            menos do que você tinha apostado. Por isso ainda saiu no prejuízo
            de <strong className="text-[#FF4757]">{brl(Math.abs(profit))}</strong>{" "}
            nessa aposta.
          </>
        );
        resultLine = (
          <span className="text-[#FF4757] font-bold">
            −{brl(Math.abs(profit))}
          </span>
        );
      }
      break;
    }
    case "lost": {
      borderClass = "border-[#FF4757]";
      statusIcon = <XCircle className="h-3.5 w-3.5" />;
      statusText = "PERDEU";
      statusColor = "text-[#FF4757]";
      explanation = (
        <>
          Você apostou <strong>{brl(amount)}</strong> e não acertou. Esse
          valor foi descontado da sua carteira.
        </>
      );
      resultLine = (
        <span className="text-[#FF4757] font-bold">−{brl(amount)}</span>
      );
      break;
    }
    case "refunded": {
      borderClass = "border-[#6B6B80]";
      statusIcon = <RotateCcw className="h-3.5 w-3.5" />;
      statusText = "REEMBOLSADA";
      statusColor = "text-[#9999AA]";
      explanation = (
        <>
          A aposta foi cancelada e <strong>{brl(amount)}</strong> voltaram
          pra sua carteira. Sem ganho nem perda.
        </>
      );
      resultLine = <span className="text-[#9999AA] font-bold">{brl(0)}</span>;
      break;
    }
    case "pending":
    default: {
      borderClass = "border-[#F5C542]";
      statusIcon = <Clock className="h-3.5 w-3.5" />;
      statusText = "EM ANDAMENTO";
      statusColor = "text-[#F5C542]";
      explanation = (
        <>
          Você apostou <strong>{brl(amount)}</strong>. Se ganhar, vai receber{" "}
          <strong className="text-[#F5C542]">{brl(potentialPayout)}</strong>{" "}
          (lucro de {brl(Math.max(potentialPayout - amount, 0))}).
        </>
      );
      resultLine = (
        <span className="text-[#F5C542] font-bold">aguardando…</span>
      );
      break;
    }
  }

  return (
    <div
      className={`rounded-xl border ${borderClass} overflow-hidden`}
      style={{ background: "#16161F" }}
    >
      <div className="px-4 py-3 space-y-2.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[#F0F0F0] truncate">
              {fightLabel}
            </p>
            <p className="text-[10px] text-[#6B6B80]">
              {marketTypeLabel(bet.market?.type)}
            </p>
          </div>
          <div
            className={`flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider ${statusColor}`}
          >
            {statusIcon}
            {statusText}
          </div>
        </div>

        <div className="flex items-center justify-between pt-1.5 border-t border-[#2A2A3A]">
          <div>
            <p className="text-[10px] text-[#6B6B80]">Sua escolha</p>
            <p className="text-xs text-[#7ED957] font-semibold">
              {bet.market_option?.label ?? "—"}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-[#6B6B80]">Resultado</p>
            <p className="text-sm">{resultLine}</p>
          </div>
        </div>

        <p className="text-[11px] text-[#9999AA] leading-relaxed">
          {explanation}
        </p>

        <p className="text-[10px] text-[#6B6B80]">
          {new Date(bet.created_at).toLocaleString("pt-BR")}
        </p>
      </div>
    </div>
  );
}
