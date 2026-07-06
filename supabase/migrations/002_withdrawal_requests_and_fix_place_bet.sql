-- ============================================
-- 002: Fix place_bet min/max + withdrawal_requests
-- ============================================

-- ============================================
-- FIX: place_bet — add min R$1 / max R$200 validation
-- ============================================

CREATE OR REPLACE FUNCTION place_bet(
  p_user_id uuid,
  p_market_id uuid,
  p_option_id uuid,
  p_amount numeric,
  p_idempotency_key uuid
)
RETURNS bets AS $$
DECLARE
  v_market markets;
  v_wallet wallets;
  v_option market_options;
  v_pool_total numeric;
  v_option_pool numeric;
  v_odds numeric;
  v_potential_payout numeric;
  v_bet bets;
  v_existing_bet uuid;
BEGIN
  -- Check idempotency
  SELECT id INTO v_existing_bet FROM bets WHERE idempotency_key = p_idempotency_key;
  IF v_existing_bet IS NOT NULL THEN
    SELECT * INTO v_bet FROM bets WHERE id = v_existing_bet;
    RETURN v_bet;
  END IF;

  -- Validate min/max amount
  IF p_amount < 1 THEN
    RAISE EXCEPTION 'Aposta minima e R$ 1,00';
  END IF;

  IF p_amount > 200 THEN
    RAISE EXCEPTION 'Aposta maxima e R$ 200,00';
  END IF;

  -- Verify market is open
  SELECT * INTO v_market FROM markets WHERE id = p_market_id;
  IF v_market.status != 'open' THEN
    RAISE EXCEPTION 'Mercado nao esta aberto para apostas';
  END IF;

  -- Verify user has no existing bet on this market
  IF EXISTS (SELECT 1 FROM bets WHERE user_id = p_user_id AND market_id = p_market_id) THEN
    RAISE EXCEPTION 'Voce ja apostou neste mercado';
  END IF;

  -- Lock wallet
  SELECT * INTO v_wallet FROM wallets WHERE user_id = p_user_id FOR UPDATE;
  IF v_wallet IS NULL THEN
    RAISE EXCEPTION 'Carteira nao encontrada';
  END IF;

  -- Check balance
  IF v_wallet.balance < p_amount THEN
    RAISE EXCEPTION 'Saldo insuficiente';
  END IF;

  -- Get option info
  SELECT * INTO v_option FROM market_options WHERE id = p_option_id AND market_id = p_market_id;
  IF v_option IS NULL THEN
    RAISE EXCEPTION 'Opcao invalida';
  END IF;

  -- Calculate odds (pari-mutuel)
  SELECT COALESCE(SUM(total_pool), 0) INTO v_pool_total FROM market_options WHERE market_id = p_market_id;
  v_option_pool := v_option.total_pool;

  -- Add current bet to pools for odds calculation
  v_pool_total := v_pool_total + p_amount;
  v_option_pool := v_option_pool + p_amount;

  IF v_option_pool > 0 THEN
    v_odds := v_pool_total / v_option_pool;
  ELSE
    v_odds := 2.0;
  END IF;

  -- Potential payout with 10% commission
  v_potential_payout := ROUND(p_amount * v_odds * 0.90, 2);

  -- Debit wallet
  UPDATE wallets
    SET balance = balance - p_amount, updated_at = now()
    WHERE id = v_wallet.id;

  -- Insert bet
  INSERT INTO bets (user_id, market_id, option_id, amount, potential_payout, idempotency_key)
  VALUES (p_user_id, p_market_id, p_option_id, p_amount, v_potential_payout, p_idempotency_key)
  RETURNING * INTO v_bet;

  -- Update market option pool
  UPDATE market_options
    SET total_pool = total_pool + p_amount
    WHERE id = p_option_id;

  -- Record transaction
  INSERT INTO transactions (wallet_id, type, amount, balance_after, reference_id, description)
  VALUES (
    v_wallet.id,
    'bet_placed',
    -p_amount,
    v_wallet.balance - p_amount,
    v_bet.id,
    'Aposta: ' || v_option.label
  );

  RETURN v_bet;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- NEW TABLE: withdrawal_requests
-- ============================================

CREATE TABLE withdrawal_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles ON DELETE CASCADE,
  amount numeric(12,2) NOT NULL CHECK (amount >= 1),
  pix_key text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);

CREATE INDEX idx_withdrawal_requests_user ON withdrawal_requests(user_id);
CREATE INDEX idx_withdrawal_requests_status ON withdrawal_requests(status);

-- ============================================
-- RLS: withdrawal_requests
-- ============================================

ALTER TABLE withdrawal_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own withdrawal requests"
  ON withdrawal_requests FOR SELECT
  USING (user_id = auth.uid() OR is_admin());

CREATE POLICY "Users can insert own withdrawal requests"
  ON withdrawal_requests FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admin can update withdrawal requests"
  ON withdrawal_requests FOR UPDATE
  USING (is_admin());

-- ============================================
-- FUNCTION: approve_withdrawal
-- ============================================

CREATE OR REPLACE FUNCTION approve_withdrawal(p_request_id uuid)
RETURNS void AS $$
DECLARE
  v_request withdrawal_requests;
  v_wallet wallets;
  v_new_balance numeric;
BEGIN
  -- Get request
  SELECT * INTO v_request FROM withdrawal_requests WHERE id = p_request_id;
  IF v_request IS NULL THEN
    RAISE EXCEPTION 'Solicitacao nao encontrada';
  END IF;
  IF v_request.status != 'pending' THEN
    RAISE EXCEPTION 'Solicitacao ja foi processada';
  END IF;

  -- Lock wallet
  SELECT * INTO v_wallet FROM wallets WHERE user_id = v_request.user_id FOR UPDATE;
  IF v_wallet IS NULL THEN
    RAISE EXCEPTION 'Carteira nao encontrada';
  END IF;

  -- Check balance
  IF v_wallet.balance < v_request.amount THEN
    RAISE EXCEPTION 'Saldo insuficiente do usuario';
  END IF;

  -- Debit wallet
  v_new_balance := v_wallet.balance - v_request.amount;
  UPDATE wallets SET balance = v_new_balance, updated_at = now()
    WHERE id = v_wallet.id;

  -- Record transaction
  INSERT INTO transactions (wallet_id, type, amount, balance_after, reference_id, description)
  VALUES (
    v_wallet.id,
    'withdraw',
    -v_request.amount,
    v_new_balance,
    v_request.id,
    'Saque aprovado - PIX: ' || v_request.pix_key
  );

  -- Update request status
  UPDATE withdrawal_requests
    SET status = 'approved', processed_at = now()
    WHERE id = p_request_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- FUNCTION: reject_withdrawal
-- ============================================

CREATE OR REPLACE FUNCTION reject_withdrawal(p_request_id uuid, p_note text DEFAULT NULL)
RETURNS void AS $$
DECLARE
  v_request withdrawal_requests;
BEGIN
  SELECT * INTO v_request FROM withdrawal_requests WHERE id = p_request_id;
  IF v_request IS NULL THEN
    RAISE EXCEPTION 'Solicitacao nao encontrada';
  END IF;
  IF v_request.status != 'pending' THEN
    RAISE EXCEPTION 'Solicitacao ja foi processada';
  END IF;

  UPDATE withdrawal_requests
    SET status = 'rejected', admin_note = p_note, processed_at = now()
    WHERE id = p_request_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
