"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Rocket, RotateCcw, ShieldCheck, TrendingUp } from "lucide-react";
import {
  startGame,
  cashout as cashoutAction,
  peek as peekAction,
  type CrashActiveGame,
} from "@/app/actions/crash";

const QUICK = [1, 2, 5, 10];
const MIN_BET = 1;
const MAX_BET = 10;

type Phase = "idle" | "flying" | "cashed" | "crashed";

type Active = {
  gameId: string;
  betAmount: number;
  startedAtMs: number;
  growthK: number;
  maxPayout: number;
};

function brl(n: number) {
  return `R$ ${n.toFixed(2).replace(".", ",")}`;
}

export function CrashClient({
  balance: initialBalance,
  initialGame,
}: {
  balance: number;
  initialGame: CrashActiveGame | null;
}) {
  const router = useRouter();
  const [balance, setBalance] = useState(initialBalance);
  const [phase, setPhase] = useState<Phase>(initialGame ? "flying" : "idle");
  const [amount, setAmount] = useState("2");
  const [multiplier, setMultiplier] = useState(1);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<{
    multiplier: number;
    payout?: number;
    crashPoint: number;
    serverSeed: string;
    capped?: boolean;
  } | null>(null);

  const active = useRef<Active | null>(
    initialGame
      ? {
          gameId: initialGame.gameId,
          betAmount: initialGame.betAmount,
          startedAtMs: Date.parse(initialGame.startedAt),
          growthK: initialGame.growthK,
          maxPayout: initialGame.maxPayout,
        }
      : null
  );
  const rafRef = useRef<number | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const phaseRef = useRef<Phase>(phase);
  phaseRef.current = phase;

  const numAmount = parseFloat(amount) || 0;
  const invalid = numAmount < MIN_BET || numAmount > MAX_BET || numAmount > balance;

  const stopLoops = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (pollRef.current) clearInterval(pollRef.current);
    rafRef.current = null;
    pollRef.current = null;
  }, []);

  const currentMultiplier = useCallback(() => {
    const a = active.current;
    if (!a) return 1;
    const elapsed = (Date.now() - a.startedAtMs) / 1000;
    if (elapsed <= 0) return 1;
    return Math.floor(Math.exp(a.growthK * elapsed) * 100) / 100;
  }, []);

  const onCrashed = useCallback(
    (crashPoint: number, serverSeed: string) => {
      stopLoops();
      setMultiplier(crashPoint);
      setResult({ multiplier: crashPoint, crashPoint, serverSeed });
      setPhase("crashed");
      active.current = null;
      router.refresh();
    },
    [router, stopLoops]
  );

  // Loop de voo: anima o multiplicador + faz polling do servidor pra detectar a explosão
  const startFlyingLoop = useCallback(() => {
    stopLoops();
    const tick = () => {
      if (phaseRef.current !== "flying") return;
      setMultiplier(currentMultiplier());
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    pollRef.current = setInterval(async () => {
      const a = active.current;
      if (!a || phaseRef.current !== "flying") return;
      const res = await peekAction(a.gameId);
      if (!res.ok) return;
      if (res.data.status === "crashed") {
        onCrashed(res.data.crashPoint, res.data.serverSeed);
      } else if (res.data.status === "won") {
        // já foi sacado em outro lugar
        stopLoops();
        setPhase("cashed");
        active.current = null;
      }
    }, 700);
  }, [currentMultiplier, onCrashed, stopLoops]);

  useEffect(() => {
    if (phase === "flying" && active.current) {
      startFlyingLoop();
    }
    return () => stopLoops();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleStart() {
    if (invalid || pending) return;
    setPending(true);
    setResult(null);
    const res = await startGame(numAmount);
    setPending(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setBalance(res.data.newBalance);
    active.current = {
      gameId: res.data.gameId,
      betAmount: res.data.betAmount,
      startedAtMs: Date.parse(res.data.startedAt),
      growthK: res.data.growthK,
      maxPayout: res.data.maxPayout,
    };
    setMultiplier(1);
    setPhase("flying");
    startFlyingLoop();
    router.refresh();
  }

  async function handleCashout() {
    const a = active.current;
    if (!a || pending || phase !== "flying") return;
    setPending(true);
    const res = await cashoutAction(a.gameId);
    setPending(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    if (res.data.result === "crashed") {
      onCrashed(res.data.crashPoint, res.data.serverSeed);
      toast.error("Explodiu antes! 💥");
      return;
    }
    stopLoops();
    setBalance(res.data.newBalance);
    setMultiplier(res.data.multiplier);
    setResult({
      multiplier: res.data.multiplier,
      payout: res.data.payout,
      crashPoint: res.data.crashPoint,
      serverSeed: res.data.serverSeed,
      capped: res.data.capped,
    });
    setPhase("cashed");
    active.current = null;
    toast.success(`Sacou ${res.data.multiplier.toFixed(2)}x! +${brl(res.data.payout)} 🚀`);
    router.refresh();
  }

  function handleNew() {
    setPhase("idle");
    setResult(null);
    setMultiplier(1);
  }

  const bet = active.current?.betAmount ?? numAmount;
  const maxPayout = active.current?.maxPayout ?? 100;
  const potential = Math.min(bet * multiplier, maxPayout);
  const atCap = bet * multiplier >= maxPayout;

  return (
    <div className="space-y-4 pb-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Rocket className="h-5 w-5 text-[#F5C542]" />
          <h1 className="font-heading text-2xl text-[#F0F0F0]">FOGUETINHO</h1>
        </div>
        <span className="text-xs text-[#9999AA]">
          Saldo <span className="font-bold text-[#7ED957]">{brl(balance)}</span>
        </span>
      </div>

      {/* Tela do foguete */}
      <div
        className={`relative rounded-2xl border-2 overflow-hidden h-64 flex flex-col items-center justify-center transition-colors ${
          phase === "crashed"
            ? "border-[#FF4757]"
            : phase === "cashed"
            ? "border-[#7ED957]"
            : "border-[#2A2A3A]"
        }`}
        style={{ background: "radial-gradient(circle at 50% 120%, #1C1C28, #0A0A0F)" }}
      >
        {/* Foguete subindo conforme o multiplicador */}
        {phase === "flying" && (
          <div
            className="absolute text-4xl transition-all duration-75"
            style={{
              bottom: `${Math.min(8 + (multiplier - 1) * 22, 78)}%`,
              left: `${Math.min(20 + (multiplier - 1) * 10, 70)}%`,
            }}
          >
            🚀
          </div>
        )}

        <div className="text-center z-10">
          {phase === "crashed" ? (
            <>
              <p className="text-5xl mb-1">💥</p>
              <p className="font-heading text-4xl text-[#FF4757] font-bold">
                {result?.crashPoint.toFixed(2)}x
              </p>
              <p className="text-sm text-[#FF4757] mt-1">Explodiu!</p>
            </>
          ) : (
            <>
              <p
                className={`font-heading font-bold tabular-nums ${
                  phase === "cashed" ? "text-[#7ED957]" : "text-[#F0F0F0]"
                } text-6xl`}
              >
                {multiplier.toFixed(2)}x
              </p>
              {phase === "flying" && (
                <p className="text-xs text-[#9999AA] mt-2 flex items-center justify-center gap-1">
                  <TrendingUp className="h-3 w-3" /> vale {brl(potential)}
                  {atCap && <span className="text-[#F5C542]"> (máx)</span>}
                </p>
              )}
              {phase === "cashed" && (
                <p className="text-sm text-[#7ED957] mt-1 font-bold">
                  Sacou +{brl(result?.payout ?? 0)}
                  {result?.capped && <span className="text-[#F5C542]"> (teto)</span>}
                </p>
              )}
              {phase === "idle" && (
                <p className="text-xs text-[#6B6B80] mt-2">
                  Solte o foguete e saque antes de explodir
                </p>
              )}
            </>
          )}
        </div>
      </div>

      {/* Controles */}
      {phase === "flying" ? (
        <Button
          onClick={handleCashout}
          disabled={pending}
          className="w-full h-14 bg-[#7ED957] text-[#0A0A0F] font-bold text-lg hover:bg-[#7ED957]/90 tap-scale"
        >
          {pending ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <>SACAR {brl(potential)}</>
          )}
        </Button>
      ) : phase === "crashed" || phase === "cashed" ? (
        <div className="space-y-3">
          {result && (
            <FairBox
              crashPoint={result.crashPoint}
              serverSeed={result.serverSeed}
            />
          )}
          <Button
            onClick={handleNew}
            className="w-full h-12 bg-[#7ED957] text-[#0A0A0F] font-bold"
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Jogar novamente
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-[#D4A017]">
              R$
            </span>
            <Input
              type="number"
              min={MIN_BET}
              max={MAX_BET}
              step="1"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="pl-10 h-12 text-lg bg-[#0A0A0F] border-[#2A2A3A] text-[#F0F0F0]"
            />
          </div>
          <div className="flex gap-2">
            {QUICK.map((v) => (
              <button
                key={v}
                onClick={() => setAmount(String(v))}
                className={`flex-1 py-2 rounded-lg text-xs font-bold border transition-colors ${
                  amount === String(v)
                    ? "bg-[#7ED957] text-[#0A0A0F] border-[#7ED957]"
                    : "bg-[#1C1C28] text-[#9999AA] border-[#2A2A3A]"
                }`}
              >
                R$ {v}
              </button>
            ))}
          </div>
          <Button
            onClick={handleStart}
            disabled={pending || invalid}
            className="w-full h-14 bg-[#F5C542] text-[#0A0A0F] font-bold text-lg hover:bg-[#F5C542]/90 disabled:opacity-50 tap-scale"
          >
            {pending ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <>
                <Rocket className="h-5 w-5 mr-2" /> SOLTAR FOGUETE
              </>
            )}
          </Button>
          <p className="text-[10px] text-center text-[#6B6B80]">
            Aposta R$ 1 a R$ 10 · ganho máx R$ 100 · RTP 95%
          </p>
        </div>
      )}
    </div>
  );
}

function FairBox({
  crashPoint,
  serverSeed,
}: {
  crashPoint: number;
  serverSeed: string;
}) {
  return (
    <div
      className="rounded-lg border border-[#2A2A3A] p-3 space-y-1"
      style={{ background: "#16161F" }}
    >
      <p className="text-[10px] uppercase tracking-wider text-[#9999AA] font-semibold flex items-center gap-1">
        <ShieldCheck className="h-3 w-3 text-[#7ED957]" /> Provably Fair
      </p>
      <p className="text-[10px] text-[#6B6B80]">
        Explodiu em <span className="text-[#F0F0F0]">{crashPoint.toFixed(2)}x</span>
      </p>
      <p className="text-[9px] text-[#6B6B80] break-all">
        server_seed: <span className="text-[#9999AA]">{serverSeed}</span>
      </p>
    </div>
  );
}
