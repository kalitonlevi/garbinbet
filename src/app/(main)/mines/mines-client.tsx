"use client";

import { useState, useTransition, useMemo } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Bomb,
  Gem,
  Wallet as WalletIcon,
  Loader2,
  Sparkles,
  RotateCcw,
  ShieldCheck,
  Trophy,
  X,
} from "lucide-react";
import {
  startGame,
  revealTile,
  cashout,
  type ActiveGame,
} from "@/app/actions/mines";

const BET_PRESETS = [5, 10, 25, 50];
const MINES_PRESETS: { count: number; label: string; color: string }[] = [
  { count: 1, label: "Fácil", color: "#7ED957" },
  { count: 3, label: "Normal", color: "#F5C542" },
  { count: 5, label: "Difícil", color: "#D4A017" },
  { count: 10, label: "Brutal", color: "#FF4757" },
  { count: 24, label: "Impossível", color: "#9333EA" },
];

type Phase = "bet" | "playing" | "lost" | "won";

type GameState = {
  gameId: string;
  betAmount: number;
  minesCount: number;
  revealedPositions: number[];
  multiplier: number;
  payout: number;
  serverSeedHash: string;
  clientSeed: string;
  nonce: number;
};

type FinishedInfo = {
  minePositions: number[];
  serverSeed: string;
  payout: number;
  multiplier: number;
  autoCashout?: boolean;
};

type Props = {
  balance: number;
  initialGame: ActiveGame | null;
};

function brl(v: number) {
  return `R$ ${v.toFixed(2).replace(".", ",")}`;
}

function fmtMult(v: number) {
  return `${v.toFixed(2).replace(".", ",")}×`;
}

// Compute the preview multiplier using the same formula as the DB
function previewMultiplier(revealedCount: number, minesCount: number): number {
  if (revealedCount <= 0) return 1;
  if (revealedCount > 25 - minesCount) return 0;
  let mult = 1;
  for (let i = 0; i < revealedCount; i++) {
    const remaining = 25 - i;
    const safe = 25 - minesCount - i;
    mult *= remaining / safe;
  }
  mult *= Math.pow(0.99, revealedCount);
  return Math.floor(mult * 100) / 100;
}

export function MinesClient({ balance, initialGame }: Props) {
  const router = useRouter();
  const [currentBalance, setCurrentBalance] = useState(balance);
  const [phase, setPhase] = useState<Phase>(initialGame ? "playing" : "bet");
  const [game, setGame] = useState<GameState | null>(
    initialGame
      ? {
          gameId: initialGame.gameId,
          betAmount: initialGame.betAmount,
          minesCount: initialGame.minesCount,
          revealedPositions: initialGame.revealedPositions,
          multiplier: initialGame.multiplier,
          payout: initialGame.payout,
          serverSeedHash: initialGame.serverSeedHash,
          clientSeed: initialGame.clientSeed,
          nonce: initialGame.nonce,
        }
      : null
  );
  const [finished, setFinished] = useState<FinishedInfo | null>(null);
  const [lastHitPosition, setLastHitPosition] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();
  const [revealingPos, setRevealingPos] = useState<number | null>(null);

  // Bet controls
  const [betAmount, setBetAmount] = useState<number>(5);
  const [customBet, setCustomBet] = useState<string>("");
  const [minesCount, setMinesCount] = useState<number>(3);
  const [clientSeed, setClientSeed] = useState<string>("default");
  const [fairOpen, setFairOpen] = useState(false);

  const effectiveBet = useMemo(() => {
    if (customBet.trim()) {
      const n = parseFloat(customBet.replace(",", "."));
      return Number.isFinite(n) ? n : 0;
    }
    return betAmount;
  }, [betAmount, customBet]);

  const multiplierTable = useMemo(() => {
    const safeTotal = 25 - minesCount;
    const rows: { k: number; mult: number }[] = [];
    for (let k = 1; k <= Math.min(safeTotal, 3); k++) {
      rows.push({ k, mult: previewMultiplier(k, minesCount) });
    }
    return rows;
  }, [minesCount]);

  function handleBetPreset(v: number) {
    setBetAmount(v);
    setCustomBet("");
  }

  function handleStart() {
    if (effectiveBet < 1 || effectiveBet > 200) {
      toast.error("Aposta deve estar entre R$ 1,00 e R$ 200,00");
      return;
    }
    if (effectiveBet > currentBalance) {
      toast.error("Saldo insuficiente");
      return;
    }

    startTransition(async () => {
      const res = await startGame(effectiveBet, minesCount, clientSeed);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setGame({
        gameId: res.data.gameId,
        betAmount: res.data.betAmount,
        minesCount: res.data.minesCount,
        revealedPositions: [],
        multiplier: 1,
        payout: res.data.betAmount,
        serverSeedHash: res.data.serverSeedHash,
        clientSeed: res.data.clientSeed,
        nonce: res.data.nonce,
      });
      setCurrentBalance(res.data.newBalance);
      setPhase("playing");
      setFinished(null);
      setLastHitPosition(null);
    });
  }

  function handleReveal(position: number) {
    if (!game || phase !== "playing" || isPending) return;
    if (game.revealedPositions.includes(position)) return;

    setRevealingPos(position);
    startTransition(async () => {
      const res = await revealTile(game.gameId, position);
      setRevealingPos(null);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }

      if (res.data.result === "mine") {
        setGame({
          ...game,
          revealedPositions: [...game.revealedPositions, position],
        });
        setLastHitPosition(position);
        setFinished({
          minePositions: res.data.minePositions,
          serverSeed: res.data.serverSeed,
          payout: 0,
          multiplier: 0,
        });
        setPhase("lost");
        router.refresh();
        return;
      }

      // safe
      const nextRevealed = [...game.revealedPositions, position];
      setGame({
        ...game,
        revealedPositions: nextRevealed,
        multiplier: res.data.multiplier,
        payout: res.data.payout,
      });

      if (res.data.autoCashout) {
        setFinished({
          minePositions: res.data.minePositions ?? [],
          serverSeed: res.data.serverSeed ?? "",
          payout: res.data.payout,
          multiplier: res.data.multiplier,
          autoCashout: true,
        });
        if (res.data.newBalance !== undefined) {
          setCurrentBalance(res.data.newBalance);
        }
        setPhase("won");
        router.refresh();
      }
    });
  }

  function handleCashout() {
    if (!game || phase !== "playing" || isPending) return;
    if (game.revealedPositions.length === 0) {
      toast.error("Revele pelo menos 1 tile antes de retirar");
      return;
    }

    startTransition(async () => {
      const res = await cashout(game.gameId);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setFinished({
        minePositions: res.data.minePositions,
        serverSeed: res.data.serverSeed,
        payout: res.data.payout,
        multiplier: res.data.multiplier,
      });
      setCurrentBalance(res.data.newBalance);
      setPhase("won");
      router.refresh();
    });
  }

  function handleNewGame() {
    setGame(null);
    setFinished(null);
    setLastHitPosition(null);
    setPhase("bet");
  }

  const safeRevealed = game?.revealedPositions.length ?? 0;
  const safeTotal = game ? 25 - game.minesCount : 0;

  return (
    <div className="space-y-4 pb-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bomb className="h-5 w-5 text-[#F5C542]" />
          <h1 className="font-heading text-2xl text-[#F0F0F0]">MINES</h1>
        </div>
        <button
          onClick={() => setFairOpen(true)}
          className="flex items-center gap-1 text-[10px] text-[#9999AA] hover:text-[#F5C542] transition-colors"
        >
          <ShieldCheck className="h-3.5 w-3.5" />
          Provably Fair
        </button>
      </div>

      {/* Balance strip */}
      <div
        className="flex items-center justify-between rounded-xl border border-[#2A2A3A] px-4 py-2.5"
        style={{ background: "#16161F" }}
      >
        <div className="flex items-center gap-2">
          <WalletIcon className="h-4 w-4 text-[#F5C542]" />
          <span className="text-[11px] uppercase tracking-wider text-[#9999AA]">
            Saldo
          </span>
        </div>
        <span className="font-heading text-xl text-[#F5C542] font-bold">
          {brl(currentBalance)}
        </span>
      </div>

      {phase === "bet" && (
        <BetView
          betAmount={betAmount}
          customBet={customBet}
          setCustomBet={setCustomBet}
          onBetPreset={handleBetPreset}
          minesCount={minesCount}
          setMinesCount={setMinesCount}
          effectiveBet={effectiveBet}
          multiplierTable={multiplierTable}
          clientSeed={clientSeed}
          setClientSeed={setClientSeed}
          onStart={handleStart}
          loading={isPending}
          maxBet={Math.min(200, currentBalance)}
        />
      )}

      {(phase === "playing" || phase === "lost" || phase === "won") && game && (
        <GameView
          game={game}
          phase={phase}
          finished={finished}
          lastHitPosition={lastHitPosition}
          onReveal={handleReveal}
          onCashout={handleCashout}
          onNewGame={handleNewGame}
          isPending={isPending}
          revealingPos={revealingPos}
          safeRevealed={safeRevealed}
          safeTotal={safeTotal}
        />
      )}

      {/* Provably Fair dialog */}
      <Dialog open={fairOpen} onOpenChange={setFairOpen}>
        <DialogContent
          showCloseButton={false}
          className="max-w-sm border-[#2A2A3A] p-5"
          style={{ background: "#16161F" }}
        >
          <div className="flex items-center justify-between mb-1">
            <DialogTitle className="font-heading text-xl text-[#F0F0F0] flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-[#7ED957]" />
              PROVABLY FAIR
            </DialogTitle>
            <button
              onClick={() => setFairOpen(false)}
              className="text-[#9999AA] hover:text-[#F0F0F0]"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <DialogDescription className="text-xs text-[#9999AA] leading-relaxed mb-3">
            Antes de cada jogo geramos um <strong>server_seed</strong> secreto
            e mostramos o seu SHA-256 (hash). As posições das minas são
            definidas por HMAC-SHA256(server_seed, client_seed:nonce). Quando
            o jogo termina o server_seed é revelado — você pode verificar que
            ele bate com o hash e que as minas estavam no lugar desde o
            início.
          </DialogDescription>

          {game && (
            <div className="space-y-2 text-[11px]">
              <FairRow
                label="Server seed hash"
                value={game.serverSeedHash}
                mono
              />
              <FairRow label="Client seed" value={game.clientSeed} />
              <FairRow label="Nonce" value={String(game.nonce)} />
              {finished?.serverSeed && (
                <FairRow
                  label="Server seed (revelado)"
                  value={finished.serverSeed}
                  mono
                  highlight
                />
              )}
              {finished?.minePositions && (
                <FairRow
                  label="Mine positions"
                  value={`[${finished.minePositions.join(", ")}]`}
                />
              )}
            </div>
          )}

          <Button
            onClick={() => setFairOpen(false)}
            className="w-full mt-4 bg-[#7ED957] text-[#0A0A0F] font-bold"
          >
            Entendi
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================================
// Bet view
// ============================================
function BetView({
  betAmount,
  customBet,
  setCustomBet,
  onBetPreset,
  minesCount,
  setMinesCount,
  effectiveBet,
  multiplierTable,
  clientSeed,
  setClientSeed,
  onStart,
  loading,
  maxBet,
}: {
  betAmount: number;
  customBet: string;
  setCustomBet: (v: string) => void;
  onBetPreset: (v: number) => void;
  minesCount: number;
  setMinesCount: (v: number) => void;
  effectiveBet: number;
  multiplierTable: { k: number; mult: number }[];
  clientSeed: string;
  setClientSeed: (v: string) => void;
  onStart: () => void;
  loading: boolean;
  maxBet: number;
}) {
  return (
    <div className="space-y-4">
      {/* Bet amount */}
      <div
        className="rounded-xl border border-[#2A2A3A] p-4 space-y-3"
        style={{ background: "#16161F" }}
      >
        <p className="text-[11px] uppercase tracking-wider text-[#9999AA] font-semibold">
          Valor da aposta
        </p>
        <div className="grid grid-cols-4 gap-2">
          {BET_PRESETS.map((v) => {
            const active = betAmount === v && !customBet;
            const disabled = v > maxBet;
            return (
              <button
                key={v}
                disabled={disabled}
                onClick={() => onBetPreset(v)}
                className={`h-10 rounded-lg text-sm font-bold transition-colors ${
                  active
                    ? "bg-[#7ED957] text-[#0A0A0F]"
                    : disabled
                    ? "bg-[#1C1C28] text-[#4A4A5A] cursor-not-allowed"
                    : "bg-[#1C1C28] text-[#F0F0F0] hover:bg-[#2A2A3A]"
                }`}
              >
                R$ {v}
              </button>
            );
          })}
        </div>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[#D4A017]">
            R$
          </span>
          <Input
            inputMode="decimal"
            placeholder="valor personalizado"
            value={customBet}
            onChange={(e) => setCustomBet(e.target.value)}
            className="pl-10 bg-[#0A0A0F] border-[#2A2A3A] text-[#F0F0F0] focus:border-[#7ED957]"
          />
        </div>
      </div>

      {/* Mines */}
      <div
        className="rounded-xl border border-[#2A2A3A] p-4 space-y-3"
        style={{ background: "#16161F" }}
      >
        <div className="flex items-center justify-between">
          <p className="text-[11px] uppercase tracking-wider text-[#9999AA] font-semibold">
            Quantidade de minas
          </p>
          <span className="text-[11px] text-[#9999AA]">
            {25 - minesCount} seguras
          </span>
        </div>
        <div className="grid grid-cols-5 gap-2">
          {MINES_PRESETS.map(({ count, label, color }) => {
            const active = minesCount === count;
            return (
              <button
                key={count}
                onClick={() => setMinesCount(count)}
                className={`flex flex-col items-center justify-center gap-0.5 h-14 rounded-lg border-2 transition-all ${
                  active
                    ? "border-[#F5C542] bg-[#1C1C28]"
                    : "border-[#2A2A3A] bg-[#1C1C28] hover:border-[#4A4A5A]"
                }`}
              >
                <span
                  className="font-heading text-lg font-bold leading-none"
                  style={{ color: active ? color : "#F0F0F0" }}
                >
                  {count}
                </span>
                <span className="text-[9px] text-[#6B6B80] uppercase tracking-wide">
                  {label}
                </span>
              </button>
            );
          })}
        </div>

        {/* Multiplier preview */}
        <div className="flex items-center justify-between gap-2 pt-1">
          {multiplierTable.map(({ k, mult }) => (
            <div
              key={k}
              className="flex-1 text-center rounded-md border border-[#2A2A3A] py-1.5"
              style={{ background: "#0A0A0F" }}
            >
              <p className="text-[9px] text-[#6B6B80] uppercase">
                {k} seg{k > 1 ? "." : "."}
              </p>
              <p className="text-sm font-bold text-[#F5C542]">
                {fmtMult(mult)}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Client seed (optional, collapsed) */}
      <details className="rounded-xl border border-[#2A2A3A] px-4 py-2 group">
        <summary className="text-[10px] text-[#6B6B80] uppercase tracking-wider cursor-pointer list-none flex items-center justify-between">
          <span>Client seed (opcional)</span>
          <ShieldCheck className="h-3 w-3 text-[#6B6B80] group-open:text-[#7ED957]" />
        </summary>
        <Input
          value={clientSeed}
          onChange={(e) => setClientSeed(e.target.value)}
          placeholder="default"
          className="mt-2 bg-[#0A0A0F] border-[#2A2A3A] text-[#F0F0F0] text-xs"
        />
      </details>

      {/* Play button */}
      <Button
        onClick={onStart}
        disabled={loading || effectiveBet < 1 || effectiveBet > maxBet}
        className="w-full h-14 bg-[#7ED957] text-[#0A0A0F] font-heading text-xl hover:bg-[#7ED957]/90 disabled:bg-[#2A2A3A] disabled:text-[#6B6B80]"
      >
        {loading ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <>
            JOGAR <span className="ml-2">{brl(effectiveBet)}</span>
          </>
        )}
      </Button>
    </div>
  );
}

// ============================================
// Game view (playing / lost / won)
// ============================================
function GameView({
  game,
  phase,
  finished,
  lastHitPosition,
  onReveal,
  onCashout,
  onNewGame,
  isPending,
  revealingPos,
  safeRevealed,
  safeTotal,
}: {
  game: GameState;
  phase: Phase;
  finished: FinishedInfo | null;
  lastHitPosition: number | null;
  onReveal: (pos: number) => void;
  onCashout: () => void;
  onNewGame: () => void;
  isPending: boolean;
  revealingPos: number | null;
  safeRevealed: number;
  safeTotal: number;
}) {
  const revealedSet = new Set(game.revealedPositions);
  const mineSet = finished ? new Set(finished.minePositions) : null;
  const isOver = phase === "lost" || phase === "won";

  return (
    <div className="space-y-4">
      {/* Game info strip */}
      <div className="grid grid-cols-3 gap-2">
        <InfoTile
          label="Aposta"
          value={brl(game.betAmount)}
          color="text-[#F0F0F0]"
        />
        <InfoTile
          label="Minas"
          value={`${game.minesCount}`}
          color="text-[#FF4757]"
        />
        <InfoTile
          label="Seguras"
          value={`${safeRevealed}/${safeTotal}`}
          color="text-[#7ED957]"
        />
      </div>

      {/* Grid */}
      <div
        className={`grid grid-cols-5 gap-1.5 ${
          phase === "lost" ? "animate-shake" : ""
        }`}
      >
        {Array.from({ length: 25 }, (_, i) => (
          <Tile
            key={i}
            position={i}
            revealed={revealedSet.has(i)}
            isMine={mineSet?.has(i) ?? false}
            wasHit={lastHitPosition === i}
            over={isOver}
            onClick={() => onReveal(i)}
            disabled={isPending || isOver || revealedSet.has(i)}
            loading={revealingPos === i}
          />
        ))}
      </div>

      {/* Multiplier + payout */}
      <div
        className="rounded-xl border border-[#2A2A3A] px-4 py-3 text-center"
        style={{ background: "#16161F" }}
      >
        <p className="text-[10px] text-[#6B6B80] uppercase tracking-wider">
          Multiplicador atual
        </p>
        <p className="font-heading text-4xl font-bold text-[#F5C542]">
          {fmtMult(game.multiplier)}
        </p>
        <p className="text-xs text-[#9999AA] mt-1">
          Retorno: <span className="text-[#7ED957] font-bold">{brl(game.payout)}</span>
        </p>
      </div>

      {/* Action button */}
      {phase === "playing" && (
        <Button
          onClick={onCashout}
          disabled={isPending || safeRevealed === 0}
          className="w-full h-14 bg-[#7ED957] text-[#0A0A0F] font-heading text-xl hover:bg-[#7ED957]/90 disabled:bg-[#2A2A3A] disabled:text-[#6B6B80] animate-pulse-soft"
        >
          {isPending ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : safeRevealed === 0 ? (
            "REVELE 1 TILE PRIMEIRO"
          ) : (
            <>
              RETIRAR <span className="ml-2">{brl(game.payout)}</span>
            </>
          )}
        </Button>
      )}

      {phase === "lost" && finished && (
        <div className="space-y-3">
          <div
            className="rounded-xl border-2 border-[#FF4757] p-4 text-center"
            style={{ background: "#16161F" }}
          >
            <Bomb className="h-10 w-10 text-[#FF4757] mx-auto mb-2" />
            <p className="font-heading text-2xl text-[#FF4757] font-bold">
              BOOM! 💥
            </p>
            <p className="text-sm text-[#9999AA] mt-1">
              Você bateu numa mina e perdeu {brl(game.betAmount)}.
            </p>
          </div>
          <Button
            onClick={onNewGame}
            className="w-full h-12 bg-[#7ED957] text-[#0A0A0F] font-bold"
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Jogar novamente
          </Button>
        </div>
      )}

      {phase === "won" && finished && (
        <div className="space-y-3">
          <div
            className="rounded-xl border-2 border-[#7ED957] p-4 text-center"
            style={{ background: "#16161F" }}
          >
            <Trophy className="h-10 w-10 text-[#7ED957] mx-auto mb-2" />
            <p className="font-heading text-2xl text-[#7ED957] font-bold">
              GANHOU! 🏆
            </p>
            <p className="text-[11px] text-[#9999AA] mt-1">
              {finished.autoCashout
                ? "Todas as tiles seguras reveladas! Auto-cashout."
                : `Retirada em ${fmtMult(finished.multiplier)}`}
            </p>
            <p className="font-heading text-3xl text-[#F5C542] font-bold mt-2">
              +{brl(finished.payout)}
            </p>
          </div>
          <Button
            onClick={onNewGame}
            className="w-full h-12 bg-[#7ED957] text-[#0A0A0F] font-bold"
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Jogar novamente
          </Button>
        </div>
      )}
    </div>
  );
}

function InfoTile({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div
      className="rounded-lg border border-[#2A2A3A] px-2 py-2 text-center"
      style={{ background: "#16161F" }}
    >
      <p className="text-[9px] uppercase tracking-wide text-[#6B6B80]">
        {label}
      </p>
      <p className={`text-sm font-bold ${color}`}>{value}</p>
    </div>
  );
}

function Tile({
  position,
  revealed,
  isMine,
  wasHit,
  over,
  onClick,
  disabled,
  loading,
}: {
  position: number;
  revealed: boolean;
  isMine: boolean;
  wasHit: boolean;
  over: boolean;
  onClick: () => void;
  disabled: boolean;
  loading: boolean;
}) {
  // Determine visual state
  const showMine = over && isMine;
  const showSafe = revealed && !isMine;
  const showHidden = !revealed && !(over && isMine);

  let classes =
    "aspect-square flex items-center justify-center rounded-lg border-2 transition-all duration-200";
  let content: React.ReactNode = null;

  if (showSafe) {
    classes += " bg-[#7ED957]/20 border-[#7ED957] scale-95";
    content = <Gem className="h-5 w-5 text-[#7ED957]" />;
  } else if (showMine) {
    if (wasHit) {
      classes += " bg-[#FF4757] border-[#FF4757] animate-pop";
    } else {
      classes += " bg-[#FF4757]/30 border-[#FF4757]/60";
    }
    content = <Bomb className="h-5 w-5 text-[#FF4757]" />;
  } else if (showHidden) {
    classes += " bg-[#1C1C28] border-[#2A2A3A]";
    if (!disabled) classes += " hover:border-[#F5C542] active:scale-95";
    if (loading) classes += " bg-[#2A2A3A]";
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={`Tile ${position + 1}`}
      className={classes}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin text-[#F5C542]" /> : content}
      {!loading && showHidden && (
        <Sparkles className="h-3 w-3 text-[#2A2A3A]" />
      )}
    </button>
  );
}

function FairRow({
  label,
  value,
  mono,
  highlight,
}: {
  label: string;
  value: string;
  mono?: boolean;
  highlight?: boolean;
}) {
  return (
    <div>
      <p className="text-[9px] uppercase tracking-wider text-[#6B6B80]">
        {label}
      </p>
      <p
        className={`${mono ? "font-mono" : ""} ${
          highlight ? "text-[#7ED957]" : "text-[#F0F0F0]"
        } break-all text-[10px] leading-snug`}
      >
        {value}
      </p>
    </div>
  );
}
