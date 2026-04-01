"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { z } from "zod";
import { Card, CardContent } from "@/components/ui/card";
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
import { Swords, Plus, Loader2, Play, Lock } from "lucide-react";
import type { Event, Fighter, Fight } from "@/types/database";

const createFightSchema = z
  .object({
    event_id: z.string().uuid("Selecione um evento"),
    fighter_a_id: z.string().uuid("Selecione o lutador A"),
    fighter_b_id: z.string().uuid("Selecione o lutador B"),
    fight_order: z.number().int().positive().optional(),
  })
  .refine((d) => d.fighter_a_id !== d.fighter_b_id, {
    message: "Selecione lutadores diferentes",
  });

function fightStatusBadge(status: string) {
  const map: Record<string, { label: string; cls: string }> = {
    upcoming: {
      label: "Aguardando",
      cls: "border-[var(--text-muted)] text-[var(--text-muted)]",
    },
    open: {
      label: "Apostas Abertas",
      cls: "border-[var(--brand-green)] text-[var(--brand-green)]",
    },
    locked: {
      label: "Apostas Fechadas",
      cls: "border-[var(--color-warning)] text-[var(--color-warning)]",
    },
    finished: {
      label: "Finalizada",
      cls: "border-[var(--text-muted)] text-[var(--text-muted)]",
    },
    cancelled: {
      label: "Cancelada",
      cls: "border-[var(--color-danger)] text-[var(--color-danger)]",
    },
  };
  const s = map[status] ?? map.upcoming;
  return (
    <Badge variant="outline" className={`text-[10px] ${s.cls}`}>
      {s.label}
    </Badge>
  );
}

export default function AdminFightsPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [fighters, setFighters] = useState<Fighter[]>([]);
  const [fights, setFights] = useState<
    (Fight & {
      fighter_a?: Fighter;
      fighter_b?: Fighter;
      events?: Event;
    })[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const [eventId, setEventId] = useState("");
  const [fighterAId, setFighterAId] = useState("");
  const [fighterBId, setFighterBId] = useState("");
  const [fightOrder, setFightOrder] = useState("");
  const [filterEventId, setFilterEventId] = useState("");

  const supabase = createClient();

  const loadData = useCallback(async () => {
    const [evRes, fRes, ftRes] = await Promise.all([
      supabase.from("events").select("*").order("date", { ascending: false }),
      supabase
        .from("fights")
        .select(
          "*, fighter_a:fighters!fighter_a_id(*), fighter_b:fighters!fighter_b_id(*), events(*)"
        )
        .order("created_at", { ascending: false }),
      supabase.from("fighters").select("*").order("name"),
    ]);
    setEvents(evRes.data ?? []);
    setFights(fRes.data ?? []);
    setFighters(ftRes.data ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const parsed = createFightSchema.safeParse({
      event_id: eventId,
      fighter_a_id: fighterAId,
      fighter_b_id: fighterBId,
      fight_order: fightOrder ? parseInt(fightOrder) : undefined,
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }

    setSaving(true);
    const { data: fight, error } = await supabase
      .from("fights")
      .insert({
        event_id: parsed.data.event_id,
        fighter_a_id: parsed.data.fighter_a_id,
        fighter_b_id: parsed.data.fighter_b_id,
        fight_order: parsed.data.fight_order ?? null,
      })
      .select()
      .single();

    if (error) {
      toast.error(error.message);
      setSaving(false);
      return;
    }

    const fighterA = fighters.find((f) => f.id === fighterAId);
    const fighterB = fighters.find((f) => f.id === fighterBId);

    // Auto-create 3 markets
    const marketsToCreate = [
      { type: "winner", fight_id: fight.id },
      { type: "method", fight_id: fight.id },
      { type: "has_submission", fight_id: fight.id },
    ];

    const { data: markets } = await supabase
      .from("markets")
      .insert(marketsToCreate)
      .select();

    if (markets) {
      const optionsToCreate: {
        market_id: string;
        label: string;
      }[] = [];

      for (const market of markets) {
        if (market.type === "winner") {
          optionsToCreate.push(
            { market_id: market.id, label: fighterA?.name ?? "Lutador A" },
            { market_id: market.id, label: fighterB?.name ?? "Lutador B" }
          );
        } else if (market.type === "method") {
          optionsToCreate.push(
            { market_id: market.id, label: "Finalizacao" },
            { market_id: market.id, label: "Pontos/Decisao" },
            { market_id: market.id, label: "DQ/Outro" }
          );
        } else if (market.type === "has_submission") {
          optionsToCreate.push(
            { market_id: market.id, label: "Sim" },
            { market_id: market.id, label: "Nao" }
          );
        }
      }

      await supabase.from("market_options").insert(optionsToCreate);
    }

    toast.success("Luta criada com 3 mercados!");
    setEventId("");
    setFighterAId("");
    setFighterBId("");
    setFightOrder("");
    loadData();
    setSaving(false);
  }

  async function handleOpenBets(fightId: string) {
    setActionLoading(fightId);
    const { error: fErr } = await supabase
      .from("fights")
      .update({ status: "open" })
      .eq("id", fightId);
    if (fErr) {
      toast.error(fErr.message);
    } else {
      await supabase
        .from("markets")
        .update({ status: "open" })
        .eq("fight_id", fightId)
        .in("status", ["open", "locked"]);
      // Also open markets that haven't been opened yet
      await supabase
        .from("markets")
        .update({ status: "open" })
        .eq("fight_id", fightId);
      toast.success("Apostas abertas!");
      loadData();
    }
    setActionLoading(null);
  }

  async function handleLockBets(fightId: string) {
    setActionLoading(fightId);
    const { error: fErr } = await supabase
      .from("fights")
      .update({ status: "locked" })
      .eq("id", fightId);
    if (fErr) {
      toast.error(fErr.message);
    } else {
      await supabase
        .from("markets")
        .update({ status: "locked" })
        .eq("fight_id", fightId)
        .eq("status", "open");
      toast.success("Apostas travadas!");
      loadData();
    }
    setActionLoading(null);
  }

  const filteredFights = filterEventId
    ? fights.filter((f) => f.event_id === filterEventId)
    : fights;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Swords className="h-6 w-6 text-[var(--brand-gold)]" />
        <h1 className="font-heading text-3xl text-[var(--text-primary)]">
          LUTAS
        </h1>
      </div>

      {/* Create form */}
      <Card
        className="border-[var(--border-default)] overflow-hidden"
        style={{ background: "var(--bg-card)" }}
      >
        <div className="h-1" style={{ background: "var(--brand-gold)" }} />
        <CardContent className="pt-5">
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[var(--text-secondary)]">Evento *</Label>
                <Select
                  value={eventId}
                  onValueChange={(v) => {
                    if (v) setEventId(v);
                  }}
                  required
                >
                  <SelectTrigger className="bg-[var(--bg-elevated)] border-[var(--border-default)] text-[var(--text-primary)]">
                    <SelectValue placeholder="Selecione o evento" />
                  </SelectTrigger>
                  <SelectContent>
                    {events.map((ev) => (
                      <SelectItem key={ev.id} value={ev.id}>
                        {ev.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-[var(--text-secondary)]">
                  Ordem da luta
                </Label>
                <Input
                  type="number"
                  value={fightOrder}
                  onChange={(e) => setFightOrder(e.target.value)}
                  placeholder="Ex: 1"
                  className="bg-[var(--bg-elevated)] border-[var(--border-default)] text-[var(--text-primary)]"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[var(--text-secondary)]">
                  Lutador A *
                </Label>
                <Select
                  value={fighterAId}
                  onValueChange={(v) => {
                    if (v) setFighterAId(v);
                  }}
                  required
                >
                  <SelectTrigger className="bg-[var(--bg-elevated)] border-[var(--border-default)] text-[var(--text-primary)]">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {fighters.map((f) => (
                      <SelectItem key={f.id} value={f.id}>
                        {f.name}
                        {f.nickname ? ` "${f.nickname}"` : ""}
                        {f.weight_kg ? ` - ${f.weight_kg}kg` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-[var(--text-secondary)]">
                  Lutador B *
                </Label>
                <Select
                  value={fighterBId}
                  onValueChange={(v) => {
                    if (v) setFighterBId(v);
                  }}
                  required
                >
                  <SelectTrigger className="bg-[var(--bg-elevated)] border-[var(--border-default)] text-[var(--text-primary)]">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {fighters.map((f) => (
                      <SelectItem key={f.id} value={f.id}>
                        {f.name}
                        {f.nickname ? ` "${f.nickname}"` : ""}
                        {f.weight_kg ? ` - ${f.weight_kg}kg` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button
              type="submit"
              disabled={saving || !eventId || !fighterAId || !fighterBId}
              className="bg-[var(--brand-green)] text-[var(--bg-primary)] hover:bg-[var(--brand-green)]/90 font-bold"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <Plus className="h-4 w-4 mr-1" />
              )}
              Criar Luta (+ 3 Mercados)
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Filter by event */}
      <div className="flex items-center gap-3">
        <Label className="text-[var(--text-secondary)] text-sm shrink-0">
          Filtrar por evento:
        </Label>
        <Select
          value={filterEventId}
          onValueChange={(v) => setFilterEventId(v ?? "")}
        >
          <SelectTrigger className="w-48 h-8 text-xs bg-[var(--bg-elevated)] border-[var(--border-default)] text-[var(--text-primary)]">
            <SelectValue placeholder="Todos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Todos</SelectItem>
            {events.map((ev) => (
              <SelectItem key={ev.id} value={ev.id}>
                {ev.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Fights list */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-[var(--brand-green)]" />
        </div>
      ) : (
        <div className="space-y-3">
          {filteredFights.map((fight) => {
            const isLoading = actionLoading === fight.id;
            return (
              <Card
                key={fight.id}
                className="border-[var(--border-default)]"
                style={{ background: "var(--bg-card)" }}
              >
                <CardContent className="py-4 px-4">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="min-w-0">
                      <p className="text-xs text-[var(--text-muted)]">
                        {fight.events?.name} &bull; Luta{" "}
                        {fight.fight_order ?? "?"}
                      </p>
                      <p className="font-semibold text-[var(--text-primary)]">
                        {fight.fighter_a?.name}{" "}
                        <span className="text-[var(--brand-gold)]">vs</span>{" "}
                        {fight.fighter_b?.name}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {fightStatusBadge(fight.status)}

                      {fight.status === "upcoming" && (
                        <Button
                          size="sm"
                          disabled={isLoading}
                          onClick={() => handleOpenBets(fight.id)}
                          className="bg-[var(--brand-green)] text-[var(--bg-primary)] hover:bg-[var(--brand-green)]/90 text-xs h-7"
                        >
                          {isLoading ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <>
                              <Play className="h-3 w-3 mr-1" />
                              Abrir Apostas
                            </>
                          )}
                        </Button>
                      )}

                      {fight.status === "open" && (
                        <Button
                          size="sm"
                          disabled={isLoading}
                          onClick={() => handleLockBets(fight.id)}
                          className="bg-[var(--brand-gold)] text-[var(--bg-primary)] hover:bg-[var(--brand-gold)]/90 text-xs h-7"
                        >
                          {isLoading ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <>
                              <Lock className="h-3 w-3 mr-1" />
                              Travar Apostas
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
