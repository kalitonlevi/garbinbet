import { createClient } from "@/lib/supabase/server";
import { Trophy, User, Crown } from "lucide-react";
import Image from "next/image";

type Fighter = {
  id: string;
  name: string;
  nickname: string | null;
  photo_url: string | null;
  gender: "M" | "F";
};

type FightRow = {
  id: string;
  status: string;
  winner_id: string | null;
  fight_order: number | null;
  fighter_a: Fighter | null;
  fighter_b: Fighter | null;
};

const GOLD = "#D4A017";
const GREEN = "#7ED957";
const SURFACE = "#16161F";
const POPOVER = "#1C1C28";
const BORDER = "#2A2A3A";
const TEXT = "#F0F0F0";
const MUTED = "#9999AA";

function FighterRow({
  fighter,
  won,
  dim,
  align,
}: {
  fighter: Fighter | null;
  won: boolean;
  dim: boolean;
  align: "left" | "right";
}) {
  return (
    <div
      className={`flex items-center gap-2 px-2 py-1.5 ${
        align === "right" ? "flex-row-reverse" : ""
      } ${dim ? "opacity-40" : ""}`}
    >
      <div
        className="h-5 w-5 rounded-full overflow-hidden flex-shrink-0 flex items-center justify-center border"
        style={{
          background: SURFACE,
          borderColor: won ? GREEN : GOLD,
        }}
      >
        {fighter?.photo_url ? (
          <Image
            src={fighter.photo_url}
            alt={fighter.name}
            width={20}
            height={20}
            className="object-cover w-full h-full"
          />
        ) : (
          <User className="h-3 w-3" style={{ color: MUTED }} />
        )}
      </div>
      <span
        className={`text-[10px] font-bold truncate flex-1 ${
          align === "right" ? "text-right" : "text-left"
        }`}
        style={{
          color: fighter ? TEXT : MUTED,
          fontStyle: fighter ? "normal" : "italic",
        }}
      >
        {fighter?.name ?? "A definir"}
      </span>
      {won && <Crown className="h-3 w-3 flex-shrink-0" style={{ color: GREEN }} />}
    </div>
  );
}

function MatchCard({
  fight,
  align,
}: {
  fight: FightRow | null;
  align: "left" | "right";
}) {
  const aWon =
    !!fight && fight.status === "finished" && fight.winner_id === fight.fighter_a?.id;
  const bWon =
    !!fight && fight.status === "finished" && fight.winner_id === fight.fighter_b?.id;
  const finished = fight?.status === "finished";
  return (
    <div
      className="w-[150px] rounded-md overflow-hidden border"
      style={{ background: POPOVER, borderColor: BORDER }}
    >
      <FighterRow
        fighter={fight?.fighter_a ?? null}
        won={aWon}
        dim={finished && !aWon}
        align={align}
      />
      <div className="h-px" style={{ background: BORDER }} />
      <FighterRow
        fighter={fight?.fighter_b ?? null}
        won={bWon}
        dim={finished && !bWon}
        align={align}
      />
    </div>
  );
}

function ByeCard() {
  return (
    <div
      className="w-[150px] rounded-md border flex items-center justify-center py-3 opacity-60"
      style={{ background: POPOVER, borderColor: BORDER }}
    >
      <span
        className="text-[10px] font-bold italic"
        style={{ color: MUTED }}
      >
        BYE
      </span>
    </div>
  );
}

function Column({
  items,
  side,
  label,
}: {
  items: (FightRow | null | "bye")[];
  side: "left" | "right";
  label: string;
}) {
  return (
    <div className="flex flex-col">
      <div
        className={`text-[9px] font-bold tracking-widest mb-1 px-2 ${
          side === "right" ? "text-right" : "text-left"
        }`}
        style={{ color: GOLD }}
      >
        {label}
      </div>
      <div className="flex-1 flex flex-col justify-around">
        {items.map((it, i) => {
          const isTop = i % 2 === 0;
          const sideCls =
            side === "left" ? "pr-3 border-r-2" : "pl-3 border-l-2";
          const vCls = isTop ? "border-b-2" : "border-t-2";
          return (
            <div
              key={i}
              className={`flex-1 flex items-center min-h-[68px] ${sideCls} ${vCls}`}
              style={{ borderColor: GOLD }}
            >
              {it === "bye" ? <ByeCard /> : <MatchCard fight={it} align={side} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Bracket({
  fights,
  title,
}: {
  fights: FightRow[];
  title: string;
}) {
  // Map fight_order → fight, but order is global per event. Re-sequence
  // gender-local: sort by fight_order, then assign positions 1..14.
  const sorted = [...fights].sort(
    (a, b) => (a.fight_order ?? 0) - (b.fight_order ?? 0)
  );
  const local = new Map<number, FightRow>();
  sorted.forEach((f, i) => local.set(i + 1, f));
  const get = (n: number) => local.get(n) ?? null;

  // 15-person / 16-slot bracket: R1=7+BYE, QF=4, SF=2, F=1
  const leftR1: (FightRow | null | "bye")[] = [get(1), get(2), get(3), get(4)];
  const rightR1: (FightRow | null | "bye")[] = [get(5), get(6), get(7), "bye"];
  const leftQF: (FightRow | null)[] = [get(8), get(9)];
  const rightQF: (FightRow | null)[] = [get(10), get(11)];
  const leftSF: (FightRow | null)[] = [get(12)];
  const rightSF: (FightRow | null)[] = [get(13)];
  const finalMatch = get(14);

  return (
    <div
      className="rounded-xl border p-4"
      style={{ background: SURFACE, borderColor: BORDER }}
    >
      <h2
        className="font-heading text-lg tracking-wide text-center mb-3"
        style={{ color: GOLD }}
      >
        {title}
      </h2>
      <div className="overflow-x-auto">
        <div
          className="flex items-stretch w-max mx-auto"
          style={{ minHeight: 560 }}
        >
          <Column items={leftR1} side="left" label="OITAVAS" />
          <Column items={leftQF} side="left" label="QUARTAS" />
          <Column items={leftSF} side="left" label="SEMI" />

          <div className="flex flex-col items-center justify-center px-5 gap-3">
            <Trophy className="h-12 w-12" style={{ color: GOLD }} />
            <p
              className="text-[10px] font-bold tracking-widest"
              style={{ color: GOLD }}
            >
              VENCEDOR
            </p>
            <MatchCard fight={finalMatch} align="left" />
            <p
              className="text-[9px] font-bold tracking-widest"
              style={{ color: GOLD }}
            >
              FINAL
            </p>
          </div>

          <Column items={rightSF} side="right" label="SEMI" />
          <Column items={rightQF} side="right" label="QUARTAS" />
          <Column items={rightR1} side="right" label="OITAVAS" />
        </div>
      </div>
    </div>
  );
}

export default async function BracketsPage() {
  const supabase = await createClient();

  const { data: event } = await supabase
    .from("events")
    .select("*")
    .in("status", ["live", "upcoming"])
    .order("date", { ascending: true })
    .limit(1)
    .single();

  let fights: FightRow[] = [];
  if (event) {
    const { data } = await supabase
      .from("fights")
      .select(
        `id, status, winner_id, fight_order,
        fighter_a:fighters!fighter_a_id(id, name, nickname, photo_url, gender),
        fighter_b:fighters!fighter_b_id(id, name, nickname, photo_url, gender)`
      )
      .eq("event_id", event.id)
      .order("fight_order", { ascending: true });
    fights = (data ?? []) as unknown as FightRow[];
  }

  const fightGender = (f: FightRow): "M" | "F" | null => {
    const g = f.fighter_a?.gender ?? f.fighter_b?.gender ?? null;
    return g;
  };
  const maleFights = fights.filter((f) => fightGender(f) === "M");
  const femaleFights = fights.filter((f) => fightGender(f) === "F");

  return (
    <div className="space-y-5">
      <div className="text-center space-y-1">
        <Trophy className="h-5 w-5 mx-auto" style={{ color: GOLD }} />
        <h1
          className="font-heading text-2xl tracking-wide"
          style={{ color: GOLD }}
        >
          CHAVEAMENTO
        </h1>
        {event && <p className="text-sm" style={{ color: MUTED }}>{event.name}</p>}
      </div>

      {!event ? (
        <div className="text-center py-12">
          <Trophy
            className="h-12 w-12 mx-auto opacity-20"
            style={{ color: GOLD }}
          />
          <p className="text-sm mt-3" style={{ color: MUTED }}>
            Nenhum evento ativo no momento.
          </p>
        </div>
      ) : (
        <>
          <Bracket fights={maleFights} title="MASCULINO" />
          <Bracket fights={femaleFights} title="FEMININO" />
        </>
      )}
    </div>
  );
}
