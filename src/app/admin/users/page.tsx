"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { z } from "zod";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  UserCog,
  Loader2,
  ArrowDownCircle,
  ArrowUpCircle,
  Shield,
  Search,
  Filter,
  X,
  ArrowUpDown,
} from "lucide-react";

const transactionSchema = z.object({
  amount: z
    .number({ error: "Informe um valor válido" })
    .positive("Valor deve ser positivo")
    .max(100000, "Valor máximo R$ 100.000"),
});

type UserRow = {
  id: string;
  user_id: string;
  balance: number;
  profile?: {
    full_name: string;
    phone: string | null;
    pix_key: string | null;
    role: string;
  };
  total_wagered: number;
  email?: string;
};

type BalanceFilter = "all" | "with" | "without";
type PixFilter = "all" | "with" | "without";
type WageredFilter = "all" | "yes" | "no";
type RoleFilter = "all" | "admin" | "user";
type SortField = "name" | "balance" | "wagered";
type SortDir = "asc" | "desc";

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [balanceFilter, setBalanceFilter] = useState<BalanceFilter>("all");
  const [pixFilter, setPixFilter] = useState<PixFilter>("all");
  const [wageredFilter, setWageredFilter] = useState<WageredFilter>("all");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [sortField, setSortField] = useState<SortField>("balance");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [modalOpen, setModalOpen] = useState(false);
  const [modalType, setModalType] = useState<"deposit" | "withdraw">("deposit");
  const [selectedUser, setSelectedUser] = useState<UserRow | null>(null);
  const [amount, setAmount] = useState("");
  const [processing, setProcessing] = useState(false);

  const supabase = createClient();

  const loadUsers = useCallback(async () => {
    // Fetch wallets with profiles
    const { data: wallets } = await supabase
      .from("wallets")
      .select(
        "id, user_id, balance, profile:profiles!user_id(full_name, phone, pix_key, role)"
      )
      .order("updated_at", { ascending: false });

    // Fetch total wagered per user
    const { data: betsAgg } = await supabase
      .from("bets")
      .select("user_id, amount");

    const wagerMap: Record<string, number> = {};
    if (betsAgg) {
      for (const b of betsAgg) {
        wagerMap[b.user_id] = (wagerMap[b.user_id] ?? 0) + Number(b.amount);
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows: UserRow[] = (wallets ?? []).map((w: any) => ({
      ...w,
      profile: Array.isArray(w.profile) ? w.profile[0] : w.profile,
      total_wagered: wagerMap[w.user_id] ?? 0,
    }));

    setUsers(rows);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  function openModal(user: UserRow, type: "deposit" | "withdraw") {
    setSelectedUser(user);
    setModalType(type);
    setAmount("");
    setModalOpen(true);
  }

  async function handleTransaction(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedUser) return;

    const parsed = transactionSchema.safeParse({
      amount: parseFloat(amount),
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }

    const txAmount = parsed.data.amount;

    if (modalType === "withdraw" && selectedUser.balance < txAmount) {
      toast.error("Saldo insuficiente do usuário");
      return;
    }

    setProcessing(true);

    const { data: wallet } = await supabase
      .from("wallets")
      .select("balance")
      .eq("id", selectedUser.id)
      .single();

    if (!wallet) {
      toast.error("Carteira não encontrada");
      setProcessing(false);
      return;
    }

    const newBalance =
      modalType === "deposit"
        ? Number(wallet.balance) + txAmount
        : Number(wallet.balance) - txAmount;

    const { error: walletError } = await supabase
      .from("wallets")
      .update({ balance: newBalance, updated_at: new Date().toISOString() })
      .eq("id", selectedUser.id);

    if (walletError) {
      toast.error(walletError.message);
      setProcessing(false);
      return;
    }

    const { error: txError } = await supabase.from("transactions").insert({
      wallet_id: selectedUser.id,
      type: modalType,
      amount: modalType === "deposit" ? txAmount : -txAmount,
      balance_after: newBalance,
      description:
        modalType === "deposit" ? "Depósito via admin" : "Saque via admin",
    });

    if (txError) {
      toast.error(txError.message);
    } else {
      toast.success(
        modalType === "deposit"
          ? `R$ ${txAmount.toFixed(2)} depositado!`
          : `R$ ${txAmount.toFixed(2)} sacado!`
      );
      setModalOpen(false);
      loadUsers();
    }
    setProcessing(false);
  }

  async function toggleAdmin(userId: string, currentRole: string) {
    const newRole = currentRole === "admin" ? "user" : "admin";
    if (
      newRole === "user" &&
      !confirm("Remover permissão de admin deste usuário?")
    )
      return;
    const { error } = await supabase
      .from("profiles")
      .update({ role: newRole })
      .eq("id", userId);
    if (error) toast.error(error.message);
    else {
      toast.success(
        newRole === "admin" ? "Promovido a admin!" : "Rebaixado a usuário"
      );
      loadUsers();
    }
  }

  const filteredUsers = useMemo(() => {
    const searchLower = search.trim().toLowerCase();

    const filtered = users.filter((u) => {
      // Search (name, phone, pix)
      if (searchLower) {
        const haystack = [
          u.profile?.full_name,
          u.profile?.phone,
          u.profile?.pix_key,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(searchLower)) return false;
      }

      // Balance filter
      const bal = Number(u.balance);
      if (balanceFilter === "with" && bal <= 0) return false;
      if (balanceFilter === "without" && bal > 0) return false;

      // PIX filter
      const hasPix = !!u.profile?.pix_key?.trim();
      if (pixFilter === "with" && !hasPix) return false;
      if (pixFilter === "without" && hasPix) return false;

      // Wagered filter
      if (wageredFilter === "yes" && u.total_wagered <= 0) return false;
      if (wageredFilter === "no" && u.total_wagered > 0) return false;

      // Role filter
      const role = u.profile?.role ?? "user";
      if (roleFilter === "admin" && role !== "admin") return false;
      if (roleFilter === "user" && role === "admin") return false;

      return true;
    });

    const sorted = [...filtered].sort((a, b) => {
      let cmp = 0;
      if (sortField === "name") {
        cmp = (a.profile?.full_name ?? "").localeCompare(
          b.profile?.full_name ?? "",
          "pt-BR"
        );
      } else if (sortField === "balance") {
        cmp = Number(a.balance) - Number(b.balance);
      } else if (sortField === "wagered") {
        cmp = a.total_wagered - b.total_wagered;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return sorted;
  }, [
    users,
    search,
    balanceFilter,
    pixFilter,
    wageredFilter,
    roleFilter,
    sortField,
    sortDir,
  ]);

  const totals = useMemo(() => {
    let balance = 0;
    let wagered = 0;
    for (const u of filteredUsers) {
      balance += Number(u.balance);
      wagered += u.total_wagered;
    }
    return { balance, wagered, count: filteredUsers.length };
  }, [filteredUsers]);

  const hasActiveFilters =
    balanceFilter !== "all" ||
    pixFilter !== "all" ||
    wageredFilter !== "all" ||
    roleFilter !== "all" ||
    search.trim() !== "";

  function clearFilters() {
    setSearch("");
    setBalanceFilter("all");
    setPixFilter("all");
    setWageredFilter("all");
    setRoleFilter("all");
  }

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir(field === "name" ? "asc" : "desc");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <UserCog className="h-6 w-6 text-[var(--brand-gold)]" />
        <h1 className="font-heading text-3xl text-[var(--text-primary)]">
          USUÁRIOS
        </h1>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-muted)]" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nome, telefone ou PIX..."
          className="pl-10 bg-[var(--bg-card)] border-[var(--border-default)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
        />
      </div>

      {/* Filters */}
      <Card
        className="border-[var(--border-default)] p-4"
        style={{ background: "var(--bg-card)" }}
      >
        <div className="flex items-center gap-2 mb-3">
          <Filter className="h-4 w-4 text-[var(--brand-gold)]" />
          <p className="text-xs uppercase tracking-wider text-[var(--text-muted)] font-semibold">
            Filtros
          </p>
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="ml-auto flex items-center gap-1 text-[11px] text-[var(--text-muted)] hover:text-[var(--brand-gold)] transition-colors"
            >
              <X className="h-3 w-3" /> Limpar
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <FilterSelect
            label="Saldo"
            value={balanceFilter}
            onChange={(v) => setBalanceFilter(v as BalanceFilter)}
            options={[
              { value: "all", label: "Todos" },
              { value: "with", label: "Com saldo (> 0)" },
              { value: "without", label: "Sem saldo" },
            ]}
          />
          <FilterSelect
            label="PIX"
            value={pixFilter}
            onChange={(v) => setPixFilter(v as PixFilter)}
            options={[
              { value: "all", label: "Todos" },
              { value: "with", label: "Com chave PIX" },
              { value: "without", label: "Sem chave PIX" },
            ]}
          />
          <FilterSelect
            label="Apostas"
            value={wageredFilter}
            onChange={(v) => setWageredFilter(v as WageredFilter)}
            options={[
              { value: "all", label: "Todos" },
              { value: "yes", label: "Já apostou" },
              { value: "no", label: "Nunca apostou" },
            ]}
          />
          <FilterSelect
            label="Tipo"
            value={roleFilter}
            onChange={(v) => setRoleFilter(v as RoleFilter)}
            options={[
              { value: "all", label: "Todos" },
              { value: "admin", label: "Admins" },
              { value: "user", label: "Usuários" },
            ]}
          />
        </div>
      </Card>

      {/* Totals row for filtered selection */}
      {!loading && (
        <div
          className="grid grid-cols-3 gap-3 rounded-lg border border-[var(--border-default)] p-3"
          style={{ background: "var(--bg-card)" }}
        >
          <div>
            <p className="text-[10px] uppercase tracking-wide text-[var(--text-muted)]">
              Usuários
            </p>
            <p className="text-lg font-bold text-[var(--text-primary)]">
              {totals.count}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wide text-[var(--text-muted)]">
              Soma dos saldos
            </p>
            <p className="text-lg font-bold text-[var(--brand-gold)]">
              R$ {totals.balance.toFixed(2)}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wide text-[var(--text-muted)]">
              Total apostado
            </p>
            <p className="text-lg font-bold text-[var(--text-secondary)]">
              R$ {totals.wagered.toFixed(2)}
            </p>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-[var(--brand-green)]" />
        </div>
      ) : (
        <Card
          className="border-[var(--border-default)] overflow-hidden"
          style={{ background: "var(--bg-card)" }}
        >
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-[var(--border-default)] hover:bg-transparent">
                  <TableHead className="text-[var(--text-muted)] text-xs">
                    <SortHeader
                      label="Nome"
                      active={sortField === "name"}
                      dir={sortDir}
                      onClick={() => toggleSort("name")}
                    />
                  </TableHead>
                  <TableHead className="text-[var(--text-muted)] text-xs">
                    PIX
                  </TableHead>
                  <TableHead className="text-[var(--text-muted)] text-xs text-right">
                    <SortHeader
                      label="Saldo"
                      active={sortField === "balance"}
                      dir={sortDir}
                      onClick={() => toggleSort("balance")}
                      align="right"
                    />
                  </TableHead>
                  <TableHead className="text-[var(--text-muted)] text-xs text-right">
                    <SortHeader
                      label="Total Apostado"
                      active={sortField === "wagered"}
                      dir={sortDir}
                      onClick={() => toggleSort("wagered")}
                      align="right"
                    />
                  </TableHead>
                  <TableHead className="text-[var(--text-muted)] text-xs text-center">
                    Role
                  </TableHead>
                  <TableHead className="text-[var(--text-muted)] text-xs text-right">
                    Ações
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="text-center text-[var(--text-muted)] py-8"
                    >
                      Nenhum usuário encontrado.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map((u) => (
                    <TableRow
                      key={u.id}
                      className="border-[var(--border-default)]"
                    >
                      <TableCell>
                        <div>
                          <p className="text-sm font-medium text-[var(--text-primary)]">
                            {u.profile?.full_name ?? "—"}
                          </p>
                          {u.profile?.phone && (
                            <p className="text-xs text-[var(--text-muted)]">
                              {u.profile.phone}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-[var(--text-secondary)]">
                        {u.profile?.pix_key ?? (
                          <span className="text-[var(--text-muted)]">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right text-sm font-bold text-[var(--brand-gold)]">
                        R$ {Number(u.balance).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right text-sm text-[var(--text-secondary)]">
                        R$ {u.total_wagered.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-center">
                        <button onClick={() => toggleAdmin(u.user_id, u.profile?.role ?? "user")}>
                          {u.profile?.role === "admin" ? (
                            <Badge className="bg-[var(--brand-gold)] text-[var(--bg-primary)] text-[10px] cursor-pointer">
                              <Shield className="h-3 w-3 mr-0.5" />
                              Admin
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="text-[10px] border-[var(--border-default)] text-[var(--text-muted)] cursor-pointer hover:border-[var(--brand-gold)]"
                            >
                              User
                            </Badge>
                          )}
                        </button>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            size="sm"
                            onClick={() => openModal(u, "deposit")}
                            className="bg-[var(--color-success)] text-[var(--bg-primary)] text-xs h-7 px-2"
                          >
                            <ArrowDownCircle className="h-3 w-3 mr-1" />
                            Dep.
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openModal(u, "withdraw")}
                            className="border-[var(--color-danger)] text-[var(--color-danger)] text-xs h-7 px-2"
                          >
                            <ArrowUpCircle className="h-3 w-3 mr-1" />
                            Saque
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {/* Transaction Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
          <DialogContent
            showCloseButton={false}
            className="max-w-sm border-[var(--border-default)] p-6"
            style={{ background: "var(--bg-card)" }}
          >
            <DialogTitle className="font-heading text-2xl text-[var(--text-primary)] mb-1">
              {modalType === "deposit" ? "DEPOSITAR" : "SACAR"}
            </DialogTitle>
            <DialogDescription className="text-sm text-[var(--text-secondary)] mb-4">
              {selectedUser?.profile?.full_name ?? "Usuário"} — Saldo atual:{" "}
              <span className="text-[var(--brand-gold)] font-bold">
                R$ {Number(selectedUser?.balance ?? 0).toFixed(2)}
              </span>
            </DialogDescription>

            <form onSubmit={handleTransaction} className="space-y-4">
              <div className="space-y-2">
                <Label className="text-[var(--text-secondary)]">
                  Valor (R$)
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[var(--brand-gold)] font-bold">
                    R$
                  </span>
                  <Input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    required
                    autoFocus
                    className="pl-10 text-lg bg-[var(--bg-elevated)] border-[var(--border-default)] text-[var(--text-primary)]"
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="flex-1 h-10 rounded-lg border border-[var(--border-default)] text-[var(--text-secondary)] text-sm font-medium hover:bg-[var(--bg-elevated)] transition-colors"
                >
                  Cancelar
                </button>
                <Button
                  type="submit"
                  disabled={processing || !amount}
                  className={`flex-1 font-bold ${
                    modalType === "deposit"
                      ? "bg-[var(--color-success)] text-[var(--bg-primary)]"
                      : "bg-[var(--color-danger)] text-white"
                  }`}
                >
                  {processing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : modalType === "deposit" ? (
                    <>
                      <ArrowDownCircle className="h-4 w-4 mr-1" />
                      Depositar
                    </>
                  ) : (
                    <>
                      <ArrowUpCircle className="h-4 w-4 mr-1" />
                      Sacar
                    </>
                  )}
                </Button>
              </div>
            </form>
          </DialogContent>
      </Dialog>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="space-y-1">
      <Label className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
        {label}
      </Label>
      <Select value={value} onValueChange={(v) => v && onChange(v)}>
        <SelectTrigger className="bg-[var(--bg-elevated)] border-[var(--border-default)] text-[var(--text-primary)] h-9 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value} className="text-xs">
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function SortHeader({
  label,
  active,
  dir,
  onClick,
  align = "left",
}: {
  label: string;
  active: boolean;
  dir: "asc" | "desc";
  onClick: () => void;
  align?: "left" | "right";
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1 text-xs uppercase tracking-wider transition-colors ${
        active
          ? "text-[var(--brand-gold)]"
          : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
      } ${align === "right" ? "ml-auto" : ""}`}
    >
      {label}
      <ArrowUpDown
        className={`h-3 w-3 ${active ? "opacity-100" : "opacity-40"} ${
          active && dir === "asc" ? "rotate-180" : ""
        }`}
      />
    </button>
  );
}
