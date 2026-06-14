"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

const CRASH_MAX_BET = 10;

async function requireAuth() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false as const, error: "Não autenticado", supabase, user: null };
  }
  return { ok: true as const, supabase, user };
}

export type CrashStartResult = {
  gameId: string;
  betAmount: number;
  serverSeedHash: string;
  clientSeed: string;
  nonce: number;
  startedAt: string;
  newBalance: number;
  maxPayout: number;
  growthK: number;
};

export async function startGame(
  betAmount: number,
  clientSeed?: string
): Promise<
  { ok: true; data: CrashStartResult } | { ok: false; error: string }
> {
  try {
    if (!Number.isFinite(betAmount) || betAmount < 1 || betAmount > CRASH_MAX_BET) {
      return {
        ok: false,
        error: `Aposta deve estar entre R$ 1,00 e R$ ${CRASH_MAX_BET},00`,
      };
    }

    const auth = await requireAuth();
    if (!auth.ok) return { ok: false, error: auth.error };
    const { supabase } = auth;

    const cleanSeed = (clientSeed ?? "default").trim() || "default";

    const { data, error } = await supabase.rpc("crash_start_game", {
      p_bet_amount: betAmount,
      p_client_seed: cleanSeed,
    });

    if (error) return { ok: false, error: error.message };
    if (!data) return { ok: false, error: "Falha ao iniciar jogo" };

    revalidatePath("/crash");
    revalidatePath("/wallet");

    return {
      ok: true,
      data: {
        gameId: data.game_id as string,
        betAmount: Number(data.bet_amount),
        serverSeedHash: data.server_seed_hash as string,
        clientSeed: data.client_seed as string,
        nonce: Number(data.nonce),
        startedAt: data.started_at as string,
        newBalance: Number(data.new_balance),
        maxPayout: Number(data.max_payout),
        growthK: Number(data.growth_k),
      },
    };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export type CrashCashoutResult =
  | {
      result: "cashout";
      multiplier: number;
      payout: number;
      capped: boolean;
      crashPoint: number;
      serverSeed: string;
      newBalance: number;
    }
  | {
      result: "crashed";
      crashPoint: number;
      serverSeed: string;
      betAmount: number;
    };

export async function cashout(
  gameId: string
): Promise<
  { ok: true; data: CrashCashoutResult } | { ok: false; error: string }
> {
  try {
    if (!gameId) return { ok: false, error: "Game id obrigatório" };
    const auth = await requireAuth();
    if (!auth.ok) return { ok: false, error: auth.error };
    const { supabase } = auth;

    const { data, error } = await supabase.rpc("crash_cashout", {
      p_game_id: gameId,
    });
    if (error) return { ok: false, error: error.message };
    if (!data) return { ok: false, error: "Resposta vazia" };

    revalidatePath("/crash");
    revalidatePath("/wallet");

    if (data.result === "crashed") {
      return {
        ok: true,
        data: {
          result: "crashed",
          crashPoint: Number(data.crash_point),
          serverSeed: data.server_seed as string,
          betAmount: Number(data.bet_amount ?? 0),
        },
      };
    }

    return {
      ok: true,
      data: {
        result: "cashout",
        multiplier: Number(data.multiplier),
        payout: Number(data.payout),
        capped: Boolean(data.capped),
        crashPoint: Number(data.crash_point),
        serverSeed: data.server_seed as string,
        newBalance: Number(data.new_balance),
      },
    };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export type CrashPeekResult =
  | { status: "flying"; multiplier: number }
  | { status: "crashed"; crashPoint: number; serverSeed: string }
  | { status: "won"; multiplier: number; crashPoint: number; serverSeed: string };

export async function peek(
  gameId: string
): Promise<{ ok: true; data: CrashPeekResult } | { ok: false; error: string }> {
  try {
    if (!gameId) return { ok: false, error: "Game id obrigatório" };
    const auth = await requireAuth();
    if (!auth.ok) return { ok: false, error: auth.error };
    const { supabase } = auth;
    const { data, error } = await supabase.rpc("crash_peek", { p_game_id: gameId });
    if (error) return { ok: false, error: error.message };
    if (!data) return { ok: false, error: "Resposta vazia" };

    if (data.status === "flying") {
      return { ok: true, data: { status: "flying", multiplier: Number(data.multiplier) } };
    }
    if (data.status === "won") {
      return {
        ok: true,
        data: {
          status: "won",
          multiplier: Number(data.multiplier),
          crashPoint: Number(data.crash_point),
          serverSeed: data.server_seed as string,
        },
      };
    }
    return {
      ok: true,
      data: {
        status: "crashed",
        crashPoint: Number(data.crash_point),
        serverSeed: data.server_seed as string,
      },
    };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export type CrashActiveGame = {
  gameId: string;
  betAmount: number;
  serverSeedHash: string;
  clientSeed: string;
  nonce: number;
  startedAt: string;
  maxPayout: number;
  growthK: number;
};

export async function getActiveGame(): Promise<CrashActiveGame | null> {
  const auth = await requireAuth();
  if (!auth.ok) return null;
  const { supabase } = auth;
  const { data, error } = await supabase.rpc("crash_get_active_game");
  if (error || !data) return null;
  return {
    gameId: data.game_id as string,
    betAmount: Number(data.bet_amount),
    serverSeedHash: data.server_seed_hash as string,
    clientSeed: data.client_seed as string,
    nonce: Number(data.nonce),
    startedAt: data.started_at as string,
    maxPayout: Number(data.max_payout),
    growthK: Number(data.growth_k),
  };
}
