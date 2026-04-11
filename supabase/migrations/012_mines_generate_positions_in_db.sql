-- ============================================
-- 012: Move Mines seed + position generation into the database
-- ============================================
-- Até migration 011, mines_start_game aceitava mine_positions como
-- parâmetro vindo do server action Node. Um caller malicioso (ou um
-- admin descuidado abrindo o devtools) poderia chamar o RPC direto e
-- passar posições de mina que ele nunca clicaria, burlando o
-- provably-fair. Enquanto o jogo é admin-only isso é teórico, mas se
-- for liberado pros usuários vira brecha crítica.
--
-- Esta migration elimina a confiança no cliente: o server_seed, o
-- hash, e as posições são todos gerados dentro da função SECURITY
-- DEFINER usando pgcrypto (gen_random_bytes + hmac). O caller passa
-- apenas bet_amount, mines_count e client_seed opcional.
--
-- Algoritmo preservado idêntico ao Node anterior para manter a
-- reprodutibilidade: HMAC-SHA256 com key=server_seed (hex string como
-- UTF-8 bytes, p/ compatibilidade), data=client_seed:nonce:counter,
-- consome 4 bytes (u32) por pick, Fisher-Yates no array [0..24].

-- ============================================
-- HELPER: gera mine positions a partir de (seed, client_seed, nonce, m)
-- ============================================
CREATE OR REPLACE FUNCTION mines_generate_positions(
  p_server_seed text,
  p_client_seed text,
  p_nonce integer,
  p_mines_count integer
) RETURNS integer[] AS $$
DECLARE
  v_available integer[];
  v_picked integer[] := ARRAY[]::integer[];
  v_counter integer := 0;
  v_hash bytea;
  v_byte_offset integer;
  v_u32 bigint;
  v_idx integer;
BEGIN
  IF p_mines_count < 1 OR p_mines_count > 24 THEN
    RAISE EXCEPTION 'Mines count out of range (1..24)';
  END IF;

  v_available := ARRAY(SELECT generate_series(0, 24));

  WHILE coalesce(array_length(v_picked, 1), 0) < p_mines_count LOOP
    v_hash := hmac(
      convert_to(
        p_client_seed || ':' || p_nonce::text || ':' || v_counter::text,
        'UTF8'
      ),
      convert_to(p_server_seed, 'UTF8'),
      'sha256'
    );

    v_byte_offset := 0;
    WHILE v_byte_offset + 4 <= 32
      AND coalesce(array_length(v_picked, 1), 0) < p_mines_count LOOP
      v_u32 := get_byte(v_hash, v_byte_offset)::bigint * 16777216
             + get_byte(v_hash, v_byte_offset + 1)::bigint * 65536
             + get_byte(v_hash, v_byte_offset + 2)::bigint * 256
             + get_byte(v_hash, v_byte_offset + 3)::bigint;
      v_idx := (v_u32 % array_length(v_available, 1))::integer + 1;
      v_picked := array_append(v_picked, v_available[v_idx]);
      v_available := v_available[1:v_idx-1] || v_available[v_idx+1:];
      v_byte_offset := v_byte_offset + 4;
    END LOOP;

    v_counter := v_counter + 1;
  END LOOP;

  RETURN ARRAY(SELECT unnest(v_picked) ORDER BY 1);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

GRANT EXECUTE ON FUNCTION mines_generate_positions(text, text, integer, integer) TO authenticated;

-- ============================================
-- START GAME: now generates seed + positions internally
-- ============================================
DROP FUNCTION IF EXISTS mines_start_game(numeric, integer, text, text, text, integer[]);

CREATE OR REPLACE FUNCTION mines_start_game(
  p_bet_amount numeric,
  p_mines_count integer,
  p_client_seed text DEFAULT 'default'
) RETURNS jsonb AS $$
DECLARE
  v_user_id uuid;
  v_wallet_id uuid;
  v_balance numeric;
  v_new_balance numeric;
  v_game_id uuid;
  v_nonce integer;
  v_server_seed text;
  v_server_seed_hash text;
  v_mine_positions integer[];
  v_client_seed text;
  v_total_wallets numeric;
  v_reserve numeric;
  v_daily_profit numeric;
  v_max_bet constant numeric := 10.00;
  v_max_payout constant numeric := 100.00;
  v_reserve_pct constant numeric := 0.30;
  v_daily_cap constant numeric := 50.00;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  -- Input validation
  IF p_bet_amount < 1 OR p_bet_amount > v_max_bet THEN
    RAISE EXCEPTION 'Aposta deve estar entre R$ 1,00 e R$ %',
      replace(to_char(v_max_bet, 'FM999990.00'), '.', ',');
  END IF;
  IF p_mines_count < 1 OR p_mines_count > 24 THEN
    RAISE EXCEPTION 'Número de minas inválido (1 a 24)';
  END IF;

  -- 1 active game per user
  IF EXISTS (
    SELECT 1 FROM mines_games WHERE user_id = v_user_id AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'Você já tem um jogo de Mines ativo';
  END IF;

  -- Bankroll reserve check
  SELECT coalesce(sum(balance), 0) INTO v_total_wallets FROM wallets;
  v_reserve := v_total_wallets * v_reserve_pct;
  IF v_reserve < v_max_payout THEN
    RAISE EXCEPTION
      'Caixa da casa insuficiente para liberar Mines agora (reserva R$ %, precisa R$ %). Volte mais tarde.',
      replace(to_char(v_reserve, 'FM999990.00'), '.', ','),
      replace(to_char(v_max_payout, 'FM999990.00'), '.', ',');
  END IF;

  -- Daily win cap
  SELECT coalesce(sum(cashout_amount - bet_amount), 0) INTO v_daily_profit
  FROM mines_games
  WHERE user_id = v_user_id
    AND status = 'won'
    AND ended_at > now() - interval '24 hours';

  IF v_daily_profit >= v_daily_cap THEN
    RAISE EXCEPTION 'Limite diário de ganhos atingido (R$ %). Tente novamente em 24h.',
      replace(to_char(v_daily_cap, 'FM999990.00'), '.', ',');
  END IF;

  -- Lock wallet and debit
  SELECT id, balance INTO v_wallet_id, v_balance
  FROM wallets WHERE user_id = v_user_id FOR UPDATE;

  IF v_wallet_id IS NULL THEN
    RAISE EXCEPTION 'Carteira não encontrada';
  END IF;
  IF v_balance < p_bet_amount THEN
    RAISE EXCEPTION 'Saldo insuficiente';
  END IF;

  v_new_balance := v_balance - p_bet_amount;
  UPDATE wallets SET balance = v_new_balance, updated_at = now() WHERE id = v_wallet_id;

  -- ============================================
  -- Seed, hash, positions generated INSIDE the DB — caller has
  -- no influence on which tiles are mines.
  -- ============================================
  v_server_seed := encode(gen_random_bytes(32), 'hex');
  v_server_seed_hash := encode(digest(v_server_seed, 'sha256'), 'hex');
  v_client_seed := coalesce(nullif(trim(p_client_seed), ''), 'default');

  SELECT count(*) + 1 INTO v_nonce FROM mines_games WHERE user_id = v_user_id;

  v_mine_positions := mines_generate_positions(
    v_server_seed, v_client_seed, v_nonce, p_mines_count
  );

  INSERT INTO mines_games (
    user_id, bet_amount, mines_count, mine_positions,
    server_seed, server_seed_hash, client_seed, nonce, status
  ) VALUES (
    v_user_id, p_bet_amount, p_mines_count, v_mine_positions,
    v_server_seed, v_server_seed_hash, v_client_seed, v_nonce, 'active'
  ) RETURNING id INTO v_game_id;

  INSERT INTO transactions (wallet_id, type, amount, balance_after, reference_id, description)
  VALUES (v_wallet_id, 'bet_placed', -p_bet_amount, v_new_balance, v_game_id, '🎲 Mines - Aposta');

  -- server_seed and mine_positions are NEVER returned from start.
  -- They only become visible after the game ends.
  RETURN jsonb_build_object(
    'game_id', v_game_id,
    'bet_amount', p_bet_amount,
    'mines_count', p_mines_count,
    'server_seed_hash', v_server_seed_hash,
    'client_seed', v_client_seed,
    'nonce', v_nonce,
    'new_balance', v_new_balance,
    'daily_profit', v_daily_profit,
    'max_payout', v_max_payout,
    'daily_cap', v_daily_cap
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION mines_start_game(numeric, integer, text) TO authenticated;
