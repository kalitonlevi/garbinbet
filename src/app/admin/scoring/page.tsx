"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
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
  Calculator,
  Loader2,
  Undo2,
  RotateCcw,
  ArrowLeft,
} from "lucide-react";
import type {
  Event,
  Fighter,
  Fight,
  FightScore,
  FightScoreAction,
} from "@/types/database";

type FightWithRelations = Fight & {
  fighter_a?: Fighter;
  fighter_b?: Fighter;
  events?: Event;
};

type ScoreAction = {
  key: FightScoreAction;
  label: string;
  shortLabel: string;
  value: number;
  kind: "points" | "advantage" | "penalty";
};

const SCORE_ACTIONS: ScoreAction[] = [
  { key: "takedown",      label: "Queda",            shortLabel: "Queda",   value: 2, kind: "points" },
  { key: "sweep",         label: "Raspagem",         shortLabel: "Raspag.", value: 2, kind: "points" },
  { key: "knee_on_belly", label: "Joelho na Barriga", shortLabel: "KoB",    value: 2, kind: "points" },
  { key: "guard_pass",    label: "Passagem de Guarda", shortLabel: "Passag.", value: 3, kind: "points" },
  { key: "mount",         label: "Montada",          shortLabel: "Montada", value: 4, kind: "points" },
  { key: "back_control",  label: "Pegada de Costas", shortLabel: "Costas",  value: 4, kind: "points" },
  { key: "advantage",     label: "Vantagem",         shortLabel: "Vant.",   value: 1, kind: "advantage" },
  { key: "penalty",       label: "Punição",          shortLabel: "Pun.",    value: 1, kind: "penalty" },
];

export default function AdminScoringPage() {
  const supabase = createClient();

  const [events, setEvents] = useState<Event[]>([]);
  const [fights, setFights] = useState<FightWithRelations[]>([]);
  const [scores, setScores] = useState<Record<string, FightScore>>({});
  const [loading, setLoading] = useState(true);
  const [filterEventId, setFilterEventId] = useState("");
  const [selectedFightId, setSelectedFightId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    const [evRes, fRes] = await Promise.all([
      supabase.from("events").select("*").order("date", { ascending: false }),
      supabase
        .from("fights")
        .select(
          "*, fighter_a:fighters!fighter_a_id(*), fighter_b:fighters!fighter_b_id(*), events(*)"
        )
        .order("created_at", { ascending: false }),
    ]);
    setEvents(evRes.data ?? []);
    setFights(fRes.data ?? []);
    setLoading(false);
  }, [supabase]);

  const loadScoresForFight = useCallback(
    async (fightId: string) => {
      const { data } = await supabase
        .from("fight_scores")
        .select("*")
        .eq("fight_id", fightId);

      if (!data) return;
      setScores((prev) => {
        const next = { ...prev };
        for (const s of data as FightScore[]) {
          next[`${s.fight_id}:${s.fighter_id}`] = s;
        }
        return next;
      });
    },
    [supabase]
  );

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (selectedFightId) loadScoresForFight(selectedFightId);
  }, [selectedFightId, loadScoresForFight]);

  const filteredFights = useMemo(
    () =>
      filterEventId
        ? fights.filter((f) => f.event_id === filterEventId)
        : fights,
    [fights, filterEventId]
  );

  const selectedFight = useMemo(
    () => fights.find((f) => f.id === selectedFightId) ?? null,
    [fights, selectedFightId]
  );

  function getScore(fightId: string, fighterId: string): FightScore {
    return (
      scores[`${fightId}:${fighterId}`] ?? {
        id: "",
        fight_id: fightId,
        fighter_id: fighterId,
        points: 0,
        advantages: 0,
        penalties: 0,
        updated_at: "",
      }
    );
  }

  async function handleScore(fighterId: string, action: FightScoreAction) {
    if (!selectedFightId) return;
    const loadingKey = `${fighterId}:${action}`;
    setActionLoading(loadingKey);

    const { data, error } = await supabase.rpc("register_score_event", {
      p_fight_id: selectedFightId,
      p_fighter_id: fighterId,
      p_action: action,
    });

    if (error) {
      toast.error(error.message);
    } else if (data) {
      const updated = data as FightScore;
      setScores((prev) => ({
        ...prev,
        [`${updated.fight_id}:${updated.fighter_id}`]: updated,
      }));
    }
    setActionLoading(null);
  }

  async function handleUndo() {
    if (!selectedFightId) return;
    setActionLoading("undo");
    const { error } = await supabase.rpc("undo_last_score_event", {
      p_fight_id: selectedFightId,
    });
    if (error) {
      toast.error(error.message);
    } else {
      await loadScoresForFight(selectedFightId);
      toast.success("Última ação revertida");
    }
    setActionLoading(null);
  }

  async function handleReset() {
    if (!selectedFightId) return;
    if (!confirm("Zerar o placar desta luta? Esta ação não pode ser desfeita."))
      return;
    setActionLoading("reset");
    const { error } = await supabase.rpc("reset_fight_scores", {
      p_fight_id: selectedFightId,
    });
    if (error) {
      toast.error(error.message);
    } else {
      setScores((prev) => {
        const next = { ...prev };
        for (const key of Object.keys(next)) {
          if (key.startsWith(`${selectedFightId}:`)) delete next[key];
        }
        return next;
      });
      toast.success("Placar zerado");
    }
    setActionLoading(null);
  }

  // ===== Detail view (scoring panel) =====
  if (selectedFight) {
    const fighters = [
      selectedFight.fighter_a,
      selectedFight.fighter_b,
    ].filter(Boolean) as Fighter[];

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedFightId(null)}
              className="border-[var(--border-default)] text-[var(--text-secondary)]"
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Voltar
            </Button>
            <div>
              <p className="text-xs text-[var(--text-muted)]">
                {selectedFight.events?.name} &bull; Luta{" "}
                {selectedFight.fight_order ?? "?"}
              </p>
              <h1 className="font-heading text-xl text-[var(--text-primary)]">
                {selectedFight.fighter_a?.name}{" "}
                <span className="text-[var(--brand-gold)]">vs</span>{" "}
                {selectedFight.fighter_b?.name}
              </h1>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={actionLoading === "undo"}
              onClick={handleUndo}
              className="border-[var(--border-default)] text-[var(--text-secondary)]"
            >
              {actionLoading === "undo" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <>
                  <Undo2 className="h-3.5 w-3.5 mr-1" />
                  Desfazer
                </>
              )}
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={actionLoading === "reset"}
              onClick={handleReset}
              className="border-[var(--color-danger)] text-[var(--color-danger)]"
            >
              {actionLoading === "reset" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <>
                  <RotateCcw className="h-3.5 w-3.5 mr-1" />
                  Zerar
                </>
              )}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {fighters.map((fighter) => {
            const score = getScore(selectedFight.id, fighter.id);
            return (
              <Card
                key={fighter.id}
                className="border-[var(--border-default)] overflow-hidden"
                style={{ background: "var(--bg-card)" }}
              >
                <div
                  className="h-1"
                  style={{ background: "var(--brand-gold)" }}
                />
                <CardContent className="pt-5 space-y-4">
                  <div>
                    <p className="text-xs uppercase tracking-wider text-[var(--text-muted)]">
                      Lutador
                    </p>
                    <p className="font-heading text-2xl text-[var(--text-primary)]">
                      {fighter.name}
                    </p>
                    {fighter.nickname && (
                      <p className="text-sm text-[var(--brand-gold)]">
                        &quot;{fighter.nickname}&quot;
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-lg border border-[var(--border-default)] py-3"
                         style={{ background: "var(--bg-elevated)" }}>
                      <p className="text-[10px] uppercase text-[var(--text-muted)]">
                        Pontos
                      </p>
                      <p className="font-heading text-3xl text-[var(--brand-green)]">
                        {score.points}
                      </p>
                    </div>
                    <div className="rounded-lg border border-[var(--border-default)] py-3"
                         style={{ background: "var(--bg-elevated)" }}>
                      <p className="text-[10px] uppercase text-[var(--text-muted)]">
                        Vant.
                      </p>
                      <p className="font-heading text-3xl text-[var(--brand-gold)]">
                        {score.advantages}
                      </p>
                    </div>
                    <div className="rounded-lg border border-[var(--border-default)] py-3"
                         style={{ background: "var(--bg-elevated)" }}>
                      <p className="text-[10px] uppercase text-[var(--text-muted)]">
                        Pun.
                      </p>
                      <p className="font-heading text-3xl text-[var(--color-danger)]">
                        {score.penalties}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {SCORE_ACTIONS.map((action) => {
                      const loadingKey = `${fighter.id}:${action.key}`;
                      const isLoading = actionLoading === loadingKey;
                      const colorCls =
                        action.kind === "penalty"
                          ? "border-[var(--color-danger)] text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10"
                          : action.kind === "advantage"
                          ? "border-[var(--brand-gold)] text-[var(--brand-gold)] hover:bg-[var(--brand-gold)]/10"
                          : "border-[var(--brand-green)] text-[var(--brand-green)] hover:bg-[var(--brand-green)]/10";
                      return (
                        <Button
                          key={action.key}
                          variant="outline"
                          disabled={isLoading}
                          onClick={() => handleScore(fighter.id, action.key)}
                          className={`h-auto py-2 flex-col gap-0 ${colorCls}`}
                        >
                          {isLoading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <span className="text-[10px] uppercase tracking-wide">
                                {action.label}
                              </span>
                              <span className="font-heading text-lg leading-tight">
                                +{action.value}
                              </span>
                            </>
                          )}
                        </Button>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card
          className="border-[var(--border-default)]"
          style={{ background: "var(--bg-card)" }}
        >
          <CardContent className="py-4">
            <p className="text-xs text-[var(--text-muted)] mb-2 uppercase tracking-wider">
              Regras IBJJF
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-[var(--text-secondary)]">
              <div>Queda &middot; Raspagem &middot; KoB: <b className="text-[var(--brand-green)]">+2</b></div>
              <div>Passagem de Guarda: <b className="text-[var(--brand-green)]">+3</b></div>
              <div>Montada &middot; Pegada de Costas: <b className="text-[var(--brand-green)]">+4</b></div>
              <div>Vantagem: <b className="text-[var(--brand-gold)]">+1</b> &middot; Punição: <b className="text-[var(--color-danger)]">+1</b></div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ===== List view =====
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Calculator className="h-6 w-6 text-[var(--brand-gold)]" />
        <h1 className="font-heading text-3xl text-[var(--text-primary)]">
          PONTUAÇÃO
        </h1>
      </div>

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

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-[var(--brand-green)]" />
        </div>
      ) : filteredFights.length === 0 ? (
        <p className="text-sm text-[var(--text-muted)] text-center py-8">
          Nenhuma luta encontrada.
        </p>
      ) : (
        <div className="space-y-3">
          {filteredFights.map((fight) => (
            <Card
              key={fight.id}
              className="border-[var(--border-default)] cursor-pointer hover:border-[var(--brand-green)] transition-colors"
              style={{ background: "var(--bg-card)" }}
              onClick={() => setSelectedFightId(fight.id)}
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
                    <Badge
                      variant="outline"
                      className="text-[10px] border-[var(--text-muted)] text-[var(--text-muted)]"
                    >
                      {fight.status}
                    </Badge>
                    <Button
                      size="sm"
                      className="bg-[var(--brand-green)] text-[var(--bg-primary)] hover:bg-[var(--brand-green)]/90 text-xs h-7"
                    >
                      Pontuar
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
