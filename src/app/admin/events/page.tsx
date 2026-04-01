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
import { Trophy, Plus, Loader2, Calendar, Swords } from "lucide-react";

const createEventSchema = z.object({
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  date: z.string().optional(),
});

type EventWithCount = {
  id: string;
  name: string;
  date: string | null;
  status: string;
  created_at: string;
  fights: { count: number }[];
};

function statusBadge(status: string) {
  switch (status) {
    case "live":
      return (
        <Badge className="bg-[var(--color-danger)] text-white animate-pulse text-[10px]">
          AO VIVO
        </Badge>
      );
    case "upcoming":
      return (
        <Badge
          variant="outline"
          className="border-[var(--brand-green)] text-[var(--brand-green)] text-[10px]"
        >
          Em breve
        </Badge>
      );
    case "finished":
      return (
        <Badge
          variant="outline"
          className="border-[var(--text-muted)] text-[var(--text-muted)] text-[10px]"
        >
          Finalizado
        </Badge>
      );
    default:
      return null;
  }
}

export default function AdminEventsPage() {
  const [events, setEvents] = useState<EventWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const supabase = createClient();

  const loadEvents = useCallback(async () => {
    const { data } = await supabase
      .from("events")
      .select("*, fights(count)")
      .order("date", { ascending: false });
    setEvents((data as EventWithCount[]) ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const parsed = createEventSchema.safeParse({ name, date: date || undefined });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("events")
      .insert({ name: parsed.data.name, date: parsed.data.date || null });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Evento criado!");
      setName("");
      setDate("");
      loadEvents();
    }
    setSaving(false);
  }

  async function handleStatusChange(id: string, status: string) {
    const { error } = await supabase
      .from("events")
      .update({ status })
      .eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Status atualizado");
      loadEvents();
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Trophy className="h-6 w-6 text-[var(--brand-gold)]" />
        <h1 className="font-heading text-3xl text-[var(--text-primary)]">
          EVENTOS
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
                <Label className="text-[var(--text-secondary)]">
                  Nome do Evento
                </Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Copa Garbin 2026"
                  required
                  className="bg-[var(--bg-elevated)] border-[var(--border-default)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[var(--text-secondary)]">Data</Label>
                <Input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="bg-[var(--bg-elevated)] border-[var(--border-default)] text-[var(--text-primary)]"
                />
              </div>
            </div>
            <Button
              type="submit"
              disabled={saving}
              className="bg-[var(--brand-green)] text-[var(--bg-primary)] hover:bg-[var(--brand-green)]/90 font-bold"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <Plus className="h-4 w-4 mr-1" />
              )}
              Criar Evento
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Events list */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-[var(--brand-green)]" />
        </div>
      ) : events.length === 0 ? (
        <Card
          className="border-[var(--border-default)]"
          style={{ background: "var(--bg-card)" }}
        >
          <CardContent className="py-8 text-center text-[var(--text-muted)]">
            Nenhum evento criado ainda.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {events.map((event) => {
            const fightCount = event.fights?.[0]?.count ?? 0;
            return (
              <Card
                key={event.id}
                className="border-[var(--border-default)]"
                style={{ background: "var(--bg-card)" }}
              >
                <CardContent className="py-4 px-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="h-10 w-10 rounded-lg flex items-center justify-center shrink-0"
                      style={{ background: "var(--bg-elevated)" }}
                    >
                      <Calendar className="h-5 w-5 text-[var(--brand-gold)]" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-[var(--text-primary)] truncate">
                        {event.name}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                        <span>{event.date ?? "Sem data"}</span>
                        <span className="flex items-center gap-0.5">
                          <Swords className="h-3 w-3" />
                          {fightCount} luta{fightCount !== 1 ? "s" : ""}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {statusBadge(event.status)}
                    <Select
                      value={event.status}
                      onValueChange={(val) => {
                        if (val) handleStatusChange(event.id, val);
                      }}
                    >
                      <SelectTrigger className="w-28 h-8 text-xs bg-[var(--bg-elevated)] border-[var(--border-default)] text-[var(--text-primary)]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="upcoming">Em breve</SelectItem>
                        <SelectItem value="live">Ao Vivo</SelectItem>
                        <SelectItem value="finished">Finalizado</SelectItem>
                      </SelectContent>
                    </Select>
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
