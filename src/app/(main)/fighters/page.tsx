import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Flag } from "lucide-react";
import Image from "next/image";
import type { Fighter } from "@/types/database";

export default async function FightersPage() {
  const supabase = await createClient();

  const { data: fighters } = await supabase
    .from("fighters")
    .select("id, name, nickname, photo_url, fifa_code, created_at")
    .order("name");

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Flag className="h-5 w-5 text-[#D4A017]" />
        <h1 className="font-heading text-2xl text-[#D4A017] tracking-wide">
          SELEÇÕES
        </h1>
      </div>

      {!fighters || fighters.length === 0 ? (
        <Card className="border-[#2A2A3A]" style={{ background: "#16161F" }}>
          <CardContent className="py-8 text-center text-[#6B6B80]">
            Nenhuma seleção cadastrada ainda.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {(fighters as Fighter[]).map((fighter) => (
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
                  <Flag className="h-14 w-14 text-[#2A2A3A]" />
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
                {fighter.fifa_code && (
                  <p className="text-[10px] font-bold tracking-widest text-[#7ED957]">
                    {fighter.fifa_code}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
