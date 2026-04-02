"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
  Banknote,
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
} from "lucide-react";

type WithdrawalRow = {
  id: string;
  user_id: string;
  amount: number;
  pix_key: string;
  status: "pending" | "approved" | "rejected";
  admin_note: string | null;
  created_at: string;
  processed_at: string | null;
  profile: {
    full_name: string;
  } | null;
  wallet: {
    balance: number;
  } | null;
};

export default function AdminWithdrawalsPage() {
  const [requests, setRequests] = useState<WithdrawalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState("");
  const [filter, setFilter] = useState<"pending" | "all">("pending");

  const supabase = createClient();

  const loadRequests = useCallback(async () => {
    let query = supabase
      .from("withdrawal_requests")
      .select(
        "*, profile:profiles!user_id(full_name), wallet:wallets!user_id(balance)"
      )
      .order("created_at", { ascending: false });

    if (filter === "pending") {
      query = query.eq("status", "pending");
    }

    const { data, error } = await query;

    if (error) {
      toast.error("Erro ao carregar solicitações");
      console.error(error);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows: WithdrawalRow[] = (data ?? []).map((r: any) => ({
      ...r,
      profile: Array.isArray(r.profile) ? r.profile[0] : r.profile,
      wallet: Array.isArray(r.wallet) ? r.wallet[0] : r.wallet,
    }));

    setRequests(rows);
    setLoading(false);
  }, [supabase, filter]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  async function handleApprove(id: string) {
    setProcessing(id);
    const { error } = await supabase.rpc("approve_withdrawal", {
      p_request_id: id,
    });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Saque aprovado e processado!");
      loadRequests();
    }
    setProcessing(null);
  }

  function openReject(id: string) {
    setRejectId(id);
    setRejectNote("");
    setRejectOpen(true);
  }

  async function handleReject() {
    if (!rejectId) return;
    setProcessing(rejectId);
    const { error } = await supabase.rpc("reject_withdrawal", {
      p_request_id: rejectId,
      p_note: rejectNote || null,
    });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Saque recusado.");
      setRejectOpen(false);
      loadRequests();
    }
    setProcessing(null);
  }

  function statusBadge(status: string) {
    switch (status) {
      case "pending":
        return (
          <Badge className="bg-[#D4A017]/20 text-[#D4A017] border-[#D4A017]/30 text-[10px]">
            <Clock className="h-3 w-3 mr-0.5" />
            Pendente
          </Badge>
        );
      case "approved":
        return (
          <Badge className="bg-[#7ED957]/20 text-[#7ED957] border-[#7ED957]/30 text-[10px]">
            <CheckCircle className="h-3 w-3 mr-0.5" />
            Aprovado
          </Badge>
        );
      case "rejected":
        return (
          <Badge className="bg-[#FF4757]/20 text-[#FF4757] border-[#FF4757]/30 text-[10px]">
            <XCircle className="h-3 w-3 mr-0.5" />
            Recusado
          </Badge>
        );
      default:
        return null;
    }
  }

  const pendingCount = requests.filter((r) => r.status === "pending").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Banknote className="h-6 w-6 text-[var(--brand-gold)]" />
        <h1 className="font-heading text-3xl text-[var(--text-primary)]">
          SAQUES
        </h1>
        {pendingCount > 0 && (
          <Badge className="bg-[#FF4757] text-white text-xs ml-2">
            {pendingCount} pendente{pendingCount > 1 ? "s" : ""}
          </Badge>
        )}
      </div>

      {/* Filter */}
      <div className="flex gap-2">
        <Button
          size="sm"
          onClick={() => setFilter("pending")}
          className={
            filter === "pending"
              ? "bg-[var(--brand-gold)] text-[var(--bg-primary)] font-bold"
              : "bg-transparent border border-[var(--border-default)] text-[var(--text-secondary)]"
          }
        >
          Pendentes
        </Button>
        <Button
          size="sm"
          onClick={() => setFilter("all")}
          className={
            filter === "all"
              ? "bg-[var(--brand-gold)] text-[var(--bg-primary)] font-bold"
              : "bg-transparent border border-[var(--border-default)] text-[var(--text-secondary)]"
          }
        >
          Todos
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-[var(--brand-green)]" />
        </div>
      ) : requests.length === 0 ? (
        <Card
          className="border-[var(--border-default)] p-8 text-center"
          style={{ background: "var(--bg-card)" }}
        >
          <Banknote className="h-10 w-10 mx-auto text-[var(--text-muted)] opacity-20 mb-2" />
          <p className="text-sm text-[var(--text-muted)]">
            {filter === "pending"
              ? "Nenhum saque pendente."
              : "Nenhuma solicitação de saque."}
          </p>
        </Card>
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
                    Usuário
                  </TableHead>
                  <TableHead className="text-[var(--text-muted)] text-xs text-right">
                    Valor
                  </TableHead>
                  <TableHead className="text-[var(--text-muted)] text-xs">
                    Chave PIX
                  </TableHead>
                  <TableHead className="text-[var(--text-muted)] text-xs text-right">
                    Saldo Atual
                  </TableHead>
                  <TableHead className="text-[var(--text-muted)] text-xs text-center">
                    Status
                  </TableHead>
                  <TableHead className="text-[var(--text-muted)] text-xs">
                    Data
                  </TableHead>
                  <TableHead className="text-[var(--text-muted)] text-xs text-right">
                    Ações
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.map((r) => {
                  const insufficientBalance =
                    r.status === "pending" &&
                    r.wallet &&
                    Number(r.wallet.balance) < r.amount;
                  return (
                    <TableRow
                      key={r.id}
                      className="border-[var(--border-default)]"
                    >
                      <TableCell>
                        <p className="text-sm font-medium text-[var(--text-primary)]">
                          {r.profile?.full_name ?? "—"}
                        </p>
                      </TableCell>
                      <TableCell className="text-right text-sm font-bold text-[#FF4757]">
                        R$ {Number(r.amount).toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <code className="text-xs text-[var(--text-secondary)] bg-[var(--bg-elevated)] px-2 py-1 rounded">
                          {r.pix_key}
                        </code>
                      </TableCell>
                      <TableCell className="text-right">
                        <span
                          className={`text-sm font-bold ${
                            insufficientBalance
                              ? "text-[#FF4757]"
                              : "text-[var(--brand-gold)]"
                          }`}
                        >
                          R$ {Number(r.wallet?.balance ?? 0).toFixed(2)}
                        </span>
                        {insufficientBalance && (
                          <div className="flex items-center justify-end gap-1 mt-0.5">
                            <AlertCircle className="h-3 w-3 text-[#FF4757]" />
                            <span className="text-[10px] text-[#FF4757]">
                              Saldo insuficiente
                            </span>
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {statusBadge(r.status)}
                        {r.admin_note && (
                          <p className="text-[10px] text-[var(--text-muted)] mt-1">
                            {r.admin_note}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-[var(--text-muted)]">
                        {new Date(r.created_at).toLocaleString("pt-BR")}
                        {r.processed_at && (
                          <p className="text-[10px] mt-0.5">
                            Proc.:{" "}
                            {new Date(r.processed_at).toLocaleString("pt-BR")}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {r.status === "pending" && (
                          <div className="flex justify-end gap-1">
                            <Button
                              size="sm"
                              disabled={
                                processing === r.id || !!insufficientBalance
                              }
                              onClick={() => handleApprove(r.id)}
                              className="bg-[var(--color-success)] text-[var(--bg-primary)] text-xs h-7 px-2"
                            >
                              {processing === r.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <>
                                  <CheckCircle className="h-3 w-3 mr-1" />
                                  Aprovar
                                </>
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={processing === r.id}
                              onClick={() => openReject(r.id)}
                              className="border-[var(--color-danger)] text-[var(--color-danger)] text-xs h-7 px-2"
                            >
                              <XCircle className="h-3 w-3 mr-1" />
                              Recusar
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {/* Reject Modal */}
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent
          showCloseButton={false}
          className="max-w-sm border-[var(--border-default)] p-6"
          style={{ background: "var(--bg-card)" }}
        >
          <DialogTitle className="font-heading text-xl text-[var(--text-primary)]">
            RECUSAR SAQUE
          </DialogTitle>
          <DialogDescription className="text-sm text-[var(--text-secondary)]">
            Informe o motivo da recusa (opcional):
          </DialogDescription>

          <div className="space-y-4 mt-3">
            <Input
              value={rejectNote}
              onChange={(e) => setRejectNote(e.target.value)}
              placeholder="Motivo da recusa..."
              className="bg-[var(--bg-elevated)] border-[var(--border-default)] text-[var(--text-primary)]"
            />
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setRejectOpen(false)}
                className="flex-1 h-10 rounded-lg border border-[var(--border-default)] text-[var(--text-secondary)] text-sm font-medium hover:bg-[var(--bg-elevated)] transition-colors"
              >
                Cancelar
              </button>
              <Button
                onClick={handleReject}
                disabled={processing !== null}
                className="flex-1 bg-[#FF4757] text-white font-bold"
              >
                {processing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Confirmar Recusa"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
