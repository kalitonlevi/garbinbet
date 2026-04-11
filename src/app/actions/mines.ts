"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import {
  MINES_MAX_BET,
  MINES_MAX_PAYOUT,
  MINES_DAILY_CAP,
} from "@/lib/mines-config";

// Mines is admin-only. Every action re-verifies the role — the page-level
// redirect is UX, this is the real security boundary.
async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false as const, error: "Não autenticado", supabase, user: null };
  }
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin") {
    return { ok: false as const, error: "Acesso negado", supabase, user };
  }
  return { ok: true as const, supabase, user };
}

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
  maxPayout: number;
  dailyCap: number;
  dailyProfit: number;
};

export async function startGame(
  betAmount: number,
  minesCount: number,
  clientSeed?: string
): Promise<{ ok: true; data: StartGameResult } | { ok: false; error: string }> {
  try {
    if (
      !Number.isFinite(betAmount) ||
      betAmount < 1 ||
      betAmount > MINES_MAX_BET
    ) {
      return {
        ok: false,
        error: `Aposta deve estar entre R$ 1,00 e R$ ${MINES_MAX_BET},00`,
      };
    }
    if (
      !Number.isInteger(minesCount) ||
      minesCount < 1 ||
      minesCount > 24
    ) {
      return { ok: false, error: "Número de minas inválido (1 a 24)" };
    }

    const auth = await requireAdmin();
    if (!auth.ok) return { ok: false, error: auth.error };
    const { supabase } = auth;

    const cleanClientSeed = (clientSeed ?? "default").trim() || "default";

    // The DB (mines_start_game) now generates the server_seed, the hash
    // commitment, and the mine positions internally using pgcrypto. We
    // don't touch any of that here — the caller has zero influence over
    // which tiles are mines, which closes the provably-fair loop.
    const { data, error } = await supabase.rpc("mines_start_game", {
      p_bet_amount: betAmount,
      p_mines_count: minesCount,
      p_client_seed: cleanClientSeed,
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
        maxPayout: Number(data.max_payout ?? MINES_MAX_PAYOUT),
        dailyCap: Number(data.daily_cap ?? MINES_DAILY_CAP),
        dailyProfit: Number(data.daily_profit ?? 0),
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
      capped?: boolean;
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

    const auth = await requireAdmin();
    if (!auth.ok) return { ok: false, error: auth.error };
    const { supabase } = auth;

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
      capped: Boolean(data.capped),
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
  capped: boolean;
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
    const auth = await requireAdmin();
    if (!auth.ok) return { ok: false, error: auth.error };
    const { supabase } = auth;

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
        capped: Boolean(data.capped),
        minePositions: (data.mine_positions as number[]) ?? [],
        serverSeed: data.server_seed as string,
        newBalance: Number(data.new_balance),
      },
    };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export type HouseStatus = {
  totalWallets: number;
  reserve: number;
  reservePct: number;
  maxPayout: number;
  acceptingBets: boolean;
  activeGames: number;
  housePnl24h: number;
};

export async function getHouseStatus(): Promise<HouseStatus | null> {
  const auth = await requireAdmin();
  if (!auth.ok) return null;
  const { supabase } = auth;
  const { data, error } = await supabase.rpc("mines_house_status");
  if (error || !data) return null;
  return {
    totalWallets: Number(data.total_wallets),
    reserve: Number(data.reserve),
    reservePct: Number(data.reserve_pct),
    maxPayout: Number(data.max_payout),
    acceptingBets: Boolean(data.accepting_bets),
    activeGames: Number(data.active_games),
    housePnl24h: Number(data.house_pnl_24h),
  };
}

export type DailyWin = {
  dailyProfit: number;
  dailyCap: number;
  remaining: number;
};

export async function getDailyWin(): Promise<DailyWin | null> {
  const auth = await requireAdmin();
  if (!auth.ok) return null;
  const { supabase } = auth;
  const { data, error } = await supabase.rpc("mines_daily_user_win");
  if (error || !data) return null;
  return {
    dailyProfit: Number(data.daily_profit),
    dailyCap: Number(data.daily_cap),
    remaining: Number(data.remaining),
  };
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
  const auth = await requireAdmin();
  if (!auth.ok) return null;
  const { supabase } = auth;
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
