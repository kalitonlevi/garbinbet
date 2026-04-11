-- ============================================
-- 009: Mines safety limits (house risk controls)
-- ============================================
-- A GARBINBET não tem um caixa separado do saldo dos usuários — o
-- "banco da casa" é literalmente a soma das carteiras. Sem limites, um
-- único jackpot poderia deixar o admin devendo várias vezes o total
-- em caixa. Esta migration cria 4 controles empilhados:
--
--   1. MAX_BET      : R$ 10,00 por aposta
--   2. MAX_PAYOUT   : R$ 100,00 por aposta (corta o long-tail)
--   3. RESERVE      : 30% da soma das carteiras precisa cobrir MAX_PAYOUT
--   4. DAILY_CAP    : R$ 50 de lucro em Mines por usuário por 24h
--
-- Com esses limites o cálculo fica: bet × multiplier é sempre
-- <= MAX_PAYOUT (auto-cashout quando ultrapassa), nenhum usuário pode
-- rodar a mesa em sequência, e se o caixa total cair abaixo de
-- ~R$ 333 o Mines bloqueia apostas novas automaticamente.

-- ============================================
-- CONFIG HELPER
-- ============================================
CREATE OR REPLACE FUNCTION mines_config() RETURNS jsonb AS $$
  SELECT jsonb_build_object(
    'max_bet', 10.00,
    'max_payout', 100.00,
    'bankroll_reserve_pct', 0.30,
    'daily_win_cap', 50.00,
    'house_edge', 0.01
  );
$$ LANGUAGE sql IMMUTABLE;

GRANT EXECUTE ON FUNCTION mines_config() TO authenticated;

-- ============================================
-- START GAME (com limites)
-- ============================================
CREATE OR REPLACE FUNCTION mines_start_game(
  p_bet_amount numeric,
  p_mines_count integer,
  p_server_seed text,
  p_server_seed_hash text,
  p_client_seed text,
  p_mine_positions integer[]
) RETURNS jsonb AS $$
DECLARE
  v_user_id uuid;
  v_wallet_id uuid;
  v_balance numeric;
  v_new_balance numeric;
  v_game_id uuid;
  v_nonce integer;
  v_pos_count integer;
  v_unique_count integer;
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

  -- ---- Input validation ----
  IF p_bet_amount < 1 OR p_bet_amount > v_max_bet THEN
    RAISE EXCEPTION 'Aposta deve estar entre R$ 1,00 e R$ %,00', v_max_bet::text;
  END IF;
  IF p_mines_count < 1 OR p_mines_count > 24 THEN
    RAISE EXCEPTION 'Número de minas inválido (1 a 24)';
  END IF;

  v_pos_count := coalesce(array_length(p_mine_positions, 1), 0);
  IF v_pos_count != p_mines_count THEN
    RAISE EXCEPTION 'Mine positions size mismatch';
  END IF;

  SELECT count(DISTINCT pos) INTO v_unique_count
  FROM unnest(p_mine_positions) AS pos;
  IF v_unique_count != p_mines_count THEN
    RAISE EXCEPTION 'Mine positions must be unique';
  END IF;

  IF EXISTS (SELECT 1 FROM unnest(p_mine_positions) AS pos WHERE pos < 0 OR pos > 24) THEN
    RAISE EXCEPTION 'Mine position out of range';
  END IF;

  -- ---- 1 active game per user ----
  IF EXISTS (
    SELECT 1 FROM mines_games WHERE user_id = v_user_id AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'Você já tem um jogo de Mines ativo';
  END IF;

  -- ---- Bankroll reserve check ----
  SELECT coalesce(sum(balance), 0) INTO v_total_wallets FROM wallets;
  v_reserve := v_total_wallets * v_reserve_pct;
  IF v_reserve < v_max_payout THEN
    RAISE EXCEPTION
      'Caixa da casa insuficiente para liberar Mines agora (reserva R$ %, precisa R$ %). Volte mais tarde.',
      to_char(v_reserve, 'FM990.00'), to_char(v_max_payout, 'FM990.00');
  END IF;

  -- ---- Daily win cap per user ----
  SELECT coalesce(sum(cashout_amount - bet_amount), 0)
  INTO v_daily_profit
  FROM mines_games
  WHERE user_id = v_user_id
    AND status = 'won'
    AND ended_at > now() - interval '24 hours';

  IF v_daily_profit >= v_daily_cap THEN
    RAISE EXCEPTION
      'Limite diário de ganhos atingido (R$ %). Tente novamente em 24h.',
      to_char(v_daily_cap, 'FM990.00');
  END IF;

  -- ---- Lock wallet and debit ----
  SELECT id, balance INTO v_wallet_id, v_balance
  FROM wallets WHERE user_id = v_user_id FOR UPDATE;

  IF v_wallet_id IS NULL THEN
    RAISE EXCEPTION 'Carteira não encontrada';
  END IF;
  IF v_balance < p_bet_amount THEN
    RAISE EXCEPTION 'Saldo insuficiente';
  END IF;

  v_new_balance := v_balance - p_bet_amount;
  UPDATE wallets SET balance = v_new_balance, updated_at = now()
  WHERE id = v_wallet_id;

  -- ---- Compute nonce and insert ----
  SELECT count(*) + 1 INTO v_nonce
  FROM mines_games WHERE user_id = v_user_id;

  INSERT INTO mines_games (
    user_id, bet_amount, mines_count, mine_positions,
    server_seed, server_seed_hash, client_seed, nonce, status
  ) VALUES (
    v_user_id, p_bet_amount, p_mines_count, p_mine_positions,
    p_server_seed, p_server_seed_hash, coalesce(p_client_seed, 'default'), v_nonce, 'active'
  ) RETURNING id INTO v_game_id;

  INSERT INTO transactions (wallet_id, type, amount, balance_after, reference_id, description)
  VALUES (v_wallet_id, 'bet_placed', -p_bet_amount, v_new_balance, v_game_id, '🎲 Mines - Aposta');

  RETURN jsonb_build_object(
    'game_id', v_game_id,
    'bet_amount', p_bet_amount,
    'mines_count', p_mines_count,
    'server_seed_hash', p_server_seed_hash,
    'client_seed', coalesce(p_client_seed, 'default'),
    'nonce', v_nonce,
    'new_balance', v_new_balance,
    'daily_profit', v_daily_profit,
    'max_payout', v_max_payout,
    'daily_cap', v_daily_cap
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- REVEAL TILE (com auto-cashout no teto)
-- ============================================
CREATE OR REPLACE FUNCTION mines_reveal_tile(
  p_game_id uuid,
  p_position integer
) RETURNS jsonb AS $$
DECLARE
  v_user_id uuid;
  v_game mines_games;
  v_is_mine boolean;
  v_new_revealed integer[];
  v_revealed_count integer;
  v_multiplier numeric;
  v_payout numeric;
  v_safe_total integer;
  v_wallet_id uuid;
  v_new_balance numeric;
  v_capped boolean := false;
  v_max_payout constant numeric := 100.00;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  IF p_position < 0 OR p_position > 24 THEN
    RAISE EXCEPTION 'Posição inválida';
  END IF;

  SELECT * INTO v_game FROM mines_games
  WHERE id = p_game_id AND user_id = v_user_id
  FOR UPDATE;

  IF v_game.id IS NULL THEN
    RAISE EXCEPTION 'Jogo não encontrado';
  END IF;
  IF v_game.status != 'active' THEN
    RAISE EXCEPTION 'Jogo já terminou';
  END IF;
  IF p_position = ANY(v_game.revealed_positions) THEN
    RAISE EXCEPTION 'Tile já revelado';
  END IF;

  v_is_mine := p_position = ANY(v_game.mine_positions);

  IF v_is_mine THEN
    UPDATE mines_games SET
      status = 'lost',
      revealed_positions = array_append(revealed_positions, p_position),
      ended_at = now()
    WHERE id = p_game_id;

    RETURN jsonb_build_object(
      'result', 'mine',
      'position', p_position,
      'mine_positions', v_game.mine_positions,
      'server_seed', v_game.server_seed,
      'server_seed_hash', v_game.server_seed_hash,
      'client_seed', v_game.client_seed,
      'nonce', v_game.nonce,
      'bet_amount', v_game.bet_amount,
      'mines_count', v_game.mines_count
    );
  END IF;

  -- ---- Safe reveal ----
  v_new_revealed := array_append(v_game.revealed_positions, p_position);
  v_revealed_count := array_length(v_new_revealed, 1);
  v_multiplier := mines_compute_multiplier(v_revealed_count, v_game.mines_count);
  v_payout := floor(v_game.bet_amount * v_multiplier * 100) / 100;
  v_safe_total := 25 - v_game.mines_count;

  -- If payout would exceed MAX_PAYOUT, cap it and end the game as won
  IF v_payout >= v_max_payout THEN
    v_payout := v_max_payout;
    v_capped := true;
  END IF;

  IF v_capped OR v_revealed_count >= v_safe_total THEN
    -- End game (auto-cashout: cap hit or all safe tiles revealed)
    SELECT id INTO v_wallet_id FROM wallets WHERE user_id = v_user_id FOR UPDATE;
    UPDATE wallets SET balance = balance + v_payout, updated_at = now()
    WHERE id = v_wallet_id
    RETURNING balance INTO v_new_balance;

    INSERT INTO transactions (wallet_id, type, amount, balance_after, reference_id, description)
    VALUES (
      v_wallet_id, 'bet_won', v_payout, v_new_balance, p_game_id,
      CASE
        WHEN v_capped THEN '💎 Mines - Retirada no teto R$ ' || to_char(v_max_payout, 'FM990.00')
        ELSE '💎 Mines - Retirada ' || to_char(v_multiplier, 'FM990.00') || 'x (auto)'
      END
    );

    UPDATE mines_games SET
      revealed_positions = v_new_revealed,
      status = 'won',
      cashout_multiplier = v_multiplier,
      cashout_amount = v_payout,
      ended_at = now()
    WHERE id = p_game_id;

    RETURN jsonb_build_object(
      'result', 'safe',
      'position', p_position,
      'multiplier', v_multiplier,
      'revealed_count', v_revealed_count,
      'payout', v_payout,
      'auto_cashout', true,
      'capped', v_capped,
      'mine_positions', v_game.mine_positions,
      'server_seed', v_game.server_seed,
      'server_seed_hash', v_game.server_seed_hash,
      'client_seed', v_game.client_seed,
      'nonce', v_game.nonce,
      'new_balance', v_new_balance
    );
  END IF;

  -- Normal continuation
  UPDATE mines_games SET
    revealed_positions = v_new_revealed,
    cashout_multiplier = v_multiplier,
    cashout_amount = v_payout
  WHERE id = p_game_id;

  RETURN jsonb_build_object(
    'result', 'safe',
    'position', p_position,
    'multiplier', v_multiplier,
    'revealed_count', v_revealed_count,
    'payout', v_payout,
    'auto_cashout', false,
    'capped', false
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- CASHOUT (com teto)
-- ============================================
CREATE OR REPLACE FUNCTION mines_cashout(
  p_game_id uuid
) RETURNS jsonb AS $$
DECLARE
  v_user_id uuid;
  v_game mines_games;
  v_wallet_id uuid;
  v_new_balance numeric;
  v_revealed_count integer;
  v_multiplier numeric;
  v_payout numeric;
  v_capped boolean := false;
  v_max_payout constant numeric := 100.00;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  SELECT * INTO v_game FROM mines_games
  WHERE id = p_game_id AND user_id = v_user_id
  FOR UPDATE;

  IF v_game.id IS NULL THEN
    RAISE EXCEPTION 'Jogo não encontrado';
  END IF;
  IF v_game.status != 'active' THEN
    RAISE EXCEPTION 'Jogo já terminou';
  END IF;

  v_revealed_count := coalesce(array_length(v_game.revealed_positions, 1), 0);
  IF v_revealed_count < 1 THEN
    RAISE EXCEPTION 'Revele pelo menos 1 tile antes de retirar';
  END IF;

  v_multiplier := mines_compute_multiplier(v_revealed_count, v_game.mines_count);
  v_payout := floor(v_game.bet_amount * v_multiplier * 100) / 100;

  IF v_payout > v_max_payout THEN
    v_payout := v_max_payout;
    v_capped := true;
  END IF;

  SELECT id INTO v_wallet_id FROM wallets WHERE user_id = v_user_id FOR UPDATE;
  UPDATE wallets SET balance = balance + v_payout, updated_at = now()
  WHERE id = v_wallet_id
  RETURNING balance INTO v_new_balance;

  INSERT INTO transactions (wallet_id, type, amount, balance_after, reference_id, description)
  VALUES (
    v_wallet_id, 'bet_won', v_payout, v_new_balance, p_game_id,
    CASE
      WHEN v_capped THEN '💎 Mines - Retirada no teto R$ ' || to_char(v_max_payout, 'FM990.00')
      ELSE '💎 Mines - Retirada ' || to_char(v_multiplier, 'FM990.00') || 'x'
    END
  );

  UPDATE mines_games SET
    status = 'won',
    cashout_multiplier = v_multiplier,
    cashout_amount = v_payout,
    ended_at = now()
  WHERE id = p_game_id;

  RETURN jsonb_build_object(
    'result', 'cashout',
    'payout', v_payout,
    'multiplier', v_multiplier,
    'revealed_count', v_revealed_count,
    'capped', v_capped,
    'mine_positions', v_game.mine_positions,
    'server_seed', v_game.server_seed,
    'server_seed_hash', v_game.server_seed_hash,
    'client_seed', v_game.client_seed,
    'nonce', v_game.nonce,
    'new_balance', v_new_balance
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- HOUSE STATUS (usado pelo admin dashboard e pelo UI do Mines)
-- ============================================
CREATE OR REPLACE FUNCTION mines_house_status() RETURNS jsonb AS $$
DECLARE
  v_total_wallets numeric;
  v_reserve numeric;
  v_reserve_pct constant numeric := 0.30;
  v_max_payout constant numeric := 100.00;
  v_active_games integer;
  v_24h_house_pnl numeric;
BEGIN
  SELECT coalesce(sum(balance), 0) INTO v_total_wallets FROM wallets;
  v_reserve := v_total_wallets * v_reserve_pct;

  SELECT count(*) INTO v_active_games
  FROM mines_games WHERE status = 'active';

  -- House P&L last 24h (positive = house is ahead).
  -- For lost games the house keeps the full bet (cashout_amount is the
  -- "would-have-been" value from the last safe reveal, not an actual
  -- payout). For won games the house paid bet + profit, so net is
  -- bet - cashout_amount.
  SELECT coalesce(sum(
    CASE
      WHEN status = 'won' THEN bet_amount - cashout_amount
      WHEN status = 'lost' THEN bet_amount
      ELSE 0
    END
  ), 0) INTO v_24h_house_pnl
  FROM mines_games
  WHERE status IN ('won', 'lost')
    AND ended_at > now() - interval '24 hours';

  RETURN jsonb_build_object(
    'total_wallets', v_total_wallets,
    'reserve', v_reserve,
    'reserve_pct', v_reserve_pct,
    'max_payout', v_max_payout,
    'accepting_bets', v_reserve >= v_max_payout,
    'active_games', v_active_games,
    'house_pnl_24h', v_24h_house_pnl
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

GRANT EXECUTE ON FUNCTION mines_house_status() TO authenticated;

-- ============================================
-- DAILY USER WIN (usado pelo UI para mostrar "ganhos hoje")
-- ============================================
CREATE OR REPLACE FUNCTION mines_daily_user_win() RETURNS jsonb AS $$
DECLARE
  v_user_id uuid;
  v_daily_profit numeric;
  v_daily_cap constant numeric := 50.00;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  SELECT coalesce(sum(cashout_amount - bet_amount), 0) INTO v_daily_profit
  FROM mines_games
  WHERE user_id = v_user_id
    AND status = 'won'
    AND ended_at > now() - interval '24 hours';

  RETURN jsonb_build_object(
    'daily_profit', v_daily_profit,
    'daily_cap', v_daily_cap,
    'remaining', greatest(v_daily_cap - v_daily_profit, 0)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

GRANT EXECUTE ON FUNCTION mines_daily_user_win() TO authenticated;
