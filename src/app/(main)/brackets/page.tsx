import { createClient } from "@/lib/supabase/server";
import { Trophy, User } from "lucide-react";
import Image from "next/image";

type Fighter = {
  id: string;
  name: string;
  nickname: string | null;
  photo_url: string | null;
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
const BLUE = "#BFE3EF";
const YELLOW = "#F5C84B";

function Pill({
  fighter,
  variant,
  isWinner,
  dim,
  align,
  placeholder,
}: {
  fighter: Fighter | null;
  variant: "blue" | "yellow";
  isWinner: boolean;
  dim: boolean;
  align: "left" | "right";
  placeholder?: string;
}) {
  const bg = variant === "blue" ? BLUE : YELLOW;
  const empty = !fighter;
  return (
    <div
      className={`flex items-center gap-1.5 rounded-md px-1.5 py-1 h-[26px] ${
        align === "right" ? "flex-row-reverse" : ""
      } ${dim ? "opacity-40" : ""} ${
        isWinner ? "ring-2 ring-[#7ED957]" : ""
      }`}
      style={{ background: empty ? "#2A2A3A" : bg }}
    >
      <div
        className="h-4 w-4 rounded-full overflow-hidden flex-shrink-0 flex items-center justify-center"
        style={{ background: "#1C1C28" }}
      >
        {fighter?.photo_url ? (
          <Image
            src={fighter.photo_url}
            alt={fighter.name}
            width={16}
            height={16}
            className="object-cover w-full h-full"
          />
        ) : (
          <User className="h-2.5 w-2.5 text-[#9999AA]" />
        )}
      </div>
      <span
        className={`text-[10px] font-bold truncate flex-1 ${
          empty ? "text-[#9999AA] italic" : "text-[#0A0A0F]"
        } ${align === "right" ? "text-right" : "text-left"}`}
      >
        {fighter?.name ?? placeholder ?? "A definir"}
      </span>
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
    <div className="flex flex-col gap-1 w-[140px]">
      <Pill
        fighter={fight?.fighter_a ?? null}
        variant="blue"
        isWinner={aWon}
        dim={finished && !aWon}
        align={align}
      />
      <Pill
        fighter={fight?.fighter_b ?? null}
        variant="yellow"
        isWinner={bWon}
        dim={finished && !bWon}
        align={align}
      />
    </div>
  );
}

function ByeCard({ align }: { align: "left" | "right" }) {
  return (
    <div className="flex flex-col gap-1 w-[140px] opacity-60">
      <div
        className={`flex items-center justify-center rounded-md h-[26px] text-[10px] font-bold text-[#9999AA] italic ${
          align === "right" ? "text-right" : "text-left"
        }`}
        style={{ background: "#2A2A3A" }}
      >
        BYE
      </div>
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
        className={`text-[9px] font-bold tracking-widest text-[${GOLD}] mb-1 px-2 ${
          side === "right" ? "text-right" : "text-left"
        }`}
        style={{ color: GOLD }}
      >
        {label}
      </div>
      <div className="flex-1 flex flex-col justify-around">
        {items.map((it, i) => {
          const isTop = i % 2 === 0;
          const borderSideCls =
            side === "left"
              ? "pr-3 border-r-2"
              : "pl-3 border-l-2";
          const vCls = isTop ? "border-b-2" : "border-t-2";
          return (
            <div
              key={i}
              className={`flex-1 flex items-center min-h-[64px] ${borderSideCls} ${vCls} border-[${GOLD}]`}
              style={{ borderColor: GOLD }}
            >
              {it === "bye" ? (
                <ByeCard align={side} />
              ) : (
                <MatchCard fight={it} align={side} />
              )}
            </div>
          );
        })}
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
        fighter_a:fighters!fighter_a_id(id, name, nickname, photo_url),
        fighter_b:fighters!fighter_b_id(id, name, nickname, photo_url)`
      )
      .eq("event_id", event.id)
      .order("fight_order", { ascending: true });
    fights = (data ?? []) as unknown as FightRow[];
  }

  // Index fights by fight_order. Fixed 15-person bracket with 14 matches:
  // R1: orders 1..7 (7 matches, +1 BYE slot to fill 8 R1 slots of a 16-bracket)
  // QF: orders 8..11
  // SF: orders 12..13
  // Final: order 14
  const byOrder = new Map<number, FightRow>();
  for (const f of fights) {
    if (f.fight_order != null) byOrder.set(f.fight_order, f);
  }
  const get = (n: number) => byOrder.get(n) ?? null;

  // Split: left side gets indices 1..4 of R1 + 8..9 QF + 12 SF
  // right side gets 5..7 + BYE of R1 + 10..11 QF + 13 SF, final = 14
  const leftR1: (FightRow | null | "bye")[] = [get(1), get(2), get(3), get(4)];
  const rightR1: (FightRow | null | "bye")[] = [get(5), get(6), get(7), "bye"];
  const leftQF: (FightRow | null)[] = [get(8), get(9)];
  const rightQF: (FightRow | null)[] = [get(10), get(11)];
  const leftSF: (FightRow | null)[] = [get(12)];
  const rightSF: (FightRow | null)[] = [get(13)];
  const finalMatch = get(14);

  return (
    <div className="space-y-4">
      <div className="text-center space-y-1">
        <Trophy className="h-5 w-5 mx-auto" style={{ color: GOLD }} />
        <h1 className="font-heading text-2xl tracking-wide" style={{ color: GOLD }}>
          CHAVEAMENTO
        </h1>
        {event && <p className="text-sm text-[#9999AA]">{event.name}</p>}
      </div>

      {!event ? (
        <div className="text-center py-12">
          <Trophy className="h-12 w-12 mx-auto opacity-20" style={{ color: GOLD }} />
          <p className="text-sm text-[#9999AA] mt-3">
            Nenhum evento ativo no momento.
          </p>
        </div>
      ) : (
        <div
          className="overflow-x-auto rounded-xl border border-[#2A2A3A] p-4"
          style={{ background: "#16161F" }}
        >
          <div className="flex items-stretch w-max mx-auto" style={{ minHeight: 560 }}>
            <Column items={leftR1} side="left" label="OITAVAS" />
            <Column items={leftQF} side="left" label="QUARTAS" />
            <Column items={leftSF} side="left" label="SEMI" />

            {/* Center: trophy + final */}
            <div className="flex flex-col items-center justify-center px-5 gap-3">
              <Trophy className="h-12 w-12" style={{ color: GOLD }} />
              <p
                className="text-[10px] font-bold tracking-widest"
                style={{ color: GOLD }}
              >
                VENCEDOR
              </p>
              <MatchCard fight={finalMatch} align="left" />
              <p className="text-[9px] font-bold tracking-widest" style={{ color: GOLD }}>
                FINAL
              </p>
            </div>

            <Column items={rightSF} side="right" label="SEMI" />
            <Column items={rightQF} side="right" label="QUARTAS" />
            <Column items={rightR1} side="right" label="OITAVAS" />
          </div>
        </div>
      )}
    </div>
  );
}
