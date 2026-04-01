import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { WalletClient } from "./wallet-client";

export default async function WalletPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: wallet } = await supabase
    .from("wallets")
    .select("*")
    .eq("user_id", user.id)
    .single();

  const { data: profile } = await supabase
    .from("profiles")
    .select("pix_key")
    .eq("id", user.id)
    .single();

  const { data: transactions } = await supabase
    .from("transactions")
    .select("*")
    .eq("wallet_id", wallet?.id)
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <WalletClient
      balance={wallet?.balance ?? 0}
      userPixKey={profile?.pix_key ?? ""}
      transactions={transactions ?? []}
    />
  );
}
