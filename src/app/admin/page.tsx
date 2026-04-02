import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  LayoutDashboard,
  Users,
  Wallet,
  Clock,
  CheckCircle,
} from "lucide-react";

export default async function AdminDashboardPage() {
  const supabase = await createClient();

  const [usersRes, walletsRes, pendingRes, settledRes, recentBetsRes] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("*", { count: "exact", head: true }),
      supabase.from("wallets").select("balance"),
      supabase
        .from("bets")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending"),
      supabase
        .from("bets")
        .select("*", { count: "exact", head: true })
        .in("status", ["won", "lost"]),
      supabase
        .from("bets")
        .select(
          `
          id, amount, status, created_at,
          profile:profiles!user_id(full_name),
          market_option:market_options!option_id(label),
          market:markets!market_id(
            fight:fights!fight_id(
              fighter_a:fighters!fighter_a_id(name),
              fighter_b:fighters!fighter_b_id(name)
            )
          )
        `
        )
        .order("created_at", { ascending: false })
        .limit(5),
    ]);

  const totalWallets =
    walletsRes.data?.reduce((sum, w) => sum + Number(w.balance), 0) ?? 0;

  const metrics = [
    {
      label: "Total de Usuários",
      value: usersRes.count ?? 0,
      icon: Users,
      color: "var(--brand-green)",
    },
    {
      label: "Total em Wallets",
      value: `R$ ${totalWallets.toFixed(2)}`,
      icon: Wallet,
      color: "var(--brand-gold)",
      isMoney: true,
    },
    {
      label: "Apostas Ativas",
      value: pendingRes.count ?? 0,
      icon: Clock,
      color: "var(--color-warning)",
    },
    {
      label: "Apostas Liquidadas",
      value: settledRes.count ?? 0,
      icon: CheckCircle,
      color: "var(--brand-blue)",
    },
  ];

  const recentBets = recentBetsRes.data ?? [];

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-2">
        <LayoutDashboard className="h-6 w-6 text-[var(--brand-gold)]" />
        <h1 className="font-heading text-3xl text-[var(--text-primary)]">
          DASHBOARD
        </h1>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((m) => {
          const Icon = m.icon;
          return (
            <Card
              key={m.label}
              className="border-[var(--border-default)] overflow-hidden"
              style={{ background: "var(--bg-card)" }}
            >
              <div
                className="h-1"
                style={{ background: "var(--brand-gold)" }}
              />
              <CardContent className="pt-4 pb-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs text-[var(--text-muted)] mb-1">
                      {m.label}
                    </p>
                    <p
                      className="text-2xl font-bold"
                      style={{ color: m.color }}
                    >
                      {m.value}
                    </p>
                  </div>
                  <div
                    className="h-9 w-9 rounded-lg flex items-center justify-center"
                    style={{ background: "var(--bg-elevated)" }}
                  >
                    <Icon className="h-5 w-5" style={{ color: m.color }} />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Recent Bets Table */}
      <div>
        <h2 className="font-heading text-xl text-[var(--text-primary)] mb-3">
          ÚLTIMAS APOSTAS
        </h2>
        <Card
          className="border-[var(--border-default)] overflow-hidden"
          style={{ background: "var(--bg-card)" }}
        >
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-[var(--border-default)] hover:bg-transparent">
                  <TableHead className="text-[var(--text-muted)] text-xs">
                    Apostador
                  </TableHead>
                  <TableHead className="text-[var(--text-muted)] text-xs">
                    Luta
                  </TableHead>
                  <TableHead className="text-[var(--text-muted)] text-xs">
                    Seleção
                  </TableHead>
                  <TableHead className="text-[var(--text-muted)] text-xs text-right">
                    Valor
                  </TableHead>
                  <TableHead className="text-[var(--text-muted)] text-xs text-center">
                    Status
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentBets.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="text-center text-[var(--text-muted)] py-8"
                    >
                      Nenhuma aposta ainda.
                    </TableCell>
                  </TableRow>
                ) : (
                  recentBets.map(
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    (bet: any) => (
                      <TableRow
                        key={bet.id}
                        className="border-[var(--border-default)]"
                      >
                        <TableCell className="text-sm text-[var(--text-primary)]">
                          {bet.profile?.full_name ?? "—"}
                        </TableCell>
                        <TableCell className="text-sm text-[var(--text-secondary)]">
                          {bet.market?.fight?.fighter_a?.name ?? "?"} vs{" "}
                          {bet.market?.fight?.fighter_b?.name ?? "?"}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className="text-xs border-[var(--brand-green)] text-[var(--brand-green)]"
                          >
                            {bet.market_option?.label ?? "—"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right text-sm font-bold text-[var(--brand-gold)]">
                          R$ {Number(bet.amount).toFixed(2)}
                        </TableCell>
                        <TableCell className="text-center">
                          <BetStatusBadge status={bet.status} />
                        </TableCell>
                      </TableRow>
                    )
                  )
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>
    </div>
  );
}

function BetStatusBadge({ status }: { status: string }) {
  switch (status) {
    case "pending":
      return (
        <Badge
          variant="outline"
          className="text-[10px] border-[var(--color-warning)] text-[var(--color-warning)]"
        >
          Pendente
        </Badge>
      );
    case "won":
      return (
        <Badge className="text-[10px] bg-[var(--color-success)] text-[var(--bg-primary)]">
          Ganhou
        </Badge>
      );
    case "lost":
      return (
        <Badge className="text-[10px] bg-[var(--color-danger)] text-white">
          Perdeu
        </Badge>
      );
    case "refunded":
      return (
        <Badge
          variant="outline"
          className="text-[10px] border-[var(--brand-blue)] text-[var(--brand-blue)]"
        >
          Reembolso
        </Badge>
      );
    default:
      return null;
  }
}
