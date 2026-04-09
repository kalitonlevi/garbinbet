import { createClient } from "@/lib/supabase/server";
import { Trophy, User } from "lucide-react";
import Image from "next/image";

type FightRow = {
  id: string;
  status: string;
  winner_id: string | null;
  fight_order: number | null;
  fighter_a: { id: string; name: string; nickname: string | null; photo_url: string | null } | null;
  fighter_b: { id: string; name: string; nickname: string | null; photo_url: string | null } | null;
};

function buildRounds(fights: FightRow[]): FightRow[][] {
  const sorted = [...fights].sort(
    (a, b) => (a.fight_order ?? 0) - (b.fight_order ?? 0)
  );
  const total = sorted.length;
  if (total === 0) return [];
  let k = 1;
  while ((1 << k) - 1 < total) k++;
  const rounds: FightRow[][] = [];
  let idx = 0;
  for (let r = k - 1; r >= 0; r--) {
    const size = 1 << r;
    rounds.push(sorted.slice(idx, idx + size));
    idx += size;
  }
  return rounds;
}

function FighterPill({
  fighter,
  variant,
  isWinner,
  dim,
  align,
}: {
  fighter: FightRow["fighter_a"];
  variant: "blue" | "yellow";
  isWinner: boolean;
  dim: boolean;
  align: "left" | "right";
}) {
  const bg = variant === "blue" ? "#BFE3EF" : "#F5C84B";
  return (
    <div
      className={`flex items-center gap-1.5 rounded-md px-1.5 py-1 ${
        align === "right" ? "flex-row-reverse" : ""
      } ${dim ? "opacity-40" : ""} ${isWinner ? "ring-2 ring-[#7ED957]" : ""}`}
      style={{ background: bg }}
    >
      <div
        className="h-5 w-5 rounded-full overflow-hidden flex-shrink-0 flex items-center justify-center"
        style={{ background: "#1C1C28" }}
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
          <User className="h-3 w-3 text-[#9999AA]" />
        )}
      </div>
      <span
        className={`text-[10px] font-bold text-[#0A0A0F] truncate ${
          align === "right" ? "text-right" : "text-left"
        }`}
      >
        {fighter?.name ?? "—"}
      </span>
    </div>
  );
}

function Match({ fight, align }: { fight: FightRow; align: "left" | "right" }) {
  const aWon = fight.status === "finished" && fight.winner_id === fight.fighter_a?.id;
  const bWon = fight.status === "finished" && fight.winner_id === fight.fighter_b?.id;
  const finished = fight.status === "finished";
  return (
    <div className="flex flex-col gap-1 w-[120px]">
      <FighterPill
        fighter={fight.fighter_a}
        variant="blue"
        isWinner={aWon}
        dim={finished && !aWon}
        align={align}
      />
      <FighterPill
        fighter={fight.fighter_b}
        variant="yellow"
        isWinner={bWon}
        dim={finished && !bWon}
        align={align}
      />
    </div>
  );
}

function RoundColumn({
  matches,
  side,
}: {
  matches: FightRow[];
  side: "left" | "right";
}) {
  const borderSide = side === "left" ? "border-r-2" : "border-l-2";
  return (
    <div className="flex flex-col justify-around py-2">
      {matches.map((m, i) => {
        const isTop = i % 2 === 0;
        return (
          <div
            key={m.id}
            className={`flex-1 flex items-center ${
              side === "left" ? "pr-3" : "pl-3"
            } ${borderSide} ${isTop ? "border-b-2" : "border-t-2"} border-[#D4A017]`}
          >
            <Match fight={m} align={side} />
          </div>
        );
      })}
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

  const rounds = buildRounds(fights);
  const finalMatch = rounds.length > 0 ? rounds[rounds.length - 1][0] : null;
  // For each non-final round, split in half: left/right
  const leftRounds: FightRow[][] = [];
  const rightRounds: FightRow[][] = [];
  for (let r = 0; r < rounds.length - 1; r++) {
    const half = Math.ceil(rounds[r].length / 2);
    leftRounds.push(rounds[r].slice(0, half));
    rightRounds.push(rounds[r].slice(half));
  }

  return (
    <div className="space-y-4">
      <div className="text-center space-y-1">
        <Trophy className="h-5 w-5 text-[#D4A017] mx-auto" />
        <h1 className="font-heading text-2xl text-[#D4A017] tracking-wide">
          CHAVEAMENTO
        </h1>
        {event && <p className="text-sm text-[#9999AA]">{event.name}</p>}
      </div>

      {!event ? (
        <div className="text-center py-12">
          <Trophy className="h-12 w-12 mx-auto text-[#D4A017] opacity-20" />
          <p className="text-sm text-[#9999AA] mt-3">
            Nenhum evento ativo no momento.
          </p>
        </div>
      ) : fights.length === 0 ? (
        <div
          className="rounded-xl border border-[#2A2A3A] py-8 text-center text-[#6B6B80]"
          style={{ background: "#16161F" }}
        >
          Lutas ainda n&atilde;o foram definidas.
        </div>
      ) : (
        <div
          className="overflow-x-auto rounded-xl border border-[#2A2A3A] p-3"
          style={{ background: "#16161F" }}
        >
          <div className="flex items-stretch min-h-[420px] mx-auto w-max">
            {/* Left side: round 1 → semis */}
            {leftRounds.map((matches, i) => (
              <RoundColumn key={`L${i}`} matches={matches} side="left" />
            ))}

            {/* Center: trophy + final */}
            <div className="flex flex-col items-center justify-center px-4 gap-3">
              <Trophy className="h-12 w-12 text-[#D4A017]" />
              <p className="text-[10px] font-bold text-[#D4A017] tracking-widest">
                VENCEDOR
              </p>
              {finalMatch && (
                <div className="flex items-center gap-2">
                  <Match fight={finalMatch} align="left" />
                </div>
              )}
            </div>

            {/* Right side: semis → round 1 (reverse column order) */}
            {[...rightRounds].reverse().map((matches, i) => (
              <RoundColumn key={`R${i}`} matches={matches} side="right" />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
