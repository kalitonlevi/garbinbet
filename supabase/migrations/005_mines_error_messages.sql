-- ============================================
-- 011: Fix R$ formatting in Mines error messages
-- ============================================
-- As mensagens de erro em mines_start_game mostravam "R$ 10.00,00" em
-- vez de "R$ 10,00" porque:
--   - ::text de um numeric usa ponto como separador decimal
--   - o literal ",00" era concatenado em cima do valor já decimal
-- Este patch troca as mensagens por formato BR (vírgula decimal) e
-- remove a duplicação "00".

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
    RAISE EXCEPTION 'Aposta deve estar entre R$ 1,00 e R$ %',
      replace(to_char(v_max_bet, 'FM999990.00'), '.', ',');
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
      replace(to_char(v_reserve, 'FM999990.00'), '.', ','),
      replace(to_char(v_max_payout, 'FM999990.00'), '.', ',');
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
      replace(to_char(v_daily_cap, 'FM999990.00'), '.', ',');
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
