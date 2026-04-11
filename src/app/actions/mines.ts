"use server";

import crypto from "crypto";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

// ============================================
// Provably fair mine position generation
// ============================================
// Uses HMAC-SHA256(server_seed, client_seed:nonce) as PRNG source.
// Consumes 8 hex chars (4 bytes, u32) per pick. If the HMAC runs out,
// rehashes with an incrementing counter. Fisher-Yates-style elimination
// guarantees uniqueness.
function generateMinePositions(
  serverSeed: string,
  clientSeed: string,
  nonce: number,
  minesCount: number
): number[] {
  const available: number[] = [];
  for (let i = 0; i < 25; i++) available.push(i);
  const picked: number[] = [];

  let counter = 0;
  while (picked.length < minesCount) {
    const hash = crypto
      .createHmac("sha256", serverSeed)
      .update(`${clientSeed}:${nonce}:${counter}`)
      .digest("hex");

    for (
      let offset = 0;
      offset + 8 <= hash.length && picked.length < minesCount;
      offset += 8
    ) {
      const u32 = parseInt(hash.substring(offset, offset + 8), 16);
      const index = u32 % available.length;
      picked.push(available[index]);
      available.splice(index, 1);
    }
    counter++;
  }

  return picked.sort((a, b) => a - b);
}

function sha256Hex(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

// ============================================
// Server Actions
// ============================================

export type StartGameResult = {
  gameId: string;
  betAmount: number;
  minesCount: number;
  serverSeedHash: string;
  clientSeed: string;
  nonce: number;
  newBalance: number;
  revealedPositions: number[];
  multiplier: number;
};

export async function startGame(
  betAmount: number,
  minesCount: number,
  clientSeed?: string
): Promise<{ ok: true; data: StartGameResult } | { ok: false; error: string }> {
  try {
    if (!Number.isFinite(betAmount) || betAmount < 1 || betAmount > 200) {
      return { ok: false, error: "Aposta deve estar entre R$ 1,00 e R$ 200,00" };
    }
    if (
      !Number.isInteger(minesCount) ||
      minesCount < 1 ||
      minesCount > 24
    ) {
      return { ok: false, error: "Número de minas inválido (1 a 24)" };
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: "Não autenticado" };

    // Generate provably fair seeds
    const serverSeed = crypto.randomBytes(32).toString("hex");
    const serverSeedHash = sha256Hex(serverSeed);
    const cleanClientSeed = (clientSeed ?? "default").trim() || "default";

    // Compute nonce client-side for position generation. DB also recomputes
    // its own nonce; we use a fresh one here just for the HMAC input so the
    // client can later re-derive positions using the server_seed reveal.
    const { count } = await supabase
      .from("mines_games")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id);
    const nonce = (count ?? 0) + 1;

    const minePositions = generateMinePositions(
      serverSeed,
      cleanClientSeed,
      nonce,
      minesCount
    );

    const { data, error } = await supabase.rpc("mines_start_game", {
      p_bet_amount: betAmount,
      p_mines_count: minesCount,
      p_server_seed: serverSeed,
      p_server_seed_hash: serverSeedHash,
      p_client_seed: cleanClientSeed,
      p_mine_positions: minePositions,
    });

    if (error) return { ok: false, error: error.message };
    if (!data) return { ok: false, error: "Falha ao iniciar jogo" };

    revalidatePath("/mines");
    revalidatePath("/wallet");

    return {
      ok: true,
      data: {
        gameId: data.game_id as string,
        betAmount: Number(data.bet_amount),
        minesCount: Number(data.mines_count),
        serverSeedHash: data.server_seed_hash as string,
        clientSeed: data.client_seed as string,
        nonce: Number(data.nonce),
        newBalance: Number(data.new_balance),
        revealedPositions: [],
        multiplier: 1,
      },
    };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export type RevealResult =
  | {
      result: "safe";
      position: number;
      multiplier: number;
      revealedCount: number;
      payout: number;
      autoCashout?: boolean;
      newBalance?: number;
      minePositions?: number[];
      serverSeed?: string;
    }
  | {
      result: "mine";
      position: number;
      minePositions: number[];
      serverSeed: string;
      betAmount: number;
      minesCount: number;
    };

export async function revealTile(
  gameId: string,
  position: number
): Promise<{ ok: true; data: RevealResult } | { ok: false; error: string }> {
  try {
    if (!gameId) return { ok: false, error: "Game id obrigatório" };
    if (!Number.isInteger(position) || position < 0 || position > 24) {
      return { ok: false, error: "Posição inválida" };
    }

    const supabase = await createClient();
    const { data, error } = await supabase.rpc("mines_reveal_tile", {
      p_game_id: gameId,
      p_position: position,
    });

    if (error) return { ok: false, error: error.message };
    if (!data) return { ok: false, error: "Resposta vazia" };

    if (data.result === "mine") {
      revalidatePath("/mines");
      revalidatePath("/wallet");
      return {
        ok: true,
        data: {
          result: "mine",
          position: Number(data.position),
          minePositions: (data.mine_positions as number[]) ?? [],
          serverSeed: data.server_seed as string,
          betAmount: Number(data.bet_amount ?? 0),
          minesCount: Number(data.mines_count ?? 0),
        },
      };
    }

    // safe
    const safe: RevealResult = {
      result: "safe",
      position: Number(data.position),
      multiplier: Number(data.multiplier),
      revealedCount: Number(data.revealed_count),
      payout: Number(data.payout),
      autoCashout: Boolean(data.auto_cashout),
    };

    if (data.auto_cashout) {
      safe.newBalance = Number(data.new_balance);
      safe.minePositions = (data.mine_positions as number[]) ?? [];
      safe.serverSeed = data.server_seed as string;
      revalidatePath("/mines");
      revalidatePath("/wallet");
    }

    return { ok: true, data: safe };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export type CashoutResult = {
  payout: number;
  multiplier: number;
  revealedCount: number;
  minePositions: number[];
  serverSeed: string;
  newBalance: number;
};

export async function cashout(
  gameId: string
): Promise<
  { ok: true; data: CashoutResult } | { ok: false; error: string }
> {
  try {
    if (!gameId) return { ok: false, error: "Game id obrigatório" };
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("mines_cashout", {
      p_game_id: gameId,
    });
    if (error) return { ok: false, error: error.message };
    if (!data) return { ok: false, error: "Resposta vazia" };

    revalidatePath("/mines");
    revalidatePath("/wallet");

    return {
      ok: true,
      data: {
        payout: Number(data.payout),
        multiplier: Number(data.multiplier),
        revealedCount: Number(data.revealed_count),
        minePositions: (data.mine_positions as number[]) ?? [],
        serverSeed: data.server_seed as string,
        newBalance: Number(data.new_balance),
      },
    };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export type ActiveGame = {
  gameId: string;
  betAmount: number;
  minesCount: number;
  revealedPositions: number[];
  revealedCount: number;
  multiplier: number;
  payout: number;
  serverSeedHash: string;
  clientSeed: string;
  nonce: number;
  createdAt: string;
};

export async function getActiveGame(): Promise<ActiveGame | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("mines_get_active_game");
  if (error || !data) return null;
  return {
    gameId: data.game_id as string,
    betAmount: Number(data.bet_amount),
    minesCount: Number(data.mines_count),
    revealedPositions: (data.revealed_positions as number[]) ?? [],
    revealedCount: Number(data.revealed_count ?? 0),
    multiplier: Number(data.multiplier ?? 1),
    payout: Number(data.payout ?? 0),
    serverSeedHash: data.server_seed_hash as string,
    clientSeed: data.client_seed as string,
    nonce: Number(data.nonce),
    createdAt: data.created_at as string,
  };
}
