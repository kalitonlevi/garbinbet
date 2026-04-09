import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Users, User } from "lucide-react";
import Image from "next/image";
import type { Fighter } from "@/types/database";

export default async function FightersPage() {
  const supabase = await createClient();

  const { data: fighters } = await supabase
    .from("fighters")
    .select("*")
    .order("name");

  const male = (fighters ?? []).filter((f: Fighter) => f.gender === "M");
  const female = (fighters ?? []).filter((f: Fighter) => f.gender === "F");

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Users className="h-5 w-5 text-[#D4A017]" />
        <h1 className="font-heading text-2xl text-[#D4A017] tracking-wide">
          LUTADORES
        </h1>
      </div>

      {!fighters || fighters.length === 0 ? (
        <Card className="border-[#2A2A3A]" style={{ background: "#16161F" }}>
          <CardContent className="py-8 text-center text-[#6B6B80]">
            Nenhum lutador cadastrado ainda.
          </CardContent>
        </Card>
      ) : (
        <>
          <FighterSection title="MASCULINO" fighters={male} />
          <FighterSection title="FEMININO" fighters={female} />
        </>
      )}
    </div>
  );
}

function FighterSection({
  title,
  fighters,
}: {
  title: string;
  fighters: Fighter[];
}) {
  return (
    <section className="space-y-3">
      <h2 className="font-heading text-sm tracking-widest text-[#9999AA]">
        {title}
      </h2>
      {fighters.length === 0 ? (
        <Card className="border-[#2A2A3A]" style={{ background: "#16161F" }}>
          <CardContent className="py-6 text-center text-[#6B6B80] text-sm">
            Nenhum lutador nesta categoria.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {fighters.map((fighter) => (
            <div
              key={fighter.id}
              className="rounded-xl border border-[#2A2A3A] overflow-hidden"
              style={{ background: "#16161F" }}
            >
              <div
                className="relative aspect-square flex items-center justify-center"
                style={{ background: "#1C1C28" }}
              >
                {fighter.photo_url ? (
                  <Image
                    src={fighter.photo_url}
                    alt={fighter.name}
                    fill
                    className="object-cover"
                  />
                ) : (
                  <User className="h-14 w-14 text-[#2A2A3A]" />
                )}
              </div>
              <div className="p-3 space-y-1">
                <p className="font-bold text-sm text-[#F0F0F0] truncate">
                  {fighter.name}
                </p>
                {fighter.nickname && (
                  <p className="text-[11px] text-[#6B6B80] italic truncate">
                    &quot;{fighter.nickname}&quot;
                  </p>
                )}
                {fighter.weight_kg && (
                  <p className="text-[10px] text-[#9999AA]">
                    {fighter.weight_kg} kg
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
