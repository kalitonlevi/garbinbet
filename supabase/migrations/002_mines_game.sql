-- ============================================
-- 008: Mines game (campo minado com apostas)
-- ============================================
-- Jogo tipo "mines" 5x5. O jogador aposta, escolhe qtd de minas (1..24),
-- vai revelando tiles, cada reveal seguro aumenta o multiplicador.
-- Pode retirar (cashout) a qualquer momento. Bater numa mina = perde.
--
-- House edge: 1% (RTP 99%), aplicado como (1 - edge)^revealed_count.
--
-- Provably fair: mine_positions é gerado no Node via
-- HMAC-SHA256(server_seed, client_seed:nonce). O server_seed_hash
-- (SHA-256 do server_seed) é exposto ANTES do jogo começar. Após o
-- jogo terminar, o server_seed é revelado para o jogador poder verificar.
--
-- Regras:
--   - Aposta: R$ 1,00 a R$ 200,00
--   - Minas: 1 a 24
--   - Apenas 1 jogo ativo por usuário
--   - Todas as mutações passam por funções SECURITY DEFINER
--   - Débito e crédito refletem no ledger (tabela transactions)
--   - Não há SELECT policy para usuário comum: leitura SÓ via RPCs,
--     evitando vazamento de mine_positions/server_seed em jogo ativo.

-- ============================================
-- TABLE
-- ============================================
CREATE TABLE mines_games (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles ON DELETE CASCADE,
  bet_amount numeric(12,2) NOT NULL CHECK (bet_amount > 0),
  mines_count integer NOT NULL CHECK (mines_count BETWEEN 1 AND 24),
  mine_positions integer[] NOT NULL,
  revealed_positions integer[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'won', 'lost')),
  cashout_multiplier numeric(8,4) NOT NULL DEFAULT 0,
  cashout_amount numeric(12,2) NOT NULL DEFAULT 0,
  server_seed text NOT NULL,
  server_seed_hash text NOT NULL,
  client_seed text NOT NULL DEFAULT 'default',
  nonce integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz
);

CREATE INDEX idx_mines_user ON mines_games(user_id);
CREATE INDEX idx_mines_active ON mines_games(user_id) WHERE status = 'active';

-- ============================================
-- RLS
-- ============================================
ALTER TABLE mines_games ENABLE ROW LEVEL SECURITY;

-- Admins podem ver tudo. Usuários normais leem apenas via RPCs.
CREATE POLICY "Admins can view all mines games"
  ON mines_games FOR SELECT
  USING (is_admin());

-- ============================================
-- COMPUTE MULTIPLIER
-- ============================================
CREATE OR REPLACE FUNCTION mines_compute_multiplier(
  p_revealed_count integer,
  p_mines_count integer
) RETURNS numeric AS $$
DECLARE
  v_mult numeric := 1;
  v_i integer;
  v_remaining integer;
  v_safe integer;
  v_house_edge constant numeric := 0.01;
BEGIN
  IF p_revealed_count < 0 THEN
    RAISE EXCEPTION 'Invalid revealed count';
  END IF;
  IF p_mines_count < 1 OR p_mines_count > 24 THEN
    RAISE EXCEPTION 'Invalid mines count';
  END IF;
  IF p_revealed_count > (25 - p_mines_count) THEN
    RAISE EXCEPTION 'Revealed count exceeds safe tiles';
  END IF;

  IF p_revealed_count = 0 THEN
    RETURN 1.00;
  END IF;

  FOR v_i IN 0..(p_revealed_count - 1) LOOP
    v_remaining := 25 - v_i;
    v_safe := 25 - p_mines_count - v_i;
    v_mult := v_mult * (v_remaining::numeric / v_safe::numeric);
  END LOOP;

  v_mult := v_mult * power(1 - v_house_edge, p_revealed_count);

  -- Truncate to 2 decimals (house-favorable rounding)
  RETURN floor(v_mult * 100) / 100;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================
-- START GAME
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
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  -- Validate inputs
  IF p_bet_amount < 1 OR p_bet_amount > 200 THEN
    RAISE EXCEPTION 'Aposta deve estar entre R$ 1,00 e R$ 200,00';
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

  -- Enforce 1 active game per user
  IF EXISTS (
    SELECT 1 FROM mines_games WHERE user_id = v_user_id AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'Você já tem um jogo de Mines ativo';
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
  UPDATE wallets SET balance = v_new_balance, updated_at = now()
  WHERE id = v_wallet_id;

  -- Compute nonce (number of prior games + 1)
  SELECT count(*) + 1 INTO v_nonce
  FROM mines_games WHERE user_id = v_user_id;

  -- Insert game
  INSERT INTO mines_games (
    user_id, bet_amount, mines_count, mine_positions,
    server_seed, server_seed_hash, client_seed, nonce, status
  ) VALUES (
    v_user_id, p_bet_amount, p_mines_count, p_mine_positions,
    p_server_seed, p_server_seed_hash, coalesce(p_client_seed, 'default'), v_nonce, 'active'
  ) RETURNING id INTO v_game_id;

  -- Transaction entry
  INSERT INTO transactions (wallet_id, type, amount, balance_after, reference_id, description)
  VALUES (v_wallet_id, 'bet_placed', -p_bet_amount, v_new_balance, v_game_id, '🎲 Mines - Aposta');

  RETURN jsonb_build_object(
    'game_id', v_game_id,
    'bet_amount', p_bet_amount,
    'mines_count', p_mines_count,
    'server_seed_hash', p_server_seed_hash,
    'client_seed', coalesce(p_client_seed, 'default'),
    'nonce', v_nonce,
    'new_balance', v_new_balance
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- REVEAL TILE
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
    -- Lost
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

  -- Safe reveal
  v_new_revealed := array_append(v_game.revealed_positions, p_position);
  v_revealed_count := array_length(v_new_revealed, 1);
  v_multiplier := mines_compute_multiplier(v_revealed_count, v_game.mines_count);
  v_payout := floor(v_game.bet_amount * v_multiplier * 100) / 100;
  v_safe_total := 25 - v_game.mines_count;

  IF v_revealed_count >= v_safe_total THEN
    -- All safe tiles revealed: auto-cashout
    SELECT id INTO v_wallet_id FROM wallets WHERE user_id = v_user_id FOR UPDATE;
    UPDATE wallets SET balance = balance + v_payout, updated_at = now()
    WHERE id = v_wallet_id
    RETURNING balance INTO v_new_balance;

    INSERT INTO transactions (wallet_id, type, amount, balance_after, reference_id, description)
    VALUES (
      v_wallet_id, 'bet_won', v_payout, v_new_balance, p_game_id,
      '💎 Mines - Retirada ' || to_char(v_multiplier, 'FM990.00') || 'x (auto)'
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
      'mine_positions', v_game.mine_positions,
      'server_seed', v_game.server_seed,
      'server_seed_hash', v_game.server_seed_hash,
      'client_seed', v_game.client_seed,
      'nonce', v_game.nonce,
      'new_balance', v_new_balance
    );
  END IF;

  -- Normal safe reveal (continue playing)
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
    'auto_cashout', false
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- CASHOUT
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

  SELECT id INTO v_wallet_id FROM wallets WHERE user_id = v_user_id FOR UPDATE;
  UPDATE wallets SET balance = balance + v_payout, updated_at = now()
  WHERE id = v_wallet_id
  RETURNING balance INTO v_new_balance;

  INSERT INTO transactions (wallet_id, type, amount, balance_after, reference_id, description)
  VALUES (
    v_wallet_id, 'bet_won', v_payout, v_new_balance, p_game_id,
    '💎 Mines - Retirada ' || to_char(v_multiplier, 'FM990.00') || 'x'
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
-- GET ACTIVE GAME (seguro: não expõe mine_positions nem server_seed)
-- ============================================
CREATE OR REPLACE FUNCTION mines_get_active_game() RETURNS jsonb AS $$
DECLARE
  v_user_id uuid;
  v_game mines_games;
  v_multiplier numeric;
  v_payout numeric;
  v_revealed_count integer;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  SELECT * INTO v_game FROM mines_games
  WHERE user_id = v_user_id AND status = 'active'
  ORDER BY created_at DESC LIMIT 1;

  IF v_game.id IS NULL THEN
    RETURN NULL;
  END IF;

  v_revealed_count := coalesce(array_length(v_game.revealed_positions, 1), 0);
  v_multiplier := mines_compute_multiplier(v_revealed_count, v_game.mines_count);
  v_payout := floor(v_game.bet_amount * v_multiplier * 100) / 100;

  RETURN jsonb_build_object(
    'game_id', v_game.id,
    'bet_amount', v_game.bet_amount,
    'mines_count', v_game.mines_count,
    'revealed_positions', v_game.revealed_positions,
    'revealed_count', v_revealed_count,
    'multiplier', v_multiplier,
    'payout', v_payout,
    'server_seed_hash', v_game.server_seed_hash,
    'client_seed', v_game.client_seed,
    'nonce', v_game.nonce,
    'created_at', v_game.created_at
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================
-- GET RECENT GAMES (histórico, só jogos finalizados expõem seeds)
-- ============================================
CREATE OR REPLACE FUNCTION mines_get_recent_games(p_limit integer DEFAULT 20)
RETURNS SETOF jsonb AS $$
DECLARE
  v_user_id uuid;
  r mines_games;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  FOR r IN
    SELECT * FROM mines_games
    WHERE user_id = v_user_id
    ORDER BY created_at DESC
    LIMIT p_limit
  LOOP
    RETURN NEXT jsonb_build_object(
      'game_id', r.id,
      'bet_amount', r.bet_amount,
      'mines_count', r.mines_count,
      'status', r.status,
      'cashout_multiplier', r.cashout_multiplier,
      'cashout_amount', r.cashout_amount,
      'created_at', r.created_at,
      'ended_at', r.ended_at,
      'mine_positions', CASE WHEN r.status != 'active' THEN r.mine_positions ELSE NULL END,
      'server_seed', CASE WHEN r.status != 'active' THEN r.server_seed ELSE NULL END,
      'server_seed_hash', r.server_seed_hash,
      'client_seed', r.client_seed,
      'nonce', r.nonce
    );
  END LOOP;

  RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION mines_start_game(numeric, integer, text, text, text, integer[]) TO authenticated;
GRANT EXECUTE ON FUNCTION mines_reveal_tile(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION mines_cashout(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION mines_get_active_game() TO authenticated;
GRANT EXECUTE ON FUNCTION mines_get_recent_games(integer) TO authenticated;
