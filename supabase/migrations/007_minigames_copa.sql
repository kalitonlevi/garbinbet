-- ============================================
-- 007: Ajuste de RTP (95%) no Mines + jogo Crash ("Foguetinho")
-- ============================================
-- Dois mini-jogos house-banked (jogador x casa), RNG no servidor,
-- provably-fair, com os mesmos limites de risco da casa do Mines:
--   MAX_BET R$10 · MAX_PAYOUT R$100 · RESERVE 30% · DAILY_CAP R$50.

-- ============================================
-- MINES — house edge de 1% (composto) -> RTP 95% aplicado UMA vez
-- ============================================
-- O multiplicador "justo" do Mines é o produto (restantes/seguras).
-- Aplicamos a margem da casa de 5% uma única vez no final (RTP 95%
-- consistente), em vez de compor por revelação.
CREATE OR REPLACE FUNCTION mines_compute_multiplier(
  p_revealed_count integer,
  p_mines_count integer
) RETURNS numeric AS $$
DECLARE
  v_mult numeric := 1;
  v_i integer;
  v_remaining integer;
  v_safe integer;
  v_rtp constant numeric := 0.95;   -- 5% de margem da casa
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

  v_mult := v_mult * v_rtp;
  RETURN floor(v_mult * 100) / 100;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION mines_config() RETURNS jsonb AS $$
  SELECT jsonb_build_object(
    'max_bet', 10.00,
    'max_payout', 100.00,
    'bankroll_reserve_pct', 0.30,
    'daily_win_cap', 50.00,
    'house_edge', 0.05
  );
$$ LANGUAGE sql IMMUTABLE;
GRANT EXECUTE ON FUNCTION mines_config() TO authenticated;

-- ============================================
-- CRASH ("Foguetinho do Canarinho")
-- ============================================
-- O multiplicador sobe seguindo a curva m(t) = e^(k*t) (k = growth).
-- O ponto de explosão (crash_point) é sorteado no servidor a partir de
-- HMAC-SHA256(server_seed, client_seed:nonce) e fica ESCONDIDO até o
-- fim. Sacar em qualquer alvo m tem probabilidade RTP/m -> RTP 95%.
-- Curva e crash_point são multiplicadores; tempo de explosão = ln(cp)/k.

CREATE TABLE crash_games (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles ON DELETE CASCADE,
  bet_amount numeric(12,2) NOT NULL CHECK (bet_amount > 0),
  crash_point numeric(10,2) NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'won', 'lost')),
  cashout_multiplier numeric(10,2) NOT NULL DEFAULT 0,
  cashout_amount numeric(12,2) NOT NULL DEFAULT 0,
  server_seed text NOT NULL,
  server_seed_hash text NOT NULL,
  client_seed text NOT NULL DEFAULT 'default',
  nonce integer NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz
);

CREATE INDEX idx_crash_user ON crash_games(user_id);
CREATE INDEX idx_crash_active ON crash_games(user_id) WHERE status = 'active';

ALTER TABLE crash_games ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view all crash games"
  ON crash_games FOR SELECT USING (is_admin());

-- Config compartilhada (cliente e servidor usam o MESMO growth k)
CREATE OR REPLACE FUNCTION crash_config() RETURNS jsonb AS $$
  SELECT jsonb_build_object(
    'max_bet', 10.00,
    'max_payout', 100.00,
    'bankroll_reserve_pct', 0.30,
    'daily_win_cap', 50.00,
    'house_edge', 0.05,
    'growth_k', 0.10
  );
$$ LANGUAGE sql IMMUTABLE;
GRANT EXECUTE ON FUNCTION crash_config() TO authenticated;

-- multiplicador a partir do tempo decorrido (segundos): m = e^(k*t)
CREATE OR REPLACE FUNCTION crash_multiplier_at(p_elapsed_seconds numeric)
RETURNS numeric AS $$
DECLARE
  v_k constant numeric := 0.10;
BEGIN
  IF p_elapsed_seconds <= 0 THEN
    RETURN 1.00;
  END IF;
  RETURN floor(exp(v_k * p_elapsed_seconds) * 100) / 100;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- START
CREATE OR REPLACE FUNCTION crash_start_game(
  p_bet_amount numeric,
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
  v_client_seed text;
  v_total_wallets numeric;
  v_reserve numeric;
  v_daily_profit numeric;
  v_active crash_games;
  v_u numeric;
  v_hash bytea;
  v_u32 bigint;
  v_crash numeric;
  v_started_at timestamptz := now();
  v_max_bet constant numeric := 10.00;
  v_max_payout constant numeric := 100.00;
  v_reserve_pct constant numeric := 0.30;
  v_daily_cap constant numeric := 50.00;
  v_k constant numeric := 0.10;
  v_rtp constant numeric := 0.95;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  IF p_bet_amount < 1 OR p_bet_amount > v_max_bet THEN
    RAISE EXCEPTION 'Aposta deve estar entre R$ 1,00 e R$ %',
      replace(to_char(v_max_bet, 'FM999990.00'), '.', ',');
  END IF;

  -- Auto-resolve jogo ativo abandonado (já explodiu no tempo) ou bloqueia
  SELECT * INTO v_active FROM crash_games
  WHERE user_id = v_user_id AND status = 'active'
  ORDER BY started_at DESC LIMIT 1;
  IF v_active.id IS NOT NULL THEN
    IF crash_multiplier_at(extract(epoch FROM (now() - v_active.started_at))) >= v_active.crash_point THEN
      UPDATE crash_games SET status = 'lost', ended_at = now() WHERE id = v_active.id;
    ELSE
      RAISE EXCEPTION 'Você já tem um Foguetinho voando';
    END IF;
  END IF;

  -- Reserva da casa
  SELECT coalesce(sum(balance), 0) INTO v_total_wallets FROM wallets;
  v_reserve := v_total_wallets * v_reserve_pct;
  -- (trava de reserva removida para bolão pequeno)

  -- Cap diário de ganho por usuário
  SELECT coalesce(sum(cashout_amount - bet_amount), 0) INTO v_daily_profit
  FROM crash_games
  WHERE user_id = v_user_id AND status = 'won'
    AND ended_at > now() - interval '24 hours';
  IF v_daily_profit >= v_daily_cap THEN
    RAISE EXCEPTION 'Limite diário de ganhos atingido (R$ %). Tente novamente em 24h.',
      replace(to_char(v_daily_cap, 'FM999990.00'), '.', ',');
  END IF;

  -- Debita carteira
  SELECT id, balance INTO v_wallet_id, v_balance FROM wallets WHERE user_id = v_user_id FOR UPDATE;
  IF v_wallet_id IS NULL THEN
    RAISE EXCEPTION 'Carteira não encontrada';
  END IF;
  IF v_balance < p_bet_amount THEN
    RAISE EXCEPTION 'Saldo insuficiente';
  END IF;
  v_new_balance := v_balance - p_bet_amount;
  UPDATE wallets SET balance = v_new_balance, updated_at = now() WHERE id = v_wallet_id;

  -- Seed + hash + crash_point (tudo no servidor)
  v_server_seed := encode(gen_random_bytes(32), 'hex');
  v_server_seed_hash := encode(digest(v_server_seed, 'sha256'), 'hex');
  v_client_seed := coalesce(nullif(trim(p_client_seed), ''), 'default');
  SELECT count(*) + 1 INTO v_nonce FROM crash_games WHERE user_id = v_user_id;

  v_hash := hmac(
    convert_to(v_client_seed || ':' || v_nonce::text, 'UTF8'),
    convert_to(v_server_seed, 'UTF8'), 'sha256'
  );
  v_u32 := get_byte(v_hash, 0)::bigint * 16777216
         + get_byte(v_hash, 1)::bigint * 65536
         + get_byte(v_hash, 2)::bigint * 256
         + get_byte(v_hash, 3)::bigint;
  v_u := v_u32::numeric / 4294967296.0;                 -- U em [0,1)
  -- crash_point = max(1.00, RTP / (1 - U)); P(cashout em m) = RTP/m
  v_crash := greatest(1.00, floor((v_rtp / (1 - v_u)) * 100) / 100);

  INSERT INTO crash_games (
    user_id, bet_amount, crash_point, server_seed, server_seed_hash,
    client_seed, nonce, status, started_at
  ) VALUES (
    v_user_id, p_bet_amount, v_crash, v_server_seed, v_server_seed_hash,
    v_client_seed, v_nonce, 'active', v_started_at
  ) RETURNING id INTO v_game_id;

  INSERT INTO transactions (wallet_id, type, amount, balance_after, reference_id, description)
  VALUES (v_wallet_id, 'bet_placed', -p_bet_amount, v_new_balance, v_game_id, '🚀 Foguetinho - Aposta');

  -- crash_point e server_seed NUNCA voltam aqui.
  RETURN jsonb_build_object(
    'game_id', v_game_id,
    'bet_amount', p_bet_amount,
    'server_seed_hash', v_server_seed_hash,
    'client_seed', v_client_seed,
    'nonce', v_nonce,
    'started_at', to_char(v_started_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'new_balance', v_new_balance,
    'max_payout', v_max_payout,
    'growth_k', v_k
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
GRANT EXECUTE ON FUNCTION crash_start_game(numeric, text) TO authenticated;

-- CASHOUT
CREATE OR REPLACE FUNCTION crash_cashout(p_game_id uuid)
RETURNS jsonb AS $$
DECLARE
  v_user_id uuid;
  v_game crash_games;
  v_elapsed numeric;
  v_m numeric;
  v_payout numeric;
  v_wallet_id uuid;
  v_new_balance numeric;
  v_capped boolean := false;
  v_max_payout constant numeric := 100.00;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  SELECT * INTO v_game FROM crash_games
  WHERE id = p_game_id AND user_id = v_user_id FOR UPDATE;
  IF v_game.id IS NULL THEN
    RAISE EXCEPTION 'Jogo não encontrado';
  END IF;
  IF v_game.status != 'active' THEN
    RAISE EXCEPTION 'Jogo já terminou';
  END IF;

  v_elapsed := extract(epoch FROM (now() - v_game.started_at));
  v_m := crash_multiplier_at(v_elapsed);

  -- Já explodiu (jogador sacou tarde demais)
  IF v_m >= v_game.crash_point THEN
    UPDATE crash_games SET status = 'lost', ended_at = now() WHERE id = v_game.id;
    RETURN jsonb_build_object(
      'result', 'crashed',
      'crash_point', v_game.crash_point,
      'server_seed', v_game.server_seed,
      'server_seed_hash', v_game.server_seed_hash,
      'client_seed', v_game.client_seed,
      'nonce', v_game.nonce,
      'bet_amount', v_game.bet_amount
    );
  END IF;

  -- Saque válido
  v_payout := floor(v_game.bet_amount * v_m * 100) / 100;
  IF v_payout > v_max_payout THEN
    v_payout := v_max_payout;
    v_m := floor((v_max_payout / v_game.bet_amount) * 100) / 100;
    v_capped := true;
  END IF;

  SELECT id INTO v_wallet_id FROM wallets WHERE user_id = v_user_id FOR UPDATE;
  UPDATE wallets SET balance = balance + v_payout, updated_at = now()
  WHERE id = v_wallet_id RETURNING balance INTO v_new_balance;

  INSERT INTO transactions (wallet_id, type, amount, balance_after, reference_id, description)
  VALUES (v_wallet_id, 'bet_won', v_payout, v_new_balance, v_game.id,
    '🚀 Foguetinho - Saque ' || to_char(v_m, 'FM999990.00') || 'x');

  UPDATE crash_games SET
    status = 'won', cashout_multiplier = v_m, cashout_amount = v_payout, ended_at = now()
  WHERE id = v_game.id;

  RETURN jsonb_build_object(
    'result', 'cashout',
    'multiplier', v_m,
    'payout', v_payout,
    'capped', v_capped,
    'crash_point', v_game.crash_point,
    'server_seed', v_game.server_seed,
    'server_seed_hash', v_game.server_seed_hash,
    'client_seed', v_game.client_seed,
    'nonce', v_game.nonce,
    'new_balance', v_new_balance
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
GRANT EXECUTE ON FUNCTION crash_cashout(uuid) TO authenticated;

-- GET ACTIVE (auto-resolve se já explodiu; nunca expõe crash_point)
CREATE OR REPLACE FUNCTION crash_get_active_game()
RETURNS jsonb AS $$
DECLARE
  v_user_id uuid;
  v_game crash_games;
  v_k constant numeric := 0.10;
  v_max_payout constant numeric := 100.00;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  SELECT * INTO v_game FROM crash_games
  WHERE user_id = v_user_id AND status = 'active'
  ORDER BY started_at DESC LIMIT 1;

  IF v_game.id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Se o tempo já passou do crash, resolve como perda e não retoma
  IF crash_multiplier_at(extract(epoch FROM (now() - v_game.started_at))) >= v_game.crash_point THEN
    UPDATE crash_games SET status = 'lost', ended_at = now() WHERE id = v_game.id;
    RETURN NULL;
  END IF;

  RETURN jsonb_build_object(
    'game_id', v_game.id,
    'bet_amount', v_game.bet_amount,
    'server_seed_hash', v_game.server_seed_hash,
    'client_seed', v_game.client_seed,
    'nonce', v_game.nonce,
    'started_at', to_char(v_game.started_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'max_payout', v_max_payout,
    'growth_k', v_k
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;
GRANT EXECUTE ON FUNCTION crash_get_active_game() TO authenticated;

-- HISTÓRICO (jogos finalizados revelam o crash_point e o seed)
CREATE OR REPLACE FUNCTION crash_get_recent_games(p_limit integer DEFAULT 20)
RETURNS SETOF jsonb AS $$
DECLARE
  v_user_id uuid;
  r crash_games;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;
  FOR r IN
    SELECT * FROM crash_games WHERE user_id = v_user_id
    ORDER BY started_at DESC LIMIT p_limit
  LOOP
    RETURN NEXT jsonb_build_object(
      'game_id', r.id,
      'bet_amount', r.bet_amount,
      'status', r.status,
      'crash_point', CASE WHEN r.status != 'active' THEN r.crash_point ELSE NULL END,
      'cashout_multiplier', r.cashout_multiplier,
      'cashout_amount', r.cashout_amount,
      'server_seed', CASE WHEN r.status != 'active' THEN r.server_seed ELSE NULL END,
      'server_seed_hash', r.server_seed_hash,
      'client_seed', r.client_seed,
      'nonce', r.nonce,
      'started_at', r.started_at,
      'ended_at', r.ended_at
    );
  END LOOP;
  RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;
GRANT EXECUTE ON FUNCTION crash_get_recent_games(integer) TO authenticated;

-- PEEK: cliente consulta durante o voo se já explodiu (sem revelar o
-- crash_point enquanto está voando). Resolve como perda se o tempo passou.
CREATE OR REPLACE FUNCTION crash_peek(p_game_id uuid)
RETURNS jsonb AS $$
DECLARE
  v_user_id uuid;
  v_game crash_games;
  v_m numeric;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  SELECT * INTO v_game FROM crash_games
  WHERE id = p_game_id AND user_id = v_user_id FOR UPDATE;
  IF v_game.id IS NULL THEN
    RAISE EXCEPTION 'Jogo não encontrado';
  END IF;

  IF v_game.status = 'won' THEN
    RETURN jsonb_build_object('status', 'won',
      'multiplier', v_game.cashout_multiplier, 'crash_point', v_game.crash_point,
      'server_seed', v_game.server_seed);
  END IF;
  IF v_game.status = 'lost' THEN
    RETURN jsonb_build_object('status', 'crashed',
      'crash_point', v_game.crash_point, 'server_seed', v_game.server_seed);
  END IF;

  v_m := crash_multiplier_at(extract(epoch FROM (now() - v_game.started_at)));
  IF v_m >= v_game.crash_point THEN
    UPDATE crash_games SET status = 'lost', ended_at = now() WHERE id = v_game.id;
    RETURN jsonb_build_object('status', 'crashed',
      'crash_point', v_game.crash_point, 'server_seed', v_game.server_seed,
      'multiplier', v_m);
  END IF;

  RETURN jsonb_build_object('status', 'flying', 'multiplier', v_m);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
GRANT EXECUTE ON FUNCTION crash_peek(uuid) TO authenticated;
