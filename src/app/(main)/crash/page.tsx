import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Rocket, Wallet as WalletIcon, ArrowRight } from "lucide-react";
import { getActiveGame } from "@/app/actions/crash";
import { CrashClient } from "./crash-client";

export default async function CrashPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: wallet } = await supabase
    .from("wallets")
    .select("balance")
    .eq("user_id", user.id)
    .single();

  const balance = Number(wallet?.balance ?? 0);
  const activeGame = await getActiveGame();

  if (balance <= 0 && !activeGame) {
    return <NoBalanceScreen />;
  }

  return <CrashClient balance={balance} initialGame={activeGame} />;
}

function NoBalanceScreen() {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <Rocket className="h-5 w-5 text-[#F5C542]" />
        <h1 className="font-heading text-2xl text-[#F0F0F0]">FOGUETINHO</h1>
      </div>

      <div
        className="rounded-xl border-2 border-[#FF4757]/60 p-6 text-center space-y-4"
        style={{ background: "#16161F" }}
      >
        <div className="h-14 w-14 rounded-full border-2 border-[#FF4757] bg-[#FF4757]/15 mx-auto flex items-center justify-center">
          <WalletIcon className="h-6 w-6 text-[#FF4757]" />
        </div>
        <div className="space-y-1.5">
          <p className="font-heading text-xl text-[#FF4757] font-bold">
            SEM SALDO
          </p>
          <p className="text-sm text-[#F0F0F0] leading-relaxed">
            Você precisa de saldo na carteira
            <br />
            pra soltar o Foguetinho.
          </p>
        </div>
        <Link
          href="/wallet"
          className="flex items-center justify-center gap-2 h-12 rounded-lg bg-[#7ED957] text-[#0A0A0F] font-bold text-sm hover:bg-[#7ED957]/90 transition-colors"
        >
          <WalletIcon className="h-4 w-4" />
          Ir pra Carteira
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      <div
        className="rounded-xl border border-[#2A2A3A] p-4 space-y-2"
        style={{ background: "#16161F" }}
      >
        <p className="text-[10px] uppercase tracking-wider text-[#9999AA] font-semibold">
          Como funciona o Foguetinho
        </p>
        <ul className="text-xs text-[#9999AA] leading-relaxed space-y-1">
          <li>• O multiplicador sobe enquanto o foguete voa 🚀</li>
          <li>• Saque antes dele explodir pra levar a aposta × multiplicador</li>
          <li>• Explodiu antes de você sacar = perde a aposta</li>
          <li>• Aposta de R$ 1 a R$ 10, ganho máximo R$ 100 por jogo</li>
        </ul>
      </div>
    </div>
  );
}
